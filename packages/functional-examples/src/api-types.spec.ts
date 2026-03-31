import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type JsonObject = Record<string, unknown>;

const KIND: Record<number, string> = {
  64: 'function',
  128: 'class',
  256: 'interface',
  512: 'constructor',
  1024: 'property',
  2048: 'method',
  4096: 'call',
  8192: 'index',
  16384: 'signature',
  32768: 'param',
  2097152: 'type',
};

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? (value as JsonObject[]) : [];
}

function nameOf(obj: JsonObject): string {
  return typeof obj.name === 'string' ? obj.name : '';
}

function sortByName(items: JsonObject[]): JsonObject[] {
  return [...items].sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
}

function renderType(type: unknown): string {
  if (!type || typeof type !== 'object') return 'unknown';
  const t = type as JsonObject;
  const tag = t.type;

  if (tag === 'intrinsic' || tag === 'reference') {
    const base = String(t.name ?? 'unknown');
    const args = asArray(t.typeArguments).map(renderType);
    return args.length > 0 ? `${base}<${args.join(', ')}>` : base;
  }

  if (tag === 'array') {
    return `${renderType(t.elementType)}[]`;
  }

  if (tag === 'union') {
    return asArray(t.types).map(renderType).join(' | ');
  }

  if (tag === 'intersection') {
    return asArray(t.types).map(renderType).join(' & ');
  }

  if (tag === 'tuple') {
    return `[${asArray(t.elements).map(renderType).join(', ')}]`;
  }

  if (tag === 'literal') {
    return JSON.stringify(t.value);
  }

  if (tag === 'typeOperator') {
    return `${String(t.operator ?? '')} ${renderType(t.target)}`.trim();
  }

  if (tag === 'reflection') {
    const decl = (t.declaration ?? {}) as JsonObject;
    const callSigs = asArray(decl.signatures);
    if (callSigs.length > 0) {
      return callSigs.map(renderSignature).join(' | ');
    }
    const children = sortByName(asArray(decl.children)).map((child) => {
      const optional = isOptional(child) ? '?' : '';
      const propType = renderType(child.type);
      return `${nameOf(child)}${optional}: ${propType}`;
    });
    return `{ ${children.join('; ')} }`;
  }

  if (tag === 'query') {
    return `typeof ${String((t.queryType as JsonObject)?.name ?? 'unknown')}`;
  }

  if (tag === 'predicate') {
    const target = String((t.targetType as JsonObject)?.name ?? t.name ?? 'value');
    return `${target} is ${renderType(t.type)}`;
  }

  if (tag === 'indexedAccess') {
    return `${renderType(t.objectType)}[${renderType(t.indexType)}]`;
  }

  if (tag === 'conditional') {
    return `${renderType(t.checkType)} extends ${renderType(t.extendsType)} ? ${renderType(t.trueType)} : ${renderType(t.falseType)}`;
  }

  if (tag === 'mapped') {
    return `{ [K in ${renderType(t.parameterType)}]: ${renderType(t.templateType)} }`;
  }

  if (tag === 'templateLiteral') {
    const head = String(t.head ?? '');
    const tail = asArray(t.tail)
      .map((part) => `${renderType((part as JsonObject).type)}${String((part as JsonObject).text ?? '')}`)
      .join('');
    return `\`${head}\${${tail}}\``;
  }

  return String(tag ?? 'unknown');
}

function isOptional(obj: JsonObject): boolean {
  const flags = (obj.flags ?? {}) as JsonObject;
  return flags.isOptional === true;
}

function isReadonly(obj: JsonObject): boolean {
  const flags = (obj.flags ?? {}) as JsonObject;
  return flags.isReadonly === true;
}

function typeParams(obj: JsonObject): string {
  const params = asArray(obj.typeParameters);
  if (params.length === 0) return '';
  return `<${params.map((p) => {
    const n = nameOf(p);
    const constraint = p.type ? ` extends ${renderType(p.type)}` : '';
    const defaultType = p.default ? ` = ${renderType(p.default)}` : '';
    return `${n}${constraint}${defaultType}`;
  }).join(', ')}>`;
}

function renderParam(param: JsonObject): string {
  const flags = (param.flags ?? {}) as JsonObject;
  const rest = flags.isRest ? '...' : '';
  const optional = isOptional(param) ? '?' : '';
  return `${rest}${nameOf(param)}${optional}: ${renderType(param.type)}`;
}

function renderSignature(sig: JsonObject): string {
  const params = asArray(sig.parameters).map(renderParam).join(', ');
  const returns = renderType(sig.type);
  return `${typeParams(sig)}(${params}) => ${returns}`;
}

function renderMember(member: JsonObject, scope: string): string[] {
  const kind = Number(member.kind ?? 0);
  const kindLabel = KIND[kind] ?? `kind:${kind}`;
  const memberName = nameOf(member);
  const lines: string[] = [];

  if (kind === 1024) {
    const readonly = isReadonly(member) ? 'readonly ' : '';
    const optional = isOptional(member) ? '?' : '';
    lines.push(`${scope}${readonly}${memberName}${optional}: ${renderType(member.type)}`);
    return lines;
  }

  const signatures = asArray(member.signatures);
  if (signatures.length > 0) {
    for (const sig of signatures) {
      if (kind === 512) {
        lines.push(`${scope}new ${renderSignature(sig)}`);
      } else {
        const optional = isOptional(member) ? '?' : '';
        lines.push(`${scope}${memberName}${optional}${renderSignature(sig)}`);
      }
    }
    return lines;
  }

  if (member.type) {
    lines.push(`${scope}${memberName}: ${renderType(member.type)}`);
    return lines;
  }

  lines.push(`${scope}${kindLabel} ${memberName}`);
  return lines;
}

function hasRelevantSource(obj: JsonObject): boolean {
  const sources = asArray(obj.sources);
  if (sources.length === 0) return true;
  return sources.some((source) => {
    const fileName = String(source.fileName ?? '');
    return !fileName.includes('node_modules/');
  });
}

function renderDeclaration(decl: JsonObject): string[] {
  const kind = Number(decl.kind ?? 0);
  const kindLabel = KIND[kind] ?? `kind:${kind}`;
  const header = `${kindLabel} ${nameOf(decl)}${typeParams(decl)}`;
  const lines = [header];

  const signatures = asArray(decl.signatures);
  if (signatures.length > 0) {
    for (const sig of signatures) {
      lines.push(`  ${renderSignature(sig)}`);
    }
  }

  if (decl.type && kind === 2097152) {
    lines.push(`  = ${renderType(decl.type)}`);
  } else if (decl.type && kind !== 64) {
    lines.push(`  : ${renderType(decl.type)}`);
  }

  const members = sortByName(asArray(decl.children).filter(hasRelevantSource));
  for (const member of members) {
    lines.push(...renderMember(member, '  '));
  }

  return lines;
}

function renderApiSnapshot(json: JsonObject): string {
  const out: string[] = [];
  const decls = sortByName(asArray(json.children));
  for (const decl of decls) {
    out.push(...renderDeclaration(decl), '');
  }
  return out.join('\n').trim();
}

function generateTypeDocJson(): Record<string, unknown> {
  const testFilePath = fileURLToPath(import.meta.url);
  const packageRoot = path.resolve(path.dirname(testFilePath), '..');
  const tempDir = mkdtempSync(path.join(tmpdir(), 'typedoc-fe-'));
  const outputPath = path.join(tempDir, 'api.json');

  try {
    const result = spawnSync(
      'pnpm',
      ['exec', 'typedoc', '--options', 'typedoc.json', '--json', outputPath],
      {
        cwd: packageRoot,
        encoding: 'utf8',
        shell: true,
      }
    );

    if (result.status !== 0) {
      throw new Error(
        `typedoc failed (${result.status}):\n${result.stdout}\n${result.stderr}`
      );
    }

    return JSON.parse(readFileSync(outputPath, 'utf8')) as Record<
      string,
      unknown
    >;
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

describe('public API types', () => {
  it('matches typedoc export snapshot', { timeout: 30_000 }, () => {
    const json = generateTypeDocJson();
    const snapshot = renderApiSnapshot(json);
    expect(snapshot).toMatchSnapshot();
  });
});

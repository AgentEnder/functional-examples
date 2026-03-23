/** Convert camelCase/PascalCase to kebab-case for URL slugs. */
export function slugify(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toLowerCase()
    .replace(/^-|-$/g, '');
}

/** Extract plain text from TypeDoc comment parts. */
export function extractCommentText(
  parts?: Array<{ kind: string; text: string }>
): string | undefined {
  if (!parts || parts.length === 0) return undefined;
  return (
    parts
      .map((p) => {
        // TypeDoc's TSDoc parser mangles `*\/` (the JSDoc workaround for
        // literal `*/` inside block comments) into `*\` — it drops the `/`.
        // Within code blocks, restore `*\` at end-of-line to `*/`.
        if (p.kind === 'code') {
          return p.text.replace(/\*\\$/gm, '*/');
        }
        return p.text;
      })
      .join('')
      .trim() || undefined
  );
}

/**
 * Strip markdown code fences from example blocks.
 * TypeDoc includes ```language ... ``` markers in examples.
 */
export function stripCodeFences(text: string): string {
  const match = text.match(/^```\w*\n?([\s\S]*?)\n?```$/);
  if (match) {
    return match[1].trim();
  }
  return text;
}

/**
 * TypeDoc comment shape (works with both raw JSON and deserialized objects).
 * Kept minimal to avoid depending on specific TypeDoc version types.
 */
interface TypeDocCommentLike {
  summary?: Array<{ kind: string; text: string }>;
  blockTags?: Array<{
    tag: string;
    content: Array<{ kind: string; text: string }>;
  }>;
}

/** Extract @category tag from a TypeDoc comment. */
export function extractCategory(
  comment?: TypeDocCommentLike
): string | undefined {
  if (!comment?.blockTags) return undefined;

  for (const tag of comment.blockTags) {
    if (tag.tag === '@category') {
      return extractCommentText(tag.content);
    }
  }

  return undefined;
}

import { describe, it, expect } from 'vitest';
import {
  parseRegions,
  extractRegion,
  stripRegionMarkers,
  listRegions,
} from './parser.js';

describe('parseRegions', () => {
  describe('JavaScript/TypeScript style', () => {
    it('parses single region', () => {
      const code = `
const before = 1;
// #region setup
const x = 1;
const y = 2;
// #endregion setup
const after = 2;
`;
      const regions = parseRegions(code, { extension: 'ts' });

      expect(regions.setup).toBeDefined();
      expect(regions.setup.content).toBe('const x = 1;\nconst y = 2;');
      expect(regions.setup.startLine).toBe(3);
      expect(regions.setup.endLine).toBe(6);
    });

    it('parses multiple regions', () => {
      const code = `
// #region imports
import { foo } from 'bar';
// #endregion imports
// #region main
console.log('hello');
// #endregion main
`;
      const regions = parseRegions(code, { extension: 'js' });

      expect(Object.keys(regions)).toEqual(['imports', 'main']);
      expect(regions.imports.content).toBe("import { foo } from 'bar';");
      expect(regions.main.content).toBe("console.log('hello');");
    });

    it('parses nested regions', () => {
      const code = `
// #region outer
const a = 1;
// #region inner
const b = 2;
// #endregion inner
const c = 3;
// #endregion outer
`;
      const regions = parseRegions(code, { extension: 'ts' });

      expect(regions.outer.content).toBe(
        'const a = 1;\nconst b = 2;\nconst c = 3;'
      );
      expect(regions.inner.content).toBe('const b = 2;');
    });

    it('throws on unclosed region', () => {
      const code = `
// #region unclosed
const x = 1;
`;
      expect(() => parseRegions(code, { extension: 'ts' })).toThrow(
        "Unclosed region 'unclosed'"
      );
    });

    it('throws on mismatched region', () => {
      const code = `
// #region foo
// #endregion bar
`;
      expect(() => parseRegions(code, { extension: 'ts' })).toThrow(
        "Mismatched region: opened 'foo'"
      );
    });

    it('throws on unexpected endregion', () => {
      const code = `
// #endregion orphan
`;
      expect(() => parseRegions(code, { extension: 'ts' })).toThrow(
        "Unexpected #endregion 'orphan'"
      );
    });
  });

  describe('Python style', () => {
    it('parses regions with hash comments', () => {
      const code = `
import os
# #region setup
db = create_connection()
# #endregion setup
`;
      const regions = parseRegions(code, { extension: 'py' });

      expect(regions.setup.content).toBe('db = create_connection()');
    });
  });

  describe('SQL style', () => {
    it('parses regions with double-dash comments', () => {
      const code = `
SELECT * FROM users;
-- #region migration
ALTER TABLE users ADD COLUMN email VARCHAR(255);
-- #endregion migration
`;
      const regions = parseRegions(code, { extension: 'sql' });

      expect(regions.migration.content).toBe(
        'ALTER TABLE users ADD COLUMN email VARCHAR(255);'
      );
    });
  });

  describe('HTML style', () => {
    it('parses regions with HTML comments', () => {
      const code = `
<html>
<!-- #region header -->
<head><title>Test</title></head>
<!-- #endregion header -->
</html>
`;
      const regions = parseRegions(code, { extension: 'html' });

      expect(regions.header.content).toBe('<head><title>Test</title></head>');
    });
  });

  describe('CSS style', () => {
    it('parses regions with block comments', () => {
      const code = `
body { margin: 0; }
/* #region theme */
.dark { background: black; }
/* #endregion theme */
`;
      const regions = parseRegions(code, { extension: 'css' });

      expect(regions.theme.content).toBe('.dark { background: black; }');
    });
  });
});

describe('extractRegion', () => {
  it('extracts specific region', () => {
    const code = `
// #region setup
const x = 1;
// #endregion setup
// #region main
const y = 2;
// #endregion main
`;
    const setup = extractRegion(code, 'setup', { extension: 'ts' });
    expect(setup).toBe('const x = 1;');
  });

  it('throws with helpful message when region not found', () => {
    const code = `
// #region existing
code();
// #endregion existing
`;
    expect(() => extractRegion(code, 'missing', { extension: 'ts' })).toThrow(
      "Region 'missing' not found. Available regions: existing"
    );
  });

  it('provides hint when no regions exist', () => {
    const code = `const x = 1;`;
    expect(() => extractRegion(code, 'missing', { extension: 'ts' })).toThrow(
      'No regions found in code'
    );
  });
});

describe('stripRegionMarkers', () => {
  it('removes all region markers', () => {
    const code = `
const before = 1;
// #region setup
const x = 1;
// #endregion setup
const after = 2;
`;
    const stripped = stripRegionMarkers(code, { extension: 'ts' });

    expect(stripped).not.toContain('#region');
    expect(stripped).not.toContain('#endregion');
    expect(stripped).toContain('const x = 1;');
    expect(stripped).toContain('const before = 1;');
    expect(stripped).toContain('const after = 2;');
  });

  it('handles multiple language styles', () => {
    const pyCode = `
# #region test
code()
# #endregion test
`;
    const stripped = stripRegionMarkers(pyCode, { extension: 'py' });
    expect(stripped.trim()).toBe('code()');
  });
});

describe('listRegions', () => {
  it('returns all region IDs', () => {
    const code = `
// #region a
// #endregion a
// #region b
// #endregion b
// #region c
// #endregion c
`;
    const ids = listRegions(code, { extension: 'ts' });
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array when no regions', () => {
    const code = `const x = 1;`;
    const ids = listRegions(code, { extension: 'ts' });
    expect(ids).toEqual([]);
  });
});

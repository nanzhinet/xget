// @vitest-environment node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const workflowPath = fileURLToPath(
  new URL('../../.github/workflows/commitlint.yml', import.meta.url)
).replace(/^\/([A-Za-z]:[\\/])/, '$1');
const workflow = readFileSync(workflowPath, 'utf8');

describe('commitlint workflow', () => {
  it('skips validation for Dependabot PR branches', () => {
    expect(workflow).toContain("!startsWith(github.head_ref, 'dependabot/')");
  });
});

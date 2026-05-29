import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

describe('Package manifest', () => {
  it('does not depend on itself', () => {
    const require = createRequire(import.meta.url);
    const packageJson = require('../../package.json');
    const { dependencies } = packageJson;
    const typedDependencies = /** @type {Record<string, string> | undefined} */ (dependencies);

    expect(packageJson.name).toBe('xget');
    expect(typedDependencies?.xget).toBeUndefined();
  });
});

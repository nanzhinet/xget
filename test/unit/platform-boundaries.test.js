import { describe, expect, it } from 'vitest';

import { PLATFORM_CATALOG } from '../../src/config/platform-catalog.js';
import { PLATFORMS, SORTED_PLATFORMS, transformPath } from '../../src/config/platforms.js';
import { getPlatformPathPrefix } from '../../src/routing/platform-index.js';
import { transformPath as transformPlatformPath } from '../../src/routing/platform-transformers.js';

describe('Platform module boundaries', () => {
  it('keeps the compatibility export wired to the platform catalog', () => {
    expect(PLATFORMS).toBe(PLATFORM_CATALOG);
  });

  it('sorts platform keys by the longest routable prefix first', () => {
    const prefixLengths = SORTED_PLATFORMS.map(
      platformKey => getPlatformPathPrefix(platformKey).length
    );

    prefixLengths.forEach((length, index) => {
      if (index < prefixLengths.length - 1) {
        expect(length).toBeGreaterThanOrEqual(prefixLengths[index + 1]);
      }
    });
  });

  it('routes legacy transform imports through the dedicated transformer module', () => {
    expect(transformPath('/crates/?q=tokio', 'crates')).toBe(
      transformPlatformPath('/crates/?q=tokio', 'crates')
    );
    expect(transformPath('/jenkins/test-path', 'jenkins')).toBe('/current/test-path');
  });
});

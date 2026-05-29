import { describe, expect, it } from 'vitest';

import { CONFIG } from '../../src/config/index.js';
import {
  isImmutableArtifactRequest,
  resolveCachePolicy,
  resolveResponseCachePolicy
} from '../../src/upstream/cache-policy.js';

const requestContext = {
  isAI: false,
  isDocker: false,
  isGit: false,
  isGitLFS: false,
  isHF: false
};

/**
 * Resolves a cache policy with common non-protocol request defaults.
 * @param {Partial<Parameters<typeof resolveCachePolicy>[0]>} overrides Policy inputs to override.
 * @returns {ReturnType<typeof resolveCachePolicy>} Resolved cache policy.
 */
function resolvePolicy(overrides = {}) {
  return resolveCachePolicy({
    canUseCache: true,
    config: CONFIG,
    effectivePath: '/gh/user/repo/file.txt',
    hasSensitiveHeaders: false,
    platform: 'gh',
    request: new Request('https://example.com/gh/user/repo/file.txt'),
    requestContext,
    targetUrl: 'https://github.com/user/repo/file.txt',
    ...overrides
  });
}

describe('Cache policy edge coverage', () => {
  it('uses metadata caching for Maven metadata files', () => {
    const policy = resolvePolicy({
      effectivePath: '/maven/maven2/org/example/demo/maven-metadata.xml',
      platform: 'maven',
      request: new Request('https://example.com/maven/maven2/org/example/demo/maven-metadata.xml'),
      targetUrl: 'https://repo1.maven.org/maven2/org/example/demo/maven-metadata.xml'
    });

    expect(policy.cacheControl).toBe('public, max-age=0, s-maxage=60, must-revalidate');
    expect(policy.edgeTtl).toBe(60);
  });

  it('does not treat incomplete or malformed artifact paths as immutable', () => {
    expect(
      isImmutableArtifactRequest(
        'gh',
        '/gh/user/repo/releases/download/',
        'https://github.com/user/repo/releases/download/'
      )
    ).toBe(false);
    expect(
      isImmutableArtifactRequest(
        'pypi-files',
        '/pypi/files/packages/source/p/pkg/pkg-%E0%A4%A.tar.gz',
        ''
      )
    ).toBe(false);
  });

  it('treats Vary star as uncacheable at response time', () => {
    const basePolicy = resolvePolicy();
    const policy = resolveResponseCachePolicy({
      basePolicy,
      response: new Response('ok', {
        headers: {
          Vary: 'Accept-Encoding, *'
        }
      })
    });

    expect(policy.allowCacheApi).toBe(false);
    expect(policy.cacheControl).toBe('no-store');
  });

  it('ignores non-standard header objects that throw during response cache checks', () => {
    const basePolicy = resolvePolicy();
    const response = {
      headers: {
        get() {
          throw new Error('header get unavailable');
        },
        has() {
          throw new Error('header has unavailable');
        }
      }
    };

    const policy = resolveResponseCachePolicy({
      basePolicy,
      response: /** @type {Response} */ (/** @type {unknown} */ (response))
    });

    expect(policy).toBe(basePolicy);
  });
});

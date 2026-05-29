import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../src/index.js';

/** @type {ExecutionContext} */
const executionContext = {
  waitUntil() {},
  passThroughOnException() {}
};

describe('CORS and Proxy Request Options', () => {
  beforeEach(() => {
    vi.stubGlobal('caches', {
      default: {
        match: vi.fn(async () => null),
        put: vi.fn(async () => undefined)
      }
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not send a synthetic Origin header upstream', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    );

    const response = await worker.fetch(
      new Request('https://example.com/gh/test/repo/index.html'),
      {},
      executionContext
    );

    expect(response.status).toBe(200);
    const upstreamHeaders = new Headers(fetchSpy.mock.calls[0][1]?.headers);
    expect(upstreamHeaders.has('Origin')).toBe(false);
  });

  it('does not enable Cloudflare minification for proxied responses', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>ok</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      })
    );

    await worker.fetch(
      new Request('https://example.com/gh/test/repo/index.html'),
      {},
      executionContext
    );

    const fetchOptions = /** @type {RequestInit & { cf?: Record<string, unknown> }} */ (
      fetchSpy.mock.calls[0][1] || {}
    );

    expect(fetchOptions.cf).toEqual(
      expect.objectContaining({
        http3: true,
        cacheEverything: true,
        preconnect: true
      })
    );
    expect(fetchOptions.cf).not.toHaveProperty('minify');
  });

  it('responds to preflight requests for allowed origins', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/gh/test/repo', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://app.example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'X-Custom-Header'
        }
      }),
      {
        ALLOWED_ORIGINS: 'https://app.example.com'
      },
      executionContext
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('X-Custom-Header');
  });

  it('rejects preflight requests for disallowed origins', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/gh/test/repo', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.example.com',
          'Access-Control-Request-Method': 'GET'
        }
      }),
      {
        ALLOWED_ORIGINS: 'https://app.example.com'
      },
      executionContext
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('adds CORS headers to normal responses for allowed origins', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    );

    const response = await worker.fetch(
      new Request('https://example.com/gh/test/repo/file.txt', {
        headers: {
          Origin: 'https://app.example.com'
        }
      }),
      {
        ALLOWED_ORIGINS: 'https://app.example.com'
      },
      executionContext
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.example.com');
    expect(response.headers.get('Vary')).toContain('Origin');
  });
});

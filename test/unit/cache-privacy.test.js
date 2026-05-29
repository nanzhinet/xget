import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../src/index.js';

describe('Cache Privacy', () => {
  /** @type {{ match: ReturnType<typeof vi.fn>, put: ReturnType<typeof vi.fn> }} */
  let cacheDefault;

  /** @type {ReturnType<typeof vi.fn>} */
  let fetchStub;

  beforeEach(() => {
    cacheDefault = {
      match: vi.fn(async () => null),
      put: vi.fn(async () => undefined)
    };

    vi.stubGlobal('caches', { default: cacheDefault });

    fetchStub = vi.fn(async () => {
      return new Response('ok', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    });
    vi.stubGlobal('fetch', fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should not use Cache API for requests with Authorization', async () => {
    const request = new Request('https://example.com/gh/test/repo/file.txt', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer test-token'
      }
    });

    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
    const response = await worker.fetch(request, {}, ctx);

    expect(response.status).toBe(200);
    expect(cacheDefault.match).not.toHaveBeenCalled();
    expect(cacheDefault.put).not.toHaveBeenCalled();
    expect(fetchStub).toHaveBeenCalled();
    expect(fetchStub.mock.calls[0][1]?.cf).toBeUndefined();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('should not enable Cloudflare fetch caching for requests with Cookie', async () => {
    const request = new Request('https://example.com/gh/test/repo/file.txt', {
      method: 'GET',
      headers: {
        Cookie: 'session=secret'
      }
    });

    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
    const response = await worker.fetch(request, {}, ctx);

    expect(response.status).toBe(200);
    expect(cacheDefault.match).not.toHaveBeenCalled();
    expect(cacheDefault.put).not.toHaveBeenCalled();
    expect(fetchStub).toHaveBeenCalled();
    expect(fetchStub.mock.calls[0][1]?.cf).toBeUndefined();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('should use Cache API for non-authenticated GET requests', async () => {
    const request = new Request('https://example.com/gh/test/repo/file.txt', {
      method: 'GET'
    });

    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
    const response = await worker.fetch(request, {}, ctx);

    expect(response.status).toBe(200);
    expect(cacheDefault.match).toHaveBeenCalled();
    expect(fetchStub).toHaveBeenCalled();
    expect(response.headers.get('Cache-Control') || '').toContain('public');
  });

  it('should not cache upstream responses with Set-Cookie', async () => {
    fetchStub.mockResolvedValueOnce(
      new Response('private data', {
        status: 200,
        headers: {
          'Content-Type': 'text/plain',
          'Set-Cookie': 'session=upstream-secret'
        }
      })
    );

    const request = new Request('https://example.com/gh/test/repo/file.txt', {
      method: 'GET'
    });

    const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
    const response = await worker.fetch(request, {}, ctx);

    expect(response.status).toBe(200);
    expect(cacheDefault.put).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each([
    ['private', 'private, max-age=60', 'private, no-store'],
    ['no-store', 'public, no-store, max-age=60', 'no-store'],
    ['no-cache', 'public, no-cache, max-age=60', 'no-store']
  ])(
    'should not publish-cache upstream %s responses',
    async (_name, upstreamCacheControl, expected) => {
      fetchStub.mockResolvedValueOnce(
        new Response('uncacheable data', {
          status: 200,
          headers: {
            'Cache-Control': upstreamCacheControl,
            'Content-Type': 'text/plain'
          }
        })
      );

      const request = new Request('https://example.com/gh/test/repo/file.txt', {
        method: 'GET'
      });

      const ctx = { waitUntil: () => {}, passThroughOnException: () => {} };
      const response = await worker.fetch(request, {}, ctx);

      expect(response.status).toBe(200);
      expect(cacheDefault.put).not.toHaveBeenCalled();
      expect(response.headers.get('Cache-Control')).toBe(expected);
    }
  );
});

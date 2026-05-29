import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../src/index.js';

/** @type {ExecutionContext} */
const executionContext = {
  waitUntil() {},
  passThroughOnException() {}
};

describe('Authentication Header Forwarding', () => {
  /** @type {{ match: ReturnType<typeof vi.fn>, put: ReturnType<typeof vi.fn> }} */
  let cacheDefault;

  beforeEach(() => {
    cacheDefault = {
      match: vi.fn(async () => null),
      put: vi.fn(async () => undefined)
    };

    vi.stubGlobal('caches', { default: cacheDefault });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('forwards Authorization for authenticated file requests and disables caching', async () => {
    const authToken = 'Bearer ghp_test_token_12345';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    );

    const response = await worker.fetch(
      new Request('https://example.com/gh/test/private-repo/README.md', {
        method: 'HEAD',
        headers: {
          Authorization: authToken
        }
      }),
      {},
      executionContext
    );

    expect(response.status).toBe(200);
    expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get('Authorization')).toBe(authToken);
    expect(cacheDefault.match).not.toHaveBeenCalled();
    expect(cacheDefault.put).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('forwards Authorization for Hugging Face API passthrough requests', async () => {
    const authToken = 'Bearer hf_test_token_12345';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const response = await worker.fetch(
      new Request('https://example.com/hf/api/models/test-private-model', {
        method: 'GET',
        headers: {
          Authorization: authToken
        }
      }),
      {},
      executionContext
    );

    expect(response.status).toBe(200);
    expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get('Authorization')).toBe(authToken);
    expect(cacheDefault.match).not.toHaveBeenCalled();
    expect(cacheDefault.put).not.toHaveBeenCalled();
  });

  it('forwards Authorization for authenticated PyPI index requests', async () => {
    const authToken = 'Basic dGVzdDp0ZXN0MTIzNDU=';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    );

    const response = await worker.fetch(
      new Request('https://example.com/pypi/simple/private-package/', {
        method: 'HEAD',
        headers: {
          Authorization: authToken
        }
      }),
      {},
      executionContext
    );

    expect(response.status).toBe(200);
    expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get('Authorization')).toBe(authToken);
    expect(cacheDefault.match).not.toHaveBeenCalled();
    expect(cacheDefault.put).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('forwards Authorization for gated Hugging Face model downloads', async () => {
    const authToken = 'Bearer hf_authenticated_token';
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    const response = await worker.fetch(
      new Request('https://example.com/hf/meta-llama/Llama-2-7b/resolve/main/config.json', {
        headers: {
          Authorization: authToken
        }
      }),
      {},
      executionContext
    );

    expect(response.status).toBe(200);
    expect(new Headers(fetchSpy.mock.calls[0][1]?.headers).get('Authorization')).toBe(authToken);
    expect(cacheDefault.match).not.toHaveBeenCalled();
    expect(cacheDefault.put).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });
});

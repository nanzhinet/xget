import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from '../../src/index.js';
import { CONFIG } from '../../src/config/index.js';
import { isAIInferenceRequest } from '../../src/protocols/ai.js';
import {
  getScopeFromUrl,
  handleDockerAuth,
  readRegistryTokenResponse
} from '../../src/protocols/docker.js';
import { isDockerRequest } from '../../src/utils/validation.js';

/** @type {ExecutionContext} */
const executionContext = {
  waitUntil() {},
  passThroughOnException() {}
};

describe('Protocol Detection', () => {
  it('only treats /ip-prefixed paths as AI inference requests', () => {
    const request = new Request('https://example.com/gh/user/repo/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const url = new URL(request.url);

    expect(isAIInferenceRequest(request, url)).toBe(false);
  });

  it('does not treat nested /v2/ segments in regular paths as Docker requests', () => {
    const request = new Request(
      'https://example.com/gh/user/repo/releases/download/v2/file.tar.gz'
    );
    const url = new URL(request.url);

    expect(isDockerRequest(request, url)).toBe(false);
  });
});

describe('Docker Authentication', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('derives scoped pull access from /cr-prefixed registry requests', () => {
    const url = new URL('https://example.com/cr/docker/v2/nginx/manifests/latest');

    expect(getScopeFromUrl(url, url.pathname, 'cr-docker')).toBe('repository:library/nginx:pull');
  });

  it('normalizes Docker Hub official image scopes during auth proxying', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);

      if (url === 'https://registry-1.docker.io/v2/') {
        return new Response('', {
          status: 401,
          headers: {
            'WWW-Authenticate':
              'Bearer realm="https://auth.docker.io/token",service="registry.docker.io"'
          }
        });
      }

      return new Response(JSON.stringify({ token: 'token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const request = new Request(
      'https://example.com/cr/docker/v2/auth?scope=repository:cr/docker/nginx:pull&service=Xget'
    );
    const response = await handleDockerAuth(request, new URL(request.url), CONFIG);

    expect(response.status).toBe(200);
    expect(String(fetchSpy.mock.calls[1][0])).toContain(
      'scope=repository%3Alibrary%2Fnginx%3Apull'
    );
  });

  it('routes platform-prefixed auth endpoints without duplicating /v2', async () => {
    /** @type {string[]} */
    const upstreamCalls = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      upstreamCalls.push(String(input));

      if (String(input) === 'https://ghcr.io/v2/') {
        return new Response('', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer realm="https://ghcr.io/token",service="ghcr.io"'
          }
        });
      }

      return new Response(JSON.stringify({ token: 'token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const request = new Request('https://example.com/cr/ghcr/v2/auth?service=Xget');
    const response = await worker.fetch(request, {}, executionContext);

    expect(response.status).toBe(200);
    expect(upstreamCalls[0]).toBe('https://ghcr.io/v2/');
  });

  it('routes registry manifests without duplicating /v2', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Length': '0' }
      })
    );

    const request = new Request(
      'https://example.com/cr/ghcr/v2/nginxinc/nginx-unprivileged/manifests/latest',
      {
        method: 'HEAD'
      }
    );
    const response = await worker.fetch(request, {}, executionContext);

    expect(response.status).toBe(200);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      'https://ghcr.io/v2/nginxinc/nginx-unprivileged/manifests/latest'
    );
  });

  it('routes host-style registry manifests through the upstream v2 API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Length': '0' }
      })
    );

    const request = new Request('https://example.com/v2/cr/ghcr/xixu-me/xget/manifests/latest', {
      method: 'HEAD'
    });
    const response = await worker.fetch(request, {}, executionContext);

    expect(response.status).toBe(200);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      'https://ghcr.io/v2/xixu-me/xget/manifests/latest'
    );
  });

  it('normalizes Docker Hub official image paths during proxying', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', {
        status: 200,
        headers: { 'Content-Length': '0' }
      })
    );

    const request = new Request('https://example.com/cr/docker/v2/nginx/manifests/latest', {
      headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' }
    });
    const response = await worker.fetch(request, {}, executionContext);

    expect(response.status).toBe(200);
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      'https://registry-1.docker.io/v2/library/nginx/manifests/latest'
    );
  });

  it('preserves platform-specific Docker auth challenges', async () => {
    let callCount = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;

      if (callCount === 1) {
        return new Response('', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer realm="https://ghcr.io/token",service="ghcr.io"'
          }
        });
      }

      return new Response('denied', { status: 401 });
    });

    const request = new Request('https://example.com/cr/ghcr/v2/private/repo/manifests/latest', {
      headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' }
    });
    const response = await worker.fetch(request, {}, executionContext);

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe(
      'Bearer realm="https://example.com/cr/ghcr/v2/auth",service="Xget"'
    );
    expect(await response.text()).toContain('UNAUTHORIZED');
  });

  it('follows 303 redirects for Docker registry responses without forwarding auth headers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const headers = new Headers(init?.headers);
      const url = String(input);

      if (url === 'https://ghcr.io/v2/xixu-me/xget/manifests/latest') {
        expect(headers.get('Authorization')).toBe('Bearer token123');
        return new Response(null, {
          status: 303,
          headers: {
            Location: 'https://pkg-containers.githubusercontent.com/manifest'
          }
        });
      }

      if (url === 'https://pkg-containers.githubusercontent.com/manifest') {
        expect(headers.get('Authorization')).toBeNull();
        return new Response('', {
          status: 200,
          headers: { 'Content-Length': '0' }
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const request = new Request('https://example.com/v2/cr/ghcr/xixu-me/xget/manifests/latest', {
      headers: { Authorization: 'Bearer token123' }
    });
    const response = await worker.fetch(request, {}, executionContext);

    expect(response.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('accepts standard repository scopes on platform-prefixed auth endpoints', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);

      if (url === 'https://ghcr.io/v2/') {
        return new Response('', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer realm="https://ghcr.io/token",service="ghcr.io"'
          }
        });
      }

      return new Response(JSON.stringify({ token: 'token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const request = new Request(
      'https://example.com/cr/ghcr/v2/auth?scope=repository:private/repo:pull&service=Xget'
    );
    const response = await worker.fetch(request, {}, executionContext);

    expect(response.status).toBe(200);
    expect(String(fetchSpy.mock.calls[1][0])).toContain('scope=repository%3Aprivate%2Frepo%3Apull');
  });

  it('treats empty JSON token responses as unusable instead of throwing', async () => {
    const token = await readRegistryTokenResponse(
      new Response('', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    expect(token).toBeNull();
  });

  it('falls back cleanly when the token service returns an empty success body', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    let callCount = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;

      if (callCount === 1) {
        return new Response('', {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer realm="https://ghcr.io/token",service="ghcr.io"'
          }
        });
      }

      return new Response('', { status: 200 });
    });

    const request = new Request('https://example.com/cr/ghcr/v2/private/repo/manifests/latest', {
      headers: { Accept: 'application/vnd.docker.distribution.manifest.v2+json' }
    });
    const response = await worker.fetch(request, {}, executionContext);

    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe(
      'Bearer realm="https://example.com/cr/ghcr/v2/auth",service="Xget"'
    );
    expect(await response.text()).toContain('UNAUTHORIZED');
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('Protocol Header Configuration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not send Git user-agent for AI inference requests', async () => {
    /** @type {{ url: string, userAgent: string | null }[]} */
    const observed = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const headers = new Headers(init?.headers);
      observed.push({
        url: String(input),
        userAgent: headers.get('User-Agent')
      });

      return new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });

    const request = new Request('https://example.com/ip/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    });
    const response = await worker.fetch(request, {}, executionContext);

    expect(response.status).toBe(200);
    expect(observed[0]).toEqual({
      url: 'https://api.openai.com/v1/chat/completions',
      userAgent: 'Xget-AI-Proxy/1.0'
    });
  });

  it('updates Content-Length after rewriting npm metadata', async () => {
    const upstreamBody = JSON.stringify({
      dist: {
        tarball: 'https://registry.npmjs.org/pkg/-/pkg-1.0.0.tgz'
      }
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(upstreamBody, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': String(upstreamBody.length)
        }
      })
    );

    const response = await worker.fetch(
      new Request('https://example.com/npm/pkg'),
      {},
      executionContext
    );
    const body = await response.text();

    expect(body).toContain('https://example.com/npm/pkg/-/pkg-1.0.0.tgz');
    expect(response.headers.get('Content-Length')).toBe(
      String(new TextEncoder().encode(body).byteLength)
    );
  });
});

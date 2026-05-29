import { afterEach, describe, expect, it, vi } from 'vitest';

import { CONFIG } from '../../src/config/index.js';
import {
  fetchToken,
  getScopeFromUrl,
  handleDockerAuth,
  normalizeRegistryApiPath,
  parseAuthenticate,
  readRegistryTokenResponse
} from '../../src/protocols/docker.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Docker helper coverage', () => {
  it('throws on malformed authenticate headers', () => {
    expect(() => parseAuthenticate('Bearer service="registry.docker.io"')).toThrow(
      /invalid WWW-Authenticate/
    );
  });

  it('includes authorization when fetching registry tokens', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );

    await fetchToken(
      { realm: 'https://auth.example.com/token', service: 'registry.example.com' },
      'repository:demo/app:pull',
      'Bearer registry-secret'
    );

    const upstreamHeaders = new Headers(fetchSpy.mock.calls[0][1]?.headers);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('scope=repository%3Ademo%2Fapp%3Apull');
    expect(upstreamHeaders.get('Authorization')).toBe('Bearer registry-secret');
  });

  it('reads both token formats and rejects malformed token payloads', async () => {
    await expect(
      readRegistryTokenResponse(
        new Response(JSON.stringify({ token: 'abc123' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    ).resolves.toBe('abc123');

    await expect(
      readRegistryTokenResponse(
        new Response(JSON.stringify({ access_token: 'def456' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    ).resolves.toBe('def456');

    await expect(
      readRegistryTokenResponse(
        new Response(JSON.stringify('invalid-shape'), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    ).resolves.toBeNull();

    await expect(
      readRegistryTokenResponse(
        new Response('{not-json', {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    ).resolves.toBeNull();
  });

  it('derives catalog and empty scopes from registry paths', () => {
    const catalogUrl = new URL('https://example.com/cr/ghcr/v2/_catalog');
    const unsupportedUrl = new URL('https://example.com/cr/ghcr/v2');

    expect(getScopeFromUrl(catalogUrl, catalogUrl.pathname, 'cr-ghcr')).toBe('registry:catalog:*');
    expect(getScopeFromUrl(unsupportedUrl, unsupportedUrl.pathname, 'cr-ghcr')).toBe('');
  });

  it('leaves normalized registry paths untouched when no library prefix is needed', () => {
    expect(normalizeRegistryApiPath('cr-ghcr', '/v2/org/app/manifests/latest')).toBe(
      '/v2/org/app/manifests/latest'
    );
    expect(normalizeRegistryApiPath('cr-docker', '/v2/library/nginx/manifests/latest')).toBe(
      '/v2/library/nginx/manifests/latest'
    );
    expect(normalizeRegistryApiPath('cr-docker', '/v2/_catalog')).toBe('/v2/_catalog');
  });

  it('returns a generic error for unsupported Docker auth scopes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const request = new Request(
      'https://example.com/v2/auth?scope=repository:cr/unknown/private:pull'
    );

    const response = await handleDockerAuth(request, new URL(request.url), CONFIG);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe('Invalid Docker authentication request');
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to resolve Docker auth target:',
      expect.any(Error)
    );
  });

  it('forwards upstream auth responses that are not challenges', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('already-authorized', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      })
    );

    const request = new Request('https://example.com/cr/ghcr/v2/auth?service=Xget');
    const response = await handleDockerAuth(request, new URL(request.url), CONFIG);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('already-authorized');
  });

  it('forwards 401 responses without authenticate headers from the upstream root probe', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('missing-authenticate', {
        status: 401,
        headers: { 'Content-Type': 'text/plain' }
      })
    );

    const request = new Request('https://example.com/cr/ghcr/v2/auth?service=Xget');
    const response = await handleDockerAuth(request, new URL(request.url), CONFIG);

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('missing-authenticate');
  });
});

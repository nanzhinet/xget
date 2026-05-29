import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import worker from '../../src/index.js';

/** @type {ExecutionContext} */
const executionContext = {
  waitUntil() {},
  passThroughOnException() {}
};

/**
 * Reads a response body as UTF-8 text without relying on the response MIME type.
 * @param {Response} response
 * @returns {Promise<string>} Decoded UTF-8 response text.
 */
async function readUtf8Text(response) {
  return new TextDecoder().decode(await response.arrayBuffer());
}

describe('Flathub Response Rewriting', () => {
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

  it('rewrites .flatpakrepo URLs to stay on the Xget mirror', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        [
          '[Flatpak Repo]',
          'Url=https://dl.flathub.org/repo/',
          'Icon=https://dl.flathub.org/repo/logo.svg',
          'Homepage=https://flathub.org/'
        ].join('\n'),
        {
          status: 200,
          headers: { 'Content-Type': 'application/octet-stream' }
        }
      )
    );

    const response = await worker.fetch(
      new Request('https://example.com/flathub/repo/flathub.flatpakrepo'),
      {},
      executionContext
    );

    expect(response.status).toBe(200);

    const body = await readUtf8Text(response);
    expect(body).toContain('Url=https://example.com/flathub/repo/');
    expect(body).toContain('Icon=https://example.com/flathub/repo/logo.svg');
    expect(body).toContain('Homepage=https://flathub.org/');
    expect(response.headers.get('Content-Length')).toBe(
      String(new TextEncoder().encode(body).length)
    );
  });

  it('rewrites .flatpakref URLs to stay on the Xget mirror', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        [
          '[Flatpak Ref]',
          'Name=org.gnome.gedit',
          'Url=https://dl.flathub.org/repo/',
          'RuntimeRepo=https://dl.flathub.org/repo/flathub.flatpakrepo'
        ].join('\n'),
        {
          status: 200,
          headers: { 'Content-Type': 'application/octet-stream' }
        }
      )
    );

    const response = await worker.fetch(
      new Request('https://example.com/flathub/repo/appstream/org.gnome.gedit.flatpakref'),
      {},
      executionContext
    );

    expect(response.status).toBe(200);

    const body = await readUtf8Text(response);
    expect(body).toContain('Url=https://example.com/flathub/repo/');
    expect(body).toContain('RuntimeRepo=https://example.com/flathub/repo/flathub.flatpakrepo');
  });

  it('uses host-scoped cache keys for rewritten Flathub descriptors', async () => {
    const cacheEntries = new Map();

    vi.stubGlobal('caches', {
      default: {
        match: vi.fn(async request => cacheEntries.get(request.url) || null),
        put: vi.fn(async (request, response) => {
          cacheEntries.set(request.url, response.clone());
        })
      }
    });

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
      async () =>
        new Response(`[Flatpak Repo]\nUrl=https://dl.flathub.org/repo/`, {
          status: 200,
          headers: { 'Content-Type': 'application/octet-stream' }
        })
    );

    const responseA = await worker.fetch(
      new Request('https://mirror-a.example/flathub/repo/flathub.flatpakrepo'),
      {},
      executionContext
    );
    const responseB = await worker.fetch(
      new Request('https://mirror-b.example/flathub/repo/flathub.flatpakrepo'),
      {},
      executionContext
    );

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(await readUtf8Text(responseA)).toContain('Url=https://mirror-a.example/flathub/repo/');
    expect(await readUtf8Text(responseB)).toContain('Url=https://mirror-b.example/flathub/repo/');
  });

  it('does not rewrite binary repository metadata like summary files', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('summary-binary-payload', {
        status: 200,
        headers: { 'Content-Type': 'application/octet-stream' }
      })
    );

    const response = await worker.fetch(
      new Request('https://example.com/flathub/repo/summary'),
      {},
      executionContext
    );

    expect(response.status).toBe(200);
    expect(await readUtf8Text(response)).toBe('summary-binary-payload');
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PerformanceMonitor, addPerformanceHeaders } from '../../src/utils/performance.js';
import {
  isFlatpakReferenceFilePath,
  rewriteTextResponse,
  shouldRewriteTextResponse
} from '../../src/utils/rewrite.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Runtime helper coverage', () => {
  it('serializes performance metrics and warns on duplicate marks', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const monitor = new PerformanceMonitor();

    monitor.mark('request-start');
    monitor.mark('request-start');
    monitor.mark('complete');

    const response = addPerformanceHeaders(
      new Response('ok', {
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      }),
      monitor
    );
    const metrics = JSON.parse(response.headers.get('X-Performance-Metrics') || '{}');

    expect(warnSpy).toHaveBeenCalledWith('Mark with name request-start already exists.');
    expect(metrics).toHaveProperty('request-start');
    expect(metrics).toHaveProperty('complete');
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
  });

  it('rewrites only supported upstream response types', () => {
    expect(shouldRewriteTextResponse('pypi', '/pypi/simple/demo/', 'text/html')).toBe(true);
    expect(shouldRewriteTextResponse('npm', '/npm/demo', 'application/json')).toBe(true);
    expect(
      shouldRewriteTextResponse(
        'flathub',
        '/flathub/repo/demo.flatpakrepo',
        'application/octet-stream'
      )
    ).toBe(true);
    expect(shouldRewriteTextResponse('gh', '/gh/user/repo/file.txt', 'text/plain')).toBe(false);

    expect(isFlatpakReferenceFilePath('/flathub/repo/demo.flatpakref')).toBe(true);
    expect(isFlatpakReferenceFilePath('/flathub/repo/summary')).toBe(false);

    expect(
      rewriteTextResponse(
        'flathub',
        '/flathub/repo/demo.flatpakrepo',
        'Url=https://dl.flathub.org/repo/',
        'https://example.com'
      )
    ).toContain('https://example.com/flathub/repo/');
    expect(
      rewriteTextResponse('gh', '/gh/user/repo/file.txt', 'unchanged', 'https://example.com')
    ).toBe('unchanged');
  });
});

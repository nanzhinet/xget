import { describe, expect, it } from 'vitest';
import { PLATFORM_CATALOG as PLATFORMS } from '../../src/config/platform-catalog.js';
import { transformPath } from '../../src/routing/platform-transformers.js';

describe('Flathub Platform Configuration', () => {
  it('should have Flathub platform configured', () => {
    expect(PLATFORMS.flathub).toBe('https://dl.flathub.org');
  });

  it('should transform Flathub repository paths correctly', () => {
    const testCases = [
      {
        input: '/flathub/repo/summary',
        expected: '/repo/summary',
        description: 'repository summary'
      },
      {
        input: '/flathub/repo/summary.sig',
        expected: '/repo/summary.sig',
        description: 'repository summary signature'
      },
      {
        input: '/flathub/repo/flathub.flatpakrepo',
        expected: '/repo/flathub.flatpakrepo',
        description: 'remote descriptor'
      },
      {
        input: '/flathub/repo/appstream/org.gnome.gedit.flatpakref',
        expected: '/repo/appstream/org.gnome.gedit.flatpakref',
        description: 'application reference'
      },
      {
        input: '/flathub/repo/objects/12/34567890abcdef.filez',
        expected: '/repo/objects/12/34567890abcdef.filez',
        description: 'content-addressed object'
      },
      {
        input: '/flathub/repo/deltas/ABCD.superblock',
        expected: '/repo/deltas/ABCD.superblock',
        description: 'static delta'
      }
    ];

    testCases.forEach(({ input, expected, description }) => {
      const result = transformPath(input, 'flathub');
      expect(result, `Failed for ${description}: ${input}`).toBe(expected);
    });
  });

  it('should handle root path correctly', () => {
    expect(transformPath('/flathub/', 'flathub')).toBe('/');
  });

  it('should preserve already transformed Flathub repository paths', () => {
    expect(transformPath('/repo/summary', 'flathub')).toBe('/repo/summary');
  });
});

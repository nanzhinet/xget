import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 60000,
    hookTimeout: 30000,
    include: [
      'test/features/auth.test.js',
      'test/unit/**/*.test.js',
      'test/platforms/crates.test.js',
      'test/platforms/cran.test.js',
      'test/platforms/flathub.test.js',
      'test/platforms/homebrew.test.js',
      'test/platforms/jenkins.test.js',
      'test/platforms/npm-fix.test.js',
      'test/platforms/opensuse.test.js'
    ],
    coverage: {
      // Cloudflare's Vitest Workers pool cannot emit reliable coverage yet,
      // so this suite targets the Node-compatible tests that still exercise src/.
      provider: 'istanbul',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'test/**',
        'coverage/**',
        'dist/**',
        '*.config.js',
        '*.config.ts'
      ],
      include: ['src/**/*.js', 'src/**/*.ts'],
      thresholds: {
        global: {
          branches: 65,
          functions: 75,
          lines: 70,
          statements: 70
        }
      }
    }
  }
});

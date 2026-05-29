// @vitest-environment node

import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const tsconfig = require('../../tsconfig.json');
const packageJson = require('../../package.json');

describe('TypeScript config', () => {
  it('explicitly includes Node.js types for mixed runtime files', () => {
    expect(tsconfig.compilerOptions.types).toContain('node');
  });

  it('declares Node.js typings as a dev dependency', () => {
    expect(packageJson.devDependencies['@types/node']).toBeTruthy();
  });
});

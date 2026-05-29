import { describe, expect, it } from 'vitest';

import { configureAIHeaders } from '../../src/protocols/ai.js';
import { configureGitHeaders, isGitLFSRequest, isGitRequest } from '../../src/protocols/git.js';
import {
  configureHuggingFaceHeaders,
  isHuggingFaceAPIRequest
} from '../../src/protocols/huggingface.js';

describe('Protocol helper coverage', () => {
  it('detects Git requests from service queries and content types', () => {
    const serviceRequest = new Request('https://example.com/repo.git?service=git-receive-pack');
    const contentTypeRequest = new Request('https://example.com/repo.git', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-git-upload-pack-request' }
    });

    expect(isGitRequest(serviceRequest, new URL(serviceRequest.url))).toBe(true);
    expect(isGitRequest(contentTypeRequest, new URL(contentTypeRequest.url))).toBe(true);
  });

  it('detects Git LFS requests from object paths and headers', () => {
    const infoRequest = new Request('https://example.com/repo.git/info/lfs');
    const objectRequest = new Request(
      'https://example.com/repo.git/objects/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );
    const headerRequest = new Request('https://example.com/repo.git/download', {
      headers: { Accept: 'application/vnd.git-lfs+json' }
    });

    expect(isGitLFSRequest(infoRequest, new URL(infoRequest.url))).toBe(true);
    expect(isGitLFSRequest(objectRequest, new URL(objectRequest.url))).toBe(true);
    expect(isGitLFSRequest(headerRequest, new URL(headerRequest.url))).toBe(true);
  });

  it('configures standard Git upload and receive pack headers', () => {
    const uploadHeaders = new Headers();
    const uploadRequest = new Request('https://example.com/repo.git/git-upload-pack', {
      method: 'POST'
    });
    configureGitHeaders(uploadHeaders, uploadRequest, new URL(uploadRequest.url), false);

    const receiveHeaders = new Headers();
    const receiveRequest = new Request('https://example.com/repo.git/git-receive-pack', {
      method: 'POST'
    });
    configureGitHeaders(receiveHeaders, receiveRequest, new URL(receiveRequest.url), false);

    expect(uploadHeaders.get('User-Agent')).toBe('git/2.34.1');
    expect(uploadHeaders.get('Content-Type')).toBe('application/x-git-upload-pack-request');
    expect(receiveHeaders.get('User-Agent')).toBe('git/2.34.1');
    expect(receiveHeaders.get('Content-Type')).toBe('application/x-git-receive-pack-request');
  });

  it('preserves existing Git headers when already provided', () => {
    const headers = new Headers({
      'Content-Type': 'application/custom',
      'User-Agent': 'custom-git/9.9.9'
    });
    const request = new Request('https://example.com/repo.git/git-upload-pack', {
      method: 'POST'
    });

    configureGitHeaders(headers, request, new URL(request.url), false);

    expect(headers.get('User-Agent')).toBe('custom-git/9.9.9');
    expect(headers.get('Content-Type')).toBe('application/custom');
  });

  it('configures Git LFS batch and object download headers', () => {
    const batchHeaders = new Headers();
    const batchRequest = new Request('https://example.com/repo.git/objects/batch', {
      method: 'POST'
    });
    configureGitHeaders(batchHeaders, batchRequest, new URL(batchRequest.url), true);

    const objectHeaders = new Headers();
    const objectRequest = new Request(
      'https://example.com/repo.git/objects/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    );
    configureGitHeaders(objectHeaders, objectRequest, new URL(objectRequest.url), true);

    expect(batchHeaders.get('User-Agent')).toContain('git-lfs/');
    expect(batchHeaders.get('Accept')).toBe('application/vnd.git-lfs+json');
    expect(batchHeaders.get('Content-Type')).toBe('application/vnd.git-lfs+json');
    expect(objectHeaders.get('Accept')).toBe('application/octet-stream');
  });

  it('detects Hugging Face API and token passthrough endpoints', () => {
    const apiRequest = new Request('https://example.com/hf/api/models/demo');
    const tokenRequest = new Request('https://example.com/hf/token');
    const regularRequest = new Request(
      'https://example.com/hf/meta-llama/model/resolve/main/config.json'
    );

    expect(isHuggingFaceAPIRequest(apiRequest, new URL(apiRequest.url))).toBe(true);
    expect(isHuggingFaceAPIRequest(tokenRequest, new URL(tokenRequest.url))).toBe(true);
    expect(isHuggingFaceAPIRequest(regularRequest, new URL(regularRequest.url))).toBe(false);
  });

  it('configures Hugging Face headers without overwriting explicit content types', () => {
    const headers = new Headers();
    const request = new Request('https://example.com/hf/api/models/demo', {
      method: 'POST',
      headers: { Authorization: 'Bearer secret-token' }
    });

    configureHuggingFaceHeaders(headers, request);

    const preconfiguredHeaders = new Headers({ 'Content-Type': 'multipart/form-data' });
    configureHuggingFaceHeaders(preconfiguredHeaders, request);

    expect(headers.get('Authorization')).toBe('Bearer secret-token');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(preconfiguredHeaders.get('Content-Type')).toBe('multipart/form-data');
  });

  it('configures AI passthrough headers and preserves explicit values', () => {
    const headers = new Headers();
    const request = new Request('https://example.com/ip/openai/v1/chat/completions', {
      method: 'POST'
    });
    configureAIHeaders(headers, request);

    const preconfiguredHeaders = new Headers({
      'Content-Type': 'application/x-ndjson',
      'User-Agent': 'custom-ai-proxy/2.0'
    });
    configureAIHeaders(preconfiguredHeaders, request);

    expect(headers.get('Content-Type')).toBe('application/json');
    expect(headers.get('User-Agent')).toBe('Xget-AI-Proxy/1.0');
    expect(preconfiguredHeaders.get('Content-Type')).toBe('application/x-ndjson');
    expect(preconfiguredHeaders.get('User-Agent')).toBe('custom-ai-proxy/2.0');
  });
});

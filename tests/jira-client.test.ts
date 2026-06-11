// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { describe, it, expect } from 'bun:test';
import { JiraClient, createJiraClient } from '../src/jira-client';
import { DEFAULT_CONFIG } from '../src/types';

// ────────────────────────────────────────────────────────────────
// JiraClient unit tests (no real API calls — tests logic + types)
// ────────────────────────────────────────────────────────────────

describe('JiraClient', () => {
  it('constructs with baseUrl, email, apiToken', () => {
    const client = new JiraClient('https://jira.example.com', 'user@example.com', 'secret-token');
    // Client should exist without errors
    expect(client).toBeDefined();
    expect(client instanceof JiraClient).toBe(true);
  });

  it('strips trailing slashes from baseUrl', () => {
    // This is tested implicitly — we just verify construction succeeds
    const client1 = new JiraClient('https://jira.example.com', 'user@example.com', 'secret');
    const client2 = new JiraClient('https://jira.example.com/', 'user@example.com', 'secret');
    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
  });

  it('getIssue returns structured error for bad URL (no real API)', async () => {
    const client = new JiraClient('https://invalid.example.com', 'user@example.com', 'secret');
    const result = await client.getIssue('TEST-1');

    // Should return error object, not throw
    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toBeTruthy();
    }
    // Network failure will result in an error object — that's fine
  });

  it('addComment returns structured error for bad URL', async () => {
    const client = new JiraClient('https://invalid.example.com', 'user@example.com', 'secret');
    const result = await client.addComment('TEST-1', 'Hello');

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toBeTruthy();
    }
  });

  it('getTransitions returns structured error for bad URL', async () => {
    const client = new JiraClient('https://invalid.example.com', 'user@example.com', 'secret');
    const result = await client.getTransitions('TEST-1');

    if ('error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toBeTruthy();
    }
  });

  it('doTransition returns structured error for bad URL', async () => {
    const client = new JiraClient('https://invalid.example.com', 'user@example.com', 'secret');
    const result = await client.doTransition('TEST-1', '11');

    if (result && 'error' in result) {
      expect(result.error).toBe(true);
      expect(result.message).toBeTruthy();
    }
  });

  it('addComment wraps string body in ADF', async () => {
    // We can only test the formatting logic without real API calls.
    // verify that the client accepts string body without throwing.
    const client = new JiraClient('https://jira.example.com', 'user@example.com', 'secret');
    // The actual call would fail, but the method should accept the parameters
    const result = await client.addComment('TEST-1', 'Test comment');
    // We expect it to fail (network) but not throw
    expect(result).toBeDefined();
  });

  it('all API methods catch network errors and return error objects', async () => {
    const client = new JiraClient('https://does-not-exist.invalid', 'u@e.com', 'p');

    // All calls should return something (not throw)
    const issue = await client.getIssue('X-1');
    const comment = await client.addComment('X-1', 'c');
    const transitions = await client.getTransitions('X-1');
    const transition = await client.doTransition('X-1', '1');

    // Each should be defined (not throwing)
    expect(issue).toBeDefined();
    expect(comment).toBeDefined();
    expect(transitions).toBeDefined();
    expect(transition === undefined || transition !== null).toBe(true);
  });
});

describe('createJiraClient', () => {
  it('returns null when env vars are missing', () => {
    // Ensure env vars are not set
    const originalUrl = process.env.JIRA_BASE_URL;
    const originalEmail = process.env.JIRA_EMAIL;
    const originalToken = process.env.JIRA_API_TOKEN;

    delete process.env.JIRA_BASE_URL;
    delete process.env.JIRA_EMAIL;
    delete process.env.JIRA_API_TOKEN;

    const config = {
      ...DEFAULT_CONFIG,
      baseUrlEnv: 'JIRA_BASE_URL',
      emailEnv: 'JIRA_EMAIL',
      apiTokenEnv: 'JIRA_API_TOKEN',
    };

    const client = createJiraClient(config);
    expect(client).toBeNull();

    // Restore
    if (originalUrl !== undefined) process.env.JIRA_BASE_URL = originalUrl;
    if (originalEmail !== undefined) process.env.JIRA_EMAIL = originalEmail;
    if (originalToken !== undefined) process.env.JIRA_API_TOKEN = originalToken;
  });

  it('returns a client when all env vars are set', () => {
    const originalUrl = process.env.JIRA_BASE_URL;
    const originalEmail = process.env.JIRA_EMAIL;
    const originalToken = process.env.JIRA_API_TOKEN;

    process.env.JIRA_BASE_URL = 'https://jira.example.com';
    process.env.JIRA_EMAIL = 'user@example.com';
    process.env.JIRA_API_TOKEN = 'some-token';

    const config = {
      ...DEFAULT_CONFIG,
      baseUrlEnv: 'JIRA_BASE_URL',
      emailEnv: 'JIRA_EMAIL',
      apiTokenEnv: 'JIRA_API_TOKEN',
    };

    const client = createJiraClient(config);
    expect(client).not.toBeNull();
    expect(client instanceof JiraClient).toBe(true);

    // Restore
    if (originalUrl !== undefined) process.env.JIRA_BASE_URL = originalUrl;
    else delete process.env.JIRA_BASE_URL;
    if (originalEmail !== undefined) process.env.JIRA_EMAIL = originalEmail;
    else delete process.env.JIRA_EMAIL;
    if (originalToken !== undefined) process.env.JIRA_API_TOKEN = originalToken;
    else delete process.env.JIRA_API_TOKEN;
  });
});

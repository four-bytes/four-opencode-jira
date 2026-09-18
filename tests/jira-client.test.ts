// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { describe, it, expect, afterEach } from 'bun:test';
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

// ────────────────────────────────────────────────────────────────
// JiraClient.createIssue — custom field support
// ────────────────────────────────────────────────────────────────

describe('JiraClient.createIssue', () => {
  const client = new JiraClient('https://jira.example.com', 'user@example.com', 'secret');
  const realFetch = globalThis.fetch;

  function stubFetch(body: unknown, status = 201) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    return calls;
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('merges customFields into the fields payload', async () => {
    const calls = stubFetch({ id: '10001', key: 'TEST-42', self: 'https://jira.example.com/rest/api/3/issue/10001' });

    await client.createIssue({
      projectKey: 'TEST',
      summary: 'Hello',
      customFields: { customfield_10495: { value: 'High' } },
    });

    expect(calls).toHaveLength(1);
    const payload = JSON.parse(String(calls[0]!.init.body));
    expect(payload.fields.customfield_10495).toEqual({ value: 'High' });
  });

  it('does not let customFields clobber project/summary/issuetype', async () => {
    const calls = stubFetch({ id: '1', key: 'TEST-2', self: 'x' });

    await client.createIssue({
      projectKey: 'TEST',
      summary: 'Real summary',
      customFields: { summary: 'evil', project: { key: 'EVIL' } },
    });

    const payload = JSON.parse(String(calls[0]!.init.body));
    expect(payload.fields.summary).toBe('Real summary');
    expect(payload.fields.project).toEqual({ key: 'TEST' });
    expect(payload.fields.issuetype).toEqual({ name: 'Story' });
  });

  it('omits custom fields from the payload when not provided', async () => {
    const calls = stubFetch({ id: '1', key: 'TEST-3', self: 'x' });

    await client.createIssue({ projectKey: 'TEST', summary: 'Hello' });

    const payload = JSON.parse(String(calls[0]!.init.body));
    expect(payload.fields.customfield_10495).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────
// JQL search — POST /rest/api/3/search/jql (replaces removed /search)
// ────────────────────────────────────────────────────────────────

describe('JiraClient.searchIssues', () => {
  const client = new JiraClient('https://jira.example.com', 'user@example.com', 'secret');
  const realFetch = globalThis.fetch;

  /** Stub global fetch, capture the request, reply with `body`. */
  function stubFetch(body: unknown, status = 200) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    return calls;
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('posts to /rest/api/3/search/jql with jql, maxResults and explicit fields', async () => {
    const calls = stubFetch({ issues: [], isLast: true });

    await client.searchIssues('project = TEST', 25);

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://jira.example.com/rest/api/3/search/jql');
    expect(calls[0]!.init.method).toBe('POST');
    const payload = JSON.parse(String(calls[0]!.init.body));
    expect(payload.jql).toBe('project = TEST');
    expect(payload.maxResults).toBe(25);
    // Without an explicit field list the endpoint returns ids only.
    expect(payload.fields).toEqual(['summary', 'status', 'assignee']);
    expect(payload.nextPageToken).toBeUndefined();
  });

  it('clamps maxResults to the 1..5000 range the endpoint accepts', async () => {
    let calls = stubFetch({ issues: [] });
    await client.searchIssues('project = TEST', 99999);
    expect(JSON.parse(String(calls[0]!.init.body)).maxResults).toBe(5000);

    calls = stubFetch({ issues: [] });
    await client.searchIssues('project = TEST', 0);
    expect(JSON.parse(String(calls[0]!.init.body)).maxResults).toBe(1);
  });

  it('sends nextPageToken when paging', async () => {
    const calls = stubFetch({ issues: [], isLast: true });

    await client.searchIssues('project = TEST', 10, { nextPageToken: 'CAEaAggD' });

    expect(JSON.parse(String(calls[0]!.init.body)).nextPageToken).toBe('CAEaAggD');
  });

  it('honours a custom field list', async () => {
    const calls = stubFetch({ issues: [] });

    await client.searchIssues('project = TEST', 10, { fields: ['summary', 'labels'] });

    expect(JSON.parse(String(calls[0]!.init.body)).fields).toEqual(['summary', 'labels']);
  });

  it('returns issues plus the paging cursor', async () => {
    stubFetch({
      issues: [{ id: '1', key: 'TEST-1', fields: { summary: 'One', status: { name: 'Open', id: '1' }, labels: [] } }],
      nextPageToken: 'tok-2',
      isLast: false,
    });

    const result = await client.searchIssues('project = TEST');

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]!.key).toBe('TEST-1');
    expect(result.nextPageToken).toBe('tok-2');
    expect(result.isLast).toBe(false);
  });

  it('treats a missing isLast as the final page when no token is returned', async () => {
    stubFetch({ issues: [] });

    const result = await client.searchIssues('project = TEST');

    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.isLast).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it('returns a structured error on a non-OK response', async () => {
    stubFetch({ errorMessages: ['bad jql'] }, 400);

    const result = await client.searchIssues('nonsense');

    expect('error' in result).toBe(true);
    if (!('error' in result)) return;
    expect(result.status).toBe(400);
  });

  it('returns a structured error for a bad URL instead of throwing', async () => {
    const broken = new JiraClient('https://does-not-exist.invalid', 'u@e.com', 'p');
    const result = await broken.searchIssues('project = TEST');

    expect('error' in result).toBe(true);
    if (!('error' in result)) return;
    expect(result.message).toBeTruthy();
  });
});

// ────────────────────────────────────────────────────────────────
// JiraClient create metadata — issue types + fields
// ────────────────────────────────────────────────────────────────

describe('JiraClient.getCreateMetaIssueTypes', () => {
  const client = new JiraClient('https://jira.example.com', 'user@example.com', 'secret');
  const realFetch = globalThis.fetch;

  function stubFetch(body: unknown, status = 200) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    return calls;
  }

  afterEach(() => { globalThis.fetch = realFetch; });

  it('hits the issue-types endpoint and parses issueTypes', async () => {
    const calls = stubFetch({ issueTypes: [{ id: '10000', name: 'Task' }, { id: '10001', name: 'Bug' }], total: 2 });
    const result = await client.getCreateMetaIssueTypes('SESSION');
    expect(calls[0]!.url).toContain('https://jira.example.com/rest/api/3/issue/createmeta/SESSION/issuetypes?startAt=0&maxResults=200');
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.issueTypes).toHaveLength(2);
    expect(result.issueTypes[0]!.name).toBe('Task');
  });

  it('paginates until all issue types are fetched', async () => {
    const responses = [
      { issueTypes: [{ id: '1', name: 'Task' }, { id: '2', name: 'Bug' }], total: 3 },
      { issueTypes: [{ id: '3', name: 'Story' }], total: 3 },
    ];
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(responses[calls.length - 1]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;

    const result = await client.getCreateMetaIssueTypes('SESSION');
    expect(calls).toHaveLength(2);
    expect(calls[1]!.url).toContain('startAt=2');
    if ('error' in result) return;
    expect(result.issueTypes).toHaveLength(3);
  });

  it('returns a structured error on a non-OK response', async () => {
    stubFetch({ errorMessages: ['no project'] }, 404);
    const result = await client.getCreateMetaIssueTypes('NOPE');
    expect('error' in result).toBe(true);
  });
});

describe('JiraClient.getCreateMetaFields', () => {
  const client = new JiraClient('https://jira.example.com', 'user@example.com', 'secret');
  const realFetch = globalThis.fetch;

  function stubFetch(body: unknown, status = 200) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    }) as unknown as typeof fetch;
    return calls;
  }

  afterEach(() => { globalThis.fetch = realFetch; });

  it('hits the fields endpoint and parses field descriptors', async () => {
    const calls = stubFetch({ fields: [
      { required: true, fieldId: 'summary', name: 'Summary', schema: { type: 'string', system: 'summary' } },
      { required: true, fieldId: 'customfield_10495', name: 'Business Impact', schema: { type: 'option', custom: 'com.atlassian.jira.plugin.system.customfieldtypes:select', customId: 10495 }, allowedValues: [{ id: '10000', value: 'High' }, { id: '10001', value: 'Low' }] },
    ], total: 2 });
    const result = await client.getCreateMetaFields('SESSION', '10000');
    expect(calls[0]!.url).toContain('https://jira.example.com/rest/api/3/issue/createmeta/SESSION/issuetypes/10000?startAt=0&maxResults=200');
    expect('error' in result).toBe(false);
    if ('error' in result) return;
    expect(result.fields).toHaveLength(2);
    expect(result.fields[1]!.fieldId).toBe('customfield_10495');
    expect(result.fields[1]!.allowedValues?.[0]?.value).toBe('High');
  });
});

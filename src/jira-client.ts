// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import type { JiraConfig, JiraIssue, CommentResult, Transition, JiraError } from './types';
import { getCredential } from './config';
import { logDebugEvent } from './debug-logger';

// ────────────────────────────────────────────────────────────────
// JiraClient — Jira REST API v3 wrapper
// ────────────────────────────────────────────────────────────────

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(baseUrl: string, email: string, apiToken: string) {
    // Strip trailing slash from base URL
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.authHeader = `Basic ${btoa(`${email}:${apiToken}`)}`;
  }

  /**
   * Fetch a Jira issue by key.
   * GET /rest/api/3/issue/{issueKey}?fields=summary,status,description,assignee,labels
   */
  async getIssue(issueKey: string): Promise<JiraIssue | JiraError> {
    const url = `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=summary,status,description,assignee,labels`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        logDebugEvent('jira_client.getIssue.error', { issueKey, status: response.status, body: body.substring(0, 500) });
        return {
          error: true,
          status: response.status,
          message: `Jira API error ${response.status}: ${body.substring(0, 200)}`,
        };
      }

      const data = await response.json() as JiraIssue;
      logDebugEvent('jira_client.getIssue.success', { issueKey, summary: data.fields?.summary });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_client.getIssue.exception', { issueKey, error: msg });
      return {
        error: true,
        status: 0,
        message: `Network error: ${msg}`,
      };
    }
  }

  /**
   * Add a comment to a Jira issue using Atlassian Document Format (ADF).
   * POST /rest/api/3/issue/{issueKey}/comment
   */
  async addComment(issueKey: string, body: string | object): Promise<CommentResult | JiraError> {
    const url = `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`;

    // If body is a string, wrap it in ADF
    const adfBody = typeof body === 'string'
      ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: body }] }] }
      : body;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ body: adfBody }),
      });

      if (!response.ok) {
        const respBody = await response.text();
        logDebugEvent('jira_client.addComment.error', { issueKey, status: response.status, body: respBody.substring(0, 500) });
        return {
          error: true,
          status: response.status,
          message: `Jira API error ${response.status}: ${respBody.substring(0, 200)}`,
        };
      }

      const data = await response.json() as CommentResult;
      logDebugEvent('jira_client.addComment.success', { issueKey, commentId: data.id });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_client.addComment.exception', { issueKey, error: msg });
      return {
        error: true,
        status: 0,
        message: `Network error: ${msg}`,
      };
    }
  }

  /**
   * Get available transitions for a Jira issue.
   * GET /rest/api/3/issue/{issueKey}/transitions
   */
  async getTransitions(issueKey: string): Promise<Transition[] | JiraError> {
    const url = `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        logDebugEvent('jira_client.getTransitions.error', { issueKey, status: response.status, body: body.substring(0, 500) });
        return {
          error: true,
          status: response.status,
          message: `Jira API error ${response.status}: ${body.substring(0, 200)}`,
        };
      }

      const data = await response.json() as { transitions: Transition[] };
      logDebugEvent('jira_client.getTransitions.success', { issueKey, count: data.transitions?.length || 0 });
      return data.transitions || [];
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_client.getTransitions.exception', { issueKey, error: msg });
      return {
        error: true,
        status: 0,
        message: `Network error: ${msg}`,
      };
    }
  }

  /**
   * Assign (or unassign) a Jira issue.
   * PUT /rest/api/3/issue/{issueKey}/assignee
   *
   * @param issueKey - The issue key (e.g. "PROJ-42")
   * @param accountId - Jira Cloud account ID, or null to unassign
   */
  async assignIssue(issueKey: string, accountId: string | null): Promise<true | JiraError> {
    const url = `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/assignee`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accountId }),
      });

      if (response.status !== 204 && !response.ok) {
        const body = await response.text();
        logDebugEvent('jira_client.assignIssue.error', { issueKey, accountId, status: response.status, body: body.substring(0, 500) });
        return {
          error: true,
          status: response.status,
          message: `Jira API error ${response.status}: ${body.substring(0, 200)}`,
        };
      }

      logDebugEvent('jira_client.assignIssue.success', { issueKey, accountId });
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_client.assignIssue.exception', { issueKey, error: msg });
      return { error: true, status: 0, message: `Network error: ${msg}` };
    }
  }

  /**
   * Test API connectivity by calling /myself.
   * Returns true on success, JiraError on failure.
   */
  async testConnection(): Promise<true | JiraError> {
    const url = `${this.baseUrl}/rest/api/3/myself`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        logDebugEvent('jira_client.testConnection.error', { status: response.status, body: body.substring(0, 500) });
        return {
          error: true,
          status: response.status,
          message: `Jira API error ${response.status}: ${body.substring(0, 200)}`,
        };
      }

      logDebugEvent('jira_client.testConnection.success', {});
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_client.testConnection.exception', { error: msg });
      return {
        error: true,
        status: 0,
        message: `Network error: ${msg}`,
      };
    }
  }

  /**
   * Execute a transition on a Jira issue.
   * POST /rest/api/3/issue/{issueKey}/transitions
   */
  async doTransition(issueKey: string, transitionId: string): Promise<void | JiraError> {
    const url = `${this.baseUrl}/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transition: { id: transitionId } }),
      });

      if (!response.ok && response.status !== 204) {
        const body = await response.text();
        logDebugEvent('jira_client.doTransition.error', { issueKey, transitionId, status: response.status, body: body.substring(0, 500) });
        return {
          error: true,
          status: response.status,
          message: `Jira API error ${response.status}: ${body.substring(0, 200)}`,
        };
      }

      logDebugEvent('jira_client.doTransition.success', { issueKey, transitionId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_client.doTransition.exception', { issueKey, transitionId, error: msg });
      return {
        error: true,
        status: 0,
        message: `Network error: ${msg}`,
      };
    }
  }

  /**
   * Search for Jira users by query string.
   * GET /rest/api/3/users/search?query={query}
   */
  async searchUsers(query: string): Promise<Array<{ accountId: string; displayName: string; emailAddress?: string }> | JiraError> {
    const url = `${this.baseUrl}/rest/api/3/users/search?query=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const body = await response.text();
        logDebugEvent('jira_client.searchUsers.error', { query, status: response.status, body: body.substring(0, 500) });
        return {
          error: true,
          status: response.status,
          message: `Jira API error ${response.status}: ${body.substring(0, 200)}`,
        };
      }

      const data = await response.json() as Array<{ accountId: string; displayName: string; emailAddress?: string }>;
      logDebugEvent('jira_client.searchUsers.success', { query, count: data.length });
      return data;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_client.searchUsers.exception', { query, error: msg });
      return { error: true, status: 0, message: `Network error: ${msg}` };
    }
  }
}

// ────────────────────────────────────────────────────────────────
// Factory function
// ────────────────────────────────────────────────────────────────

/**
 * Create a JiraClient from config + environment variables.
 * Returns null if required env vars are missing.
 */
export function createJiraClient(config: JiraConfig): JiraClient | null {
  const baseUrl = getCredential(config, 'baseUrl');
  const email = getCredential(config, 'email');
  const apiToken = getCredential(config, 'apiToken');

  if (!baseUrl || !email || !apiToken) {
    const missing: string[] = [];
    if (!baseUrl) missing.push(config.baseUrlEnv);
    if (!email) missing.push(config.emailEnv);
    if (!apiToken) missing.push(config.apiTokenEnv);
    logDebugEvent('jira_client.create.missing_creds', { missingVars: missing });
    return null;
  }

  logDebugEvent('jira_client.create.success', { baseUrl: baseUrl.replace(/\/\/.*@/, '//***@') });
  return new JiraClient(baseUrl, email, apiToken);
}

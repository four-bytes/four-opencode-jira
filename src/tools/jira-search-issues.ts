// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';

export const jiraSearchIssuesTool = tool({
  description: 'Search Jira issues using JQL (Jira Query Language). Use text ~ "keyword" for text search, status = "In Progress" for status filter, project = "PROJ" for project filter. Combine with AND/OR. Results are paged — pass the returned nextPageToken to fetch the following page.',

  args: {
    jql: tool.schema.string().describe('JQL query (e.g. \'text ~ "footer" AND status = "Code Review" ORDER BY updated DESC\')'),
    maxResults: tool.schema.number().optional().describe('Max results per page (default: 10, max: 5000)'),
    nextPageToken: tool.schema.string().optional().describe('Page token returned by a previous search, to fetch the next page'),
  },

  async execute(args, ctx) {
    const { jql, maxResults, nextPageToken } = args;

    logDebugEvent('jira_search_issues.start', { jql, maxResults, paged: Boolean(nextPageToken) });

    try {
      const config = loadConfig(ctx.directory);
      if (!config.enabled) return 'Jira plugin is disabled.';

      const client = createJiraClient(config);
      if (!client) return 'Jira client not configured.';

      const result = await client.searchIssues(jql, maxResults || 10, { nextPageToken });

      if ('error' in result) {
        return `Search failed: ${result.message}`;
      }

      const { issues, isLast, nextPageToken: nextToken } = result;
      if (issues.length === 0) {
        return `No issues found for JQL: ${jql}`;
      }

      const lines = [`${issues.length} issue(s) found:`];
      for (const issue of issues) {
        const status = issue.fields?.status?.name || '?';
        const assignee = issue.fields?.assignee?.displayName || 'unassigned';
        lines.push(`  - ${issue.key}: ${issue.fields?.summary || '(no summary)'} [${status}] (${assignee})`);
      }
      // The API reports no total — only whether another page exists.
      if (!isLast && nextToken) {
        lines.push(`\nMore results available — nextPageToken: ${nextToken}`);
      }

      logDebugEvent('jira_search_issues.success', { jql, count: issues.length, isLast });
      return lines.join('\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_search_issues.error', { jql, error: msg });
      return `Error: ${msg}`;
    }
  },
});

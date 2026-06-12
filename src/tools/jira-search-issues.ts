// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';

export const jiraSearchIssuesTool = tool({
  description: 'Search Jira issues using JQL (Jira Query Language). Use text ~ "keyword" for text search, status = "In Progress" for status filter, project = "PROJ" for project filter. Combine with AND/OR.',

  args: {
    jql: tool.schema.string().describe('JQL query (e.g. \'text ~ "footer" AND status = "Code Review" ORDER BY updated DESC\')'),
    maxResults: tool.schema.number().optional().describe('Max results (default: 10)'),
  },

  async execute(args, ctx) {
    const { jql, maxResults } = args;

    logDebugEvent('jira_search_issues.start', { jql, maxResults });

    try {
      const config = loadConfig(ctx.directory);
      if (!config.enabled) return 'Jira plugin is disabled.';

      const client = createJiraClient(config);
      if (!client) return 'Jira client not configured.';

      const result = await client.searchIssues(jql, maxResults || 10);

      if (typeof result === 'object' && 'error' in result && result.error) {
        return `Search failed: ${result.message}`;
      }

      const issues = result as Array<any>;
      if (!issues || issues.length === 0) {
        return `No issues found for JQL: ${jql}`;
      }

      const lines = [`${issues.length} issue(s) found:`];
      for (const issue of issues) {
        const status = issue.fields?.status?.name || '?';
        const assignee = issue.fields?.assignee?.displayName || 'unassigned';
        lines.push(`  - ${issue.key}: ${issue.fields?.summary || '(no summary)'} [${status}] (${assignee})`);
      }

      logDebugEvent('jira_search_issues.success', { jql, count: issues.length });
      return lines.join('\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_search_issues.error', { jql, error: msg });
      return `Error: ${msg}`;
    }
  },
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';
import type { JiraIssue } from '../types';

// ────────────────────────────────────────────────────────────────
// Output formatting
// ────────────────────────────────────────────────────────────────

function formatIssue(issue: JiraIssue): string {
  const f = issue.fields;
  const lines: string[] = [];

  lines.push(`# ${issue.key}: ${f.summary}`);
  lines.push('');
  lines.push(`**Status:** ${f.status.name}`);
  lines.push('');

  if (f.assignee) {
    lines.push(`**Assignee:** ${f.assignee.displayName}`);
  } else {
    lines.push('**Assignee:** Unassigned');
  }

  if (f.labels && f.labels.length > 0) {
    lines.push(`**Labels:** ${f.labels.join(', ')}`);
  }

  if (f.description) {
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('## Description');
    lines.push('');
    if (typeof f.description === 'string') {
      lines.push(f.description);
    } else {
      lines.push(JSON.stringify(f.description, null, 2));
    }
  }

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Tool definition
// ────────────────────────────────────────────────────────────────

export const jiraGetIssueTool = tool({
  description: 'Read Jira issue fields — status, summary, description, assignee, labels',

  args: {
    issueKey: tool.schema.string().describe('Jira issue key (e.g. SESSION-1026)'),
  },

  async execute(args, ctx) {
    const issueKey = args.issueKey as string;
    logDebugEvent('jira_get_issue.start', { issueKey });

    try {
      const config = loadConfig(ctx.directory);

      if (!config.enabled) {
        return 'Jira integration is disabled in this project. Set `enabled: true` in `.opencode/jira.json`.';
      }

      const client = createJiraClient(config);
      if (!client) {
        const missing: string[] = [];
        if (!process.env[config.baseUrlEnv]) missing.push(config.baseUrlEnv);
        if (!process.env[config.emailEnv]) missing.push(config.emailEnv);
        if (!process.env[config.apiTokenEnv]) missing.push(config.apiTokenEnv);
        return `Jira not configured. Missing environment variables: ${missing.join(', ')}. Run jira_validate_config to check setup.`;
      }

      const issue = await client.getIssue(issueKey);

      if ('error' in issue && issue.error) {
        return `Error: ${issue.message}`;
      }

      return formatIssue(issue as JiraIssue);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_get_issue.error', { error: msg });
      return `Error: ${msg}`;
    }
  },
});

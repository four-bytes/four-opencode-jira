// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';

export const jiraAssignIssueTool = tool({
  description: 'Assign a Jira issue to a user (or unassign). Uses Jira Cloud account IDs. Pass "unassign" to remove the current assignee.',

  args: {
    issueKey: tool.schema.string().describe('The Jira issue key (e.g. "PROJ-42")'),
    assignee: tool.schema.string().describe('Jira Cloud account ID of the user, or "unassign" to remove the current assignee'),
  },

  async execute(args, ctx) {
    const { issueKey, assignee } = args;

    logDebugEvent('jira_assign_issue.start', { issueKey, assignee });

    try {
      const config = loadConfig(ctx.directory);
      if (!config.enabled) return 'Jira plugin is disabled. Enable it in .opencode/jira.json.';

      const client = createJiraClient(config);
      if (!client) return 'Jira client not configured. Check credentials in .opencode/jira.json or environment variables.';

      const accountId = assignee === 'unassign' ? null : assignee;
      const result = await client.assignIssue(issueKey, accountId);

      if (typeof result === 'object' && 'error' in result) {
        return `Failed to assign ${issueKey}: ${result.message}`;
      }

      const action = accountId ? `assigned to ${assignee}` : 'unassigned';
      logDebugEvent('jira_assign_issue.success', { issueKey, assignee });
      return `✅ Issue ${issueKey} ${action}.`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_assign_issue.error', { issueKey, error: msg });
      return `Error: ${msg}`;
    }
  },
});

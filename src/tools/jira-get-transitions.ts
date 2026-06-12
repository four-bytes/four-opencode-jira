// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';

export const jiraGetTransitionsTool = tool({
  description: 'List all available status transitions for a Jira issue. Does NOT execute any transition — read-only.',

  args: {
    issueKey: tool.schema.string().describe('The Jira issue key (e.g. "PROJ-42")'),
  },

  async execute(args, ctx) {
    const { issueKey } = args;

    logDebugEvent('jira_get_transitions.start', { issueKey });

    try {
      const config = loadConfig(ctx.directory);
      if (!config.enabled) return 'Jira plugin is disabled. Enable it in .opencode/jira.json.';

      const client = createJiraClient(config);
      if (!client) return 'Jira client not configured. Check credentials in .opencode/jira.json or environment variables.';

      const result = await client.getTransitions(issueKey);

      if (typeof result === 'object' && 'error' in result) {
        return `Failed to get transitions for ${issueKey}: ${result.message}`;
      }

      if (!result || result.length === 0) {
        return `No transitions available for ${issueKey}. This issue may be in a terminal state or the workflow has no transitions.`;
      }

      const lines = [`Available transitions for ${issueKey}:`];
      for (const t of result) {
        lines.push(`  - ${t.name} (ID: ${t.id})`);
      }

      logDebugEvent('jira_get_transitions.success', { issueKey, count: result.length });
      return lines.join('\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_get_transitions.error', { issueKey, error: msg });
      return `Error: ${msg}`;
    }
  },
});

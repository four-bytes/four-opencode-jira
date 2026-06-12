// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';

export const jiraSearchUsersTool = tool({
  description: 'Search for Jira users by name or email. Returns account IDs needed for jira_assign_issue.',

  args: {
    query: tool.schema.string().describe('Name or email to search for (partial match supported, e.g. "Robby")'),
  },

  async execute(args, ctx) {
    const { query } = args;

    logDebugEvent('jira_search_users.start', { query });

    try {
      const config = loadConfig(ctx.directory);
      if (!config.enabled) return 'Jira plugin is disabled.';

      const client = createJiraClient(config);
      if (!client) return 'Jira client not configured.';

      const result = await client.searchUsers(query);

      if (typeof result === 'object' && 'error' in result && result.error) {
        return `Failed to search users: ${result.message}`;
      }

      const users = result as Array<{ accountId: string; displayName: string; emailAddress?: string }>;
      if (!users || users.length === 0) {
        return `No users found for "${query}".`;
      }

      const lines = [`Users matching "${query}":`];
      for (const u of users.slice(0, 10)) {
        const email = u.emailAddress ? ` (${u.emailAddress})` : '';
        lines.push(`  - ${u.displayName}${email} — accountId: ${u.accountId}`);
      }

      logDebugEvent('jira_search_users.success', { query, count: users.length });
      return lines.join('\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_search_users.error', { query, error: msg });
      return `Error: ${msg}`;
    }
  },
});

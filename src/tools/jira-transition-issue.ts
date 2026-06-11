// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';
import type { Transition } from '../types';

// ────────────────────────────────────────────────────────────────
// Tool definition
// ────────────────────────────────────────────────────────────────

export const jiraTransitionIssueTool = tool({
  description: 'Transition a Jira issue to a different status. Find transition by name match, or list available transitions if no match.',

  args: {
    issueKey: tool.schema.string().describe('Jira issue key (e.g. SESSION-1026)'),
    transitionName: tool.schema.string().describe('Transition name to execute (e.g. "In Progress", "Done", "Blocked"). Partial/fuzzy match supported.'),
  },

  async execute(args, ctx) {
    const issueKey = args.issueKey as string;
    const transitionName = args.transitionName as string;
    logDebugEvent('jira_transition_issue.start', { issueKey, transitionName });

    try {
      const config = loadConfig(ctx.directory);

      if (!config.enabled) {
        return 'Jira integration is disabled in this project.';
      }

      if (!config.transitions.enabled) {
        return 'Transitions are disabled in this project\'s Jira config. Enable with `transitions.enabled: true` in `.opencode/jira.json`.';
      }

      const client = createJiraClient(config);
      if (!client) {
        const missing: string[] = [];
        if (!process.env[config.baseUrlEnv]) missing.push(config.baseUrlEnv);
        if (!process.env[config.emailEnv]) missing.push(config.emailEnv);
        if (!process.env[config.apiTokenEnv]) missing.push(config.apiTokenEnv);
        return `Jira not configured. Missing environment variables: ${missing.join(', ')}.`;
      }

      // Get available transitions
      const transitionsResult = await client.getTransitions(issueKey);

      if ('error' in transitionsResult && transitionsResult.error) {
        return `Error getting transitions: ${transitionsResult.message}`;
      }

      const transitions = transitionsResult as Transition[];

      if (transitions.length === 0) {
        return `No transitions available for issue ${issueKey}.`;
      }

      // Try to find a matching transition
      // First: exact match (case-insensitive)
      // Second: partial match (case-insensitive)
      const searchLower = transitionName.toLowerCase();
      let match = transitions.find(t => t.name.toLowerCase() === searchLower)
        || transitions.find(t => t.name.toLowerCase().includes(searchLower));

      if (!match) {
        // No match found — list available transitions
        const available = transitions.map(t => `  - ${t.name} (ID: ${t.id})`).join('\n');
        return `No transition matching "${transitionName}" found for ${issueKey}.\n\nAvailable transitions:\n${available}`;
      }

      // Execute the transition
      const result = await client.doTransition(issueKey, match.id);

      if (result && 'error' in result && result.error) {
        return `Error executing transition: ${result.message}`;
      }

      return `Successfully transitioned ${issueKey} to "${match.name}".`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_transition_issue.error', { error: msg });
      return `Error: ${msg}`;
    }
  },
});

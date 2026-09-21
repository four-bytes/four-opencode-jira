// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';
import { formatComment } from '../comment-formatter';

export const jiraEditDescriptionTool = tool({
  description: 'Edit the description of an existing Jira issue. Accepts markdown (converted to ADF); an empty or whitespace-only description clears it.',

  args: {
    issueKey: tool.schema.string().describe('The Jira issue key (e.g. "PROJ-42")'),
    description: tool.schema.string().describe('New issue description in markdown (converted to ADF). Empty/whitespace clears the description.'),
  },

  async execute(args, ctx) {
    const { issueKey, description } = args;

    logDebugEvent('jira_edit_description.start', { issueKey });

    try {
      const config = loadConfig(ctx.directory);

      if (!config.enabled) {
        return 'Jira integration is disabled in this project.';
      }

      const client = createJiraClient(config);
      if (!client) {
        const missing: string[] = [];
        const hasBaseUrl = config.baseUrl || process.env[config.baseUrlEnv];
        const hasEmail = config.email || process.env[config.emailEnv];
        const hasApiToken = config.apiToken || process.env[config.apiTokenEnv];
        if (!hasBaseUrl) missing.push(config.baseUrlEnv);
        if (!hasEmail) missing.push(config.emailEnv);
        if (!hasApiToken) missing.push(config.apiTokenEnv);
        return `Jira not configured. Missing: ${missing.length ? missing.join(', ') : 'unknown credentials'}.`;
      }

      // Convert markdown description to ADF; empty/whitespace clears via null.
      let descAdf: object | null = null;
      if (description.trim()) {
        const formatted = formatComment('adf', { details: description });
        descAdf = typeof formatted === 'string'
          ? { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: formatted }] }] }
          : formatted;
      }

      const result = await client.updateDescription(issueKey, descAdf);

      if (typeof result === 'object' && 'error' in result && result.error) {
        logDebugEvent('jira_edit_description.error', { issueKey, error: result.message });
        return `Error updating description: ${result.message}`;
      }

      logDebugEvent('jira_edit_description.success', { issueKey });
      return `✅ Description updated for ${issueKey}.`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_edit_description.error', { issueKey, error: msg });
      return `Error: ${msg}`;
    }
  },
});

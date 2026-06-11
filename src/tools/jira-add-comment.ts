// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';
import { formatComment } from '../comment-formatter';
import type { CommentResult } from '../types';

// ────────────────────────────────────────────────────────────────
// Tool definition
// ────────────────────────────────────────────────────────────────

export const jiraAddCommentTool = tool({
  description: 'Add a comment to a Jira issue. Supports markdown, plain text, and ADF templates based on config.',

  args: {
    issueKey: tool.schema.string().describe('Jira issue key (e.g. SESSION-1026)'),
    comment: tool.schema.string().describe('Comment text to post on the issue'),
  },

  async execute(args, ctx) {
    const issueKey = args.issueKey as string;
    const commentText = args.comment as string;
    logDebugEvent('jira_add_comment.start', { issueKey, commentLength: commentText.length });

    try {
      const config = loadConfig(ctx.directory);

      if (!config.enabled) {
        return 'Jira integration is disabled in this project.';
      }

      if (!config.comments.enabled) {
        return 'Comments are disabled in this project\'s Jira config.';
      }

      const client = createJiraClient(config);
      if (!client) {
        const missing: string[] = [];
        if (!process.env[config.baseUrlEnv]) missing.push(config.baseUrlEnv);
        if (!process.env[config.emailEnv]) missing.push(config.emailEnv);
        if (!process.env[config.apiTokenEnv]) missing.push(config.apiTokenEnv);
        return `Jira not configured. Missing environment variables: ${missing.join(', ')}.`;
      }

      // Format comment using the configured template
      const formatted = formatComment(config.comments.template, {
        summary: commentText.substring(0, 100),
        details: commentText,
      });

      const result = await client.addComment(issueKey, formatted);

      if ('error' in result && result.error) {
        return `Error posting comment: ${result.message}`;
      }

      const comment = result as CommentResult;
      return `Comment posted successfully.\n\nIssue: ${issueKey}\nComment ID: ${comment.id}\nCreated: ${comment.created}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_add_comment.error', { error: msg });
      return `Error: ${msg}`;
    }
  },
});

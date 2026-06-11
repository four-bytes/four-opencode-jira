// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';
import { formatComment } from '../comment-formatter';
import { defaultRateLimiter } from '../rate-limiter';
import type { CommentResult, Transition } from '../types';

// ────────────────────────────────────────────────────────────────
// Tool definition
// ────────────────────────────────────────────────────────────────

export const jiraSyncProgressTool = tool({
  description: 'Post a progress comment on a Jira issue with optional status transition. Respects rate limits from config.',

  args: {
    issueKey: tool.schema.string().describe('Jira issue key (e.g. SESSION-1026)'),
    summary: tool.schema.string().describe('Progress summary (1-2 sentences)'),
    details: tool.schema.string().optional().describe('Additional details about the progress'),
    statusHint: tool.schema.string().optional().describe('Suggested status transition name (e.g. "In Progress", "Done"). Only used if transitions.enabled + mapping matches.'),
  },

  async execute(args, ctx) {
    const issueKey = args.issueKey as string;
    const summary = args.summary as string;
    const details = args.details as string | undefined;
    const statusHint = args.statusHint as string | undefined;
    const sessionId = ctx.sessionID;

    logDebugEvent('jira_sync_progress.start', { issueKey, summary: summary.substring(0, 80), statusHint });

    try {
      const config = loadConfig(ctx.directory);

      if (!config.enabled) {
        return 'Jira integration is disabled in this project.';
      }

      if (!config.comments.enabled) {
        return 'Comments are disabled in this project\'s Jira config.';
      }

      // Rate limiting
      if (!defaultRateLimiter.canComment(sessionId, config.comments.maxPerSession, config.comments.dedupeWindowSeconds)) {
        const current = defaultRateLimiter.getCount(sessionId, config.comments.dedupeWindowSeconds);
        return `Rate limit reached: ${current}/${config.comments.maxPerSession} comments in the last ${config.comments.dedupeWindowSeconds}s. Comment skipped.`;
      }

      const client = createJiraClient(config);
      if (!client) {
        const missing: string[] = [];
        if (!process.env[config.baseUrlEnv]) missing.push(config.baseUrlEnv);
        if (!process.env[config.emailEnv]) missing.push(config.emailEnv);
        if (!process.env[config.apiTokenEnv]) missing.push(config.apiTokenEnv);
        return `Jira not configured. Missing environment variables: ${missing.join(', ')}.`;
      }

      // Format and post comment
      const formatted = formatComment(config.comments.template, {
        summary,
        details,
        statusHint,
      });

      const commentResult = await client.addComment(issueKey, formatted);

      if ('error' in commentResult && commentResult.error) {
        return `Error posting comment: ${commentResult.message}`;
      }

      const comment = commentResult as CommentResult;
      const results: string[] = [];
      results.push(`Progress comment posted to ${issueKey} (Comment ID: ${comment.id}).`);

      // Optionally transition the issue
      if (statusHint && config.transitions.enabled && Object.keys(config.transitions.mapping).length > 0) {
        // Try to find the statusHint in the mapping
        const mappedStatus = config.transitions.mapping[statusHint] || statusHint;

        const transitionsResult = await client.getTransitions(issueKey);

        if ('error' in transitionsResult && transitionsResult.error) {
          results.push(`Warning: Could not check transitions: ${transitionsResult.message}`);
        } else {
          const transitions = transitionsResult as Transition[];
          const searchLower = mappedStatus.toLowerCase();
          const match = transitions.find(t => t.name.toLowerCase() === searchLower)
            || transitions.find(t => t.name.toLowerCase().includes(searchLower));

          if (match) {
            const transitionResult = await client.doTransition(issueKey, match.id);
            if (transitionResult && 'error' in transitionResult && transitionResult.error) {
              results.push(`Warning: Transition to "${match.name}" failed: ${transitionResult.message}`);
            } else {
              results.push(`Issue transitioned to "${match.name}".`);
            }
          } else {
            results.push(`Note: No transition matching "${mappedStatus}" found for this issue.`);
          }
        }
      }

      return results.join('\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_sync_progress.error', { error: msg });
      return `Error: ${msg}`;
    }
  },
});

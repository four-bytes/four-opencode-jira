// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { extractIssueKey } from '../issue-key';
import { logDebugEvent } from '../debug-logger';

// ────────────────────────────────────────────────────────────────
// Tool definition
// ────────────────────────────────────────────────────────────────

export const jiraExtractIssueKeyTool = tool({
  description: 'Extract Jira issue key from text, branch name, or CWD. Returns key, confidence, and source.',

  args: {
    text: tool.schema.string().optional().describe('Text to search for issue key'),
    branchName: tool.schema.string().optional().describe('Git branch name to search'),
    cwd: tool.schema.string().optional().describe('Current working directory path to search'),
  },

  async execute(args, ctx) {
    const text = args.text as string | undefined;
    const branchName = args.branchName as string | undefined;
    const cwd = args.cwd as string | undefined;

    logDebugEvent('jira_extract_issue_key.start', { text, branchName, cwd });

    try {
      const config = loadConfig(ctx.directory);

      // Use provided args or fall back to context
      const effectiveCwd = cwd || ctx.directory;
      const effectiveBranch = branchName;

      const result = extractIssueKey({
        text: text,
        branchName: effectiveBranch,
        cwd: effectiveCwd,
        regex: config.issueKeyDetection.regex,
      });

      return JSON.stringify(result, null, 2);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_extract_issue_key.error', { error: msg });
      return `Error: ${msg}`;
    }
  },
});

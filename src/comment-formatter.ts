// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { logDebugEvent } from './debug-logger';

// ────────────────────────────────────────────────────────────────
// Comment Formatter — Templates for Jira comments
// ────────────────────────────────────────────────────────────────

export interface CommentData {
  summary: string;
  details?: string;
  statusHint?: string;
}

/**
 * Format a comment using the specified template.
 *
 * Templates:
 *   - "markdown": Rich markdown with emoji, timestamp
 *   - "plain": Simple text block
 *   - "adf": Atlassian Document Format JSON (stringified)
 */
export function formatComment(template: string, data: CommentData): string {
  switch (template) {
    case 'markdown':
      return formatMarkdown(data);
    case 'adf':
      return JSON.stringify(formatADF(data));
    case 'plain':
    default:
      return formatPlain(data);
  }
}

/**
 * Format as Markdown (most common template).
 */
function formatMarkdown(data: CommentData): string {
  const lines: string[] = [];

  if (data.summary) lines.push(data.summary);

  if (data.details) {
    if (lines.length > 0) lines.push('');
    lines.push(data.details);
  }

  logDebugEvent('comment_formatter.markdown', { summary: data.summary.substring(0, 80) });
  return lines.join('\n');
}

/**
 * Format as plain text.
 */
function formatPlain(data: CommentData): string {
  const lines: string[] = [];

  if (data.summary) lines.push(data.summary);

  if (data.details) {
    if (lines.length > 0) lines.push('');
    lines.push(data.details);
  }

  return lines.join('\n');
}

/**
 * Format as Atlassian Document Format (ADF) JSON.
 *
 * This produces a valid ADF document that can be used
 * directly in the Jira REST API comment body.
 */
function formatADF(data: CommentData): object {
  const content: object[] = [];

  // Summary
  content.push({
    type: 'paragraph',
    content: [{ type: 'text', text: data.summary }],
  });

  // Details
  if (data.details) {
    for (const line of data.details.split('\n')) {
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line }],
      });
    }
  }

  logDebugEvent('comment_formatter.adf', { summary: data.summary.substring(0, 80) });

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

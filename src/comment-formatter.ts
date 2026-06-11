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
  const timestamp = new Date().toISOString();

  switch (template) {
    case 'markdown':
      return formatMarkdown(data, timestamp);
    case 'adf':
      return JSON.stringify(formatADF(data, timestamp));
    case 'plain':
    default:
      return formatPlain(data, timestamp);
  }
}

/**
 * Format as Markdown (most common template).
 */
function formatMarkdown(data: CommentData, timestamp: string): string {
  const lines: string[] = [];

  lines.push('### 🤖 OpenCode Update');
  lines.push('');

  if (data.statusHint) {
    lines.push(`> Status: ${data.statusHint}`);
    lines.push('');
  }

  lines.push(`**${data.summary}**`);

  if (data.details) {
    lines.push('');
    lines.push(data.details);
  }

  lines.push('');
  lines.push(`⏱️ ${timestamp}`);

  logDebugEvent('comment_formatter.markdown', { summary: data.summary.substring(0, 80) });
  return lines.join('\n');
}

/**
 * Format as plain text.
 */
function formatPlain(data: CommentData, timestamp: string): string {
  const lines: string[] = [];

  lines.push('OpenCode Update');
  if (data.statusHint) {
    lines.push(`Status: ${data.statusHint}`);
  }
  lines.push(data.summary);

  if (data.details) {
    lines.push('');
    lines.push(data.details);
  }

  lines.push('');
  lines.push(timestamp);

  return lines.join('\n');
}

/**
 * Format as Atlassian Document Format (ADF) JSON.
 *
 * This produces a valid ADF document that can be used
 * directly in the Jira REST API comment body.
 */
function formatADF(data: CommentData, timestamp: string): object {
  const content: object[] = [];

  // Heading
  content.push({
    type: 'heading',
    attrs: { level: 3 },
    content: [{ type: 'text', text: 'OpenCode Update', marks: [{ type: 'em' }] }],
  });

  // Status hint
  if (data.statusHint) {
    content.push({
      type: 'panel',
      attrs: { panelType: 'info' },
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: `Status: ${data.statusHint}`, marks: [{ type: 'strong' }] }],
        },
      ],
    });
  }

  // Summary
  content.push({
    type: 'paragraph',
    content: [{ type: 'text', text: data.summary, marks: [{ type: 'strong' }] }],
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

  // Timestamp
  content.push({
    type: 'paragraph',
    content: [{ type: 'text', text: `⏱️ ${timestamp}`, marks: [{ type: 'textColor', attrs: { color: '#999999' } }] }],
  });

  logDebugEvent('comment_formatter.adf', { summary: data.summary.substring(0, 80) });

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

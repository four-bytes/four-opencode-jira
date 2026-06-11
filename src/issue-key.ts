// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { basename } from 'node:path';
import type { IssueKeyResult } from './types';
import { logDebugEvent } from './debug-logger';

/**
 * Extract a Jira issue key from text using a regex pattern.
 */
function matchInText(text: string, regex: string): string | null {
  try {
    const re = new RegExp(regex, 'i');
    const match = text.match(re);
    return match ? match[0].toUpperCase() : null;
  } catch {
    return null;
  }
}

/**
 * Extract a Jira issue key from multiple sources.
 *
 * Priority:
 *   1. Explicit text (confidence: 1.0)
 *   2. Branch name (confidence: 0.8)
 *   3. CWD path (confidence: 0.5)
 *
 * Uses the regex from config to match issue keys.
 */
export function extractIssueKey(params: {
  text?: string;
  branchName?: string;
  cwd?: string;
  regex?: string;
}): IssueKeyResult {
  const regex = params.regex || '[A-Z][A-Z0-9]+-\\d+';

  // 1. Explicit text
  if (params.text && params.text.trim()) {
    const key = matchInText(params.text, regex);
    if (key) {
      logDebugEvent('issue_key.extracted', { key, confidence: 1.0, source: 'text' });
      return { key, confidence: 1.0, source: 'text' };
    }
  }

  // 2. Branch name
  if (params.branchName && params.branchName.trim()) {
    const key = matchInText(params.branchName, regex);
    if (key) {
      logDebugEvent('issue_key.extracted', { key, confidence: 0.8, source: 'branch' });
      return { key, confidence: 0.8, source: 'branch' };
    }
  }

  // 3. CWD path
  if (params.cwd && params.cwd.trim()) {
    const dirName = basename(params.cwd);
    const key = matchInText(dirName, regex);
    if (key) {
      logDebugEvent('issue_key.extracted', { key, confidence: 0.5, source: 'cwd' });
      return { key, confidence: 0.5, source: 'cwd' };
    }
  }

  logDebugEvent('issue_key.not_found', { text: params.text, branch: params.branchName, cwd: params.cwd });
  return { key: null, confidence: 0, source: null };
}

export { matchInText };

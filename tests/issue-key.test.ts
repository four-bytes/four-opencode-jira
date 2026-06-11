// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { describe, it, expect } from 'bun:test';
import { extractIssueKey } from '../src/issue-key';

describe('extractIssueKey', () => {
  const defaultRegex = '[A-Z][A-Z0-9]+-\\d+';

  it('extracts from explicit text with confidence 1.0', () => {
    const result = extractIssueKey({ text: 'SESSION-1026', regex: defaultRegex });
    expect(result.key).toBe('SESSION-1026');
    expect(result.confidence).toBe(1.0);
    expect(result.source).toBe('text');
  });

  it('extracts from branch name with confidence 0.8', () => {
    const result = extractIssueKey({ branchName: 'SESSION-1026-mp-footer-styling', regex: defaultRegex });
    expect(result.key).toBe('SESSION-1026');
    expect(result.confidence).toBe(0.8);
    expect(result.source).toBe('branch');
  });

  it('extracts from branch name with prefix (fix/SW-42-bug)', () => {
    const result = extractIssueKey({ branchName: 'fix/SW-42-bug', regex: defaultRegex });
    expect(result.key).toBe('SW-42');
    expect(result.confidence).toBe(0.8);
    expect(result.source).toBe('branch');
  });

  it('extracts from branch name with feat/PROJ-123', () => {
    const result = extractIssueKey({ branchName: 'feat/PROJ-123', regex: defaultRegex });
    expect(result.key).toBe('PROJ-123');
    expect(result.confidence).toBe(0.8);
    expect(result.source).toBe('branch');
  });

  it('extracts from cwd path with confidence 0.5', () => {
    const result = extractIssueKey({ cwd: '/home/user/projects/SESSION-1026-mp-footer', regex: defaultRegex });
    expect(result.key).toBe('SESSION-1026');
    expect(result.confidence).toBe(0.5);
    expect(result.source).toBe('cwd');
  });

  it('prioritizes text over branch over cwd', () => {
    const result = extractIssueKey({
      text: 'TEXT-999',
      branchName: 'BRANCH-888-fix',
      cwd: '/home/CWD-777',
      regex: defaultRegex,
    });
    expect(result.key).toBe('TEXT-999');
    expect(result.confidence).toBe(1.0);
    expect(result.source).toBe('text');
  });

  it('falls back to branch when text has no match', () => {
    const result = extractIssueKey({
      text: 'no issue key here',
      branchName: 'BRANCH-888-fix',
      cwd: '/home/CWD-777',
      regex: defaultRegex,
    });
    expect(result.key).toBe('BRANCH-888');
    expect(result.confidence).toBe(0.8);
    expect(result.source).toBe('branch');
  });

  it('falls back to cwd when text and branch have no match', () => {
    const result = extractIssueKey({
      text: 'no key',
      branchName: 'no-key-either',
      cwd: '/home/CWD-777-task',
      regex: defaultRegex,
    });
    expect(result.key).toBe('CWD-777');
    expect(result.confidence).toBe(0.5);
    expect(result.source).toBe('cwd');
  });

  it('returns null when no match found anywhere', () => {
    const result = extractIssueKey({
      text: 'nothing here',
      branchName: 'just-a-branch',
      cwd: '/home/user/project',
      regex: defaultRegex,
    });
    expect(result.key).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.source).toBeNull();
  });

  it('uses custom regex when provided', () => {
    const customRegex = 'SESSION-\\d+';
    
    // Should match with custom regex
    const matchResult = extractIssueKey({ text: 'SESSION-1026', regex: customRegex });
    expect(matchResult.key).toBe('SESSION-1026');

    // Should NOT match non-SESSION keys
    const noMatchResult = extractIssueKey({ text: 'OTHER-123', regex: customRegex });
    expect(noMatchResult.key).toBeNull();
  });

  it('handles empty text gracefully', () => {
    const result = extractIssueKey({ text: '   ', branchName: 'SESSION-1026-fix' });
    expect(result.key).toBe('SESSION-1026');
    expect(result.source).toBe('branch');
  });

  it('normalizes to uppercase', () => {
    const result = extractIssueKey({ text: 'session-1026', regex: defaultRegex });
    expect(result.key).toBe('SESSION-1026');
  });
});

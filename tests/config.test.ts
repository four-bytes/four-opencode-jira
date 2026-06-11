// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig, getEnvVar } from '../src/config';
import type { JiraConfig, IssueKeyDetectionConfig } from '../src/types';
import { DEFAULT_CONFIG } from '../src/types';

// ────────────────────────────────────────────────────────────────
// Test helpers
// ────────────────────────────────────────────────────────────────

let tmpDir: string;

function setupTmpDir(): string {
  const dir = join(tmpdir(), `jira-config-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function createJiraJson(dir: string, content: object): void {
  const opencodeDir = join(dir, '.opencode');
  mkdirSync(opencodeDir, { recursive: true });
  writeFileSync(join(opencodeDir, 'jira.json'), JSON.stringify(content, null, 2));
}

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

describe('loadConfig', () => {
  beforeEach(() => {
    tmpDir = setupTmpDir();
  });

  afterEach(() => {
    if (tmpDir && existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns defaults when no jira.json exists', () => {
    const config = loadConfig(tmpDir);
    expect(config.enabled).toBe(true);
    expect(config.projectKey).toBe('SESSION');
    expect(config.baseUrlEnv).toBe('JIRA_BASE_URL');
    expect(config.emailEnv).toBe('JIRA_EMAIL');
    expect(config.apiTokenEnv).toBe('JIRA_API_TOKEN');
    expect(config.issueKeyDetection.fromBranch).toBe(true);
    expect(config.issueKeyDetection.fromCwd).toBe(true);
    expect(config.issueKeyDetection.fromPrompt).toBe(true);
    expect(config.comments.enabled).toBe(true);
    expect(config.comments.mode).toBe('milestones');
    expect(config.transitions.enabled).toBe(false);
  });

  it('loads and merges custom config from jira.json', () => {
    createJiraJson(tmpDir, {
      projectKey: 'CUSTOM',
      comments: {
        maxPerSession: 5,
        template: 'plain' as const,
      },
      transitions: {
        enabled: true,
      },
    });

    const config = loadConfig(tmpDir);

    // Overridden
    expect(config.projectKey).toBe('CUSTOM');
    expect(config.comments.maxPerSession).toBe(5);
    expect(config.comments.template).toBe('plain');
    expect(config.transitions.enabled).toBe(true);

    // Defaults still intact
    expect(config.enabled).toBe(true);
    expect(config.baseUrlEnv).toBe('JIRA_BASE_URL');
    expect(config.issueKeyDetection.regex).toBe('[A-Z][A-Z0-9]+-\\d+');
  });

  it('deep-merges nested objects', () => {
    createJiraJson(tmpDir, {
      issueKeyDetection: {
        fromCwd: false,
        regex: 'TEST-\\d+',
      },
    });

    const config = loadConfig(tmpDir);

    expect(config.issueKeyDetection.fromBranch).toBe(true);  // default preserved
    expect(config.issueKeyDetection.fromCwd).toBe(false);    // overridden
    expect(config.issueKeyDetection.fromPrompt).toBe(true);  // default preserved
    expect(config.issueKeyDetection.regex).toBe('TEST-\\d+'); // overridden
  });

  it('handles empty config gracefully', () => {
    createJiraJson(tmpDir, {});

    const config = loadConfig(tmpDir);
    expect(config.enabled).toBe(true);
    expect(config.projectKey).toBe('SESSION');
  });

  it('handles invalid JSON gracefully — falls back to defaults', () => {
    const opencodeDir = join(tmpDir, '.opencode');
    mkdirSync(opencodeDir, { recursive: true });
    writeFileSync(join(opencodeDir, 'jira.json'), '{ invalid json }');

    const config = loadConfig(tmpDir);
    // Falls back to defaults
    expect(config.enabled).toBe(true);
    expect(config.projectKey).toBe('SESSION');
  });
});

describe('getEnvVar', () => {
  it('returns env var based on config field name', () => {
    const config: JiraConfig = { ...DEFAULT_CONFIG, baseUrlEnv: 'JIRA_BASE_URL' };

    // Save original
    const original = process.env.JIRA_BASE_URL;

    process.env.JIRA_BASE_URL = 'https://jira.example.com';
    const result = getEnvVar(config, 'baseUrlEnv');
    expect(result).toBe('https://jira.example.com');

    // Restore
    if (original !== undefined) {
      process.env.JIRA_BASE_URL = original;
    } else {
      delete process.env.JIRA_BASE_URL;
    }
  });

  it('returns undefined when env var is not set', () => {
    const config: JiraConfig = { ...DEFAULT_CONFIG, baseUrlEnv: 'NONEXISTENT_VAR' };
    const result = getEnvVar(config, 'baseUrlEnv');
    expect(result).toBeUndefined();
  });

  it('returns undefined when config field is empty', () => {
    const config: JiraConfig = { ...DEFAULT_CONFIG, baseUrlEnv: '' };
    const result = getEnvVar(config, 'baseUrlEnv');
    expect(result).toBeUndefined();
  });
});

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { JiraConfig } from './types';
import { DEFAULT_CONFIG } from './types';
import { logDebugEvent } from './debug-logger';

/**
 * Deep-merge two objects. Source values override target values.
 * Only merges plain objects — arrays and primitives are replaced.
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sv = source[key];
    const tv = target[key];
    if (sv !== undefined && sv !== null && typeof sv === 'object' && !Array.isArray(sv) &&
        tv !== undefined && tv !== null && typeof tv === 'object' && !Array.isArray(tv)) {
      (result as Record<string, unknown>)[key as string] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>,
      );
    } else if (sv !== undefined) {
      (result as Record<string, unknown>)[key as string] = sv;
    }
  }
  return result;
}

/**
 * Load Jira configuration from a project directory.
 *
 * Reads `<cwd>/.opencode/jira.json` and deep-merges with defaults.
 * If the file doesn't exist, returns the default config.
 */
export function loadConfig(cwd: string): JiraConfig {
  const configPath = join(cwd, '.opencode', 'jira.json');

  if (!existsSync(configPath)) {
    logDebugEvent('jira_config.load', { cwd, found: false, note: 'using defaults' });
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw);
    const merged = deepMerge(
      DEFAULT_CONFIG as unknown as Record<string, unknown>,
      parsed,
    ) as unknown as JiraConfig;

    logDebugEvent('jira_config.load', { cwd, found: true, projectKey: merged.projectKey });
    return merged;
  } catch (err) {
    logDebugEvent('jira_config.error', { cwd, error: String(err), note: 'using defaults' });
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Get an environment variable by the name stored in config.
 * E.g., config.baseUrlEnv = "JIRA_BASE_URL" → reads process.env.JIRA_BASE_URL
 */
export function getEnvVar(config: JiraConfig, envField: 'baseUrlEnv' | 'emailEnv' | 'apiTokenEnv'): string | undefined {
  const varName = config[envField];
  if (!varName) return undefined;
  return process.env[varName] || undefined;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import type { Hooks } from '@opencode-ai/plugin';
import { loadConfig } from './config';
import { logDebugEvent } from './debug-logger';
import { defaultRateLimiter } from './rate-limiter';

/**
 * Build the hooks object for the Jira plugin.
 *
 * ALL hooks are DEFENSIVE:
 * - No auto status changes without config opt-in
 * - Fail silently, never throw
 * - Log via debug-logger
 */
export function createJiraHooks(): Partial<Hooks> {
  return {
    /**
     * tool.execute.after — Log major tool completions.
     * Does NOT auto-comment unless config explicitly allows.
     */
    'tool.execute.after': async (input, output) => {
      try {
        const toolName = input.tool;

        // Only track Jira-specific tools
        if (!toolName.startsWith('jira_')) return;

        logDebugEvent('hook.tool_execute_after', {
          tool: toolName,
          sessionId: input.sessionID.substring(0, 8),
          hasError: output.output?.includes('Error:') || false,
        });
      } catch {
        // Never throw from hooks
      }
    },

    /**
     * Dispose — cleanup when plugin is unloaded.
     */
    dispose: async () => {
      try {
        defaultRateLimiter.reset('*');
        logDebugEvent('hook.dispose', {});
      } catch {
        // Silent
      }
    },
  };
}

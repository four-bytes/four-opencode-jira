// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { logDebugEvent } from './debug-logger';

// ────────────────────────────────────────────────────────────────
// RateLimiter — in-memory per-session rate limiter
// ────────────────────────────────────────────────────────────────

/**
 * Simple in-memory rate limiter that tracks per-session timestamps.
 * Evicts old entries on check.
 */
export class RateLimiter {
  private sessions: Map<string, number[]> = new Map();

  /**
   * Check whether an action is allowed for a given session.
   *
   * @param sessionId  - Unique session identifier
   * @param limit      - Maximum allowed actions within the window
   * @param windowSeconds - Time window in seconds
   * @returns true if the action is allowed, false if rate-limited
   */
  canComment(sessionId: string, limit: number, windowSeconds: number): boolean {
    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;

    // Get or create session timestamps
    let timestamps = this.sessions.get(sessionId);
    if (!timestamps) {
      timestamps = [];
      this.sessions.set(sessionId, timestamps);
    }

    // Evict old entries
    const filtered = timestamps.filter(ts => ts > cutoff);
    this.sessions.set(sessionId, filtered);

    // Check limit
    if (filtered.length >= limit) {
      logDebugEvent('rate_limiter.blocked', {
        sessionId: sessionId.substring(0, 8),
        current: filtered.length,
        limit,
        windowSeconds,
        oldest: filtered.length > 0 ? new Date(filtered[0]!).toISOString() : null,
      });
      return false;
    }

    // Record this action
    filtered.push(now);
    this.sessions.set(sessionId, filtered);

    logDebugEvent('rate_limiter.allowed', {
      sessionId: sessionId.substring(0, 8),
      current: filtered.length,
      limit,
    });
    return true;
  }

  /**
   * Reset a specific session's tracking.
   */
  reset(sessionId: string): void {
    this.sessions.delete(sessionId);
    logDebugEvent('rate_limiter.reset', { sessionId: sessionId.substring(0, 8) });
  }

  /**
   * Get current count for a session (without recording anything).
   */
  getCount(sessionId: string, windowSeconds: number): number {
    const now = Date.now();
    const cutoff = now - windowSeconds * 1000;
    const timestamps = this.sessions.get(sessionId) || [];
    return timestamps.filter(ts => ts > cutoff).length;
  }
}

/**
 * Default singleton instance for plugin-wide use.
 */
export const defaultRateLimiter = new RateLimiter();

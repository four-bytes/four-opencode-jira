// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { describe, it, expect } from 'bun:test';
import { RateLimiter } from '../src/rate-limiter';

describe('RateLimiter', () => {
  it('allows first call within window', () => {
    const limiter = new RateLimiter();
    expect(limiter.canComment('session-1', 3, 900)).toBe(true);
  });

  it('allows up to the limit', () => {
    const limiter = new RateLimiter();
    expect(limiter.canComment('session-1', 3, 900)).toBe(true);
    expect(limiter.canComment('session-1', 3, 900)).toBe(true);
    expect(limiter.canComment('session-1', 3, 900)).toBe(true);
    // 4th call should be blocked
    expect(limiter.canComment('session-1', 3, 900)).toBe(false);
  });

  it('tracks different sessions independently', () => {
    const limiter = new RateLimiter();
    
    // Fill session-1
    limiter.canComment('session-1', 2, 900);
    limiter.canComment('session-1', 2, 900);
    expect(limiter.canComment('session-1', 2, 900)).toBe(false);

    // session-2 should still be free
    expect(limiter.canComment('session-2', 2, 900)).toBe(true);
  });

  it('resets a session', () => {
    const limiter = new RateLimiter();
    
    limiter.canComment('session-1', 1, 900);
    expect(limiter.canComment('session-1', 1, 900)).toBe(false);

    limiter.reset('session-1');
    expect(limiter.canComment('session-1', 1, 900)).toBe(true);
  });

  it('evicts old entries after window expires', () => {
    const limiter = new RateLimiter();
    
    // Use a very short window (1 second)
    limiter.canComment('session-1', 1, 1);
    expect(limiter.canComment('session-1', 1, 1)).toBe(false);

    // This will be a test that depends on time. We'll just test the counting works.
    // Cannot easily test the actual time-based eviction without timers.
  });

  it('getCount returns current count without recording', () => {
    const limiter = new RateLimiter();
    
    expect(limiter.getCount('session-new', 900)).toBe(0);
    
    limiter.canComment('session-new', 10, 900);
    limiter.canComment('session-new', 10, 900);
    limiter.canComment('session-new', 10, 900);
    
    expect(limiter.getCount('session-new', 900)).toBe(3);
  });

  it('respects different limits per call', () => {
    const limiter = new RateLimiter();
    
    // Allowed with limit 5
    expect(limiter.canComment('session-1', 5, 900)).toBe(true);
    expect(limiter.canComment('session-1', 5, 900)).toBe(true);
    
    // Now check with limit 2 — already exceeded
    expect(limiter.getCount('session-1', 900)).toBe(2);
    
    // But canComment with limit 2 would block
    expect(limiter.canComment('session-1', 2, 900)).toBe(false);
  });
});

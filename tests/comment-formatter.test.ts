// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { describe, it, expect } from 'bun:test';
import { formatComment } from '../src/comment-formatter';

describe('formatComment', () => {
  const testData = {
    summary: 'Updated pricing logic for EU markets',
    details: 'Changed the VAT calculation to use the new 2026 rates.\nAlso fixed rounding for CHF and SEK.',
    statusHint: 'In Progress',
  };

  it('formats markdown with all fields', () => {
    const result = formatComment('markdown', testData);

    expect(result).toContain('### 🤖 OpenCode Update');
    expect(result).toContain('> Status: In Progress');
    expect(result).toContain('**Updated pricing logic for EU markets**');
    expect(result).toContain('Changed the VAT calculation');
    expect(result).toContain('fixed rounding for CHF and SEK');
    expect(result).toContain('⏱️ ');
  });

  it('formats markdown without optional fields', () => {
    const result = formatComment('markdown', {
      summary: 'Simple update',
    });

    expect(result).toContain('### 🤖 OpenCode Update');
    expect(result).toContain('**Simple update**');
    expect(result).not.toContain('> Status:');
    expect(result).toContain('⏱️ ');
  });

  it('formats plain text', () => {
    const result = formatComment('plain', testData);

    expect(result).toContain('OpenCode Update');
    expect(result).toContain('Status: In Progress');
    expect(result).toContain('Updated pricing logic for EU markets');
    expect(result).not.toContain('**'); // No markdown
    expect(result).not.toContain('###'); // No headings
  });

  it('formats plain text without optional fields', () => {
    const result = formatComment('plain', {
      summary: 'Simple update',
    });

    expect(result).toContain('OpenCode Update');
    expect(result).toContain('Simple update');
    expect(result).not.toContain('Status:');
  });

  it('formats ADF as valid JSON', () => {
    const result = formatComment('adf', testData);

    // Should be valid JSON
    const parsed = JSON.parse(result);
    expect(parsed.type).toBe('doc');
    expect(parsed.version).toBe(1);
    expect(Array.isArray(parsed.content)).toBe(true);
    expect(parsed.content.length).toBeGreaterThan(0);

    // Should contain summary text somewhere
    const contentStr = JSON.stringify(parsed.content);
    expect(contentStr).toContain('Updated pricing logic for EU markets');
  });

  it('formatComment with "adf" produces ADF the client can use directly', () => {
    const result = formatComment('adf', {
      summary: 'Done: completed feature #42',
      statusHint: 'Done',
    });

    const parsed = JSON.parse(result);
    expect(parsed.type).toBe('doc');
    // The ADF has heading + panel (status) + paragraph (summary) + timestamp paragraph
    expect(parsed.content.length).toBeGreaterThanOrEqual(3);
  });

  it('includes timestamp in all templates', () => {
    const markdown = formatComment('markdown', testData);
    const plain = formatComment('plain', testData);
    const adf = formatComment('adf', testData);

    expect(markdown).toContain('⏱️ ');
    expect(plain).toMatch(/\d{4}-\d{2}-\d{2}/); // ISO date
    expect(adf).toContain('⏱️ ');
  });
});

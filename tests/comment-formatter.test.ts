// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { describe, it, expect } from 'bun:test';
import { formatComment } from '../src/comment-formatter';

// ────────────────────────────────────────────────────────────────
// formatComment — every template produces an ADF document object.
// Jira Cloud v3 requires ADF for comment bodies, and `addComment`
// posts the returned object as `{ body: <adf> }` without stringifying.
// ────────────────────────────────────────────────────────────────

interface ADFDocShape {
  type: string;
  version: number;
  content: unknown[];
}

/** Narrow the `string | object` return type to an ADF doc, failing loudly if it is not one. */
function asDoc(result: string | object): ADFDocShape {
  expect(typeof result).toBe('object');
  const doc = result as ADFDocShape;
  expect(doc.type).toBe('doc');
  expect(doc.version).toBe(1);
  expect(Array.isArray(doc.content)).toBe(true);
  return doc;
}

/** All text carried anywhere in the node tree, for content assertions. */
function textOf(doc: ADFDocShape): string {
  return JSON.stringify(doc.content);
}

describe('formatComment', () => {
  const testData = {
    summary: 'Updated pricing logic for EU markets',
    details: 'Changed the VAT calculation to use the new 2026 rates.\nAlso fixed rounding for CHF and SEK.',
    statusHint: 'In Progress',
  };

  it('formats markdown as an ADF document with all fields', () => {
    const doc = asDoc(formatComment('markdown', testData));

    expect(doc.content.length).toBeGreaterThan(0);
    const text = textOf(doc);
    expect(text).toContain('In Progress');
    expect(text).toContain('Updated pricing logic for EU markets');
    expect(text).toContain('Changed the VAT calculation');
    expect(text).toContain('fixed rounding for CHF and SEK');
  });

  it('formats markdown without optional fields', () => {
    const doc = asDoc(formatComment('markdown', { summary: 'Simple update' }));

    expect(textOf(doc)).toContain('Simple update');
    // No statusHint was given, so no status node should be emitted.
    expect(textOf(doc)).not.toContain('In Progress');
  });

  // jira_add_comment posts the user's text as `details` alone. An omitted
  // summary must not put a lead-in line above the body (it used to pass the
  // first 100 chars as `summary`, which prefixed every comment with a
  // truncated copy of itself).
  it('emits the body once when only details are given', () => {
    const body = 'Reviewed the migration and it looks correct end to end.';
    for (const template of ['markdown', 'plain', 'adf']) {
      const doc = asDoc(formatComment(template, { details: body }));
      const occurrences = textOf(doc).split(body).length - 1;
      expect(occurrences).toBe(1);
      expect(doc.content.length).toBe(1);
    }
  });

  it('renders the status hint as a strong node', () => {
    const doc = asDoc(formatComment('markdown', testData));

    const first = doc.content[0] as { type: string; content: Array<{ text: string; marks?: Array<{ type: string }> }> };
    expect(first.type).toBe('paragraph');
    expect(first.content[0]!.text).toBe('In Progress');
    expect(first.content[0]!.marks?.[0]!.type).toBe('strong');
  });

  it('formats plain text as an ADF document', () => {
    const doc = asDoc(formatComment('plain', testData));

    const text = textOf(doc);
    expect(text).toContain('In Progress');
    expect(text).toContain('Updated pricing logic for EU markets');
    // Plain keeps every detail line as its own paragraph, unformatted.
    const types = doc.content.map((node) => (node as { type: string }).type);
    expect(new Set(types)).toEqual(new Set(['paragraph']));
  });

  it('formats plain text without optional fields', () => {
    const doc = asDoc(formatComment('plain', { summary: 'Simple update' }));

    expect(doc.content).toHaveLength(1);
    expect(textOf(doc)).toContain('Simple update');
  });

  it('splits plain-text details into one paragraph per line', () => {
    const doc = asDoc(formatComment('plain', {
      summary: 'Two-line detail',
      details: 'first line\n\nsecond line',
    }));

    // summary + two non-blank detail lines; the blank line is dropped.
    expect(doc.content).toHaveLength(3);
  });

  it('returns a pre-built ADF document untouched', () => {
    const prebuilt = {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'already ADF' }] }],
    };

    const doc = asDoc(formatComment('adf', { summary: '', details: JSON.stringify(prebuilt) }));

    expect(doc).toEqual(prebuilt);
  });

  it('builds ADF when the adf template gets text rather than a document', () => {
    const doc = asDoc(formatComment('adf', {
      summary: 'Done: completed feature #42',
      statusHint: 'Done',
    }));

    expect(doc.content.length).toBeGreaterThanOrEqual(2);
    const text = textOf(doc);
    expect(text).toContain('Done: completed feature #42');
    expect(text).toContain('Done');
  });

  it('falls back to a built document for an unknown template', () => {
    const doc = asDoc(formatComment('does-not-exist', testData));

    expect(textOf(doc)).toContain('Updated pricing logic for EU markets');
  });

  it('produces a document the client can post directly for every template', () => {
    for (const template of ['markdown', 'plain', 'adf']) {
      const doc = asDoc(formatComment(template, testData));
      // addComment sends this as `{ body: doc }`, so the document must survive
      // a JSON round-trip unchanged — an `undefined` field anywhere in the node
      // tree would be dropped in transit and reach Jira as a different document.
      expect(JSON.parse(JSON.stringify(doc))).toEqual(doc);
    }
  });
});

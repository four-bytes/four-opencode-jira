// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

/**
 * Jira comment formatter — always produces ADF (Atlassian Document Format).
 * Jira Cloud requires ADF JSON for all comments in the new editor.
 */

export interface CommentData {
  summary: string;
  details?: string;
  statusHint?: string;
}

/** ADF document node types */
interface ADFDoc {
  type: "doc";
  version: number;
  content: ADFBlock[];
}
type ADFBlock = ADFParagraph | ADFBulletList | ADFCodeBlock | ADFHeading | ADFOrderedList | ADFBlockquote | ADFRule | ADFTable | ADFMediaSingle;
interface ADFParagraph {
  type: "paragraph";
  content: ADFInline[];
}
interface ADFBulletList {
  type: "bulletList";
  content: ADFListItem[];
}
interface ADFOrderedList {
  type: "orderedList";
  content: ADFListItem[];
}
interface ADFBlockquote {
  type: "blockquote";
  content: ADFParagraph[];
}
interface ADFRule {
  type: "rule";
}
interface ADFTable {
  type: "table";
  attrs: { isNumberColumnEnabled: boolean; layout: string };
  content: ADFTableRow[];
}
interface ADFTableRow {
  type: "tableRow";
  content: ADFTableCell[];
}
interface ADFTableCell {
  type: "tableCell";
  content: ADFParagraph[];
}
interface ADFMediaSingle {
  type: "mediaSingle";
  content: ADFMedia[];
}
interface ADFMedia {
  type: "media";
  attrs: { url: string; type: string; alt?: string };
}
interface ADFListItem {
  type: "listItem";
  content: ADFParagraph[];
}
interface ADFCodeBlock {
  type: "codeBlock";
  attrs: { language: string };
  content: ADFText[];
}
interface ADFHeading {
  type: "heading";
  attrs: { level: number };
  content: ADFInline[];
}
interface ADFText {
  type: "text";
  text: string;
  marks?: ADFMark[];
}
interface ADFLinkMark {
  type: "link";
  attrs: { href: string; title?: string };
}
type ADFInline = ADFText;
type ADFMark = { type: "strong" } | { type: "em" } | { type: "code" } | ADFLinkMark;

/** Convert a single line of text to ADF inline content, handling **bold**, `code`, and [link](url) */
function parseInline(text: string): ADFInline[] {
  const result: ADFInline[] = [];
  // Match **bold**, `code`, or [link](url)
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index);
      if (before) result.push({ type: "text", text: before });
    }

    if (match[2]) {
      // **bold**
      result.push({ type: "text", text: match[2], marks: [{ type: "strong" }] });
    } else if (match[3]) {
      // `code`
      result.push({ type: "text", text: match[3], marks: [{ type: "code" }] });
    } else if (match[4] && match[5]) {
      // [text](url) — link
      result.push({ type: "text", text: match[4], marks: [{ type: "link", attrs: { href: match[5] } }] });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    result.push({ type: "text", text: text.slice(lastIndex) });
  }
  if (result.length === 0 && text) {
    result.push({ type: "text", text });
  }
  return result;
}

/** Convert a text body to ADF blocks (paragraphs, bullet lists, code blocks, etc.) */
function textToADF(body: string): ADFBlock[] {
  const blocks: ADFBlock[] = [];
  const lines = body.split("\n");
  const bulletItems: string[] = [];
  const orderedItems: string[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLanguage = "";
  let inTable = false;
  let tableRows: ADFTableRow[] = [];

  function flushBullets(): void {
    if (bulletItems.length > 0) {
      blocks.push({
        type: "bulletList",
        content: bulletItems.map(item => ({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(item) }],
        })),
      });
      bulletItems.length = 0;
    }
  }

  function flushOrdered(): void {
    if (orderedItems.length > 0) {
      blocks.push({
        type: "orderedList",
        content: orderedItems.map(item => ({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(item) }],
        })),
      });
      orderedItems.length = 0;
    }
  }

  function flushTable(): void {
    if (inTable && tableRows.length > 0) {
      blocks.push({
        type: "table",
        attrs: { isNumberColumnEnabled: false, layout: "default" },
        content: tableRows,
      });
      tableRows = [];
      inTable = false;
    }
  }

  function flushCodeBlock(): void {
    if (codeLines.length > 0) {
      blocks.push({
        type: "codeBlock",
        attrs: { language: codeLanguage || "plain" },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
      codeLines = [];
    }
    inCodeBlock = false;
  }

  function flushParagraph(text: string): void {
    if (text.trim()) {
      blocks.push({ type: "paragraph", content: parseInline(text) });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block fences
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        flushCodeBlock();
      } else {
        flushBullets();
        flushOrdered();
        flushTable();
        inCodeBlock = true;
        codeLanguage = line.trim().slice(3).trim() || "plain";
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    // Heading (# ## ### etc.)
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      flushBullets();
      flushOrdered();
      flushTable();
      blocks.push({
        type: "heading",
        attrs: { level },
        content: parseInline(text),
      });
      continue;
    }

    // Bullet list items (- or *)
    const bulletMatch = line.match(/^[\s]*[-*]\s+(.+)/);
    if (bulletMatch) {
      flushOrdered();
      flushTable();
      bulletItems.push(bulletMatch[1]);
      continue;
    }

    // Ordered list (1. 2. 3. etc.)
    const orderedMatch = line.match(/^[\s]*(\d+)\.\s+(.+)/);
    if (orderedMatch) {
      flushBullets();
      flushTable();
      orderedItems.push(orderedMatch[2]);
      continue;
    }

    // Blockquote
    if (line.trim().startsWith("> ")) {
      flushBullets();
      flushOrdered();
      flushTable();
      const content = line.trim().slice(2);
      blocks.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: parseInline(content) }],
      });
      continue;
    }

    // Horizontal rule
    if (line.trim().match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      flushBullets();
      flushOrdered();
      flushTable();
      blocks.push({ type: "rule" });
      continue;
    }

    // Image
    const imageMatch = line.trim().match(/^!\[(.+?)\]\((.+?)\)$/);
    if (imageMatch) {
      flushBullets();
      flushOrdered();
      flushTable();
      blocks.push({
        type: "mediaSingle",
        content: [{
          type: "media",
          attrs: { url: imageMatch[2], type: "image", alt: imageMatch[1] },
        }],
      });
      continue;
    }

    // Table row
    const tableCells = line.split("|").filter(c => c.trim()).map(c => c.trim());
    if (tableCells.length >= 2 && line.includes("|") && !line.trim().startsWith("```")) {
      flushBullets();
      flushOrdered();
      if (!inTable) {
        inTable = true;
        tableRows = [];
      }
      tableRows.push({
        type: "tableRow",
        content: tableCells.map(cell => ({
          type: "tableCell",
          content: [{ type: "paragraph", content: parseInline(cell) }],
        })),
      });
      continue;
    } else if (inTable && tableRows.length > 0) {
      flushTable();
    }

    // If we were collecting bullets and this line isn't a bullet
    flushBullets();
    flushOrdered();

    // Empty line → paragraph break
    if (line.trim() === "") {
      continue;
    }

    // Regular paragraph
    flushParagraph(line);
  }

  // Flush any remaining
  flushBullets();
  flushOrdered();
  flushTable();
  flushCodeBlock();

  return blocks;
}

/** Build a full ADF document from summary + details */
function buildADF(data: CommentData, statusHint?: string): ADFDoc {
  const content: ADFBlock[] = [];

  // Status hint as bold italic paragraph
  if (statusHint) {
    content.push({
      type: "paragraph",
      content: [{ type: "text", text: statusHint, marks: [{ type: "strong" }] }],
    });
  }

  // Summary as paragraph
  if (data.summary) {
    content.push(...textToADF(data.summary));
  }

  // Details
  if (data.details) {
    content.push(...textToADF(data.details));
  }

  return { type: "doc", version: 1, content };
}

/**
 * Format a comment for Jira API.
 *
 * All formats produce ADF objects. The `addComment` method posts ADF JSON.
 * Jira Cloud no longer accepts plain Markdown — ADF is required.
 *
 * Returns a raw ADF object (not stringified — addComment wraps it).
 */
export function formatComment(
  template: string,
  data: CommentData,
): string | object {
  const status = data.statusHint;

  switch (template) {
    case "markdown": {
      // Parse markdown-like text into ADF (handles **bold**, - lists, ```code blocks```)
      return buildADF(data, status);
    }

    case "plain": {
      // Plain text with no formatting
      const doc: ADFDoc = {
        type: "doc",
        version: 1,
        content: [],
      };
      if (status) {
        doc.content.push({
          type: "paragraph",
          content: [{ type: "text", text: status, marks: [{ type: "strong" }] }],
        });
      }
      if (data.summary) {
        doc.content.push({
          type: "paragraph",
          content: [{ type: "text", text: data.summary }],
        });
      }
      if (data.details) {
        for (const line of data.details.split("\n")) {
          if (line.trim()) {
            doc.content.push({
              type: "paragraph",
              content: [{ type: "text", text: line }],
            });
          }
        }
      }
      return doc;
    }

    case "adf": {
      // User provides pre-built ADF — wrap in doc if needed
      if (data.details) {
        try {
          const parsed = JSON.parse(data.details);
          // Check if it's already a valid ADF doc
          if (parsed && parsed.type === "doc" && parsed.version && Array.isArray(parsed.content)) {
            return parsed;
          }
        } catch {
          // Not valid JSON — fall back to buildADF
        }
      }
      return buildADF(data, status);
    }

    default:
      return buildADF(data, status);
  }
}

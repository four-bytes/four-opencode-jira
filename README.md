# @four-bytes/four-opencode-jira

Jira REST API integration tools for opencode agents — 6 custom tools (get_issue, add_comment, transition, extract_key, sync_progress, validate_config), project-local .opencode/jira.json config, optional hook automation. Source: Perplexity P49.

## Status

Sprint P15 (bootstrap), in Planung.

## Installation

```bash
bun install @four-bytes/four-opencode-jira
```

## Konfiguration

```typescript
// opencode.config.ts
export default {
  plugins: [
    require("@four-bytes/four-opencode-jira"),
  ],
};
```

## Usage

<!-- TODO: Add usage examples -->

## Lizenz

Apache-2.0 —siehe [LICENSE](../LICENSE)

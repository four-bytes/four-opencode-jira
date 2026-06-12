# @four-bytes/four-opencode-jira

> Jira REST API integration for opencode agents — 10 tools for issues, comments, transitions, and assignment with TUI sidebar.

[![npm](https://img.shields.io/npm/v/@four-bytes/four-opencode-jira)](https://www.npmjs.com/package/@four-bytes/four-opencode-jira)
[![license](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![bun](https://img.shields.io/badge/runtime-bun-orange)](https://bun.sh)

## Why?

For opencode users who work with Jira — create, search, comment, and transition issues without leaving the terminal. Auto-detects issue keys from branch names. TUI sidebar shows current issue. All comments use ADF (Atlassian Document Format) for proper rendering in Jira Cloud.

## Quickstart

```bash
opencode plugin @four-bytes/four-opencode-jira -g
```

Or manually:

```json
// ~/.config/opencode/opencode.json
{ "plugin": ["file:///home/user/four-opencode-jira/"] }

// ~/.config/opencode/tui.json
{ "plugin": [["/home/user/four-opencode-jira", { "enabled": true, "sidebar": true }]] }
```

Restart opencode.

## Configuration

Create `.opencode/jira.json` in your project:

```json
{
  "projectKey": "PROJ",
  "baseUrl": "https://your-domain.atlassian.net",
  "email": "user@example.com",
  "apiToken": "your-api-token",
  "transitions": { "enabled": true }
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `projectKey` | string | `"SESSION"` | Jira project key |
| `baseUrl` | string | env `JIRA_BASE_URL` | Jira Cloud URL (inline or env) |
| `email` | string | env `JIRA_EMAIL` | Account email (inline or env) |
| `apiToken` | string | env `JIRA_API_TOKEN` | API token from id.atlassian.com (inline or env) |
| `transitions.enabled` | boolean | `false` | Enable status transitions |
| `comments.enabled` | boolean | `true` | Enable auto-comments |

Credentials priority: JSON file > environment variables.

## Tools

| Tool | Description |
|------|-------------|
| `jira_get_issue` | Read issue fields (status, summary, assignee, labels) |
| `jira_search_issues` | Search issues with JQL (text, status, assignee filters) |
| `jira_search_users` | Find users by name/email — returns account IDs for assignment |
| `jira_assign_issue` | Assign/unassign issue to user |
| `jira_add_comment` | Add ADF-formatted comment (supports Markdown → ADF conversion) |
| `jira_transition_issue` | Transition issue to new status with fuzzy name matching |
| `jira_get_transitions` | List available transitions for an issue (read-only) |
| `jira_extract_issue_key` | Detect issue key from branch name, CWD, or text |
| `jira_sync_progress` | Post progress comment + optional status transition |
| `jira_validate_config` | Validate config file, credentials, API connectivity |

### `jira_add_comment` — ADF formatting

Comments support Markdown that auto-converts to ADF:

| Markdown | Renders as |
|---|---|
| `**bold**` | Bold text |
| `- item` | Bullet list |
| `1. item` | Ordered list |
| `# Heading` | Heading (levels 1-6) |
| `[text](url)` | Clickable link |
| `> quote` | Blockquote |
| `| col | col |` | Table |
| `---` | Horizontal rule |
| ` ```code``` ` | Code block |

## TUI Sidebar

Shows current Jira issue from git branch name. Clickable issue key opens in browser (Ctrl+click in terminal).

## Contributing

PRs welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

```bash
bun install
bun run build
bun test
```

**Requirements:** Bun >= 1.0, opencode with plugin support.

## License

Apache-2.0 — see [LICENSE](LICENSE)

---

> If this plugin saves you time, consider leaving a ⭐ on [GitHub](https://github.com/four-bytes/four-opencode-jira).

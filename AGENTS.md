# four-opencode-jira — AGENTS.md

Pointer to central standards: `~/ai-shared-rules/AGENTS.md` and meta-repo `four-bytes/opencode-plugins` AGENTS.md.

## Convention
- Source file: `src/four-opencode-jira.ts` (NOT `src/index.ts`)
- npm name: `@four-bytes/four-opencode-jira`
- License: Apache-2.0
- ESM, Bun-targeted, strict TypeScript

## Build Discipline (MANDATORY)
- EVERY code change ends with: version bump in `package.json` + `bun run build`
- No merge without current `dist/`
- `dist/` is gitignored, freshly built on `npm publish`

## Standards
`~/ai-shared-rules/AGENTS.md`

## This Plugin
- Plugin name: four-opencode-jira
- Description: Jira REST API integration tools for opencode agents — 6 custom tools (get_issue, add_comment, transition, extract_key, sync_progress, validate_config), project-local .opencode/jira.json config, optional hook automation. Source: Perplexity P49.
- Status: Sprint P15 (implemented)

## Workflow
Issues → Branch → PR → Merge (feature workflow)

- **Console logging:** Plugins MUST use `_client?.app?.log()` for all logging in plugin mode — `console.log` / `console.warn` / `console.error` is ONLY permitted for the initial startup `"init"` message. Console output in plugin mode breaks the terminal UI.

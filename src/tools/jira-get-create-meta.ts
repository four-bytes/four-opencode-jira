// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';
import type { CreateMetaField } from '../types';

export const jiraGetCreateMetaTool = tool({
  description: 'List required fields (and allowed values) for creating an issue in a project/issue type, so you can build the correct customFields payload for jira_create_issue.',

  args: {
    projectKey: tool.schema.string().describe('Jira project key (e.g. "SESSION")'),
    issueType: tool.schema.string().optional().describe('Issue type name to inspect (default: "Task")'),
  },

  async execute(args, ctx) {
    const projectKey = args.projectKey as string;
    const issueTypeName = ((args.issueType as string | undefined) ?? 'Task').trim();

    logDebugEvent('jira_get_create_meta.start', { projectKey, issueTypeName });

    try {
      const config = loadConfig(ctx.directory);
      if (!config.enabled) return 'Jira integration is disabled in this project.';

      const client = createJiraClient(config);
      if (!client) return 'Jira not configured.';

      // 1. Resolve issue type name → id (case-insensitive)
      const types = await client.getCreateMetaIssueTypes(projectKey);
      if ('error' in types) return `Error fetching issue types: ${types.message}`;

      const match = types.issueTypes.find(t => t.name.toLowerCase() === issueTypeName.toLowerCase());
      if (!match) {
        const available = types.issueTypes.map(t => t.name).join(', ');
        return `Issue type "${issueTypeName}" not found in project ${projectKey}. Available: ${available}`;
      }

      // 2. Fetch field metadata
      const meta = await client.getCreateMetaFields(projectKey, match.id);
      if ('error' in meta) return `Error fetching field metadata: ${meta.message}`;

      // 3. Partition fields
      const required = meta.fields.filter(f => f.required);
      const custom = meta.fields.filter(f => f.schema?.custom);

      const typeLabel = (f: CreateMetaField): string => {
        const t = f.schema?.type ?? 'string';
        if (t === 'option') {
          return (f.schema?.custom ?? '').includes('multiselect') ? 'multi-select' : 'select';
        }
        return t;
      };

      const options = (f: CreateMetaField): string => {
        const vals = f.allowedValues?.map(v => v.value ?? v.name).filter((v): v is string => !!v) ?? [];
        return vals.length ? ` — options: ${vals.join(', ')}` : '';
      };

      const lines: string[] = [];
      lines.push(`Create metadata for ${projectKey} (${match.name}):`);

      lines.push('');
      lines.push(`Required fields (${required.length}):`);
      if (required.length === 0) {
        lines.push('  (none)');
      } else {
        required.forEach((f, i) => {
          lines.push(`  ${i + 1}. ${f.name} [${f.fieldId}] (${typeLabel(f)})${options(f)}`);
        });
      }

      lines.push('');
      lines.push(`Custom fields (${custom.length}):`);
      if (custom.length === 0) {
        lines.push('  (none)');
      } else {
        custom.forEach(f => {
          lines.push(`  - ${f.name} [${f.fieldId}] (${typeLabel(f)})${options(f)}${f.required ? ' *required*' : ''}`);
        });
      }

      lines.push('');
      lines.push('To satisfy required custom fields, pass the customFields arg to jira_create_issue (JSON keyed by fieldId). Select/list fields take {"value": "..."}; text/date fields take a plain string.');

      return lines.join('\n');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_get_create_meta.error', { error: msg });
      return `Error: ${msg}`;
    }
  },
});

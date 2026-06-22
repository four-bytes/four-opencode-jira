// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { loadConfig } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';
import { formatComment } from '../comment-formatter';
import type { CreatedIssue } from '../types';

// ────────────────────────────────────────────────────────────────
// Tool definition
// ────────────────────────────────────────────────────────────────

export const jiraCreateIssueTool = tool({
  description: 'Create a new Jira issue in the configured project. Supports summary, markdown description, issue type, priority, labels, and assignee.',

  args: {
    projectKey: tool.schema.string().describe('Jira project key (e.g. "SESSION")'),
    summary: tool.schema.string().describe('Issue summary/title'),
    description: tool.schema.string().optional().describe('Issue description in markdown (converted to ADF)'),
    issueType: tool.schema.string().optional().describe('Issue type name (default if omitted: "Task")'),
    priority: tool.schema.string().optional().describe('Priority name (e.g. "High", "Medium", "Low")'),
    labels: tool.schema.string().optional().describe('Comma-separated label names (e.g. "bug,frontend")'),
    assignee: tool.schema.string().optional().describe('Jira account ID of the assignee'),
  },

  async execute(args, ctx) {
    const projectKey = args.projectKey as string;
    const summary = args.summary as string;
    const description = args.description as string | undefined;
    const issueType = args.issueType as string | undefined;
    const priority = args.priority as string | undefined;
    const labelsRaw = args.labels as string | undefined;
    const assignee = args.assignee as string | undefined;

    logDebugEvent('jira_create_issue.start', { projectKey, summary });

    try {
      const config = loadConfig(ctx.directory);

      if (!config.enabled) {
        return 'Jira integration is disabled in this project.';
      }

      const client = createJiraClient(config);
      if (!client) {
        const missing: string[] = [];
        if (!process.env[config.baseUrlEnv]) missing.push(config.baseUrlEnv);
        if (!process.env[config.emailEnv]) missing.push(config.emailEnv);
        if (!process.env[config.apiTokenEnv]) missing.push(config.apiTokenEnv);
        return `Jira not configured. Missing environment variables: ${missing.join(', ')}.`;
      }

      // Convert markdown description to ADF
      const descAdf = description
        ? (formatComment(config.comments.template, { summary: '', details: description }) as object)
        : undefined;

      // Parse comma-separated labels into array
      const labels = labelsRaw
        ? labelsRaw.split(',').map(l => l.trim()).filter(Boolean)
        : undefined;

      // Build params — only include optional fields when they have values
      const params: {
        projectKey: string;
        summary: string;
        description?: object;
        issueType?: string;
        priority?: string;
        labels?: string[];
        assignee?: string;
      } = { projectKey, summary };

      if (descAdf) params.description = descAdf;
      if (issueType) params.issueType = issueType;
      if (priority) params.priority = priority;
      if (labels && labels.length > 0) params.labels = labels;
      if (assignee) params.assignee = assignee;

      const result = await client.createIssue(params);

      if ('error' in result && result.error) {
        return `Error creating issue: ${result.message}`;
      }

      const created = result as CreatedIssue;

      // Build the base URL for the browse link
      const baseUrl = config.baseUrl || process.env[config.baseUrlEnv] || '';

      return `Issue created: ${created.key}\nURL: ${baseUrl}/browse/${created.key}\n\nSummary: ${summary}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_create_issue.error', { error: msg });
      return `Error: ${msg}`;
    }
  },
});

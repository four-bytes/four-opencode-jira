// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

// ────────────────────────────────────────────────────────────────
// Jira Config Types
// ────────────────────────────────────────────────────────────────

export interface IssueKeyDetectionConfig {
  fromBranch: boolean;
  fromCwd: boolean;
  fromPrompt: boolean;
  regex: string;
}

export interface CommentsConfig {
  enabled: boolean;
  mode: 'always' | 'milestones' | 'manual';
  maxPerSession: number;
  dedupeWindowSeconds: number;
  template: 'markdown' | 'plain' | 'adf';
}

export interface TransitionsConfig {
  enabled: boolean;
  mapping: Record<string, string>;
}

export interface JiraConfig {
  enabled: boolean;
  projectKey: string;
  baseUrlEnv: string;
  emailEnv: string;
  apiTokenEnv: string;
  // Inline credentials (optional, takes priority over env vars)
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  issueKeyDetection: IssueKeyDetectionConfig;
  comments: CommentsConfig;
  transitions: TransitionsConfig;
}

export const DEFAULT_CONFIG: JiraConfig = {
  enabled: true,
  projectKey: 'SESSION',
  baseUrlEnv: 'JIRA_BASE_URL',
  emailEnv: 'JIRA_EMAIL',
  apiTokenEnv: 'JIRA_API_TOKEN',
  issueKeyDetection: {
    fromBranch: true,
    fromCwd: true,
    fromPrompt: true,
    regex: '[A-Z][A-Z0-9]+-\\d+',
  },
  comments: {
    enabled: true,
    mode: 'milestones',
    maxPerSession: 3,
    dedupeWindowSeconds: 900,
    template: 'markdown',
  },
  transitions: {
    enabled: false,
    mapping: {
      work_started: 'In Progress',
      done: 'Done',
      blocked: 'Blocked',
    },
  },
};

// ────────────────────────────────────────────────────────────────
// Jira API Types
// ────────────────────────────────────────────────────────────────

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string; id: string };
    description?: string | object;
    assignee?: { displayName: string; emailAddress: string } | null;
    labels: string[];
  };
}

export interface CommentResult {
  id: string;
  body: unknown;
  created: string;
}

export interface Transition {
  id: string;
  name: string;
}

export interface CreatedIssue {
  id: string;
  key: string;
  self: string;
}

export interface JiraError {
  error: true;
  status: number;
  message: string;
}

// ────────────────────────────────────────────────────────────────
// Issue Key Detection
// ────────────────────────────────────────────────────────────────

export interface IssueKeyResult {
  key: string | null;
  confidence: number;
  source: 'text' | 'branch' | 'cwd' | null;
}

// ────────────────────────────────────────────────────────────────
// Validation
// ────────────────────────────────────────────────────────────────

export interface ValidationField {
  status: 'ok' | 'missing' | 'error';
  message: string;
  detail?: string;
}

export interface ValidationReport {
  configExists: ValidationField;
  configValid: ValidationField;
  envVars: ValidationField;
  apiReachable: ValidationField;
  transitions: ValidationField;
  allOk: boolean;
}

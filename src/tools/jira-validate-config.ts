// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import { tool } from '@opencode-ai/plugin';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, getEnvVar } from '../config';
import { createJiraClient } from '../jira-client';
import { logDebugEvent } from '../debug-logger';
import type { JiraConfig, ValidationField, ValidationReport } from '../types';

// ────────────────────────────────────────────────────────────────
// Output formatting
// ────────────────────────────────────────────────────────────────

function formatValidation(report: ValidationReport): string {
  const lines: string[] = [];
  const icon = (status: string) => status === 'ok' ? '✅' : status === 'missing' ? '⚠️' : '❌';

  lines.push('# Jira Configuration Validation');
  lines.push('');
  lines.push(`${icon(report.configExists.status)} **Config File:** ${report.configExists.message}`);
  if (report.configExists.detail) lines.push(`   ${report.configExists.detail}`);
  lines.push(`${icon(report.configValid.status)} **Config Valid:** ${report.configValid.message}`);
  if (report.configValid.detail) lines.push(`   ${report.configValid.detail}`);
  lines.push(`${icon(report.envVars.status)} **Environment Variables:** ${report.envVars.message}`);
  if (report.envVars.detail) lines.push(`   ${report.envVars.detail}`);
  lines.push(`${icon(report.apiReachable.status)} **API Reachable:** ${report.apiReachable.message}`);
  if (report.apiReachable.detail) lines.push(`   ${report.apiReachable.detail}`);
  lines.push(`${icon(report.transitions.status)} **Transitions:** ${report.transitions.message}`);
  if (report.transitions.detail) lines.push(`   ${report.transitions.detail}`);
  lines.push('');
  lines.push(`**Overall:** ${report.allOk ? '✅ All checks passed' : '❌ Some checks failed'}`);

  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────
// Tool definition
// ────────────────────────────────────────────────────────────────

export const jiraValidateConfigTool = tool({
  description: 'Validate Jira configuration — checks config file, env vars, API reachability, and available transitions.',

  args: {},

  async execute(_args, ctx) {
    logDebugEvent('jira_validate_config.start', { directory: ctx.directory });

    try {
      const configPath = join(ctx.directory, '.opencode', 'jira.json');

      // 1. Check config file exists
      const configExists: ValidationField = existsSync(configPath)
        ? { status: 'ok', message: `Found at ${configPath}` }
        : { status: 'missing', message: `Not found at ${configPath}. Create it with project-specific settings.` };

      // 2. Load and validate config
      let configValid: ValidationField;
      let config: JiraConfig;

      try {
        config = loadConfig(ctx.directory);
        configValid = {
          status: 'ok',
          message: `Valid JSON. projectKey=${config.projectKey}, enabled=${config.enabled}`,
        };
      } catch (err) {
        config = {} as JiraConfig;
        configValid = {
          status: 'error',
          message: 'Invalid JSON',
          detail: String(err),
        };
      }

      // 3. Check credentials (config file → env var fallback)
      const credResults: string[] = [];
      const missingCreds: string[] = [];

      const { getCredential } = await import('../config');

      // Base URL
      const baseUrl = getCredential(config, 'baseUrl');
      if (baseUrl) {
        const source = config.baseUrl ? 'config file' : `env:${config.baseUrlEnv}`;
        credResults.push(`baseUrl=${baseUrl.replace(/\/\/.*@/, '//***@')} (${source})`);
      } else {
        credResults.push(`baseUrl=<missing> (check ${config.baseUrlEnv} or config file)`);
        missingCreds.push('baseUrl');
      }

      // Email
      const email = getCredential(config, 'email');
      if (email) {
        const source = config.email ? 'config file' : `env:${config.emailEnv}`;
        credResults.push(`email=${email} (${source})`);
      } else {
        credResults.push(`email=<missing> (check ${config.emailEnv} or config file)`);
        missingCreds.push('email');
      }

      // API Token
      const apiToken = getCredential(config, 'apiToken');
      if (apiToken) {
        const source = config.apiToken ? 'config file' : `env:${config.apiTokenEnv}`;
        credResults.push(`apiToken=*** (${source})`);
      } else {
        credResults.push(`apiToken=<missing> (check ${config.apiTokenEnv} or config file)`);
        missingCreds.push('apiToken');
      }

      const envVars: ValidationField = missingCreds.length === 0
        ? { status: 'ok', message: credResults.join(', ') }
        : {
            status: 'missing',
            message: `Missing: ${missingCreds.join(', ')}`,
            detail: credResults.join(', '),
          };

      // 4. Test API reachability
      let apiReachable: ValidationField;
      let transitions: ValidationField = { status: 'ok', message: 'Not checked (no API connection)' };

      if (missingCreds.length === 0) {
        const client = createJiraClient(config);
        if (client) {
          try {
            // Use the client to test connectivity
            const connResult = await client.testConnection();

            if (connResult === true) {
              apiReachable = { status: 'ok', message: 'API connection successful' };

              // 5. Check transitions if we have a project key
              if (config.projectKey) {
                const testIssueResult = await client.getIssue(`${config.projectKey}-1`);
                if ('error' in testIssueResult && testIssueResult.error) {
                  transitions = {
                    status: 'ok',
                    message: `Skipped (test issue ${config.projectKey}-1 not found)`,
                    detail: `Create an issue with key ${config.projectKey}-1 to test transitions`,
                  };
                } else {
                  const transResult = await client.getTransitions(`${config.projectKey}-1`);
                  if ('error' in transResult && transResult.error) {
                    transitions = {
                      status: 'error',
                      message: `Could not fetch transitions: ${transResult.message}`,
                    };
                  } else {
                    const trans = transResult;
                    const names = trans.map(t => t.name).join(', ');
                    transitions = {
                      status: 'ok',
                      message: `${trans.length} transition(s) available`,
                      detail: names || '(none)',
                    };
                  }
                }
              }
            } else {
              apiReachable = {
                status: 'error',
                message: `API returned ${connResult.status}`,
                detail: connResult.message.substring(0, 200),
              };
            }
          } catch (err) {
            apiReachable = {
              status: 'error',
              message: `Connection failed: ${err instanceof Error ? err.message : String(err)}`,
            };
          }
        } else {
          apiReachable = { status: 'error', message: 'Could not create Jira client' };
        }
      } else {
        apiReachable = { status: 'missing', message: 'Skipped (missing credentials)' };
      }

      const report: ValidationReport = {
        configExists,
        configValid,
        envVars,
        apiReachable,
        transitions,
        allOk: configExists.status === 'ok'
          && configValid.status === 'ok'
          && envVars.status === 'ok'
          && (apiReachable.status === 'ok' || apiReachable.status === 'missing'),
      };

      return formatValidation(report);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logDebugEvent('jira_validate_config.error', { error: msg });
      return `Error: ${msg}`;
    }
  },
});

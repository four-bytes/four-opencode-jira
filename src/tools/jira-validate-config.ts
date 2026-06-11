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

      // 3. Check environment variables
      const envVarResults: string[] = [];
      const missingVars: string[] = [];

      if (config.baseUrlEnv) {
        const val = getEnvVar(config, 'baseUrlEnv');
        if (val) {
          envVarResults.push(`${config.baseUrlEnv}=${val.replace(/\/\/.*@/, '//***@')}`);
        } else {
          envVarResults.push(`${config.baseUrlEnv}=<missing>`);
          missingVars.push(config.baseUrlEnv);
        }
      }
      if (config.emailEnv) {
        const val = getEnvVar(config, 'emailEnv');
        if (val) {
          envVarResults.push(`${config.emailEnv}=${val}`);
        } else {
          envVarResults.push(`${config.emailEnv}=<missing>`);
          missingVars.push(config.emailEnv);
        }
      }
      if (config.apiTokenEnv) {
        const val = getEnvVar(config, 'apiTokenEnv');
        if (val) {
          envVarResults.push(`${config.apiTokenEnv}=***`);
        } else {
          envVarResults.push(`${config.apiTokenEnv}=<missing>`);
          missingVars.push(config.apiTokenEnv);
        }
      }

      const envVars: ValidationField = missingVars.length === 0
        ? { status: 'ok', message: envVarResults.join(', ') }
        : {
            status: 'missing',
            message: `Missing: ${missingVars.join(', ')}`,
            detail: envVarResults.join(', '),
          };

      // 4. Test API reachability
      let apiReachable: ValidationField;
      let transitions: ValidationField = { status: 'ok', message: 'Not checked (no API connection)' };

      if (missingVars.length === 0 && config.baseUrlEnv) {
        const client = createJiraClient(config);
        if (client) {
          try {
            // Use a simple API call to test connectivity
            const response = await fetch(`${getEnvVar(config, 'baseUrlEnv')!.replace(/\/+$/, '')}/rest/api/3/myself`, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${btoa(`${getEnvVar(config, 'emailEnv')!}:${getEnvVar(config, 'apiTokenEnv')!}`)}`,
                'Accept': 'application/json',
              },
            });

            if (response.ok) {
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
              const body = await response.text();
              apiReachable = {
                status: 'error',
                message: `API returned ${response.status}`,
                detail: body.substring(0, 200),
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
        apiReachable = { status: 'missing', message: 'Skipped (missing environment variables)' };
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

// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2025-2026 Four Bytes

import type { Plugin } from '@opencode-ai/plugin';
import { jiraGetIssueTool } from './tools/jira-get-issue';
import { jiraAddCommentTool } from './tools/jira-add-comment';
import { jiraTransitionIssueTool } from './tools/jira-transition-issue';
import { jiraExtractIssueKeyTool } from './tools/jira-extract-issue-key';
import { jiraSyncProgressTool } from './tools/jira-sync-progress';
import { jiraValidateConfigTool } from './tools/jira-validate-config';
import { jiraAssignIssueTool } from './tools/jira-assign-issue';
import { jiraGetTransitionsTool } from './tools/jira-get-transitions';
import { jiraSearchUsersTool } from './tools/jira-search-users';
import { createJiraHooks } from './hooks';
import { logDebugEvent } from './debug-logger';

const FourOpencodeJira: Plugin = async (_ctx) => {
  logDebugEvent('plugin.init', { version: '0.2.0' });

  return {
    tool: {
      jira_get_issue: jiraGetIssueTool,
      jira_add_comment: jiraAddCommentTool,
      jira_transition_issue: jiraTransitionIssueTool,
      jira_extract_issue_key: jiraExtractIssueKeyTool,
      jira_sync_progress: jiraSyncProgressTool,
      jira_validate_config: jiraValidateConfigTool,
      jira_assign_issue: jiraAssignIssueTool,
      jira_get_transitions: jiraGetTransitionsTool,
      jira_search_users: jiraSearchUsersTool,
    },
    ...createJiraHooks(),
  };
};

export default FourOpencodeJira;

/** @jsxImportSource @opentui/solid */
import { createSignal, onMount } from "solid-js";
import type { TuiPlugin, TuiPluginApi, TuiPluginModule } from "@opencode-ai/plugin/tui";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const SIDEBAR_ORDER = 60;
const REFRESH_INTERVAL_MS = 15_000;

const [showSidebar, setShowSidebar] = createSignal(true);

// ── Config loader ──────────────────────────────────────────

interface JiraTuiConfig {
  enabled?: boolean;
  projectKey?: string;
  baseUrl?: string;
  email?: string;
  apiToken?: string;
  baseUrlEnv?: string;
  emailEnv?: string;
  apiTokenEnv?: string;
  issueKeyDetection?: { regex?: string };
}

function loadConfig(): JiraTuiConfig | null {
  try {
    const path = join(process.cwd(), '.opencode', 'jira.json');
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function getBranch(): string {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8', timeout: 2000 }).trim();
  } catch {
    return '';
  }
}

function extractKey(text: string, regex: string): string | null {
  try {
    const m = text.match(new RegExp(regex, 'i'));
    return m ? m[0].toUpperCase() : null;
  } catch {
    return null;
  }
}

// ── View component ─────────────────────────────────────────

function JiraView(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current;
  const [key, setKey] = createSignal<string | null>(null);
  const [status, setStatus] = createSignal<string | null>(null);
  const [summary, setSummary] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  const fetchIssue = async () => {
    const cfg = loadConfig()!;
    const baseUrl = cfg.baseUrl || process.env[cfg.baseUrlEnv || 'JIRA_BASE_URL'];
    const email = cfg.email || process.env[cfg.emailEnv || 'JIRA_EMAIL'];
    const apiToken = cfg.apiToken || process.env[cfg.apiTokenEnv || 'JIRA_API_TOKEN'];
    if (!baseUrl || !email || !apiToken) return;

    const branch = getBranch();
    const regex = cfg.issueKeyDetection?.regex || '[A-Z][A-Z0-9]+-\\d+';
    const newKey = extractKey(branch, regex);
    if (!newKey) {
      setError('no issue');
      return;
    }

    if (newKey !== key()) {
      // Branch/issue changed — clear old state
      setSummary(null);
      setStatus(null);
      setError(null);
    }

    setKey(newKey);

    try {
      const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/rest/api/3/issue/${newKey}?fields=summary,status`, {
        headers: {
          Authorization: `Basic ${btoa(`${email}:${apiToken}`)}`,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        setSummary(null);
        setStatus(null);
        setError(res.status === 404 ? 'not found' : `API ${res.status}`);
        return;
      }
      const data = await res.json() as any;
      setSummary(data.fields?.summary?.substring(0, 50) || null);
      setStatus(data.fields?.status?.name || null);
      setError(null);
    } catch {
      setError('unreachable');
    }
  };

  onMount(() => {
    fetchIssue();
    const timer = setInterval(fetchIssue, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  });

  const jiraUrl = () => {
    const k = key();
    const cfg = loadConfig();
    if (!k || !cfg?.baseUrl) return null;
    return `${cfg.baseUrl.replace(/\/+$/, '')}/browse/${k}`;
  };

  return (
    <box flexDirection="column" gap={0}>
      <box flexDirection="row" justifyContent="space-between" width="100%">
        <text fg={theme().accent}><b>JIRA</b></text>
        <text fg={theme().textMuted}>
          {key() && jiraUrl() ? <a href={jiraUrl()!}>{key()}</a> : key() || "—"}
        </text>
      </box>
      {key() && !error() && status() && (
        <box flexDirection="column">
          <text fg={theme().text}>{summary()}</text>
          <box flexDirection="row" justifyContent="space-between" width="100%">
            <text fg={theme().success}>{status()}</text>
          </box>
        </box>
      )}
      {error() && error() !== 'no issue' && (
        <text fg={theme().error}>{error()}</text>
      )}
    </box>
  );
}

// ── Plugin registration ────────────────────────────────────

const tui: TuiPlugin = async (api) => {
  api.slots.register({
    order: SIDEBAR_ORDER,
    slots: {
      sidebar_content(_ctx, props) {
        if (!showSidebar()) return null;
        const cfg = loadConfig();
        if (!cfg || cfg.enabled === false) {
          setTimeout(() => setShowSidebar(false), 3000);
          return <text fg={api.theme.current.textMuted}>no jira config</text>;
        }
        return <JiraView api={api} />;
      },
    },
  });
};

const plugin: TuiPluginModule & { id: string } = {
  id: 'four-opencode-jira',
  tui,
};

export default plugin;

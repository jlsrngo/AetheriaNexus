export interface LiveStackOptions {
  /** Replace the default mock-provider `aetheria.json` (parity harness uses its own fake provider). */
  aetheriaConfig?: unknown;
  /** Skip starting Vite when the test only exercises the engine HTTP API. Default true. */
  startWeb?: boolean;
  /** Extra environment variables passed to the spawned `aetheria-engine` process. */
  env?: Record<string, string>;
}

export interface MockLlmController {
  url: string;
  setFailNext: (message: string | null) => void;
  setExploreDelayMs: (ms: number) => void;
  getCallCounts: () => {
    parentInitial: number;
    parentWake: number;
    subagentExplore: number;
    subagentAudio: number;
    activeSubagents: number;
    maxConcurrentSubagents: number;
  };
}

export interface LiveStack {
  repoRoot: string;
  tempRoot: string;
  homeDir: string;
  workspaceDir: string;
  engineUrl: string;
  /** null when startLiveStack({ startWeb: false }) was used. */
  webUrl: string | null;
  authHeader: string;
  screenshotDir: string | null;
  mockLlm: MockLlmController;
  engineLogs: () => string;
  stop: () => Promise<void>;
}

export function resolveEngineBinary(repoRoot: string): string;
export function startLiveStack(options?: LiveStackOptions): Promise<LiveStack>;

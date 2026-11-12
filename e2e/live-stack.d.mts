export interface MockLlmController {
  url: string;
  setFailNext: (message: string | null) => void;
  setExploreDelayMs: (ms: number) => void;
  getCallCounts: () => {
    parentInitial: number;
    parentWake: number;
    subagentExplore: number;
    subagentAudio: number;
  };
}

export interface LiveStack {
  repoRoot: string;
  tempRoot: string;
  homeDir: string;
  workspaceDir: string;
  engineUrl: string;
  webUrl: string;
  authHeader: string;
  screenshotDir: string | null;
  mockLlm: MockLlmController;
  engineLogs: () => string;
  stop: () => Promise<void>;
}

export function startLiveStack(): Promise<LiveStack>;


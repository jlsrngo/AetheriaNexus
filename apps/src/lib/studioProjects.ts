import { activeDirectory, apiFetch } from "./api";
import type { StudioProjectInfo, StudioProjectsState } from "../types/studio";

function buildDirQuery(): string {
  const dir = activeDirectory();
  return dir ? `?directory=${encodeURIComponent(dir)}` : "";
}

async function parseJsonOrThrow<T>(res: Response): Promise<T> {
  const json = (await res.json()) as { data?: T; error?: string };
  if (!res.ok || json.error) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  if (json.data === undefined) {
    throw new Error("Missing data in Studio project response");
  }
  return json.data;
}

export async function fetchStudioProjects(): Promise<StudioProjectsState> {
  const res = await apiFetch(`/api/studio/projects${buildDirQuery()}`);
  return parseJsonOrThrow<StudioProjectsState>(res);
}

export async function selectStudioProject(project: string): Promise<string | null> {
  const res = await apiFetch(`/api/studio/projects/select${buildDirQuery()}`, {
    method: "POST",
    body: JSON.stringify({ directory: activeDirectory() || undefined, project }),
  });
  const data = await parseJsonOrThrow<{ activeProject: string | null }>(res);
  return data.activeProject ?? null;
}

export async function createStudioProject(title: string): Promise<StudioProjectInfo> {
  const res = await apiFetch(`/api/studio/projects/create${buildDirQuery()}`, {
    method: "POST",
    body: JSON.stringify({ directory: activeDirectory() || undefined, title }),
  });
  const data = await parseJsonOrThrow<{ project: StudioProjectInfo }>(res);
  return data.project;
}

export async function deleteStudioProject(
  project: string
): Promise<{ deleted: string; activeProject: string | null }> {
  const res = await apiFetch(`/api/studio/projects/delete${buildDirQuery()}`, {
    method: "POST",
    body: JSON.stringify({ directory: activeDirectory() || undefined, project }),
  });
  return parseJsonOrThrow<{ deleted: string; activeProject: string | null }>(res);
}

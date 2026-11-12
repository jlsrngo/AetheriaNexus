import { defaultNexusVideoProps, type NexusVideoProps } from "../types/video";
import type { StudioComposition } from "../types/studio";

function normalizeProps(
  composition: StudioComposition,
  fallbackProps: NexusVideoProps = defaultNexusVideoProps,
): NexusVideoProps {
  const isHtmlFilm =
    composition.id === "HtmlMotionFilm" || composition.id === "empty-html-stage";
  const baseProps: NexusVideoProps = isHtmlFilm
    ? {
        ...fallbackProps,
        hookText: composition.name || "",
        bodyText: "",
        category: composition.props?.category || "HTML MOTION",
        subCategory: composition.props?.subCategory || "",
        authorHandle: "",
        editorialTag: "",
        showText: false,
        showBackground: false,
      }
    : fallbackProps;
  return {
    ...baseProps,
    ...(composition.props || {}),
  };
}

/**
 * Applies a composition update safely even when `compositions` was empty (`DEFAULT_WORKSPACE_COMPOSITION`
 * hadn't been materialized into state yet) so early user edits are never silently dropped.
 */
export function applyCompositionMutation(
  compositions: StudioComposition[],
  activeCompositionId: string,
  fallback: StudioComposition,
  mutate: (target: StudioComposition) => StudioComposition,
): { compositions: StudioComposition[]; mutatedId: string } {
  const existingIndex = compositions.findIndex((c) => c.id === activeCompositionId);
  if (existingIndex >= 0) {
    const next = compositions.map((comp, idx) =>
      idx === existingIndex ? mutate(comp) : comp,
    );
    return { compositions: next, mutatedId: activeCompositionId };
  }

  const seed =
    compositions.length === 0 || activeCompositionId === fallback.id
      ? mutate({ ...fallback, props: { ...fallback.props } })
      : mutate({ ...compositions[0], props: { ...compositions[0].props } });

  return {
    compositions: [seed, ...compositions.filter((c) => c.id !== seed.id)],
    mutatedId: seed.id,
  };
}

export interface MergeBackendCompositionsOptions {
  local: StudioComposition[];
  backend: StudioComposition[];
  dirtyIds: ReadonlySet<string>;
  activeCompositionId: string;
}

/**
 * Reconciles backend-scanned compositions with local state without discarding non-first backend
 * items or overwriting dirty unsaved user edits on window focus/visibility sync.
 */
export function mergeBackendCompositions(
  opts: MergeBackendCompositionsOptions,
): { compositions: StudioComposition[]; activeCompositionId: string } {
  const { local, backend, dirtyIds, activeCompositionId } = opts;

  const localById = new Map<string, StudioComposition>();
  for (const item of local) {
    if (!localById.has(item.id)) {
      localById.set(item.id, item);
    }
  }

  const merged: StudioComposition[] = [];
  const seen = new Set<string>();

  for (const rawRemote of backend) {
    if (!rawRemote?.id || seen.has(rawRemote.id)) continue;
    seen.add(rawRemote.id);

    const existingLocal = localById.get(rawRemote.id);
    if (existingLocal && dirtyIds.has(rawRemote.id)) {
      merged.push(existingLocal);
      continue;
    }

    const baseProps = existingLocal ? existingLocal.props : defaultNexusVideoProps;
    const normalizedRemote: StudioComposition = {
      ...rawRemote,
      props: normalizeProps(rawRemote, baseProps),
    };
    merged.push(normalizedRemote);
  }

  // Preserve unsaved dirty local compositions (and locally persisted compositions while backend scan is empty)
  for (const localItem of local) {
    if (!localItem?.id || seen.has(localItem.id)) continue;
    if (dirtyIds.has(localItem.id) || backend.length === 0) {
      seen.add(localItem.id);
      merged.push(localItem);
    }
  }

  const nextActive =
    merged.some((c) => c.id === activeCompositionId)
      ? activeCompositionId
      : merged[0]?.id ?? activeCompositionId;

  return {
    compositions: merged,
    activeCompositionId: nextActive,
  };
}

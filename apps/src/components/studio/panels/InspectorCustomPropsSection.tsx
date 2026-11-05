import React from "react";
import { Plus, Trash2, Layers, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "../../../lib/utils";
import type {
  CustomVideoLayerInput,
  NexusVideoProps,
  VideoLayerKind,
} from "../../../remotion/types";

interface InspectorCustomPropsSectionProps {
  props: NexusVideoProps;
  durationInFrames: number;
  onUpdateProps: (patch: Partial<NexusVideoProps>) => void;
}

const LAYER_COLORS = [
  "violet",
  "cyan",
  "rose",
  "amber",
  "sky",
  "fuchsia",
  "orange",
  "indigo",
] as const;

const CORE_OPTIONAL_FIELDS: Array<{
  id: string;
  layerId: string;
  label: string;
  propKey: "hookText" | "category" | "subCategory" | "authorHandle" | "editorialTag";
  placeholder: string;
}> = [
  {
    id: "hookText",
    layerId: "text-hook",
    label: "Hook Title (hookText)",
    propKey: "hookText",
    placeholder: "Enter main hook headline...",
  },
  {
    id: "category",
    layerId: "hud-category",
    label: "Category Badge",
    propKey: "category",
    placeholder: "PRODUCTIVITY",
  },
  {
    id: "subCategory",
    layerId: "hud-subcategory",
    label: "Sub-Category Label",
    propKey: "subCategory",
    placeholder: "EXECUTIVE HABITS",
  },
  {
    id: "authorHandle",
    layerId: "footer-author",
    label: "Author Handle",
    propKey: "authorHandle",
    placeholder: "@nexus.creative",
  },
  {
    id: "editorialTag",
    layerId: "footer-tag",
    label: "Footer Tag",
    propKey: "editorialTag",
    placeholder: "NEXUS // EDITORIAL SHORT",
  },
];

export const InspectorCustomPropsSection: React.FC<
  InspectorCustomPropsSectionProps
> = ({ props, durationInFrames, onUpdateProps }) => {
  const bulletLines = (props.bodyText || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const customLayers: CustomVideoLayerInput[] = Array.isArray(props.customLayers)
    ? props.customLayers
    : [];

  const layerVis = props.layerVisibility || {};

  const isFieldVisible = (layerId: string) => layerVis[layerId] !== false;

  const toggleCoreFieldVisibility = (layerId: string, label: string) => {
    const nextVis = !isFieldVisible(layerId);
    onUpdateProps({
      layerVisibility: {
        ...layerVis,
        [layerId]: nextVis,
      },
    });
    toast.info(nextVis ? `Restored "${label}"` : `Removed "${label}" from scene`);
  };

  const handleUpdateBullet = (idx: number, nextValue: string) => {
    const next = [...bulletLines];
    next[idx] = nextValue;
    onUpdateProps({ bodyText: next.join("\n") });
  };

  const handleRemoveBullet = (idx: number) => {
    const next = bulletLines.filter((_, i) => i !== idx);
    onUpdateProps({ bodyText: next.join("\n") });
  };

  const handleAddBullet = () => {
    const nextNum = bulletLines.length + 1;
    const next = [...bulletLines, `${nextNum}. New key point for your video`];
    onUpdateProps({ bodyText: next.join("\n") });
  };

  const handleAddCustomLayer = () => {
    const nextIdx = customLayers.length + 1;
    const newLayer: CustomVideoLayerInput = {
      id: `custom-prop-${Date.now().toString(36)}`,
      label: `Custom Layer #${nextIdx}`,
      kind: "badge",
      content: `CUSTOM BADGE #${nextIdx}`,
      color: LAYER_COLORS[(nextIdx - 1) % LAYER_COLORS.length],
      from: Math.min(durationInFrames - 15, nextIdx * 6),
      durationInFrames: Math.max(30, durationInFrames - nextIdx * 6),
      visible: true,
    };
    onUpdateProps({ customLayers: [...customLayers, newLayer] });
    toast.success(`Added "${newLayer.label}"`);
  };

  const handleUpdateCustomLayer = (
    id: string,
    patch: Partial<CustomVideoLayerInput>
  ) => {
    const next = customLayers.map((item) =>
      item.id === id ? { ...item, ...patch } : item
    );
    onUpdateProps({ customLayers: next });
  };

  const handleRemoveCustomLayer = (id: string) => {
    onUpdateProps({
      customLayers: customLayers.filter((item) => item.id !== id),
    });
  };

  const hiddenCoreFields = CORE_OPTIONAL_FIELDS.filter(
    (f) => !isFieldVisible(f.layerId)
  );

  return (
    <div className="space-y-3">
      {/* Restore Removed Core Fields Bar */}
      {hiddenCoreFields.length > 0 && (
        <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1.5">
          <span className="text-[10px] font-mono text-[var(--text-muted)] block">
            Removed Fields (Click to restore):
          </span>
          <div className="flex flex-wrap gap-1">
            {hiddenCoreFields.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => toggleCoreFieldVisibility(f.layerId, f.label)}
                className="h-6 px-2 rounded-md bg-[var(--bg-panel)] hover:bg-[var(--bg-hover)] border border-[var(--border-strong)] text-[10px] text-amber-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>{f.label.split(" (")[0]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 1. Hook Title (Removable & Editable) */}
      {isFieldVisible("text-hook") && (
        <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">
              Hook Title (<code className="text-[10px] text-amber-400">hookText</code>)
            </label>
            <button
              type="button"
              onClick={() => toggleCoreFieldVisibility("text-hook", "Hook Title")}
              className="p-1 rounded text-[var(--text-muted)] hover:text-rose-400 hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
              title="Remove Hook Title from scene"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
          <textarea
            rows={2}
            value={props.hookText}
            onChange={(e) => onUpdateProps({ hookText: e.target.value })}
            className="w-full p-2 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)] resize-none"
          />
        </div>
      )}

      {/* 2. Dynamic Body Bullet List (Add, Edit, or Remove Each Item) */}
      <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[11px] font-medium text-[var(--text-secondary)] truncate min-w-0">
            Body Bullets (<code className="text-[10px] text-amber-400">{bulletLines.length}</code>)
          </label>
          <button
            type="button"
            onClick={handleAddBullet}
            className="h-6 px-2.5 rounded-md bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-[10px] font-semibold text-white flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer transition-colors"
            title="Add new bullet point layer"
          >
            <Plus className="w-3 h-3 shrink-0" />
            <span>Add Point</span>
          </button>
        </div>

        {bulletLines.length === 0 ? (
          <div className="py-2 text-center text-[11px] text-[var(--text-muted)]">
            No bullet points. Click <strong>+ Add Point</strong> to add one.
          </div>
        ) : (
          <div className="space-y-1.5">
            {bulletLines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <span className="w-5 text-[10px] font-mono text-amber-400 text-center shrink-0">
                  #{idx + 1}
                </span>
                <input
                  type="text"
                  value={line}
                  onChange={(e) => handleUpdateBullet(idx, e.target.value)}
                  className="flex-1 min-w-0 h-7 px-2 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveBullet(idx)}
                  className="w-6 h-6 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-rose-400 hover:bg-[var(--bg-hover)] flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  title={`Remove Point #${idx + 1}`}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Removable Core Metadata Fields (Category, Sub-Category, Author, Footer Tag) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {CORE_OPTIONAL_FIELDS.filter((f) => f.id !== "hookText" && isFieldVisible(f.layerId)).map(
          (field) => (
            <div
              key={field.id}
              className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] space-y-1"
            >
              <div className="flex items-center justify-between gap-1">
                <label className="text-[10px] text-[var(--text-muted)] truncate">
                  {field.label}
                </label>
                <button
                  type="button"
                  onClick={() => toggleCoreFieldVisibility(field.layerId, field.label)}
                  className="p-0.5 rounded text-[var(--text-muted)] hover:text-rose-400 cursor-pointer shrink-0"
                  title={`Remove ${field.label}`}
                >
                  <Trash2 className="w-2.5 h-2.5" />
                </button>
              </div>
              <input
                type="text"
                value={(props[field.propKey] as string) || ""}
                placeholder={field.placeholder}
                onChange={(e) => onUpdateProps({ [field.propKey]: e.target.value })}
                className="w-full h-7 px-2 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none focus:border-[var(--border-strong)]"
              />
            </div>
          )
        )}
      </div>

      {/* 4. Custom Dynamic Layers / Props (Unlimited Add, Edit & Delete) */}
      <div className="p-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[var(--text-secondary)] flex items-center gap-1.5 min-w-0">
            <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Custom Layers ({customLayers.length})</span>
          </span>
          <button
            type="button"
            onClick={handleAddCustomLayer}
            className="h-6 px-2.5 rounded-md bg-[#cf6613] hover:bg-[#b8580f] border border-[#e07b27] text-[10px] font-semibold text-white flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer transition-colors"
            title="Add a custom layer/prop to composition and timeline"
          >
            <Plus className="w-3 h-3 shrink-0" />
            <span>Add Custom</span>
          </button>
        </div>

        {customLayers.length === 0 ? (
          <div className="py-1.5 text-[10px] text-[var(--text-muted)]">
            Click <strong>+ Add Custom</strong> to add custom badges, text overlays, or visual layers.
          </div>
        ) : (
          <div className="space-y-2">
            {customLayers.map((layer) => (
              <div
                key={layer.id}
                className="p-2 rounded-md bg-[var(--bg-panel)] border border-[var(--border-color)] space-y-1.5"
              >
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={layer.label}
                    onChange={(e) =>
                      handleUpdateCustomLayer(layer.id, { label: e.target.value })
                    }
                    placeholder="Layer Name..."
                    className="flex-1 min-w-0 h-6 px-2 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[11px] font-semibold text-[var(--text-primary)] outline-none"
                  />
                  <select
                    value={layer.kind || "text"}
                    onChange={(e) =>
                      handleUpdateCustomLayer(layer.id, {
                        kind: e.target.value as VideoLayerKind,
                      })
                    }
                    className="h-6 px-1.5 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-[10px] font-mono text-[var(--text-secondary)] outline-none cursor-pointer"
                    title="Layer Type"
                  >
                    <option value="text">Text</option>
                    <option value="badge">Badge</option>
                    <option value="icon">Icon</option>
                    <option value="pattern">Pattern</option>
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateCustomLayer(layer.id, {
                        visible: layer.visible === false,
                      })
                    }
                    className={cn(
                      "w-6 h-6 rounded bg-[var(--bg-card)] border border-[var(--border-color)] flex items-center justify-center cursor-pointer",
                      layer.visible !== false
                        ? "text-amber-400"
                        : "text-[var(--text-muted)]"
                    )}
                    title={layer.visible !== false ? "Hide Layer" : "Show Layer"}
                  >
                    {layer.visible !== false ? (
                      <Eye className="w-3 h-3" />
                    ) : (
                      <EyeOff className="w-3 h-3" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomLayer(layer.id)}
                    className="w-6 h-6 rounded bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-rose-400 flex items-center justify-center cursor-pointer"
                    title="Delete Custom Layer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <input
                  type="text"
                  value={layer.content || ""}
                  onChange={(e) =>
                    handleUpdateCustomLayer(layer.id, { content: e.target.value })
                  }
                  placeholder="Displayed text / content..."
                  className="w-full h-7 px-2 rounded bg-[var(--bg-input)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};


import React, { useState, useEffect } from "react";
import { Palette, Pipette } from "lucide-react";
import { resolveColorToHex } from "../../../remotion/types";

export interface ColorPickerFieldProps {
  label: string;
  desc?: string;
  value: string;
  onChange: (hex: string) => void;
}

export const ColorPickerField: React.FC<ColorPickerFieldProps> = ({
  label,
  desc,
  value,
  onChange,
}) => {
  const [hexInput, setHexInput] = useState(value);

  useEffect(() => {
    setHexInput(value);
  }, [value]);

  const cleanVal = value.startsWith("#") ? value : resolveColorToHex(value);

  return (
    <div className="p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
          <Palette className="w-3.5 h-3.5 text-amber-400" />
          <span>{label}</span>
        </span>
        <span
          className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border"
          style={{
            backgroundColor: `${cleanVal}20`,
            borderColor: `${cleanVal}70`,
            color: cleanVal,
          }}
        >
          {cleanVal}
        </span>
      </div>

      {desc && (
        <p className="text-[10px] text-[var(--text-muted)] leading-relaxed">
          {desc}
        </p>
      )}

      <div className="flex items-center gap-2 pt-0.5">
        {/* Native Eyedropper / Color Picker Button */}
        <label
          className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-white/20 cursor-pointer overflow-hidden shadow-md shrink-0 hover:scale-105 transition-transform"
          style={{ backgroundColor: cleanVal }}
          title="Buka sistem color picker / eyedropper"
        >
          <input
            type="color"
            value={cleanVal.length === 7 ? cleanVal : "#F97316"}
            onChange={(e) => {
              const next = e.target.value.toUpperCase();
              setHexInput(next);
              onChange(next);
            }}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          />
          <Pipette className="w-3.5 h-3.5 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] pointer-events-none" />
        </label>

        {/* Hex Input Box */}
        <div className="flex-1 flex items-center gap-1 px-2.5 h-8 rounded-lg bg-[var(--bg-input)] border border-[var(--border-color)] focus-within:border-amber-400 transition-colors">
          <span className="text-[11px] font-mono text-[var(--text-muted)] font-semibold">#</span>
          <input
            type="text"
            maxLength={6}
            value={hexInput.replace("#", "")}
            onChange={(e) => {
              const cleaned = e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6).toUpperCase();
              setHexInput(`#${cleaned}`);
              if (cleaned.length === 6 || cleaned.length === 3) {
                onChange(`#${cleaned}`);
              }
            }}
            placeholder="F97316"
            className="w-full bg-transparent text-xs font-mono text-[var(--text-primary)] outline-none uppercase font-semibold"
          />
        </div>

        {/* Live Preview Pill */}
        <div
          className="h-8 px-3 rounded-lg border flex items-center gap-1.5 text-[10px] font-mono font-bold shrink-0 transition-colors"
          style={{
            backgroundColor: `${cleanVal}25`,
            borderColor: cleanVal,
            color: cleanVal,
          }}
        >
          <span
            className="w-2 h-2 rounded-full shadow-sm"
            style={{ backgroundColor: cleanVal }}
          />
          <span>PREVIEW</span>
        </div>
      </div>
    </div>
  );
};

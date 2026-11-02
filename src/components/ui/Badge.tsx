import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "emerald" | "amber" | "rose" | "cyan" | "neutral";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "neutral",
  className = "",
}) => {
  const styles = {
    emerald: "bg-emerald-950/60 text-emerald-400 border-emerald-500/50",
    amber: "bg-amber-950/60 text-amber-400 border-amber-500/50",
    rose: "bg-rose-950/60 text-rose-400 border-rose-500/50",
    cyan: "bg-cyan-950/60 text-cyan-400 border-cyan-500/50",
    neutral: "bg-neutral-900 text-neutral-300 border-neutral-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-widest border rounded-none ${styles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};


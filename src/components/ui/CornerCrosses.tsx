import React from "react";

interface CornerCrossesProps {
  className?: string;
  size?: "sm" | "md";
}

export const CornerCrosses: React.FC<CornerCrossesProps> = ({ className = "text-neutral-500", size = "sm" }) => {
  const char = "+";
  const sizeClass = size === "sm" ? "text-[10px] leading-none" : "text-xs leading-none";

  return (
    <>
      <span className={`absolute -top-1.5 -left-1.5 select-none font-mono font-bold pointer-events-none ${sizeClass} ${className}`}>
        {char}
      </span>
      <span className={`absolute -top-1.5 -right-1.5 select-none font-mono font-bold pointer-events-none ${sizeClass} ${className}`}>
        {char}
      </span>
      <span className={`absolute -bottom-1.5 -left-1.5 select-none font-mono font-bold pointer-events-none ${sizeClass} ${className}`}>
        {char}
      </span>
      <span className={`absolute -bottom-1.5 -right-1.5 select-none font-mono font-bold pointer-events-none ${sizeClass} ${className}`}>
        {char}
      </span>
    </>
  );
};


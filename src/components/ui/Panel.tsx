import React from "react";
import { CornerCrosses } from "./CornerCrosses";

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  showCorners?: boolean;
  cornerColor?: string;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({
  children,
  showCorners = true,
  cornerColor,
  className = "",
  ...rest
}) => {
  return (
    <div
      className={`relative bg-neutral-900/80 border border-neutral-800 rounded-none ${className}`}
      {...rest}
    >
      {showCorners && <CornerCrosses className={cornerColor} />}
      {children}
    </div>
  );
};


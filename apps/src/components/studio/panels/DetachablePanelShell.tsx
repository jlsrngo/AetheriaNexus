import React, { useEffect, useRef, useState } from "react";
import { cn } from "../../../lib/utils";

export interface FloatingPanelGeometry {
  x: number;
  y: number;
  width: number;
  zIndex: number;
}

interface DetachablePanelShellProps {
  isFloating: boolean;
  dockedWidth?: number | string;
  geometry?: FloatingPanelGeometry;
  onFloat: (initialPos: { x: number; y: number }) => void;
  onUpdateGeometry?: (patch: Partial<FloatingPanelGeometry>) => void;
  onFocus?: () => void;
  children: React.ReactNode;
}

const MIN_FLOAT_WIDTH = 240;
const MAX_FLOAT_WIDTH = 680;

/**
 * Wraps any left-sidebar panel so its top header bar (top 38px) can be dragged
 * to detach the panel into a floating, width-resizable popup window.
 */
export const DetachablePanelShell: React.FC<DetachablePanelShellProps> = ({
  isFloating,
  dockedWidth = "var(--left-panel-width, 256px)",
  geometry,
  onFloat,
  onUpdateGeometry,
  onFocus,
  children,
}) => {
  const [localGeo, setLocalGeo] = useState<FloatingPanelGeometry>(
    geometry ?? { x: 84, y: 64, width: 310, zIndex: 50 }
  );
  const isFloatingRef = useRef(isFloating);
  isFloatingRef.current = isFloating;

  useEffect(() => {
    if (geometry) {
      setLocalGeo(geometry);
    }
  }, [geometry?.x, geometry?.y, geometry?.width, geometry?.zIndex]);

  const handleContainerMouseDownCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isFloating && onFocus) {
      onFocus();
    }

    // Only initiate drag if user clicked inside the top 38px header bar
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    if (offsetY > 38) return;

    // Do not hijack clicks on interactive elements inside the header
    const target = e.target as HTMLElement;
    if (target.closest("button, input, select, textarea, a")) return;

    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = localGeo.x;
    const origY = localGeo.y;
    const currentWidth = localGeo.width;

    if (isFloating) {
      const onMove = (moveEvent: MouseEvent) => {
        const nextX = Math.max(
          8,
          Math.min(
            window.innerWidth - currentWidth - 8,
            origX + (moveEvent.clientX - startX)
          )
        );
        const nextY = Math.max(
          36,
          Math.min(window.innerHeight - 100, origY + (moveEvent.clientY - startY))
        );
        setLocalGeo((prev) => ({ ...prev, x: nextX, y: nextY }));
        onUpdateGeometry?.({ x: nextX, y: nextY });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    } else {
      let detached = false;
      const onMove = (moveEvent: MouseEvent) => {
        const dist = Math.hypot(
          moveEvent.clientX - startX,
          moveEvent.clientY - startY
        );
        const nextX = Math.max(
          8,
          Math.min(
            window.innerWidth - currentWidth - 8,
            moveEvent.clientX - Math.round(currentWidth / 2)
          )
        );
        const nextY = Math.max(
          36,
          Math.min(window.innerHeight - 100, moveEvent.clientY - 18)
        );

        if (!detached && dist > 7) {
          detached = true;
          setLocalGeo((prev) => ({ ...prev, x: nextX, y: nextY }));
          onFloat({ x: nextX, y: nextY });
        } else if (detached) {
          setLocalGeo((prev) => ({ ...prev, x: nextX, y: nextY }));
          onUpdateGeometry?.({ x: nextX, y: nextY });
        }
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
  };

  const startResizeWidth = (
    e: React.MouseEvent,
    side: "left" | "right"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    onFocus?.();

    const startX = e.clientX;
    const origWidth = localGeo.width;
    const origX = localGeo.x;

    const onMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (side === "right") {
        const nextWidth = Math.max(
          MIN_FLOAT_WIDTH,
          Math.min(MAX_FLOAT_WIDTH, origWidth + deltaX)
        );
        setLocalGeo((prev) => ({ ...prev, width: nextWidth }));
        onUpdateGeometry?.({ width: nextWidth });
      } else {
        const nextWidth = Math.max(
          MIN_FLOAT_WIDTH,
          Math.min(MAX_FLOAT_WIDTH, origWidth - deltaX)
        );
        const appliedDelta = origWidth - nextWidth;
        const nextX = Math.max(8, origX + appliedDelta);
        setLocalGeo((prev) => ({ ...prev, x: nextX, width: nextWidth }));
        onUpdateGeometry?.({ x: nextX, width: nextWidth });
      }
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  if (!isFloating) {
    return (
      <div
        onMouseDownCapture={handleContainerMouseDownCapture}
        className="h-full flex shrink-0 relative [&>aside]:h-full [&>aside>div:first-child]:cursor-grab [&>aside>div:first-child]:active:cursor-grabbing"
        style={{ width: dockedWidth }}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      onMouseDownCapture={handleContainerMouseDownCapture}
      className={cn(
        "fixed flex flex-col rounded-xl bg-[var(--bg-panel)] border-2 border-[var(--border-strong)] shadow-2xl overflow-hidden select-none",
        "[&>aside]:w-full! [&>aside]:max-h-[82vh] [&>aside]:border-r-0 [&>aside>div:first-child]:cursor-grab [&>aside>div:first-child]:active:cursor-grabbing [&>aside>div:first-child]:bg-[var(--bg-card)]"
      )}
      style={{
        left: localGeo.x,
        top: localGeo.y,
        width: localGeo.width,
        maxHeight: "82vh",
        zIndex: localGeo.zIndex,
      }}
    >
      {/* Left Width Resize Handle */}
      <div
        onMouseDown={(e) => startResizeWidth(e, "left")}
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[#cf6613] transition-colors z-30"
        title="Drag to resize width"
      />

      {/* Right Width Resize Handle */}
      <div
        onMouseDown={(e) => startResizeWidth(e, "right")}
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-[#cf6613] transition-colors z-30"
        title="Drag to resize width"
      />

      {/* Bottom-Right Corner Width Resize Grip */}
      <div
        onMouseDown={(e) => startResizeWidth(e, "right")}
        className="absolute right-0 bottom-0 w-3.5 h-3.5 cursor-nwse-resize z-30 flex items-end justify-end p-0.5 text-[var(--text-muted)] hover:text-amber-400"
        title="Drag to resize width"
      >
        <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current">
          <path d="M8 2v6H2" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>

      {children}
    </div>
  );
};

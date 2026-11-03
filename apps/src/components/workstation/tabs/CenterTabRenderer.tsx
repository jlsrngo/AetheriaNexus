import { memo, lazy, Suspense } from "react";
import { CenterTab } from "./types";
import { CenterEditorView } from "./CenterEditorView";
import { SplitDiffViewer } from "./SplitDiffViewer";
import { StudioPlayerCanvas } from "../../studio/StudioPlayerCanvas";
import { cn } from "../../../lib/utils";

const CanvasView = lazy(() =>
  import("../canvas/CanvasView").then((m) => ({ default: m.CanvasView }))
);

interface CenterTabRendererProps {
  tab: CenterTab;
  isActive: boolean;
  tabContent: string;
  activeFolder?: string;
  lineCount: number;
  addedLineNums: Set<number>;
  cursorPos: { line: number; col: number };
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  gutterRef: React.RefObject<HTMLDivElement | null>;
  onTextChange: (text: string) => void;
  updateCursorPos: () => void;
  onScroll: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onTextChangeForTab: (tabId: string, text: string) => void;
  onSaveForTab: (tabId: string) => void;
  onDirtyChange: (tabId: string, dirty: boolean) => void;
  onOpenFileTab?: (filePath: string) => void;
  onCloseTab: (tabId: string) => void;
  onRevertDiff?: (filePath: string) => void;
  onAcceptDiff?: (filePath: string) => void;
}

export const CenterTabRenderer = memo(function CenterTabRenderer({
  tab,
  isActive,
  tabContent,
  activeFolder: _activeFolder,
  lineCount,
  addedLineNums,
  cursorPos,
  textareaRef,
  gutterRef,
  onTextChange,
  updateCursorPos,
  onScroll,
  onKeyDown,
  onTextChangeForTab,
  onSaveForTab,
  onOpenFileTab: _onOpenFileTab,
  onCloseTab,
  onRevertDiff,
  onAcceptDiff,
}: CenterTabRendererProps) {
  const isTabCanvas = tab.type === "canvas";

  return (
    <div
      className={cn("w-full h-full flex flex-col flex-1", !isActive && "hidden")}
      style={{ display: isActive ? "flex" : "none" }}
    >
      {isTabCanvas ? (
        <Suspense fallback={null}>
          <CanvasView
            content={tabContent}
            title={tab.title}
            tabId={tab.id}
            timeStr={tab.timeStr}
            createdAt={tab.createdAt}
            onContentChange={(newContent) => onTextChangeForTab(tab.id, newContent)}
            onSave={() => onSaveForTab(tab.id)}
          />
        </Suspense>
      ) : tab.type === "stage" ? (
        <StudioPlayerCanvas />
      ) : tab.type === "diff" ? (
        <SplitDiffViewer
          fileName={tab.title.replace(" (Working Tree)", "")}
          filePath={tab.path}
          beforeContent={tab.beforeContent || ""}
          afterContent={tab.afterContent || tab.content || ""}
          onRevert={() => {
            if (tab.path && onRevertDiff) {
              onRevertDiff(tab.path);
            }
            onCloseTab(tab.id);
          }}
          onAccept={() => {
            if (tab.path && onAcceptDiff) {
              onAcceptDiff(tab.path);
            }
            onCloseTab(tab.id);
          }}
        />
      ) : (
        isActive && (
          <CenterEditorView
            currentContent={tabContent}
            lineCount={lineCount}
            addedLineNums={addedLineNums}
            cursorPos={cursorPos}
            textareaRef={textareaRef}
            gutterRef={gutterRef}
            onTextChange={onTextChange}
            updateCursorPos={updateCursorPos}
            onScroll={onScroll}
            onKeyDown={onKeyDown}
          />
        )
      )}
    </div>
  );
});

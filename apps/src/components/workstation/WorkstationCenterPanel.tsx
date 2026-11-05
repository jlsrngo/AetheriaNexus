import { memo, useState, useCallback } from "react";
import { CenterTab } from "./tabs/types";
import { StudioPreview } from "../studio/StudioPreview";
import { CenterTabRenderer } from "./tabs/CenterTabRenderer";
import { useCenterPanelEditor } from "./hooks/useCenterPanelEditor";
import { Film, FileCode, X } from "lucide-react";
import { cn } from "../../lib/utils";

export type { CenterTab };

export interface WorkstationCenterPanelProps {
  tabs: CenterTab[];
  activeTabId: string | null;
  activeFolder?: string;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onUpdateTabContent?: (tabId: string, newContent: string) => void;
  onSaveTabContent?: (tabId: string, content: string) => Promise<void> | void;
  onOpenFolder?: () => void;
  onOpenFileTab?: (filePath: string) => void;
}

function WorkstationCenterPanelComponent({
  tabs,
  activeTabId,
  activeFolder,
  onSelectTab,
  onCloseTab,
  onUpdateTabContent,
  onSaveTabContent,
  onOpenFileTab,
}: WorkstationCenterPanelProps) {
  const [activeView, setActiveView] = useState<"studio" | "script">("studio");
  const [_unsavedTabs, setUnsavedTabs] = useState<Record<string, boolean>>({});
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleDirtyChange = useCallback((tabId: string, dirty: boolean) => {
    setUnsavedTabs((prev) => ({ ...prev, [tabId]: dirty }));
  }, []);

  const {
    editedContents,
    cursorPos,
    textareaRef,
    gutterRef,
    lineCount,
    addedLineNums,
    handleTextChange,
    handleTextChangeForTab,
    handleSaveForTab,
    handleScroll,
    handleKeyDown,
    updateCursorPos,
  } = useCenterPanelEditor({
    tabs,
    activeTab,
    onUpdateTabContent,
    onSaveTabContent,
  });

  return (
    <main className="flex-1 flex flex-col min-w-0 bg-[var(--bg-app)] overflow-hidden select-none border-l border-r border-[var(--border-color)] transition-none">
      {/* 1. TOP VIEW SELECTOR BAR */}
      <div className="h-9 bg-[var(--bg-app)] border-b border-[var(--border-color)] px-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveView("studio")}
            className={cn(
              "px-3 py-1 text-xs font-medium flex items-center gap-1.5 border rounded-md transition-colors cursor-pointer shrink-0",
              activeView === "studio"
                ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)] shadow-sm"
                : "bg-transparent text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
            )}
          >
            <Film className="w-3.5 h-3.5 text-emerald-400" />
            <span>Studio Stage</span>
          </button>

          {/* Open Script Tabs if any */}
          {tabs.map((tab) => {
            const isTabActive = activeView === "script" && activeTabId === tab.id;
            return (
              <div
                key={tab.id}
                onClick={() => {
                  onSelectTab(tab.id);
                  setActiveView("script");
                }}
                className={cn(
                  "px-3 py-1 text-xs font-medium flex items-center gap-1.5 border rounded-md transition-colors cursor-pointer shrink-0",
                  isTabActive
                    ? "bg-[var(--bg-hover)] text-[var(--text-primary)] border-[var(--border-strong)] shadow-sm"
                    : "bg-transparent text-[var(--text-muted)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)]"
                )}
              >
                <FileCode className="w-3 h-3 text-amber-400" />
                <span className="truncate max-w-[120px]">{tab.title}</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                    if (tabs.length <= 1) setActiveView("studio");
                  }}
                  className="hover:text-rose-400 ml-1 p-0.5 rounded transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MAIN CENTER CONTENT VIEW (in-house preview stage — engine is driven from Rust) */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative overflow-hidden bg-[var(--bg-app)]">
        {activeView === "studio" ? (
          <StudioPreview />
        ) : activeTab ? (
          <div className="w-full h-full flex flex-col flex-1 min-h-0">
            <CenterTabRenderer
              tab={activeTab}
              isActive={true}
              tabContent={editedContents[activeTab.id] ?? activeTab.content ?? ""}
              activeFolder={activeFolder}
              lineCount={lineCount}
              addedLineNums={addedLineNums}
              cursorPos={cursorPos}
              textareaRef={textareaRef}
              gutterRef={gutterRef}
              onTextChange={handleTextChange}
              updateCursorPos={updateCursorPos}
              onScroll={handleScroll}
              onKeyDown={handleKeyDown}
              onTextChangeForTab={handleTextChangeForTab}
              onSaveForTab={handleSaveForTab}
              onDirtyChange={handleDirtyChange}
              onOpenFileTab={onOpenFileTab}
              onCloseTab={(id) => {
                onCloseTab(id);
                if (tabs.length <= 1) setActiveView("studio");
              }}
            />
          </div>
        ) : (
          <StudioPreview />
        )}
      </div>
    </main>
  );
}

export const WorkstationCenterPanel = memo(WorkstationCenterPanelComponent);

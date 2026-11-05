import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { WorkstationLeftExplorer } from "../components/workstation/WorkstationLeftExplorer";
import { WorkstationCenterPanel } from "../components/workstation/WorkstationCenterPanel";
import { WorkstationRightChat } from "../components/workstation/WorkstationRightChat";
import { ConnectFolderModal } from "../components/workstation/ConnectFolderModal";
import { SearchSectionModal } from "../components/workstation/SearchSectionModal";
import { QuickOpenFileModal } from "../components/workstation/QuickOpenFileModal";
import { useTabs } from "../components/workstation/tabs/useTabs";
import { useWorkstationChat } from "../components/workstation/chat/useWorkstationChat";
import { useWorkstationSession } from "../components/workstation/hooks/useWorkstationSession";
import { useWorkstationFiles } from "../components/workstation/hooks/useWorkstationFiles";
import { useWorkstationLayout } from "../components/workstation/hooks/useWorkstationLayout";
import { ErrorBoundary } from "../components/common/ErrorBoundary";

export function UnifiedWorkstationPage() {
  const location = useLocation();
  const isWorkstationRoute =
    location.pathname === "/" || location.pathname.startsWith("/workspace");

  // 1. Session & Folder Isolation Management
  const {
    activeFolder,
    activeWorkspace,
    activeChatId,
    setActiveChatId,
    openFolder,
    handleCloseFolderAction,
    handleSelectSessionAction,
  } = useWorkstationSession({ isWorkstationRoute });

  // 2. Workspace Files & Mentions Query
  const {
    workspaceFiles,
    refetchFiles,
    setNativeFileNames,
    mentionFiles,
  } = useWorkstationFiles({ activeFolder });

  // 3. Document Tabs Management
  const tabs = useTabs({ activeFolder, activeChatId, refetchFiles });

  // 4. Workstation Chat Engine
  const chat = useWorkstationChat({
    activeFolder,
    activeChatId,
    setActiveChatId,
    refetchFiles,
    reloadOpenTabsContent: tabs.reloadOpenTabsContent,
    onOpenFileTab: tabs.handleOpenFileTab,
    upsertCanvasTab: tabs.upsertCanvasTab,
    setRecentCanvases: tabs.setRecentCanvases,
  });

  const handleSaveActiveTab = useCallback(() => {
    const activeTab = tabs.tabs.find((t) => t.id === tabs.activeTabId);
    if (activeTab && (activeTab.type === "file" || activeTab.type === "app")) {
      tabs.handleSaveFileTab(activeTab.id, activeTab.content || "");
      return;
    }
    toast.info("Nothing to save - open a document first.");
  }, [tabs]);

  const handleOpenCanvas = useCallback(
    (content: string) => {
      tabs.upsertCanvasTab(content, true);
    },
    [tabs]
  );

  // 5. Layout Panels & Global Window Event Handlers
  const {
    containerRef,
    leftCollapsed,
    rightCollapsed,
    startDrag,
    handleCloseLeft,
    handleToggleLeft,
    handleToggleRight,
    showFolderModal,
    handleOpenFolderModal,
    handleCloseFolderModal,
    showSearchSectionModal,
    handleOpenSearchModal,
    handleCloseSearchModal,
  } = useWorkstationLayout({
    onNewChat: chat.handleNewChat,
    onSaveActiveTab: handleSaveActiveTab,
    onOpenCanvas: handleOpenCanvas,
  });

  const [showQuickOpenModal, setShowQuickOpenModal] = useState(false);

  useEffect(() => {
    const handleQuickOpenEvent = () => setShowQuickOpenModal((prev) => !prev);
    window.addEventListener("arunaki-quick-open-file", handleQuickOpenEvent);
    return () => {
      window.removeEventListener("arunaki-quick-open-file", handleQuickOpenEvent);
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-neutral-950 text-neutral-100 overflow-hidden select-none transition-none font-mono relative">
      {/* Floating AI Copilot toggle when right panel is collapsed */}
      {rightCollapsed && (
        <div className="absolute top-1 right-2 z-50 flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-800 p-0.5 shadow-lg">
          <button
            type="button"
            onClick={handleToggleRight}
            className="px-2.5 py-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-700 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 rounded-none cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>AI COPILOT</span>
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden relative"
        style={
          {
            "--left-panel-width": "256px",
            "--right-panel-width": "340px",
          } as React.CSSProperties
        }
      >
        {/* 1. Left: workspace explorer */}
        <WorkstationLeftExplorer
          collapsed={leftCollapsed}
          onClose={handleCloseLeft}
          onToggle={handleToggleLeft}
          activeWorkspace={activeWorkspace}
          workspaceFiles={workspaceFiles}
          onOpenFileTab={tabs.handleOpenFileTab}
          onOpenFolderModal={handleOpenFolderModal}
          onCloseFolder={handleCloseFolderAction}
          width="var(--left-panel-width, 256px)"
          onNativeFilesChange={setNativeFileNames}
          recentCanvases={tabs.recentCanvases}
          onOpenCanvasTab={tabs.handleOpenCanvasTab}
        />

        {!leftCollapsed && (
          <div
            className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-neutral-600 transition-colors"
            onMouseDown={(e) => startDrag("left", e)}
          />
        )}

        {/* 2. Center: tabs + video preview + timeline */}
        <WorkstationCenterPanel
          tabs={tabs.tabs}
          activeTabId={tabs.activeTabId}
          activeFolder={activeFolder}
          onSelectTab={tabs.setActiveTabId}
          onCloseTab={tabs.handleCloseTab}
          onUpdateTabContent={tabs.handleUpdateTabContent}
          onSaveTabContent={tabs.handleSaveFileTab}
        />

        {/* Resizer when Right Chat is open */}
        {!rightCollapsed && (
          <div
            className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-neutral-600 transition-colors"
            onMouseDown={(e) => startDrag("right", e)}
          />
        )}

        {/* AI Copilot Panel (HALO) */}
        {!rightCollapsed && (
          <div
            className="h-full flex flex-col shrink-0 overflow-hidden bg-neutral-950 border-l border-neutral-800"
            style={{ width: "var(--right-panel-width, 340px)" }}
          >
            <ErrorBoundary fullScreen={false} fallbackTitle="Chat panel encountered an error">
              <WorkstationRightChat
                activeChatId={activeChatId}
                collapsed={false}
                onClose={handleToggleRight}
                chatMessages={chat.chatMessages}
                optimisticMessages={chat.optimisticMessages}
                liveStatus={chat.liveStatus}
                messagesEndRef={chat.messagesEndRef}
                activeWorkspace={activeWorkspace}
                isStreaming={chat.isStreaming}
                onSendMessage={chat.handleSendMessage}
                width="100%"
                files={mentionFiles}
                queuedPrompts={chat.queuedPrompts}
                onRemoveQueuedPrompt={chat.handleRemoveQueuedPrompt}
                onSearchSection={handleOpenSearchModal}
                reasoningEffort={chat.reasoningEffort}
                setReasoningEffort={chat.setReasoningEffort}
                effortOptions={chat.effortOptions}
                activeModel={chat.activeModel}
                modelOptions={chat.providerModels}
                onSelectModel={(m) => chat.setActiveModel(chat.activeModel?.providerID ?? "", m.id)}
                onNewChat={chat.handleNewChat}
                onCancelStream={chat.handleCancelStream}
                onAnswerQuestion={chat.handleAnswerQuestion}
                onCompactSession={chat.handleCompactSession}
                isCompacting={chat.isCompacting}
                isCompacted={chat.isCompacted}
              />
            </ErrorBoundary>
          </div>
        )}
      </div>

      <ConnectFolderModal
        isOpen={showFolderModal}
        onClose={handleCloseFolderModal}
        onOpenFolder={openFolder}
      />

      <SearchSectionModal
        isOpen={showSearchSectionModal}
        activeFolder={activeFolder}
        onClose={handleCloseSearchModal}
        onSelectSession={handleSelectSessionAction}
      />

      <QuickOpenFileModal
        isOpen={showQuickOpenModal}
        onClose={() => setShowQuickOpenModal(false)}
        activeFolder={activeFolder}
        workspaceFiles={workspaceFiles}
        tabs={tabs.tabs}
        onOpenFileTab={tabs.handleOpenFileTab}
        onSelectTab={tabs.setActiveTabId}
        onCloseTab={tabs.handleCloseTab}
      />
    </div>
  );
}

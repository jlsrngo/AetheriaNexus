import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { WorkstationLeftExplorer } from "../components/workstation/WorkstationLeftExplorer";
import { WorkstationActivityBar, type SidebarView } from "../components/workstation/activity/WorkstationActivityBar";
import { WorkspaceSearchPanel } from "../components/workstation/search/WorkspaceSearchPanel";
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
  const [activeSidebarView, setActiveSidebarView] = useState<SidebarView>("explorer");

  const handleSelectSidebarView = useCallback(
    (view: SidebarView) => {
      if (leftCollapsed) {
        setActiveSidebarView(view);
        handleToggleLeft();
      } else if (activeSidebarView === view) {
        handleToggleLeft();
      } else {
        setActiveSidebarView(view);
      }
    },
    [leftCollapsed, activeSidebarView, handleToggleLeft]
  );

  useEffect(() => {
    const handleQuickOpenEvent = () => setShowQuickOpenModal((prev) => !prev);
    const handleWorkspaceSearchEvent = () => {
      setActiveSidebarView("search");
      if (leftCollapsed) handleToggleLeft();
    };
    window.addEventListener("arunaki-quick-open-file", handleQuickOpenEvent);
    window.addEventListener("arunaki-workspace-search", handleWorkspaceSearchEvent);
    return () => {
      window.removeEventListener("arunaki-quick-open-file", handleQuickOpenEvent);
      window.removeEventListener("arunaki-workspace-search", handleWorkspaceSearchEvent);
    };
  }, [leftCollapsed, handleToggleLeft]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden select-none transition-colors duration-150">
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden relative"
        style={{ "--left-panel-width": "256px", "--right-panel-width": "320px" } as React.CSSProperties}
      >
        {/* Activity Bar on far left (VS Code parity) */}
        <WorkstationActivityBar
          activeView={activeSidebarView}
          isCollapsed={leftCollapsed}
          onSelectView={handleSelectSidebarView}
        />

        {!leftCollapsed && activeSidebarView === "explorer" && (
          <WorkstationLeftExplorer
            collapsed={false}
            onClose={handleCloseLeft}
            onToggle={handleToggleLeft}
            activeWorkspace={activeWorkspace}
            workspaceFiles={workspaceFiles}
            onOpenFileTab={tabs.handleOpenFileTab}
            onOpenFolderModal={handleOpenFolderModal}
            onCloseFolder={handleCloseFolderAction}
            width="var(--left-panel-width)"
            onNativeFilesChange={setNativeFileNames}
            recentCanvases={tabs.recentCanvases}
            onOpenCanvasTab={tabs.handleOpenCanvasTab}
          />
        )}

        {!leftCollapsed && activeSidebarView === "search" && (
          <WorkspaceSearchPanel
            activeFolder={activeFolder}
            workspaceFiles={workspaceFiles}
            onOpenFileTab={tabs.handleOpenFileTab}
            onClose={handleCloseLeft}
            onToggle={handleToggleLeft}
            width="var(--left-panel-width)"
          />
        )}

        {!leftCollapsed && (
          <div
            className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-[var(--border-strong)] transition-colors"
            onMouseDown={(e) => startDrag("left", e)}
          />
        )}

        {/* Center: tabs + video preview + timeline */}
        <WorkstationCenterPanel
          tabs={tabs.tabs}
          activeTabId={tabs.activeTabId}
          activeFolder={activeFolder}
          onSelectTab={tabs.setActiveTabId}
          onCloseTab={tabs.handleCloseTab}
          onUpdateTabContent={tabs.handleUpdateTabContent}
          onSaveTabContent={tabs.handleSaveFileTab}
        />

        {!rightCollapsed && (
          <div
            className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-[var(--border-strong)] transition-colors"
            onMouseDown={(e) => startDrag("right", e)}
          />
        )}

        <ErrorBoundary fullScreen={false} fallbackTitle="Chat panel encountered an error">
          <WorkstationRightChat
            activeChatId={activeChatId}
            collapsed={rightCollapsed}
            onClose={handleToggleRight}
            chatMessages={chat.chatMessages}
            optimisticMessages={chat.optimisticMessages}
            liveStatus={chat.liveStatus}
            messagesEndRef={chat.messagesEndRef}
            activeWorkspace={activeWorkspace}
            isStreaming={chat.isStreaming}
            onSendMessage={chat.handleSendMessage}
            width="var(--right-panel-width, 320px)"
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

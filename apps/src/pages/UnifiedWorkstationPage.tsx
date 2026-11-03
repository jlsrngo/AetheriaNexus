import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { StudioAssetsPanel } from "../components/studio/StudioAssetsPanel";
import { WorkstationCenterPanel } from "../components/workstation/WorkstationCenterPanel";
import { WorkstationRightChat } from "../components/workstation/WorkstationRightChat";
import { WorkstationLeftExplorer } from "../components/workstation/WorkstationLeftExplorer";
import {
  WorkstationActivityBar,
  SidebarView,
} from "../components/workstation/activity/WorkstationActivityBar";
import { ConnectFolderModal } from "../components/workstation/ConnectFolderModal";
import { SearchSectionModal } from "../components/workstation/SearchSectionModal";
import { QuickOpenFileModal } from "../components/workstation/QuickOpenFileModal";
import { useTabs } from "../components/workstation/tabs/useTabs";
import { useWorkstationChat } from "../components/workstation/chat/useWorkstationChat";
import { useWorkstationSession } from "../components/workstation/hooks/useWorkstationSession";
import { useWorkstationFiles } from "../components/workstation/hooks/useWorkstationFiles";
import { useWorkstationLayout } from "../components/workstation/hooks/useWorkstationLayout";
import { ErrorBoundary } from "../components/common/ErrorBoundary";
import { tauriPickFolder } from "../lib/api";

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
    handleCloseFolderAction: _handleCloseFolderAction,
    handleSelectSessionAction,
  } = useWorkstationSession({ isWorkstationRoute });

  // 2. Workspace Files & Mentions Query
  const {
    workspaceFiles,
    refetchFiles,
    setNativeFileNames: _setNativeFileNames,
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

  // Save active document tab callback for top menubar Ctrl+S / File -> Save
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
    handleCloseLeft: _handleCloseLeft,
    handleToggleLeft,
    handleToggleRight,
    showFolderModal,
    handleCloseFolderModal,
    showSearchSectionModal,
    handleOpenSearchModal,
    handleCloseSearchModal,
  } = useWorkstationLayout({
    onNewChat: chat.handleNewChat,
    onSaveActiveTab: handleSaveActiveTab,
    onOpenCanvas: handleOpenCanvas,
  });

  // Directly open native OS folder picker (VS Code / Antigravity IDE parity — NO intermediate popup!)
  const handleDirectPickFolder = useCallback(async () => {
    try {
      const selected = await tauriPickFolder();
      if (selected) {
        openFolder(selected);
        toast.success(`Folder opened: ${selected}`);
      }
    } catch (err: any) {
      toast.error(`Failed to open folder: ${err?.message || err}`);
    }
  }, [openFolder]);

  const [showQuickOpenModal, setShowQuickOpenModal] = useState(false);

  // Listen for Ctrl+P Quick Open File
  useEffect(() => {
    const handleQuickOpenEvent = () => setShowQuickOpenModal((prev) => !prev);
    window.addEventListener("arunaki-quick-open-file", handleQuickOpenEvent);
    return () => {
      window.removeEventListener("arunaki-quick-open-file", handleQuickOpenEvent);
    };
  }, []);

  const [activeCompositionId, setActiveCompositionId] = useState("nexus-vertical");
  const [sidebarView, setSidebarView] = useState<SidebarView>("explorer");

  const handleSelectSidebarView = useCallback(
    (view: SidebarView) => {
      if (view === "search") {
        handleOpenSearchModal();
        return;
      }
      if (!leftCollapsed && sidebarView === view) {
        handleToggleLeft();
      } else {
        if (leftCollapsed) {
          handleToggleLeft();
        }
        setSidebarView(view);
      }
    },
    [leftCollapsed, sidebarView, handleToggleLeft, handleOpenSearchModal]
  );

  return (
    <div className="flex flex-col h-full w-full bg-neutral-950 text-neutral-100 overflow-hidden select-none transition-none font-mono">
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden relative"
        style={{ "--left-panel-width": "256px", "--right-panel-width": "320px" } as React.CSSProperties}
      >
        {/* Far-Left Activity Bar (Arunaki Agent Architecture) */}
        <WorkstationActivityBar
          activeView={sidebarView}
          isCollapsed={leftCollapsed}
          onSelectView={handleSelectSidebarView}
          activeFolderName={activeFolder ? activeFolder.split(/[\\/]/).pop() : undefined}
          onOpenFolder={handleDirectPickFolder}
        />

        {/* Secondary Left Sidebar Panel: Explorer or Compositions */}
        {!leftCollapsed && (
          <div
            className="h-full flex flex-col shrink-0 overflow-hidden"
            style={{ width: "var(--left-panel-width)" }}
          >
            {sidebarView === "compositions" ? (
              <StudioAssetsPanel
                activeCompositionId={activeCompositionId}
                onSelectComposition={setActiveCompositionId}
                width="100%"
              />
            ) : (
              <WorkstationLeftExplorer
                collapsed={false}
                onClose={handleToggleLeft}
                activeWorkspace={activeWorkspace}
                workspaceFiles={workspaceFiles}
                onOpenFileTab={(path, name, content) =>
                  tabs.handleOpenFileTab(path, name, content)
                }
                onOpenFolderModal={handleDirectPickFolder}
                width="100%"
                recentCanvases={tabs.recentCanvases}
                onOpenCanvasTab={(item) => handleOpenCanvas(item.content)}
                onCloseFolder={() => openFolder("")}
              />
            )}
          </div>
        )}

        {!leftCollapsed && (
          <div
            className="w-1 cursor-col-resize bg-neutral-850 hover:bg-white shrink-0 transition-colors"
            onMouseDown={(e) => startDrag("left", e)}
          />
        )}

        <WorkstationCenterPanel
          tabs={tabs.tabs}
          activeTabId={tabs.activeTabId}
          activeFolder={activeFolder}
          onSelectTab={tabs.setActiveTabId}
          onCloseTab={tabs.handleCloseTab}
          onUpdateTabContent={tabs.handleUpdateTabContent}
          onSaveTabContent={tabs.handleSaveFileTab}
          onOpenFolder={handleDirectPickFolder}
          onOpenFileTab={(path) =>
            tabs.handleOpenFileTab(path, path.split(/[\\/]/).pop() || path)
          }
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

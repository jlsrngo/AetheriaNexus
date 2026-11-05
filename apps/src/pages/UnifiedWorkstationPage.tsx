import { useState, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { WorkstationLeftExplorer } from "../components/workstation/WorkstationLeftExplorer";
import { WorkstationActivityBar, type SidebarView } from "../components/workstation/activity/WorkstationActivityBar";
import { WorkspaceSearchPanel } from "../components/workstation/search/WorkspaceSearchPanel";
import { CompositionsPanel } from "../components/studio/panels/CompositionsPanel";
import { InspectorPanel } from "../components/studio/panels/InspectorPanel";
import { ElementsCaptionsPanel } from "../components/studio/panels/ElementsCaptionsPanel";
import { RenderQueuePanel } from "../components/studio/panels/RenderQueuePanel";
import {
  DetachablePanelShell,
  type FloatingPanelGeometry,
} from "../components/studio/panels/DetachablePanelShell";
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
import { useStudioStore } from "../hooks/useStudioStore";
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
  const [activeSidebarView, setActiveSidebarView] = useState<SidebarView>("compositions");
  const [floatingPanels, setFloatingPanels] = useState<
    Partial<Record<SidebarView, FloatingPanelGeometry>>
  >({});
  const [, setTopZIndex] = useState(55);

  const { renderJobs } = useStudioStore();
  const activeRenderCount =
    renderJobs.filter((j) => j.status === "rendering" || j.status === "pending").length ||
    renderJobs.length;

  const handleFloatPanel = useCallback(
    (view: SidebarView, pos: { x: number; y: number }) => {
      setTopZIndex((prevZ) => {
        const nextZ = prevZ + 1;
        setFloatingPanels((prev) => ({
          ...prev,
          [view]: {
            x: pos.x,
            y: pos.y,
            width: prev[view]?.width ?? 310,
            zIndex: nextZ,
          },
        }));
        return nextZ;
      });
      if (!leftCollapsed && activeSidebarView === view) {
        handleCloseLeft();
      }
    },
    [leftCollapsed, activeSidebarView, handleCloseLeft]
  );

  const handleDockPanelBack = useCallback(
    (view: SidebarView) => {
      setFloatingPanels((prev) => {
        const next = { ...prev };
        delete next[view];
        return next;
      });
      setActiveSidebarView(view);
      if (leftCollapsed) {
        handleToggleLeft();
      }
    },
    [leftCollapsed, handleToggleLeft]
  );

  const handleUpdateFloatingGeometry = useCallback(
    (view: SidebarView, patch: Partial<FloatingPanelGeometry>) => {
      setFloatingPanels((prev) => {
        const cur = prev[view];
        if (!cur) return prev;
        return {
          ...prev,
          [view]: { ...cur, ...patch },
        };
      });
    },
    []
  );

  const handleFocusFloatingPanel = useCallback((view: SidebarView) => {
    setTopZIndex((prevZ) => {
      const nextZ = prevZ + 1;
      setFloatingPanels((prev) => {
        const cur = prev[view];
        if (!cur || cur.zIndex === prevZ) return prev;
        return {
          ...prev,
          [view]: { ...cur, zIndex: nextZ },
        };
      });
      return nextZ;
    });
  }, []);

  const handleSelectSidebarView = useCallback(
    (view: SidebarView) => {
      if (floatingPanels[view]) {
        handleDockPanelBack(view);
        return;
      }
      if (leftCollapsed) {
        setActiveSidebarView(view);
        handleToggleLeft();
      } else if (activeSidebarView === view) {
        handleToggleLeft();
      } else {
        setActiveSidebarView(view);
      }
    },
    [leftCollapsed, activeSidebarView, handleToggleLeft, floatingPanels, handleDockPanelBack]
  );

  const renderPanelContent = (view: SidebarView, isFloating: boolean) => {
    const onCloseAction = isFloating
      ? () => handleDockPanelBack(view)
      : handleCloseLeft;

    switch (view) {
      case "compositions":
        return (
          <CompositionsPanel
            width="100%"
            isFloating={isFloating}
            onClose={onCloseAction}
          />
        );
      case "inspector":
        return (
          <InspectorPanel
            width="100%"
            isFloating={isFloating}
            onClose={onCloseAction}
          />
        );
      case "elements":
        return (
          <ElementsCaptionsPanel
            width="100%"
            isFloating={isFloating}
            onClose={onCloseAction}
          />
        );
      case "renders":
        return (
          <RenderQueuePanel
            width="100%"
            isFloating={isFloating}
            onClose={onCloseAction}
          />
        );
      case "explorer":
        return (
          <WorkstationLeftExplorer
            collapsed={false}
            isFloating={isFloating}
            onClose={onCloseAction}
            onToggle={isFloating ? onCloseAction : handleToggleLeft}
            activeWorkspace={activeWorkspace}
            workspaceFiles={workspaceFiles}
            onOpenFileTab={tabs.handleOpenFileTab}
            onOpenFolderModal={handleOpenFolderModal}
            onCloseFolder={handleCloseFolderAction}
            width="100%"
            onNativeFilesChange={setNativeFileNames}
            recentCanvases={tabs.recentCanvases}
            onOpenCanvasTab={tabs.handleOpenCanvasTab}
          />
        );
      case "search":
        return (
          <WorkspaceSearchPanel
            activeFolder={activeFolder}
            workspaceFiles={workspaceFiles}
            onOpenFileTab={tabs.handleOpenFileTab}
            isFloating={isFloating}
            onClose={onCloseAction}
            onToggle={isFloating ? onCloseAction : handleToggleLeft}
            width="100%"
          />
        );
    }
  };

  const isCurrentSidebarFloating = Boolean(floatingPanels[activeSidebarView]);

  useEffect(() => {
    const handleQuickOpenEvent = () => setShowQuickOpenModal((prev) => !prev);
    const handleWorkspaceSearchEvent = () => {
      setActiveSidebarView("search");
      if (leftCollapsed) handleToggleLeft();
    };
    const handleOpenSidebarView = (e: Event) => {
      const custom = e as CustomEvent<SidebarView>;
      if (custom.detail) {
        setActiveSidebarView(custom.detail);
        if (leftCollapsed) handleToggleLeft();
      }
    };
    window.addEventListener("arunaki-quick-open-file", handleQuickOpenEvent);
    window.addEventListener("arunaki-workspace-search", handleWorkspaceSearchEvent);
    window.addEventListener("arunaki-open-sidebar-view", handleOpenSidebarView);
    return () => {
      window.removeEventListener("arunaki-quick-open-file", handleQuickOpenEvent);
      window.removeEventListener("arunaki-workspace-search", handleWorkspaceSearchEvent);
      window.removeEventListener("arunaki-open-sidebar-view", handleOpenSidebarView);
    };
  }, [leftCollapsed, handleToggleLeft]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-app)] text-[var(--text-primary)] overflow-hidden select-none transition-colors duration-150">
      <div
        ref={containerRef}
        className="flex-1 flex overflow-hidden relative"
        style={{ "--left-panel-width": "256px", "--right-panel-width": "320px" } as React.CSSProperties}
      >
        {/* Activity Bar on far left (6 Remotion + VS Code icons) */}
        <WorkstationActivityBar
          activeView={activeSidebarView}
          isCollapsed={leftCollapsed}
          onSelectView={handleSelectSidebarView}
          renderJobCount={activeRenderCount}
        />

        {/* Docked Left Sidebar Panel (Can be dragged out into a floating window) */}
        {!leftCollapsed && !isCurrentSidebarFloating && (
          <DetachablePanelShell
            isFloating={false}
            dockedWidth="var(--left-panel-width)"
            onFloat={(pos) => handleFloatPanel(activeSidebarView, pos)}
            onUpdateGeometry={(patch) =>
              handleUpdateFloatingGeometry(activeSidebarView, patch)
            }
          >
            {renderPanelContent(activeSidebarView, false)}
          </DetachablePanelShell>
        )}

        {!leftCollapsed && !isCurrentSidebarFloating && (
          <div
            className="w-1 cursor-col-resize bg-transparent shrink-0 hover:bg-[var(--border-strong)] transition-colors"
            onMouseDown={(e) => startDrag("left", e)}
          />
        )}

        {/* All Detached Floating Left Panels (Resizable Width & Independent Positioning) */}
        {(Object.keys(floatingPanels) as SidebarView[]).map((viewKey) => {
          const geo = floatingPanels[viewKey];
          if (!geo) return null;
          return (
            <DetachablePanelShell
              key={`float-${viewKey}`}
              isFloating
              geometry={geo}
              onFloat={(pos) => handleFloatPanel(viewKey, pos)}
              onUpdateGeometry={(patch) =>
                handleUpdateFloatingGeometry(viewKey, patch)
              }
              onFocus={() => handleFocusFloatingPanel(viewKey)}
            >
              {renderPanelContent(viewKey, true)}
            </DetachablePanelShell>
          );
        })}

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

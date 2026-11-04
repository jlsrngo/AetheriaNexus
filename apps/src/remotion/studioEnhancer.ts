/**
 * Nexus Studio Layout & Theme Enhancer
 *
 * Implements the Swiss Brutalist / Neo-Brutalist HUD architecture:
 * 1. Palette: Electric Technical Orange (#f97316) accent, deep void background (#090a0d), 0px sharp corners.
 * 2. Top-Left Branding: Replaces default Remotion controls with Arunaki orange SVG logo + ARUNAKI NEXUS.
 * 3. Activity Rail: 44px vertical icon-only rail (Compositions, Assets, Properties, Jobs).
 * 4. Dedicated Panel: 270px panel with collapse toggle inside the search/inspector header.
 * 5. Full-Height Sidebar: Left sidebar extends 100% full height down to the bottom status bar.
 * 6. Center Timeline: Timeline resides strictly in the center below the preview monitor.
 */

if (typeof window !== "undefined") {
  const initNexusEnhancer = () => {
    // 1. Inject Theme & Layout Styles into Document Head
    if (!document.getElementById("nexus-studio-theme-styles")) {
      const style = document.createElement("style");
      style.id = "nexus-studio-theme-styles";
      style.innerHTML = `
        :root {
          --remotion-studio-blue: #f97316 !important;
          --remotion-studio-accent: #f97316 !important;
          --remotion-studio-bg: #090a0d !important;
        }

        /* Strict Zero Border Radius */
        * {
          border-radius: 0px !important;
        }

        /* Activity Rail (MENU) */
        #nexus-activity-rail {
          width: 44px !important;
          height: 100% !important;
          background-color: #0b0c10 !important;
          border-right: 1px solid #22252e !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          padding-top: 8px !important;
          gap: 8px !important;
          z-index: 100 !important;
          flex-shrink: 0 !important;
          user-select: none !important;
        }

        .nexus-rail-item {
          width: 36px !important;
          height: 36px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          color: #71717a !important;
          background: transparent !important;
          border: 1px solid transparent !important;
          cursor: pointer !important;
          transition: all 0.15s ease !important;
          padding: 0 !important;
        }

        .nexus-rail-item:hover {
          color: #f97316 !important;
          border-color: #333 !important;
          background: #14161f !important;
        }

        .nexus-rail-item.active {
          color: #f97316 !important;
          background: #181b24 !important;
          border: 1px solid #333 !important;
          border-left: 2px solid #f97316 !important;
        }

        .nexus-rail-icon {
          width: 18px !important;
          height: 18px !important;
          fill: currentColor !important;
        }

        /* Remove green tints, replace with technical orange */
        .__remotion-hoverable:hover {
          border-color: #f97316 !important;
        }

        /* Technical Monospace Micro Scrollbars */
        ::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        ::-webkit-scrollbar-track {
          background: #090a0d;
        }
        ::-webkit-scrollbar-thumb {
          background: #27272a;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #f97316;
        }
      `;
      document.head.appendChild(style);
    }

    let isConfigured = false;

    const setupDockedLayout = () => {
      // 1. Expand right panel if needed so its DOM is mounted by Remotion
      const expandBtn = document.querySelector('button[aria-label="Expand right sidebar"]') as HTMLElement | null;
      if (expandBtn) {
        expandBtn.click();
        return;
      }

      const root = document.getElementById("__remotion-studio-container");
      if (!root || !root.children[0] || !root.children[0].children[1]) return;
      const container = root.children[0].children[1].children[0] as HTMLElement | undefined;
      if (!container || container.children.length < 2) return;

      const topBar = container.children[0] as HTMLElement;
      const mainArea = (document.getElementById("nexus-center-main-area") || container.children[1]) as HTMLElement;

      const all = Array.from(document.querySelectorAll("*"));
      const compLeft = all.find(
        (el) => (el.textContent || "").trim() === "Compositions" && el.getAttribute("role") === "button"
      );
      const defaultProps = all.find((el) => (el.textContent || "").trim() === "Default Props");

      if (!compLeft || !defaultProps) return;

      // Locate leftPanel container
      let leftPanel: HTMLElement | null = compLeft as HTMLElement;
      while (leftPanel && leftPanel.parentElement) {
        if (
          leftPanel.parentElement.children.length >= 5 &&
          window.getComputedStyle(leftPanel.parentElement).flexDirection === "row"
        ) {
          break;
        }
        leftPanel = leftPanel.parentElement;
      }

      // Locate rightPanel container
      let rightPanel: HTMLElement | null = defaultProps as HTMLElement;
      while (rightPanel && rightPanel.parentElement) {
        if (
          rightPanel.parentElement.children.length >= 5 &&
          window.getComputedStyle(rightPanel.parentElement).flexDirection === "row"
        ) {
          break;
        }
        rightPanel = rightPanel.parentElement;
      }

      if (!leftPanel || !rightPanel) return;

      // 2. Top-Left Brand: Replace default collapse + logo buttons with Arunaki Logo + ARUNAKI NEXUS
      const collapseLeftBtn =
        (document.querySelector('button[aria-label="Collapse left sidebar"]') as HTMLElement | null) ||
        (document.querySelector('button[aria-label="Expand left sidebar"]') as HTMLElement | null);

      if (collapseLeftBtn && collapseLeftBtn.parentElement) {
        const topRow = collapseLeftBtn.parentElement;
        const btns = Array.from(topRow.querySelectorAll("button"));
        collapseLeftBtn.style.display = "none";
        if (btns[1]) btns[1].style.display = "none";

        if (!document.getElementById("nexus-top-brand-badge")) {
          const brandBadge = document.createElement("div");
          brandBadge.id = "nexus-top-brand-badge";
          brandBadge.style.cssText =
            "display: inline-flex; align-items: center; padding: 0 10px 0 8px; height: 26px; user-select: none;";
          brandBadge.innerHTML = `
            <svg viewBox="0 0 6821.37 6210.13" style="width: 15px; height: 15px; fill: #f97316; margin-right: 7px; flex-shrink: 0;">
              <path d="M879.14 4373.85l2374.82 0c483.53,0 879.14,395.61 879.14,879.14l0 0.01c0,483.53 -395.61,879.14 -879.14,879.14l-2374.82 0c-483.53,0 -879.14,-395.61 -879.14,-879.14l0 -0.01c0,-483.53 395.61,-879.14 879.14,-879.14zm1792.3 -3925.98l-1211.69 2098.71c-246.72,427.32 -98.95,978.78 328.37,1225.49l0.01 0.01c427.31,246.71 978.77,98.94 1225.49,-328.38l1211.69 -2098.71c246.71,-427.31 98.94,-978.78 -328.37,-1225.49l0 0c-427.32,-246.71 -978.79,-98.94 -1225.49,328.37zm2818.73 2318.55l1211.69 2098.71c246.72,427.32 98.95,978.78 -328.37,1225.49l-0.01 0.01c-427.31,246.71 -978.77,98.94 -1225.49,-328.38l-1211.69 -2098.71c-246.71,-427.31 -98.94,-978.78 328.37,-1225.49l0 0c427.32,-246.71 978.79,-98.94 1225.49,328.37z" />
            </svg>
            <span style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: #fff;">ARUNAKI NEXUS</span>
            <div style="width: 1px; height: 14px; background: #262626; margin-left: 10px; margin-right: 4px;"></div>
          `;
          topRow.insertBefore(brandBadge, topRow.firstChild);
        }
      }

      // 3. Hide redundant inner tab headers in Column 2
      if (compLeft && compLeft.parentElement) {
        compLeft.parentElement.style.display = "none";
      }

      const compRightTab = Array.from(rightPanel.querySelectorAll("div[role='button'], button")).find(
        (el) => (el.textContent || "").trim() === "Composition"
      ) as HTMLElement | undefined;
      if (compRightTab && compRightTab.parentElement) {
        compRightTab.parentElement.style.display = "none";
      }

      // 4. Insert Sidebar Collapse Toggle inside leftPanel Search Row
      const searchBtn = Array.from(leftPanel.querySelectorAll("button")).find((b) =>
        (b.textContent || "").includes("Search...")
      );
      if (searchBtn && searchBtn.parentElement && !document.getElementById("nexus-sidebar-collapse-toggle-left")) {
        const searchRow = searchBtn.parentElement;
        const collapseToggle = document.createElement("button");
        collapseToggle.id = "nexus-sidebar-collapse-toggle-left";
        collapseToggle.title = "Collapse Sidebar";
        collapseToggle.style.cssText =
          "width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 1px solid #333; color: #71717a; cursor: pointer; flex-shrink: 0;";
        collapseToggle.innerHTML = `
          <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2;">
            <rect x="3" y="3" width="18" height="18" rx="0" />
            <path d="M9 3v18" />
          </svg>
        `;
        collapseToggle.onmouseover = () => {
          collapseToggle.style.color = "#f97316";
          collapseToggle.style.borderColor = "#f97316";
        };
        collapseToggle.onmouseout = () => {
          collapseToggle.style.color = "#71717a";
          collapseToggle.style.borderColor = "#333";
        };
        collapseToggle.onclick = () => {
          const p = document.getElementById("nexus-active-panel-container");
          if (p) {
            p.style.display = p.style.display === "none" ? "flex" : "none";
            window.dispatchEvent(new Event("resize"));
          }
        };
        searchRow.insertBefore(collapseToggle, searchRow.firstChild);
      }

      // 5. Insert Sidebar Collapse Toggle inside rightPanel Header
      if (rightPanel.firstElementChild && !document.getElementById("nexus-sidebar-collapse-toggle-right")) {
        const innerContainer = rightPanel.firstElementChild as HTMLElement;
        const rightHeader = document.createElement("div");
        rightHeader.id = "nexus-right-header-bar";
        rightHeader.style.cssText =
          "padding: 6px 8px; border-bottom: 1px solid #22252e; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; background: #0d0e12;";
        rightHeader.innerHTML = `
          <span id="nexus-right-panel-title" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; color: #fff; letter-spacing: 0.05em;">PROPERTIES</span>
          <button id="nexus-sidebar-collapse-toggle-right" title="Collapse Sidebar" style="width: 24px; height: 24px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: 1px solid #333; color: #71717a; cursor: pointer;">
            <svg viewBox="0 0 24 24" style="width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2;">
              <rect x="3" y="3" width="18" height="18" rx="0" />
              <path d="M9 3v18" />
            </svg>
          </button>
        `;
        const btn = rightHeader.querySelector("button");
        if (btn) {
          btn.onmouseover = () => {
            btn.style.color = "#f97316";
            btn.style.borderColor = "#f97316";
          };
          btn.onmouseout = () => {
            btn.style.color = "#71717a";
            btn.style.borderColor = "#333";
          };
          btn.onclick = () => {
            const p = document.getElementById("nexus-active-panel-container");
            if (p) {
              p.style.display = p.style.display === "none" ? "flex" : "none";
              window.dispatchEvent(new Event("resize"));
            }
          };
        }
        innerContainer.insertBefore(rightHeader, innerContainer.firstChild);
      }

      // 6. Build Activity Rail (Icon-Only, 4 Menus Separated 1-by-1)
      let rail = document.getElementById("nexus-activity-rail");
      if (!rail) {
        rail = document.createElement("div");
        rail.id = "nexus-activity-rail";
        rail.innerHTML = `
          <button class="nexus-rail-item" id="nexus-rail-comp" title="Compositions">
            <svg class="nexus-rail-icon" viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
          </button>
          <button class="nexus-rail-item" id="nexus-rail-assets" title="Assets">
            <svg class="nexus-rail-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
          </button>
          <button class="nexus-rail-item" id="nexus-rail-props" title="Composition Properties">
            <svg class="nexus-rail-icon" viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
          </button>
          <button class="nexus-rail-item" id="nexus-rail-jobs" title="Render Jobs Queue">
            <svg class="nexus-rail-icon" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
          </button>
        `;
      }

      // 7. Full-Height Layout Architecture
      let bodyRow = document.getElementById("nexus-body-row");
      if (!bodyRow) {
        bodyRow = document.createElement("div");
        bodyRow.id = "nexus-body-row";
        bodyRow.style.cssText =
          "display: flex; flex-direction: row; flex: 1 1 0%; height: calc(100% - 29px); width: 100%; overflow: hidden;";

        const leftSidebar = document.createElement("div");
        leftSidebar.id = "nexus-left-sidebar-full";
        leftSidebar.style.cssText =
          "display: flex; flex-direction: row; height: 100%; flex-shrink: 0; border-right: 1px solid #22252e; background: #090a0d;";

        const panelContainer = document.createElement("div");
        panelContainer.id = "nexus-active-panel-container";
        panelContainer.style.cssText =
          "display: flex; flex-direction: column; height: 100%; width: 270px; background: #0d0e12; overflow: hidden;";

        leftPanel.style.height = "100%";
        leftPanel.style.width = "100%";
        panelContainer.appendChild(leftPanel);

        rightPanel.style.height = "100%";
        rightPanel.style.width = "100%";
        rightPanel.style.display = "none";
        panelContainer.appendChild(rightPanel);

        leftSidebar.appendChild(rail);
        leftSidebar.appendChild(panelContainer);

        mainArea.id = "nexus-center-main-area";
        mainArea.style.flex = "1 1 0%";
        mainArea.style.height = "100%";
        mainArea.style.overflow = "hidden";

        container.appendChild(bodyRow);
        bodyRow.appendChild(leftSidebar);
        bodyRow.appendChild(mainArea);
      }

      // Hide leftover splitters in center preview area
      Array.from(mainArea.querySelectorAll(".remotion-splitter-vertical")).forEach(
        (s) => ((s as HTMLElement).style.display = "none")
      );

      // 8. Switching Functionality (Toggles panel or switches active view)
      const panelContainer = document.getElementById("nexus-active-panel-container");

      (window as any).nexusSwitchMenu = (tab: "COMP" | "ASSETS" | "PROPS" | "JOBS") => {
        const currentActive = document.querySelector(".nexus-rail-item.active");
        const targetBtn = document.getElementById(`nexus-rail-${tab.toLowerCase()}`);

        if (currentActive === targetBtn && panelContainer && panelContainer.style.display !== "none") {
          panelContainer.style.display = "none";
          targetBtn?.classList.remove("active");
          window.dispatchEvent(new Event("resize"));
          return;
        }

        document.querySelectorAll(".nexus-rail-item").forEach((b) => b.classList.remove("active"));
        if (panelContainer) panelContainer.style.display = "flex";
        targetBtn?.classList.add("active");

        if (tab === "COMP") {
          leftPanel!.style.display = "flex";
          rightPanel!.style.display = "none";
          const btn = Array.from(leftPanel!.querySelectorAll("div[role='button']")).find(
            (el) => (el.textContent || "").trim() === "Compositions"
          ) as HTMLElement | undefined;
          if (btn) btn.click();
        } else if (tab === "ASSETS") {
          leftPanel!.style.display = "flex";
          rightPanel!.style.display = "none";
          const btn = Array.from(leftPanel!.querySelectorAll("div[role='button']")).find(
            (el) => (el.textContent || "").trim() === "Assets"
          ) as HTMLElement | undefined;
          if (btn) btn.click();
        } else if (tab === "PROPS") {
          leftPanel!.style.display = "none";
          rightPanel!.style.display = "flex";
          const title = document.getElementById("nexus-right-panel-title");
          if (title) title.textContent = "COMPOSITION PROPERTIES";
          const btn = Array.from(rightPanel!.querySelectorAll("div[role='button'], button")).find(
            (el) => (el.textContent || "").trim() === "Composition"
          ) as HTMLElement | undefined;
          if (btn) btn.click();
        } else if (tab === "JOBS") {
          leftPanel!.style.display = "none";
          rightPanel!.style.display = "flex";
          const title = document.getElementById("nexus-right-panel-title");
          if (title) title.textContent = "RENDER QUEUE";
          const btn = Array.from(rightPanel!.querySelectorAll("div[role='button'], button")).find(
            (el) => (el.textContent || "").trim() === "Jobs"
          ) as HTMLElement | undefined;
          if (btn) btn.click();
        }

        window.dispatchEvent(new Event("resize"));
      };

      // Wire button click handlers
      const cBtn = document.getElementById("nexus-rail-comp");
      const aBtn = document.getElementById("nexus-rail-assets");
      const pBtn = document.getElementById("nexus-rail-props");
      const jBtn = document.getElementById("nexus-rail-jobs");

      if (cBtn) cBtn.onclick = () => (window as any).nexusSwitchMenu?.("COMP");
      if (aBtn) aBtn.onclick = () => (window as any).nexusSwitchMenu?.("ASSETS");
      if (pBtn) pBtn.onclick = () => (window as any).nexusSwitchMenu?.("PROPS");
      if (jBtn) jBtn.onclick = () => (window as any).nexusSwitchMenu?.("JOBS");

      if (!isConfigured) {
        (window as any).nexusSwitchMenu?.("COMP");
        isConfigured = true;
      }
    };

    // Run setup immediately and on interval to support Remotion HMR
    setupDockedLayout();
    const interval = setInterval(setupDockedLayout, 1000);
    setTimeout(() => clearInterval(interval), 25000);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNexusEnhancer);
  } else {
    initNexusEnhancer();
  }
}
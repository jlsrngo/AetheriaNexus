/**
 * Nexus Studio Layout & Theme Enhancer
 *
 * Implements the Swiss Brutalist / Neo-Brutalist HUD architecture:
 * 1. Palette: Electric Technical Orange (#f97316) accent, deep void background (#090a0d), 0px sharp corners.
 * 2. Left Structure: Column 1 = Vertical Activity Rail (MENU), Column 2 = Panel Content (ISI SETIAP MENU).
 * 3. Unified Panels: Docks Remotion's Inspector (Composition) and Render Queue (Jobs) into Column 2,
 *    eliminating the right sidebar so the center Preview Monitor and Timeline remain spacious and uncrowded.
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
          width: 44px;
          height: 100%;
          background-color: #0b0c10;
          border-right: 1px solid #22252e;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 6px;
          gap: 6px;
          z-index: 1000;
          flex-shrink: 0;
          user-select: none;
        }

        .nexus-rail-item {
          width: 36px;
          height: 36px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #71717a;
          background: transparent;
          border: 1px solid transparent;
          cursor: pointer;
          font-family: 'JetBrains Mono', monospace, sans-serif;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.05em;
          transition: all 0.15s ease;
        }

        .nexus-rail-item:hover {
          color: #f97316;
          border-color: #333;
          background: #14161f;
        }

        .nexus-rail-item.active {
          color: #f97316;
          background: #181b24;
          border: 1px solid #333;
          border-left: 2px solid #f97316;
        }

        .nexus-rail-icon {
          width: 16px;
          height: 16px;
          margin-bottom: 2px;
          fill: currentColor;
        }

        /* Remove any green tints, replace with technical orange */
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

    // 2. Observer & Mounting Function
    let isConfigured = false;

    const setupDockedLayout = () => {
      // Ensure right panel is expanded so its DOM is mounted
      const expandBtn = document.querySelector('button[aria-label="Expand right sidebar"]') as HTMLElement | null;
      if (expandBtn) {
        expandBtn.click();
        return; // Will re-run on next tick when mounted
      }

      const all = Array.from(document.querySelectorAll("*"));
      const defaultProps = all.find((el) => (el.textContent || "").trim() === "Default Props");
      const compLeft = all.find(
        (el) => (el.textContent || "").trim() === "Compositions" && el.getAttribute("role") === "button"
      );

      if (!defaultProps || !compLeft) return;

      // Locate right panel container
      let rightPanel: HTMLElement | null = defaultProps as HTMLElement;
      while (rightPanel && rightPanel.parentElement) {
        const p = rightPanel.parentElement;
        if (p.children.length === 5 && window.getComputedStyle(p).flexDirection === "row") {
          break;
        }
        rightPanel = p;
      }

      // Locate left panel container
      let leftPanel: HTMLElement | null = compLeft as HTMLElement;
      while (leftPanel && leftPanel.parentElement) {
        const p = leftPanel.parentElement;
        if (
          (p.children.length === 5 || p.children.length === 6) &&
          window.getComputedStyle(p).flexDirection === "row"
        ) {
          break;
        }
        leftPanel = p;
      }

      if (!rightPanel || !leftPanel || !leftPanel.parentElement) return;

      const parentRow = leftPanel.parentElement;

      // Hide the right vertical splitter in the center area
      if (rightPanel.parentElement && rightPanel.parentElement !== parentRow) {
        const origCenterRow = rightPanel.parentElement;
        Array.from(origCenterRow.children).forEach((c) => {
          if (c.classList.contains("remotion-splitter-vertical")) {
            (c as HTMLElement).style.display = "none";
          }
        });
      }

      // Create Activity Rail (Column 1) if not already created
      if (!document.getElementById("nexus-activity-rail")) {
        const rail = document.createElement("div");
        rail.id = "nexus-activity-rail";
        rail.innerHTML = `
          <button class="nexus-rail-item active" id="nexus-rail-comp" title="Compositions">
            <svg class="nexus-rail-icon" viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>
            <span>CMP</span>
          </button>
          <button class="nexus-rail-item" id="nexus-rail-assets" title="Assets">
            <svg class="nexus-rail-icon" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            <span>AST</span>
          </button>
          <button class="nexus-rail-item" id="nexus-rail-props" title="Composition Properties">
            <svg class="nexus-rail-icon" viewBox="0 0 24 24"><path d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"/></svg>
            <span>PRP</span>
          </button>
          <button class="nexus-rail-item" id="nexus-rail-jobs" title="Render Jobs Queue">
            <svg class="nexus-rail-icon" viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            <span>JOB</span>
          </button>
        `;
        parentRow.insertBefore(rail, leftPanel);
      }

      // Move rightPanel right next to leftPanel in the outer row (Column 2)
      if (rightPanel.parentElement !== parentRow) {
        parentRow.insertBefore(rightPanel, leftPanel.nextSibling);
      }

      rightPanel.id = "nexus-docked-inspector";
      rightPanel.style.width = "280px";
      rightPanel.style.flexShrink = "0";

      // Function to switch between left panel (CMP/AST) and right panel (PRP/JOB)
      (window as any).nexusSwitchMenu = (tab: "CMP" | "AST" | "PRP" | "JOB") => {
        document.querySelectorAll(".nexus-rail-item").forEach((b) => b.classList.remove("active"));

        if (tab === "CMP") {
          document.getElementById("nexus-rail-comp")?.classList.add("active");
          leftPanel!.style.display = "";
          rightPanel!.style.display = "none";
          const compTab = Array.from(leftPanel!.querySelectorAll("div[role='button'], button")).find(
            (el) => (el.textContent || "").trim() === "Compositions"
          ) as HTMLElement | undefined;
          if (compTab) compTab.click();
        } else if (tab === "AST") {
          document.getElementById("nexus-rail-assets")?.classList.add("active");
          leftPanel!.style.display = "";
          rightPanel!.style.display = "none";
          const assetsTab = Array.from(leftPanel!.querySelectorAll("div[role='button'], button")).find(
            (el) => (el.textContent || "").trim() === "Assets"
          ) as HTMLElement | undefined;
          if (assetsTab) assetsTab.click();
        } else if (tab === "PRP") {
          document.getElementById("nexus-rail-props")?.classList.add("active");
          leftPanel!.style.display = "none";
          rightPanel!.style.display = "flex";
          rightPanel!.style.flexDirection = "column";
          const compBtn = Array.from(rightPanel!.querySelectorAll("div[role='button'], button")).find(
            (b) => (b.textContent || "").trim() === "Composition"
          ) as HTMLElement | undefined;
          if (compBtn) compBtn.click();
        } else if (tab === "JOB") {
          document.getElementById("nexus-rail-jobs")?.classList.add("active");
          leftPanel!.style.display = "none";
          rightPanel!.style.display = "flex";
          rightPanel!.style.flexDirection = "column";
          const jobsBtn = Array.from(rightPanel!.querySelectorAll("div[role='button'], button")).find(
            (b) => (b.textContent || "").trim() === "Jobs"
          ) as HTMLElement | undefined;
          if (jobsBtn) jobsBtn.click();
        }
      };

      // Wire rail button click listeners
      document.getElementById("nexus-rail-comp")?.addEventListener("click", () => {
        (window as any).nexusSwitchMenu?.("CMP");
      });
      document.getElementById("nexus-rail-assets")?.addEventListener("click", () => {
        (window as any).nexusSwitchMenu?.("AST");
      });
      document.getElementById("nexus-rail-props")?.addEventListener("click", () => {
        (window as any).nexusSwitchMenu?.("PRP");
      });
      document.getElementById("nexus-rail-jobs")?.addEventListener("click", () => {
        (window as any).nexusSwitchMenu?.("JOB");
      });

      // Default initial state: CMP
      if (!isConfigured) {
        (window as any).nexusSwitchMenu?.("CMP");
        isConfigured = true;
      }
    };

    // Run setup immediately and on interval to maintain stability during HMR
    setupDockedLayout();
    const interval = setInterval(setupDockedLayout, 1000);
    setTimeout(() => clearInterval(interval), 20000);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNexusEnhancer);
  } else {
    initNexusEnhancer();
  }
}

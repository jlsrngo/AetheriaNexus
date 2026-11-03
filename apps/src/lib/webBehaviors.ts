export function disableDefaultWebBehaviors(win: Window = window, isDev = false) {
  if (isDev) return;
  win.addEventListener("contextmenu", (e) => {
    // allow right click inside input / textarea
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    if (tag !== "input" && tag !== "textarea") {
      e.preventDefault();
    }
  });
}

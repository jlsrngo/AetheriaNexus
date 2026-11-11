//! Native Windows WebView2 desktop window & IPC lifecycle.

use crate::paths::aetheria_dot_dir;

pub const DESKTOP_INIT_SCRIPT: &str = r#"
(function() {
  // Suppress browser context menu
  window.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  }, true);

  if (window.aetheriaDesktop) return;
  const ORIGIN = window.location.origin || 'http://127.0.0.1:4196';
  const postJson = async (path, body) => {
    const r = await fetch(ORIGIN + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    });
    return await r.json();
  };

  window.aetheriaDesktop = {
    isDesktop: true,
    platform: 'win32',
    runtime: 'rust-tauri-wry',
    minimize: () => {
      try { if (window.ipc) window.ipc.postMessage('minimize'); } catch {}
    },
    maximize: () => {
      try { if (window.ipc) window.ipc.postMessage('maximize'); } catch {}
    },
    close: () => {
      try { if (window.ipc) window.ipc.postMessage('close'); else postJson('/api/desktop/quit', {}); } catch {}
    },
    quit: () => {
      try { if (window.ipc) window.ipc.postMessage('close'); else postJson('/api/desktop/quit', {}); } catch {}
    },
    startDrag: () => {
      try { if (window.ipc) window.ipc.postMessage('drag'); } catch {}
    },
    isMaximized: async () => false,
    onMaximizedChange: () => () => {},
    pickFolder: async () => {
      const res = await postJson('/api/desktop/pick-folder', {});
      return { path: res && res.path ? res.path : null };
    },
    getFolderTree: (folderPath) => postJson('/api/desktop/folder-tree', { folderPath }),
    readFile: (filePath) => postJson('/api/desktop/read-file', { filePath }),
    writeFile: (filePath, content) => postJson('/api/desktop/write-file', { filePath, content }),
    createFolder: (folderPath) => postJson('/api/desktop/create-folder', { folderPath }),
    backupFolder: (sourcePath) => postJson('/api/desktop/backup-folder', { sourcePath: sourcePath || localStorage.getItem('aetheria_active_folder') || '' }),
    deletePath: (targetPath) => postJson('/api/desktop/delete-path', { targetPath }),
    renamePath: (oldPath, newPath) => postJson('/api/desktop/rename-path', { oldPath, newPath }),
    openPath: (filePath) => postJson('/api/desktop/open-path', { filePath }),
    openExcelNative: (filePath) => postJson('/api/desktop/open-excel', { filePath }),
    openWordNative: (filePath) => postJson('/api/desktop/open-word', { filePath }),
    openPptNative: (filePath) => postJson('/api/desktop/open-ppt', { filePath }),
    parseExcel: (filePath) => postJson('/api/desktop/parse-excel', { filePath }),
    parseWord: (filePath) => postJson('/api/desktop/parse-word', { filePath }),
    parsePpt: (filePath) => postJson('/api/desktop/parse-ppt', { filePath }),
    parsePdf: (filePath, maxPages) => postJson('/api/desktop/parse-pdf', { filePath, maxPages }),
    writeExcel: (filePath, rows, sheetName) => postJson('/api/desktop/write-excel', { filePath, rows, sheetName }),
    readBinaryFile: (filePath) => postJson('/api/desktop/read-binary', { filePath }),
    readClipboardImage: async () => {
      const res = await postJson('/api/desktop/read-clipboard-image', {});
      return res && res.dataUrl ? res.dataUrl : null;
    },
    getEngineInfo: async () => {
      const r = await fetch(ORIGIN + '/api/desktop/engine-info');
      return await r.json();
    },
    ping: () => Promise.resolve('desktop'),
    resetZoom: () => {},
    setTheme: (_theme) => Promise.resolve(),
    notify: (payload) => {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(payload.title || 'Aetheria', { body: payload.body || '' });
        }
      } catch {}
    },
    getSystemInfo: () => ({
      runtime: 'Native Rust Hybrid',
      engine: 'Axum v0.7 + Tokio v1.40',
      desktop: 'Tauri v2 + Microsoft Edge WebView2',
      docs: 'Native Win32 COM Sidecar (aetheria-docs)',
      os: 'Windows_NT x64'
    }),
  };
})();
"#;

#[cfg(windows)]
pub fn hide_console_window() {
    #[link(name = "kernel32")]
    extern "system" {
        fn GetConsoleWindow() -> *mut std::ffi::c_void;
    }
    #[link(name = "user32")]
    extern "system" {
        fn ShowWindow(hwnd: *mut std::ffi::c_void, n_cmd_show: i32) -> i32;
    }
    unsafe {
        let hwnd = GetConsoleWindow();
        if !hwnd.is_null() {
            ShowWindow(hwnd, 0); // SW_HIDE = 0
        }
    }
}

#[cfg(not(windows))]
pub fn hide_console_window() {}

#[derive(Debug, Clone, Copy)]
pub enum DesktopAction {
    Minimize,
    Maximize,
    Close,
    Drag,
}

pub fn launch_desktop_window(url: &str) {
    use tao::{
        dpi::LogicalSize,
        event::{Event, WindowEvent},
        event_loop::{ControlFlow, EventLoopBuilder},
        window::{Theme, WindowBuilder},
    };
    use wry::WebViewBuilder;

    let event_loop = EventLoopBuilder::<DesktopAction>::with_user_event().build();
    let proxy = event_loop.create_proxy();

    #[cfg(target_os = "windows")]
    use tao::platform::windows::WindowBuilderExtWindows;

    let mut builder = WindowBuilder::new()
        .with_title("Aetheria")
        .with_inner_size(LogicalSize::new(1360.0, 860.0))
        .with_min_inner_size(LogicalSize::new(960.0, 640.0))
        .with_theme(Some(Theme::Dark))
        .with_decorations(false)
        .with_resizable(true);

    let icon_rgba = include_bytes!("../icon_64x64.rgba");
    if let Ok(icon) = tao::window::Icon::from_rgba(icon_rgba.to_vec(), 64, 64) {
        builder = builder.with_window_icon(Some(icon));
    }

    #[cfg(target_os = "windows")]
    {
        builder = builder.with_undecorated_shadow(false);
    }

    let window = builder
        .build(&event_loop)
        .expect("Failed to create Aetheria desktop window");

    window.set_decorations(false);

    #[cfg(target_os = "windows")]
    unsafe {
        use tao::platform::windows::WindowExtWindows;
        let hwnd = window.hwnd();

        #[link(name = "user32")]
        extern "system" {
            fn GetWindowLongPtrW(hwnd: isize, n_index: i32) -> isize;
            fn SetWindowLongPtrW(hwnd: isize, n_index: i32, new_long: isize) -> isize;
            fn SetWindowPos(
                hwnd: isize,
                hwnd_insert_after: isize,
                x: i32,
                y: i32,
                cx: i32,
                cy: i32,
                flags: u32,
            ) -> i32;
        }

        #[link(name = "dwmapi")]
        extern "system" {
            fn DwmSetWindowAttribute(
                hwnd: isize,
                dw_attribute: u32,
                pv_attribute: *const std::ffi::c_void,
                cb_attribute: u32,
            ) -> i32;
        }

        const GWL_STYLE: i32 = -16;
        const WS_CAPTION: isize = 0x00C00000;
        const WS_THICKFRAME: isize = 0x00040000;
        const SWP_FRAMECHANGED: u32 = 0x0020;
        const SWP_NOMOVE: u32 = 0x0002;
        const SWP_NOSIZE: u32 = 0x0001;
        const SWP_NOZORDER: u32 = 0x0004;

        let mut style = GetWindowLongPtrW(hwnd, GWL_STYLE);
        style &= !WS_CAPTION;
        style |= WS_THICKFRAME;
        SetWindowLongPtrW(hwnd, GWL_STYLE, style);

        // 1. Immersive dark mode (attribute 20)
        let dark_mode: i32 = 1;
        let _ = DwmSetWindowAttribute(
            hwnd,
            20,
            &dark_mode as *const _ as *const _,
            std::mem::size_of::<i32>() as u32,
        );

        // 2. Windows 11 Rounded Corners (DWMWA_WINDOW_CORNER_PREFERENCE = 33, DWMWCP_ROUND = 2)
        let round_preference: u32 = 2;
        let _ = DwmSetWindowAttribute(
            hwnd,
            33,
            &round_preference as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );

        // 3. Remove white border line (DWMWA_BORDER_COLOR = 34, DWMWA_COLOR_NONE = 0xFFFFFFFE)
        let border_color: u32 = 0xFFFFFFFE;
        let _ = DwmSetWindowAttribute(
            hwnd,
            34,
            &border_color as *const _ as *const _,
            std::mem::size_of::<u32>() as u32,
        );

        // 4. Force DWM frame recalculation
        SetWindowPos(
            hwnd,
            0,
            0,
            0,
            0,
            0,
            SWP_FRAMECHANGED | SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER,
        );
    }

    let proxy_c = proxy.clone();

    let data_dir = aetheria_dot_dir().join("webview2");
    let _ = std::fs::create_dir_all(&data_dir);
    let mut web_context = wry::WebContext::new(Some(data_dir));

    let _webview = match WebViewBuilder::new_with_web_context(&mut web_context)
        .with_initialization_script(DESKTOP_INIT_SCRIPT)
        .with_ipc_handler(move |req| {
            let msg = req.body().as_str();
            match msg {
                "minimize" => {
                    let _ = proxy_c.send_event(DesktopAction::Minimize);
                }
                "maximize" => {
                    let _ = proxy_c.send_event(DesktopAction::Maximize);
                }
                "close" => {
                    let _ = proxy_c.send_event(DesktopAction::Close);
                }
                "drag" => {
                    let _ = proxy_c.send_event(DesktopAction::Drag);
                }
                _ => {}
            }
        })
        .with_url(url)
        .build(&window)
    {
        Ok(wv) => wv,
        Err(e) => {
            eprintln!("[Desktop] Failed to initialize WebView2 runtime: {}", e);
            return;
        }
    };

    event_loop.run(move |event, _, control_flow| {
        *control_flow = ControlFlow::Wait;
        match event {
            Event::UserEvent(DesktopAction::Minimize) => {
                window.set_minimized(true);
            }
            Event::UserEvent(DesktopAction::Maximize) => {
                window.set_maximized(!window.is_maximized());
            }
            Event::UserEvent(DesktopAction::Close) => {
                *control_flow = ControlFlow::Exit;
                std::process::exit(0);
            }
            Event::UserEvent(DesktopAction::Drag) => {
                let _ = window.drag_window();
            }
            Event::WindowEvent {
                event: WindowEvent::CloseRequested,
                ..
            } => {
                *control_flow = ControlFlow::Exit;
                std::process::exit(0);
            }
            _ => {}
        }
    });
}


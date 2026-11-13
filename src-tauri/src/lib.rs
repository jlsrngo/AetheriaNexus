pub mod cli_auth_cmds;
pub mod dialog;
pub mod engine_bridge;
pub mod fs;
pub mod studio_cmds;
pub mod system;
pub mod window_cmds;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.unminimize();
                let _ = main_window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            // 1. Core Window & Engine Bridge
            window_cmds::desktop_info,
            window_cmds::window_minimize,
            window_cmds::window_toggle_maximize,
            window_cmds::window_close,
            engine_bridge::tauri_engine_fetch,
            engine_bridge::get_engine_auth_token,
            // 2. CLI Auth & Status
            cli_auth_cmds::tauri_cli_login,
            cli_auth_cmds::tauri_cli_status,
            // 3. Studio Motion Render
            studio_cmds::render_nexus_video,
            // 2. Native Dialogs
            dialog::pick_folder,
            dialog::pick_file,
            dialog::show_in_explorer,
            dialog::open_path,
            // 3. Safe Project Filesystem
            fs::list_project_files,
            fs::read_project_file,
            fs::write_project_file,
            // 5. System Diagnostics & Telemetry
            system::get_system_telemetry,
            system::detect_cli_binaries,
            system::system_ping
        ])
        .setup(|app| {
            // 1. Spawn background Axum engine & Local-CLI bridge on localhost (only runs in single active instance)
            let host = "127.0.0.1".to_string();
            let port = 4196;
            std::thread::spawn(move || {
                let rt = tokio::runtime::Builder::new_multi_thread()
                    .enable_all()
                    .build()
                    .expect("Failed to create background Tokio runtime for Aetheria Engine");
                rt.block_on(async move {
                    let probe_url = format!("http://{}:{}/api/health", host, port);
                    let already_up = reqwest::Client::builder()
                        .timeout(std::time::Duration::from_millis(400))
                        .build()
                        .unwrap()
                        .get(&probe_url)
                        .send()
                        .await
                        .map(|r| {
                            r.status().is_success()
                                || r.status() == reqwest::StatusCode::UNAUTHORIZED
                        })
                        .unwrap_or(false);

                    if !already_up {
                        let creds = aetheria_engine::server_auth::init_server_credentials();
                        aetheria_engine::server_auth::persist_dev_server_password_files(creds);
                        engine_bridge::set_engine_auth_mode_embedded();
                        let (listener, _url, actual_port) =
                            aetheria_engine::init_engine_and_bind(&host, port).await;
                        aetheria_engine::run_axum_server(listener, actual_port).await;
                    } else {
                        engine_bridge::set_engine_auth_mode_external();
                        println!("[aetheria-desktop] Engine already running on port {}, reusing instance.", port);
                        let _ = aetheria_engine::bridge::ensure_bridge_running().await;
                    }
                });
            });

            // 2. Completely disable all native Microsoft Edge WebView2 browser features
            // (Print Ctrl+P, Find bar Ctrl+F/F3, Reload F5/Ctrl+R, Context Menu, Autofill, Zoom, DevTools, Status Bar)
            #[cfg(windows)]
            if let Some(main_window) = app.get_webview_window("main") {
                // Explicitly set window icon so Windows taskbar displays Aetheria logo
                if let Some(icon) = app.default_window_icon() {
                    let _ = main_window.set_icon(icon.clone());
                } else if let Ok(icon) = tauri::image::Image::from_icon_resource(1, 32, 32) {
                    let _ = main_window.set_icon(icon);
                } else if let Ok(icon) = tauri::image::Image::from_app_icon_resource(32) {
                    let _ = main_window.set_icon(icon);
                }

                // Ensure Win32 window HWND taskbar icon is set via WM_SETICON
                unsafe {
                    #[link(name = "user32")]
                    extern "system" {
                        fn SendMessageW(hWnd: *mut std::ffi::c_void, Msg: u32, wParam: usize, lParam: isize) -> isize;
                        fn GetModuleHandleW(lpModuleName: *const u16) -> *mut std::ffi::c_void;
                        fn LoadIconW(hInstance: *mut std::ffi::c_void, lpIconName: *const u16) -> *mut std::ffi::c_void;
                    }
                    const WM_SETICON: u32 = 0x0080;
                    const ICON_SMALL: usize = 0;
                    const ICON_BIG: usize = 1;
                    let h_instance = GetModuleHandleW(std::ptr::null());
                    let mut h_icon = LoadIconW(h_instance, 1 as _);
                    if h_icon.is_null() {
                        h_icon = LoadIconW(h_instance, 32512 as _);
                    }
                    if h_icon.is_null() {
                        h_icon = LoadIconW(h_instance, 128 as _);
                    }
                    if !h_icon.is_null() {
                        if let Ok(hwnd) = main_window.hwnd() {
                            let hwnd_ptr = hwnd.0 as *mut std::ffi::c_void;
                            SendMessageW(hwnd_ptr, WM_SETICON, ICON_BIG, h_icon as isize);
                            SendMessageW(hwnd_ptr, WM_SETICON, ICON_SMALL, h_icon as isize);
                        }
                    }
                }

                let _ = main_window.with_webview(|webview| unsafe {
                    if let Ok(core_webview) = webview.controller().CoreWebView2() {
                        if let Ok(settings) = core_webview.Settings() {
                            let _ = settings.SetIsStatusBarEnabled(false);
                            let _ = settings.SetAreDefaultContextMenusEnabled(false);
                            let _ = settings.SetIsZoomControlEnabled(false);
                            let _ = settings.SetAreDevToolsEnabled(false);
                            let _ = settings.SetIsBuiltInErrorPageEnabled(false);

                            if let Ok(settings3) = windows_core::Interface::cast::<
                                webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings3,
                            >(&settings)
                            {
                                let _ = settings3.SetAreBrowserAcceleratorKeysEnabled(false);
                            }
                            if let Ok(settings4) = windows_core::Interface::cast::<
                                webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings4,
                            >(&settings)
                            {
                                let _ = settings4.SetIsGeneralAutofillEnabled(false);
                                let _ = settings4.SetIsPasswordAutosaveEnabled(false);
                            }
                            if let Ok(settings5) = windows_core::Interface::cast::<
                                webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings5,
                            >(&settings)
                            {
                                let _ = settings5.SetIsPinchZoomEnabled(false);
                            }
                            if let Ok(settings6) = windows_core::Interface::cast::<
                                webview2_com::Microsoft::Web::WebView2::Win32::ICoreWebView2Settings6,
                            >(&settings)
                            {
                                let _ = settings6.SetIsSwipeNavigationEnabled(false);
                            }
                        }
                    }
                });
            }

            // Bridge engine events to the webview over Tauri IPC, so the UI never needs SSE over
            // the local HTTP port. Third-party clients still use GET /api/event on :4096.
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut rx = aetheria_engine::session::get_event_sender().subscribe();
                loop {
                    match rx.recv().await {
                        Ok(event) => {
                            let _ = handle.emit("aetheria-event", event);
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                        Err(_) => break,
                    }
                }
            });

            // Setup System Tray Icon with Open & Quit menu items safely
            if let Ok(show_i) = MenuItem::with_id(app, "show", "Open Nexus", true, None::<&str>) {
                if let Ok(quit_i) = MenuItem::with_id(app, "quit", "Quit Nexus", true, None::<&str>) {
                    if let Ok(menu) = Menu::with_items(app, &[&show_i, &quit_i]) {
                        let mut tray_builder = TrayIconBuilder::new()
                            .menu(&menu)
                            .show_menu_on_left_click(false);

                        if let Some(icon) = app.default_window_icon() {
                            tray_builder = tray_builder.icon(icon.clone());
                        }

                        let _ = tray_builder
                            .on_menu_event(|app, event| match event.id.as_ref() {
                                "show" => {
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                                "quit" => {
                                    app.exit(0);
                                }
                                _ => {}
                            })
                            .on_tray_icon_event(|tray, event| {
                                if let tauri::tray::TrayIconEvent::Click {
                                    button: tauri::tray::MouseButton::Left,
                                    button_state: tauri::tray::MouseButtonState::Up,
                                    ..
                                } = event
                                {
                                    let app = tray.app_handle();
                                    if let Some(window) = app.get_webview_window("main") {
                                        let _ = window.show();
                                        let _ = window.set_focus();
                                    }
                                }
                            })
                            .build(app);
                    }
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while building tauri application");
}

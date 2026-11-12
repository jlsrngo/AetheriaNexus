//! Per-launch mandatory HTTP authentication credentials and constant-time verification.

use base64::Engine;
use std::path::PathBuf;
use std::sync::OnceLock;

static ENGINE_CREDENTIALS: OnceLock<(String, String)> = OnceLock::new();

#[cfg(windows)]
fn fill_os_random(buf: &mut [u8]) -> Result<(), String> {
    #[link(name = "bcrypt")]
    extern "system" {
        fn BCryptGenRandom(
            h_algorithm: *mut std::ffi::c_void,
            pb_buffer: *mut u8,
            cb_buffer: u32,
            dw_flags: u32,
        ) -> i32;
    }
    const BCRYPT_USE_SYSTEM_PREFERRED_RNG: u32 = 0x0000_0002;
    let len = u32::try_from(buf.len()).map_err(|_| "RNG buffer too large".to_string())?;
    // SAFETY: `buf.as_mut_ptr()` points to `len` contiguous writable bytes inside `buf`, and a
    // null algorithm handle with `BCRYPT_USE_SYSTEM_PREFERRED_RNG` uses the Windows system CSPRNG.
    let status = unsafe {
        BCryptGenRandom(
            std::ptr::null_mut(),
            buf.as_mut_ptr(),
            len,
            BCRYPT_USE_SYSTEM_PREFERRED_RNG,
        )
    };
    if status == 0 {
        Ok(())
    } else {
        Err(format!(
            "BCryptGenRandom failed with NTSTATUS 0x{:08x}",
            status as u32
        ))
    }
}

#[cfg(unix)]
fn fill_os_random(buf: &mut [u8]) -> Result<(), String> {
    use std::io::Read;
    let mut f = std::fs::File::open("/dev/urandom")
        .map_err(|e| format!("Failed to open /dev/urandom: {}", e))?;
    f.read_exact(buf)
        .map_err(|e| format!("Failed to read /dev/urandom: {}", e))
}

fn generate_random_hex_token(num_bytes: usize) -> Result<String, String> {
    let mut bytes = vec![0u8; num_bytes];
    fill_os_random(&mut bytes)?;
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push_str(&format!("{:02x}", b));
    }
    Ok(out)
}

fn resolve_username_from_env() -> String {
    std::env::var("Aetheria_SERVER_USERNAME")
        .or_else(|_| std::env::var("AETHERIA_SERVER_USERNAME"))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "aetheria".to_string())
}

fn resolve_password_from_env() -> Option<String> {
    std::env::var("Aetheria_SERVER_PASSWORD")
        .or_else(|_| std::env::var("AETHERIA_SERVER_PASSWORD"))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// Initializes process-wide engine auth credentials (env override or CSPRNG per launch).
/// Always initializes credentials once and ensures HTTP requests require authentication.
pub fn init_server_credentials() -> &'static (String, String) {
    ENGINE_CREDENTIALS.get_or_init(|| {
        let user = resolve_username_from_env();
        let pass = resolve_password_from_env().unwrap_or_else(|| {
            generate_random_hex_token(24).unwrap_or_else(|err| {
                panic!(
                    "Unable to generate cryptographic server credentials: {}",
                    err
                )
            })
        });
        (user, pass)
    })
}

/// Returns active runtime `(username, password)` credentials, initializing if needed.
pub fn credentials() -> &'static (String, String) {
    init_server_credentials()
}

/// Returns active runtime credentials only if this process owns an initialized engine instance.
pub fn try_credentials() -> Option<&'static (String, String)> {
    ENGINE_CREDENTIALS.get()
}

/// Formats `Authorization: Basic ...` header value for trusted internal callers (e.g. Tauri IPC).
pub fn server_auth_header() -> String {
    format!("Basic {}", server_auth_token_b64())
}

/// Returns Base64 `username:password` token for same-machine HTTP Basic auth & media/SSE query auth.
pub fn server_auth_token_b64() -> String {
    let (user, pass) = credentials();
    base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", user, pass))
}

/// Returns `username:password` Basic auth token if persisted by an external engine process.
pub fn read_persisted_auth_token_b64() -> Option<String> {
    let (user, pass) = read_persisted_credentials()?;
    Some(base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", user, pass)))
}

/// Writes `username:password` to both `~/.aetheria/dev-server-password` and `.aetheria-nexus`
/// for out-of-band CLI scripts and Tauri fallback while keeping owner-only permissions on Unix.
pub fn persist_dev_server_password_files(creds: &(String, String)) {
    let content = format!("{}:{}", creds.0, creds.1);
    let paths: [PathBuf; 2] = [
        crate::paths::home_dir()
            .join(".aetheria")
            .join("dev-server-password"),
        crate::paths::aetheria_dot_dir().join("dev-server-password"),
    ];

    for path in paths {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        #[cfg(unix)]
        {
            use std::io::Write;
            use std::os::unix::fs::OpenOptionsExt;
            if let Ok(mut f) = std::fs::OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .mode(0o600)
                .open(&path)
            {
                let _ = f.write_all(content.as_bytes());
            }
        }
        #[cfg(not(unix))]
        {
            let _ = std::fs::write(&path, &content);
        }
    }
}

/// Reads credentials written by an external running engine instance from disk, if present.
pub fn read_persisted_credentials() -> Option<(String, String)> {
    let candidates = [
        crate::paths::home_dir()
            .join(".aetheria")
            .join("dev-server-password"),
        crate::paths::aetheria_dot_dir().join("dev-server-password"),
    ];
    for path in candidates {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            let trimmed = raw.trim();
            if let Some((user, pass)) = trimmed.split_once(':') {
                if !user.is_empty() && !pass.is_empty() {
                    return Some((user.to_string(), pass.to_string()));
                }
            }
        }
    }
    None
}

pub fn read_persisted_auth_header() -> Option<String> {
    let (user, pass) = read_persisted_credentials()?;
    let encoded =
        base64::engine::general_purpose::STANDARD.encode(format!("{}:{}", user, pass));
    Some(format!("Basic {}", encoded))
}

pub fn read_persisted_media_token() -> Option<String> {
    Some(read_persisted_credentials()?.1)
}

pub fn constant_time_eq(a: &str, b: &str) -> bool {
    let ab = a.as_bytes();
    let bb = b.as_bytes();
    let max_len = ab.len().max(bb.len());
    let mut diff: u8 = if ab.len() == bb.len() { 0 } else { 1 };
    for i in 0..max_len {
        let x = *ab.get(i).unwrap_or(&0);
        let y = *bb.get(i).unwrap_or(&0);
        diff |= x ^ y;
    }
    diff == 0
}

pub fn verify_basic_auth_header(header_val: &str, expected: &(String, String)) -> bool {
    let Some(b64) = header_val
        .strip_prefix("Basic ")
        .or_else(|| header_val.strip_prefix("basic "))
    else {
        return false;
    };
    let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(b64.trim()) else {
        return false;
    };
    let Ok(creds) = std::str::from_utf8(&decoded) else {
        return false;
    };
    let Some((user, pass)) = creds.split_once(':') else {
        return false;
    };
    constant_time_eq(user, &expected.0) && constant_time_eq(pass, &expected.1)
}

pub fn verify_query_token(token: &str, expected: &(String, String)) -> bool {
    let trimmed = token.trim();
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(trimmed)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(trimmed))
        .or_else(|_| base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(trimmed))
        .or_else(|_| base64::engine::general_purpose::STANDARD_NO_PAD.decode(trimmed));

    if let Ok(bytes) = decoded {
        if let Ok(s) = std::str::from_utf8(&bytes) {
            if let Some((user, pass)) = s.split_once(':') {
                return constant_time_eq(user, &expected.0) && constant_time_eq(pass, &expected.1);
            }
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_random_hex_token_is_unique_and_nonempty() {
        let t1 = generate_random_hex_token(24).unwrap();
        let t2 = generate_random_hex_token(24).unwrap();
        assert_eq!(t1.len(), 48);
        assert_eq!(t2.len(), 48);
        assert_ne!(t1, t2);
        assert!(t1.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_constant_time_auth_verification() {
        let expected = ("aetheria".to_string(), "secret-token-123".to_string());
        let encoded =
            base64::engine::general_purpose::STANDARD.encode("aetheria:secret-token-123");
        assert!(verify_basic_auth_header(
            &format!("Basic {}", encoded),
            &expected
        ));
        assert!(!verify_basic_auth_header(
            &format!(
                "Basic {}",
                base64::engine::general_purpose::STANDARD.encode("aetheria:wrong")
            ),
            &expected
        ));
        assert!(!verify_basic_auth_header("Bearer xyz", &expected));
        let token_b64 = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .encode("aetheria:secret-token-123");
        assert!(verify_query_token(&token_b64, &expected));
        assert!(!verify_query_token("secret-token-123", &expected));
        assert!(!verify_query_token("wrong", &expected));
    }
}

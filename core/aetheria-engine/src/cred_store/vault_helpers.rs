//! Credential expiry checks, JWT payload decoding, ISO-8601 timestamp parsing,
//! and Windows Credential Manager lookups.

use super::types::CredentialEntry;
use crate::paths::now_ms;
use base64::Engine as _;
use serde_json::Value;

pub fn is_expired(entry: &CredentialEntry, buffer_ms: u64) -> bool {
    match entry.expires_at {
        None => false,
        Some(exp) => now_ms() + buffer_ms >= exp,
    }
}

pub fn decode_jwt_payload(jwt: &str) -> Option<Value> {
    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() != 3 {
        return None;
    }
    let payload_b64 = parts[1];
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .or_else(|_| base64::engine::general_purpose::URL_SAFE.decode(payload_b64))
        .or_else(|_| base64::engine::general_purpose::STANDARD_NO_PAD.decode(payload_b64))
        .or_else(|_| base64::engine::general_purpose::STANDARD.decode(payload_b64))
        .ok()?;
    serde_json::from_slice(&bytes).ok()
}

pub fn parse_iso_to_ms(iso: &str) -> Option<u64> {
    let s = iso.trim();
    if s.len() < 19 {
        return None;
    }
    let year: i64 = s.get(0..4)?.parse().ok()?;
    let month: u64 = s.get(5..7)?.parse().ok()?;
    let day: u64 = s.get(8..10)?.parse().ok()?;
    let hour: u64 = s.get(11..13)?.parse().ok()?;
    let min: u64 = s.get(14..16)?.parse().ok()?;
    let sec: u64 = s.get(17..19)?.parse().ok()?;

    let mut offset_secs: i64 = 0;
    if let Some(pos) = s[19..].find(|c| c == '+' || c == '-') {
        let tz_str = &s[19 + pos..];
        if tz_str.len() >= 6 {
            let sign = if tz_str.starts_with('+') { 1 } else { -1 };
            if let (Ok(tz_h), Ok(tz_m)) = (tz_str[1..3].parse::<i64>(), tz_str[4..6].parse::<i64>())
            {
                offset_secs = sign * (tz_h * 3600 + tz_m * 60);
            }
        }
    }

    let y = if month <= 2 { year - 1 } else { year };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = (y - era * 400) as u64;
    let m_adj = if month > 2 { month - 3 } else { month + 9 };
    let doy = (153 * m_adj + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + (doe as i64) - 719468;
    if days < 0 {
        return None;
    }
    let local_secs = (days as i64) * 86400 + (hour * 3600 + min * 60 + sec) as i64;
    let utc_secs = local_secs - offset_secs;
    if utc_secs < 0 {
        return None;
    }
    Some((utc_secs as u64) * 1000)
}

#[cfg(windows)]
pub fn read_windows_generic_credential(target: &str) -> Option<String> {
    #[repr(C)]
    struct CREDENTIALW {
        flags: u32,
        cred_type: u32,
        target_name: *mut u16,
        comment: *mut u16,
        last_written: u64,
        credential_blob_size: u32,
        credential_blob: *const u8,
        persist: u32,
        attribute_count: u32,
        attributes: *mut std::ffi::c_void,
        target_alias: *mut u16,
        user_name: *mut u16,
    }

    #[link(name = "advapi32")]
    extern "system" {
        fn CredReadW(
            target_name: *const u16,
            cred_type: u32,
            flags: u32,
            credential: *mut *mut CREDENTIALW,
        ) -> i32;
        fn CredFree(buffer: *mut std::ffi::c_void);
    }

    let mut wide: Vec<u16> = target.encode_utf16().collect();
    wide.push(0);
    let mut pcred: *mut CREDENTIALW = std::ptr::null_mut();
    unsafe {
        let ok = CredReadW(wide.as_ptr(), 1, 0, &mut pcred);
        if ok == 0 || pcred.is_null() {
            return None;
        }
        let cred = &*pcred;
        let result = if !cred.credential_blob.is_null() && cred.credential_blob_size > 0 {
            let slice =
                std::slice::from_raw_parts(cred.credential_blob, cred.credential_blob_size as usize);
            Some(String::from_utf8_lossy(slice).to_string())
        } else {
            None
        };
        CredFree(pcred as *mut std::ffi::c_void);
        result
    }
}

#[cfg(not(windows))]
pub fn read_windows_generic_credential(_target: &str) -> Option<String> {
    None
}


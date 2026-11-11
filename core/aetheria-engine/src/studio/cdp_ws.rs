//! Minimal pure-Rust RFC 6455 WebSocket & Chrome DevTools Protocol (CDP) localhost client.

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

const WS_GUID: &str = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
static MSG_SEQ: AtomicU64 = AtomicU64::new(1);

/// Minimal FIPS 180-4 / RFC 3174 SHA-1 for RFC 6455 `Sec-WebSocket-Accept`.
pub fn sha1_digest(input: &[u8]) -> [u8; 20] {
    let mut h: [u32; 5] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    let mut msg = input.to_vec();
    let bit_len = (input.len() as u64).wrapping_mul(8);
    msg.push(0x80);
    while (msg.len() % 64) != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bit_len.to_be_bytes());

    for chunk in msg.chunks_exact(64) {
        let mut w = [0u32; 80];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }

        let [mut a, mut b, mut c, mut d, mut e] = h;
        for (i, &word) in w.iter().enumerate() {
            let (f, k) = match i {
                0..=19 => ((b & c) | ((!b) & d), 0x5A827999u32),
                20..=39 => (b ^ c ^ d, 0x6ED9EBA1u32),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1BBCDCu32),
                _ => (b ^ c ^ d, 0xCA62C1D6u32),
            };
            let temp = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(word);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = temp;
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
    }

    let mut out = [0u8; 20];
    for (idx, word) in h.iter().enumerate() {
        out[idx * 4..idx * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

pub fn compute_ws_accept_key(client_key: &str) -> String {
    let combined = format!("{}{}", client_key.trim(), WS_GUID);
    B64.encode(sha1_digest(combined.as_bytes()))
}

fn parse_ws_url(ws_url: &str) -> Result<(String, u16, String), String> {
    let stripped = ws_url
        .strip_prefix("ws://")
        .ok_or_else(|| format!("Unsupported WebSocket URL scheme: {}", ws_url))?;
    let (host_port, path) = match stripped.find('/') {
        Some(idx) => (&stripped[..idx], &stripped[idx..]),
        None => (stripped, "/"),
    };
    let (host, port) = match host_port.rsplit_once(':') {
        Some((h, p)) => (
            h.to_string(),
            p.parse::<u16>()
                .map_err(|_| format!("Invalid port in WS URL: {}", ws_url))?,
        ),
        None => (host_port.to_string(), 80),
    };
    Ok((host, port, path.to_string()))
}

pub struct CdpWebSocket {
    stream: TcpStream,
    read_buf: Vec<u8>,
    next_id: u64,
}

impl CdpWebSocket {
    pub async fn connect(ws_url: &str) -> Result<Self, String> {
        let (host, port, path) = parse_ws_url(ws_url)?;
        let mut stream = TcpStream::connect((host.as_str(), port))
            .await
            .map_err(|e| format!("Failed connecting CDP WebSocket {}:{}: {}", host, port, e))?;

        let nonce = MSG_SEQ.fetch_add(1, Ordering::Relaxed) ^ crate::paths::now_ms();
        let mut raw_key = [0u8; 16];
        raw_key[..8].copy_from_slice(&nonce.to_le_bytes());
        raw_key[8..].copy_from_slice(&(nonce.wrapping_mul(0x9E3779B97F4A7C15)).to_be_bytes());
        let client_key = B64.encode(raw_key);
        let expected_accept = compute_ws_accept_key(&client_key);

        let handshake = format!(
            "GET {} HTTP/1.1\r\nHost: {}:{}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {}\r\nSec-WebSocket-Version: 13\r\n\r\n",
            path, host, port, client_key
        );
        stream
            .write_all(handshake.as_bytes())
            .await
            .map_err(|e| format!("Failed sending WS upgrade: {}", e))?;

        let mut hdr_buf = Vec::with_capacity(1024);
        let mut tmp = [0u8; 1024];
        let header_end = loop {
            if let Some(pos) = hdr_buf.windows(4).position(|w| w == b"\r\n\r\n") {
                break pos + 4;
            }
            let n = stream
                .read(&mut tmp)
                .await
                .map_err(|e| format!("Failed reading WS upgrade response: {}", e))?;
            if n == 0 {
                return Err("CDP WebSocket closed before upgrade completed".to_string());
            }
            hdr_buf.extend_from_slice(&tmp[..n]);
            if hdr_buf.len() > 16384 {
                return Err("CDP HTTP upgrade header too large".to_string());
            }
        };

        let header_str = String::from_utf8_lossy(&hdr_buf[..header_end]);
        if !header_str.starts_with("HTTP/1.1 101") {
            return Err(format!("Unexpected CDP WS status: {}", header_str.lines().next().unwrap_or("")));
        }
        let accept_ok = header_str.lines().any(|line| {
            if let Some((k, v)) = line.split_once(':') {
                k.trim().eq_ignore_ascii_case("sec-websocket-accept") && v.trim() == expected_accept
            } else {
                false
            }
        });
        if !accept_ok {
            return Err("Invalid Sec-WebSocket-Accept from CDP endpoint".to_string());
        }

        let leftover = hdr_buf[header_end..].to_vec();
        Ok(Self {
            stream,
            read_buf: leftover,
            next_id: 1,
        })
    }

    async fn read_exact_bytes(&mut self, needed: usize) -> Result<Vec<u8>, String> {
        let mut tmp = [0u8; 8192];
        while self.read_buf.len() < needed {
            let n = self
                .stream
                .read(&mut tmp)
                .await
                .map_err(|e| format!("CDP socket read error: {}", e))?;
            if n == 0 {
                return Err("CDP socket closed unexpectedly".to_string());
            }
            self.read_buf.extend_from_slice(&tmp[..n]);
        }
        Ok(self.read_buf.drain(..needed).collect())
    }

    async fn write_frame(&mut self, opcode: u8, payload: &[u8]) -> Result<(), String> {
        let mut frame = Vec::with_capacity(14 + payload.len());
        frame.push(0x80 | (opcode & 0x0F));
        let len = payload.len();
        if len < 126 {
            frame.push(0x80 | (len as u8));
        } else if len <= u16::MAX as usize {
            frame.push(0x80 | 126);
            frame.extend_from_slice(&(len as u16).to_be_bytes());
        } else {
            frame.push(0x80 | 127);
            frame.extend_from_slice(&(len as u64).to_be_bytes());
        }
        let seq = MSG_SEQ.fetch_add(1, Ordering::Relaxed) as u32;
        let mask = seq.wrapping_mul(0x9E3779B1).to_be_bytes();
        frame.extend_from_slice(&mask);
        for (i, &b) in payload.iter().enumerate() {
            frame.push(b ^ mask[i & 3]);
        }
        self.stream
            .write_all(&frame)
            .await
            .map_err(|e| format!("CDP frame write error: {}", e))
    }

    pub async fn read_text_message(&mut self) -> Result<String, String> {
        let mut assembled = Vec::new();
        loop {
            let hdr = self.read_exact_bytes(2).await?;
            let fin = (hdr[0] & 0x80) != 0;
            let opcode = hdr[0] & 0x0F;
            let masked = (hdr[1] & 0x80) != 0;
            let len_code = (hdr[1] & 0x7F) as u64;

            let payload_len = match len_code {
                0..=125 => len_code as usize,
                126 => {
                    let b = self.read_exact_bytes(2).await?;
                    u16::from_be_bytes([b[0], b[1]]) as usize
                }
                127 => {
                    let b = self.read_exact_bytes(8).await?;
                    u64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]) as usize
                }
                _ => unreachable!(),
            };

            let mask_key = if masked {
                Some(self.read_exact_bytes(4).await?)
            } else {
                None
            };

            let mut payload = self.read_exact_bytes(payload_len).await?;
            if let Some(mask) = mask_key {
                for (i, byte) in payload.iter_mut().enumerate() {
                    *byte ^= mask[i & 3];
                }
            }

            match opcode {
                0x08 => return Err("CDP closed WebSocket connection".to_string()),
                0x09 => {
                    let _ = self.write_frame(0x0A, &payload).await;
                    continue;
                }
                0x0A => continue,
                0x00 | 0x01 | 0x02 => {
                    assembled.extend_from_slice(&payload);
                    if fin {
                        return String::from_utf8(assembled)
                            .map_err(|e| format!("Invalid UTF-8 in CDP message: {}", e));
                    }
                }
                _ => {}
            }
        }
    }

    pub async fn call(&mut self, method: &str, params: Value) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let req = json!({
            "id": id,
            "method": method,
            "params": params
        });
        let text = serde_json::to_string(&req).map_err(|e| e.to_string())?;
        self.write_frame(0x01, text.as_bytes()).await?;

        let wait_fut = async {
            loop {
                let raw = self.read_text_message().await?;
                let Ok(val) = serde_json::from_str::<Value>(&raw) else {
                    continue;
                };
                if val.get("id").and_then(Value::as_u64) == Some(id) {
                    if let Some(err) = val.get("error") {
                        let msg = err
                            .get("message")
                            .and_then(Value::as_str)
                            .unwrap_or("Unknown CDP error");
                        return Err(format!("CDP {} error: {}", method, msg));
                    }
                    return Ok(val.get("result").cloned().unwrap_or_else(|| json!({})));
                }
            }
        };

        tokio::time::timeout(std::time::Duration::from_secs(45), wait_fut)
            .await
            .map_err(|_| format!("Timed out waiting for CDP response: {}", method))?
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rfc6455_websocket_accept_vector() {
        let client_key = "dGhlIHNhbXBsZSBub25jZQ==";
        let accept = compute_ws_accept_key(client_key);
        assert_eq!(accept, "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
    }
}


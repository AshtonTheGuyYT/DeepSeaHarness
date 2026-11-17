use std::{fs, path::PathBuf};

fn decode_base64(input: &str) -> Vec<u8> {
    let mut output = Vec::with_capacity(input.len() * 3 / 4);
    let mut buffer = 0u32;
    let mut bits = 0u8;

    for byte in input.bytes() {
        let value = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            b'=' => break,
            b'\n' | b'\r' | b' ' | b'\t' => continue,
            _ => panic!("Invalid character in embedded application icon"),
        };

        buffer = (buffer << 6) | u32::from(value);
        bits += 6;

        if bits >= 8 {
            bits -= 8;
            output.push((buffer >> bits) as u8);
            buffer &= (1 << bits) - 1;
        }
    }

    output
}

fn main() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let icon_dir = manifest_dir.join("icons");
    fs::create_dir_all(&icon_dir).expect("Failed to create icon directory");

    let encoded_icon = include_str!("icons/icon.ico.base64");
    let icon_bytes = decode_base64(encoded_icon);
    fs::write(icon_dir.join("icon.ico"), icon_bytes)
        .expect("Failed to generate Windows application icon");

    tauri_build::build();
}

use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
fn list_workspace(path: String) -> Result<Vec<String>, String> {
    let root = PathBuf::from(&path).canonicalize().map_err(|error| format!("Unable to open workspace: {error}"))?;
    if !root.is_dir() { return Err("The selected workspace is not a directory.".to_string()); }
    let mut entries = fs::read_dir(&root).map_err(|error| format!("Unable to read workspace: {error}"))?.filter_map(Result::ok).filter_map(|entry| {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" || name == "target" { None } else { Some(name) }
    }).collect::<Vec<_>>();
    entries.sort_by_key(|name| name.to_lowercase());
    Ok(entries)
}

#[tauri::command]
fn canonicalize_workspace_child(root: String, relative_path: String) -> Result<String, String> {
    let root_path = Path::new(&root).canonicalize().map_err(|error| format!("Invalid workspace root: {error}"))?;
    let resolved = root_path.join(relative_path).canonicalize().map_err(|error| format!("Unable to resolve workspace path: {error}"))?;
    if !resolved.starts_with(&root_path) { return Err("Access outside the selected workspace is not permitted.".to_string()); }
    Ok(resolved.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default().plugin(tauri_plugin_dialog::init()).invoke_handler(tauri::generate_handler![list_workspace, canonicalize_workspace_child]).run(tauri::generate_context!()).expect("error while running DeepSea Harness");
}
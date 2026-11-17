use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
struct WorkspaceEntry {
    name: String,
    relative_path: String,
    is_dir: bool,
}

fn workspace_root(path: &str) -> Result<PathBuf, String> {
    let root = PathBuf::from(path).canonicalize().map_err(|error| format!("Invalid workspace root: {error}"))?;
    if !root.is_dir() {
        return Err("The selected workspace is not a directory.".to_string());
    }
    Ok(root)
}

fn safe_child(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = Path::new(relative_path);
    if relative.is_absolute() || relative.components().any(|part| matches!(part, std::path::Component::ParentDir | std::path::Component::RootDir | std::path::Component::Prefix(_))) {
        return Err("The requested path is outside the selected workspace.".to_string());
    }
    let resolved = root.join(relative).canonicalize().map_err(|error| format!("Unable to resolve workspace path: {error}"))?;
    if !resolved.starts_with(root) {
        return Err("Access outside the selected workspace is not permitted.".to_string());
    }
    Ok(resolved)
}

fn collect_entries(root: &Path, directory: &Path, depth: usize, output: &mut Vec<WorkspaceEntry>) -> Result<(), String> {
    if depth > 5 {
        return Ok(());
    }
    let entries = fs::read_dir(directory).map_err(|error| format!("Unable to read workspace: {error}"))?;
    let mut children = entries.filter_map(Result::ok).collect::<Vec<_>>();
    children.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());
    for entry in children {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || matches!(name.as_str(), "node_modules" | "target" | "dist" | "build") {
            continue;
        }
        let path = entry.path();
        let metadata = match fs::symlink_metadata(&path) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if metadata.file_type().is_symlink() {
            continue;
        }
        let is_dir = metadata.is_dir();
        let relative_path = path.strip_prefix(root).map_err(|error| error.to_string())?.to_string_lossy().replace('\\', "/");
        output.push(WorkspaceEntry { name, relative_path, is_dir });
        if is_dir {
            collect_entries(root, &path, depth + 1, output)?;
        }
    }
    Ok(())
}

#[tauri::command]
fn list_workspace(path: String) -> Result<Vec<String>, String> {
    let root = workspace_root(&path)?;
    let mut entries = fs::read_dir(&root).map_err(|error| format!("Unable to read workspace: {error}"))?.filter_map(Result::ok).filter_map(|entry| {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || matches!(name.as_str(), "node_modules" | "target" | "dist" | "build") { None } else { Some(name) }
    }).collect::<Vec<_>>();
    entries.sort_by_key(|name| name.to_lowercase());
    Ok(entries)
}

#[tauri::command]
fn list_workspace_tree(path: String) -> Result<Vec<WorkspaceEntry>, String> {
    let root = workspace_root(&path)?;
    let mut output = Vec::new();
    collect_entries(&root, &root, 0, &mut output)?;
    Ok(output)
}

#[tauri::command]
fn read_workspace_file(path: String, relative_path: String) -> Result<String, String> {
    let root = workspace_root(&path)?;
    let file = safe_child(&root, &relative_path)?;
    if !file.is_file() {
        return Err("The selected item is not a file.".to_string());
    }
    let metadata = fs::metadata(&file).map_err(|error| error.to_string())?;
    if metadata.len() > 1_048_576 {
        return Err("This file is larger than the 1 MB editor limit.".to_string());
    }
    fs::read_to_string(file).map_err(|_| "This file is not valid UTF-8 text and cannot be opened in the editor.".to_string())
}

#[tauri::command]
fn write_workspace_file(path: String, relative_path: String, content: String) -> Result<(), String> {
    let root = workspace_root(&path)?;
    let file = safe_child(&root, &relative_path)?;
    if !file.is_file() {
        return Err("Only existing files can be saved from the editor.".to_string());
    }
    if content.len() > 1_048_576 {
        return Err("The edited file exceeds the 1 MB save limit.".to_string());
    }
    fs::write(file, content).map_err(|error| format!("Unable to save file: {error}"))
}

#[tauri::command]
fn canonicalize_workspace_child(root: String, relative_path: String) -> Result<String, String> {
    let root_path = workspace_root(&root)?;
    let resolved = safe_child(&root_path, &relative_path)?;
    Ok(resolved.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![list_workspace, list_workspace_tree, read_workspace_file, write_workspace_file, canonicalize_workspace_child])
        .run(tauri::generate_context!())
        .expect("error while running DeepSea Harness");
}

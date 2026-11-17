use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use std::process::Command;

#[derive(Serialize)]
struct WorkspaceEntry {
    name: String,
    relative_path: String,
    is_dir: bool,
}

#[derive(Serialize)]
struct ProviderModel {
    id: String,
    cost: String,
    free: bool,
}

fn credential_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new("com.deepseaharness.provider", "api-key").map_err(|error| error.to_string())
}

fn load_api_key() -> Result<String, String> {
    credential_entry()?.get_password().map_err(|error| format!("No API key is saved in Windows Credential Manager: {error}"))
}

fn normalized_base(endpoint: &str) -> Result<String, String> {
    let trimmed = endpoint.trim().trim_end_matches('/');
    let parsed = reqwest::Url::parse(trimmed).map_err(|_| "Enter a valid provider URL, including https://".to_string())?;
    if parsed.scheme() != "https" && !(parsed.scheme() == "http" && matches!(parsed.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"))) {
        return Err("Provider URLs must use HTTPS. HTTP is only allowed for localhost development servers.".to_string());
    }
    if parsed.host_str().is_none() {
        return Err("The provider URL must include a hostname.".to_string());
    }
    Ok(trimmed.to_string())
}

fn endpoint_url(base: &str, suffix: &str) -> String {
    if base.ends_with(suffix) { base.to_string() } else { format!("{base}/{suffix}") }
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder().timeout(Duration::from_secs(45)).build().map_err(|error| error.to_string())
}

#[derive(Serialize)]
struct CommandResult {
    command: String,
    success: bool,
    exit_code: Option<i32>,
    stdout: String,
    stderr: String,
}

#[tauri::command]
async fn run_workspace_command(command: String, workspace: String) -> Result<CommandResult, String> {
    let root = workspace_root(&workspace)?;
    let trimmed = command.trim();
    if trimmed.is_empty() || trimmed.len() > 2000 {
        return Err("Enter a command under 2,000 characters.".to_string());
    }
    if trimmed.chars().any(|character| matches!(character, '\n' | '\r' | '&' | '|' | '<' | '>' | '^' | '%' | '!')) {
        return Err("Command chaining, redirection, and shell expansion are disabled. Run one approved command at a time.".to_string());
    }
    let executable = trimmed.split_whitespace().next().unwrap_or("").trim_matches('"').to_ascii_lowercase();
    let allowed = ["npm", "npx", "node", "python", "py", "cargo", "git", "dotnet", "where", "dir", "mkdir", "type", "echo"];
    if !allowed.contains(&executable.as_str()) {
        return Err("This command is not in DeepSea's approved command set. Supported tools include npm, node, Python, Cargo, Git, and basic workspace commands.".to_string());
    }
    let lower = trimmed.to_ascii_lowercase();
    if lower.contains("..") || lower.contains(r":\") || lower.contains(r"\\") {
        return Err("Command arguments must stay within the mounted project and cannot use absolute paths or parent-directory traversal.".to_string());
    }
    let blocked = ["format c:", "del /s", "del /q", "rmdir /s", "rd /s", "shutdown", "reg delete", "diskpart", "cipher /w", "takeown", "icacls", "powershell", "pwsh", "cmd.exe", "start-process", "invoke-expression"];
    if blocked.iter().any(|pattern| lower.contains(pattern)) {
        return Err("This command is blocked because it can modify system-wide files or bypass the workspace command restrictions.".to_string());
    }
    let command_for_run = trimmed.to_string();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let output = Command::new("cmd.exe")
            .args(["/D", "/S", "/C", &command_for_run])
            .current_dir(root)
            .output()
            .map_err(|error| format!("Unable to start command: {error}"))?;
        let stdout = String::from_utf8_lossy(&output.stdout).chars().take(24000).collect::<String>();
        let stderr = String::from_utf8_lossy(&output.stderr).chars().take(12000).collect::<String>();
        Ok::<CommandResult, String>(CommandResult {
            command: command_for_run,
            success: output.status.success(),
            exit_code: output.status.code(),
            stdout,
            stderr,
        })
    }).await.map_err(|error| format!("Command task failed: {error}"))??;
    Ok(result)
}

#[derive(Serialize)]
struct ReleaseInfo {
    tag_name: String,
    html_url: String,
}

#[tauri::command]
async fn check_for_updates() -> Result<ReleaseInfo, String> {
    let response = http_client()?
        .get("https://api.github.com/repos/AshtonTheGuyYT/DeepSeaHarness/releases/latest")
        .header(reqwest::header::USER_AGENT, "DeepSeaHarness")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .send()
        .await
        .map_err(|error| format!("Unable to contact GitHub: {error}"))?;
    if !response.status().is_success() {
        return Err(format!("GitHub release check returned HTTP {}. There may not be a published release yet.", response.status()));
    }
    let release: Value = response.json().await.map_err(|error| format!("GitHub returned an invalid release response: {error}"))?;
    let tag_name = release.get("tag_name").and_then(Value::as_str).ok_or_else(|| "The latest GitHub release did not include a version tag.".to_string())?;
    let html_url = release.get("html_url").and_then(Value::as_str).ok_or_else(|| "The latest GitHub release did not include a release page.".to_string())?;
    Ok(ReleaseInfo { tag_name: tag_name.to_string(), html_url: html_url.to_string() })
}

#[tauri::command]
fn provider_key_exists() -> bool {
    credential_entry().and_then(|entry| entry.get_password().map(|_| entry).map_err(|error| error.to_string())).is_ok()
}

#[tauri::command]
fn save_provider_key(api_key: String) -> Result<(), String> {
    let key = api_key.trim();
    if key.is_empty() {
        credential_entry()?.delete_credential().or_else(|error| {
            if matches!(error, keyring::Error::NoEntry) { Ok(()) } else { Err(error) }
        }).map_err(|error| format!("Unable to clear saved API key: {error}"))?;
        return Ok(());
    }
    credential_entry()?.set_password(key).map_err(|error| format!("Unable to save API key in Windows Credential Manager: {error}"))
}

#[tauri::command]
async fn discover_provider_models(endpoint: String) -> Result<Vec<ProviderModel>, String> {
    let base = normalized_base(&endpoint)?;
    let key = load_api_key()?;
    let response = http_client()?.get(endpoint_url(&base, "models")).bearer_auth(key).send().await.map_err(|error| format!("Could not reach provider: {error}"))?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|error| format!("Provider returned invalid JSON: {error}"))?;
    if !status.is_success() {
        let detail = body.get("error").and_then(|value| value.get("message")).and_then(Value::as_str).or_else(|| body.get("message").and_then(Value::as_str)).unwrap_or("Provider rejected the request");
        return Err(format!("Provider error ({status}): {detail}"));
    }
    let items = body.get("data").or_else(|| body.get("models")).and_then(Value::as_array).ok_or_else(|| "The provider's model endpoint did not return a data or models array.".to_string())?;
    let mut models = items.iter().filter_map(|item| {
        let id = item.get("id").or_else(|| item.get("name")).and_then(Value::as_str)?.to_string();
        let pricing = item.get("pricing");
        let prompt = pricing.and_then(|value| value.get("prompt")).and_then(|value| value.as_f64().or_else(|| value.as_str().and_then(|text| text.parse::<f64>().ok())));
        let completion = pricing.and_then(|value| value.get("completion")).and_then(|value| value.as_f64().or_else(|| value.as_str().and_then(|text| text.parse::<f64>().ok())));
        let free = id.to_lowercase().ends_with(":free") || matches!((prompt, completion), (Some(a), Some(b)) if a == 0.0 && b == 0.0);
        let cost = if free { "free" } else if prompt.is_some() && completion.is_some() { "paid" } else { "unknown" };
        Some(ProviderModel { id, cost: cost.to_string(), free })
    }).collect::<Vec<_>>();
    models.sort_by(|a, b| a.id.to_lowercase().cmp(&b.id.to_lowercase()));
    models.dedup_by(|a, b| a.id == b.id);
    Ok(models)
}

#[derive(Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[tauri::command]
async fn send_provider_message(endpoint: String, model: String, messages: Vec<ChatMessage>) -> Result<String, String> {
    let base = normalized_base(&endpoint)?;
    let key = load_api_key()?;
    if model.trim().is_empty() {
        return Err("Choose a model discovered from your provider first.".to_string());
    }
    let safe_messages = messages.into_iter().map(|message| {
        let role = match message.role.as_str() { "system" => "system", "assistant" => "assistant", _ => "user" };
        json!({"role": role, "content": message.content})
    }).collect::<Vec<_>>();
    let response = http_client()?.post(endpoint_url(&base, "chat/completions")).bearer_auth(key).json(&json!({
        "model": model,
        "messages": safe_messages,
        "stream": false
    })).send().await.map_err(|error| format!("Could not reach provider: {error}"))?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|error| format!("Provider returned invalid JSON: {error}"))?;
    if !status.is_success() {
        let detail = body.get("error").and_then(|value| value.get("message")).and_then(Value::as_str).or_else(|| body.get("message").and_then(Value::as_str)).unwrap_or("Provider rejected the request");
        return Err(format!("Provider error ({status}): {detail}"));
    }
    body.pointer("/choices/0/message/content").and_then(Value::as_str).map(str::to_string).ok_or_else(|| "The provider response did not contain a text message. The selected model may not support chat completions.".to_string())
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
    if depth > 5 { return Ok(()); }
    let entries = fs::read_dir(directory).map_err(|error| format!("Unable to read workspace: {error}"))?;
    let mut children = entries.filter_map(Result::ok).collect::<Vec<_>>();
    children.sort_by_key(|entry| entry.file_name().to_string_lossy().to_lowercase());
    for entry in children {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || matches!(name.as_str(), "node_modules" | "target" | "dist" | "build") { continue; }
        let path = entry.path();
        let metadata = match fs::symlink_metadata(&path) { Ok(value) => value, Err(_) => continue };
        if metadata.file_type().is_symlink() { continue; }
        let is_dir = metadata.is_dir();
        let relative_path = path.strip_prefix(root).map_err(|error| error.to_string())?.to_string_lossy().replace('\\', "/");
        output.push(WorkspaceEntry { name, relative_path, is_dir });
        if is_dir { collect_entries(root, &path, depth + 1, output)?; }
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
    if !file.is_file() { return Err("The selected item is not a file.".to_string()); }
    let metadata = fs::metadata(&file).map_err(|error| error.to_string())?;
    if metadata.len() > 1_048_576 { return Err("This file is larger than the 1 MB editor limit.".to_string()); }
    fs::read_to_string(file).map_err(|_| "This file is not valid UTF-8 text and cannot be opened in the editor.".to_string())
}

#[tauri::command]
fn create_workspace_file(path: String, relative_path: String, content: String) -> Result<String, String> {
    let root = workspace_root(&path)?;
    let relative = Path::new(&relative_path);
    if relative.as_os_str().is_empty() || relative.is_absolute() || relative.components().any(|part| !matches!(part, std::path::Component::Normal(_))) {
        return Err("Use a relative file path inside the selected workspace.".to_string());
    }
    if content.len() > 1_048_576 {
        return Err("The proposed file exceeds the 1 MB creation limit.".to_string());
    }
    let mut parent = root.clone();
    let components = relative.components().collect::<Vec<_>>();
    for component in components.iter().take(components.len().saturating_sub(1)) {
        parent.push(component.as_os_str());
        match fs::symlink_metadata(&parent) {
            Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => return Err("The file path contains an unsafe or non-directory component.".to_string()),
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => fs::create_dir(&parent).map_err(|create_error| format!("Unable to create parent folder: {create_error}"))?,
            Err(error) => return Err(format!("Unable to inspect target folder: {error}")),
        }
    }
    let file_name = components.last().ok_or_else(|| "A file name is required.".to_string())?;
    let file_path = parent.join(file_name.as_os_str());
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    use std::io::Write;
    let mut file = options.open(&file_path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists { "A file or folder with that name already exists. Nothing was overwritten.".to_string() } else { format!("Unable to create file: {error}") }
    })?;
    file.write_all(content.as_bytes()).map_err(|error| {
        let _ = fs::remove_file(&file_path);
        format!("Unable to write the new file: {error}")
    })?;
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn create_file_at_path(target_path: String, content: String, allow_full_access: bool, workspace: Option<String>) -> Result<String, String> {
    if content.len() > 1_048_576 {
        return Err("The proposed file exceeds the 1 MB creation limit.".to_string());
    }
    let requested = PathBuf::from(target_path.trim());
    let file_path = if requested.is_absolute() {
        if !allow_full_access {
            return Err("Enable expanded filesystem access in Settings before creating files outside the mounted workspace.".to_string());
        }
        if !requested.components().all(|part| matches!(part, std::path::Component::Prefix(_) | std::path::Component::RootDir | std::path::Component::Normal(_))) {
            return Err("The absolute destination contains an unsafe path component.".to_string());
        }
        let lexical = requested.to_string_lossy().replace('/', "\\").to_lowercase();
        if !lexical.starts_with("c:\\") {
            return Err("Expanded access is currently limited to the C: drive.".to_string());
        }
        for protected in ["c:\\windows", "c:\\program files", "c:\\program files (x86)", "c:\\programdata"] {
            if lexical == protected || lexical.starts_with(&format!("{protected}\\")) {
                return Err("DeepSea cannot create files inside protected Windows or application installation folders.".to_string());
            }
        }
        let parent = requested.parent().ok_or_else(|| "Choose a destination folder for the file.".to_string())?;
        fs::create_dir_all(parent).map_err(|error| format!("Unable to create destination folders: {error}"))?;
        let canonical_parent = parent.canonicalize().map_err(|error| format!("Unable to resolve destination folder: {error}"))?;
        let canonical_text = canonical_parent.to_string_lossy().replace('/', "\\").to_lowercase();
        if !canonical_text.starts_with("c:\\") {
            return Err("The resolved destination is outside the permitted C: drive.".to_string());
        }
        for protected in ["c:\\windows", "c:\\program files", "c:\\program files (x86)", "c:\\programdata"] {
            if canonical_text == protected || canonical_text.starts_with(&format!("{protected}\\")) {
                return Err("The resolved destination is inside a protected Windows or application installation folder.".to_string());
            }
        }
        canonical_parent.join(requested.file_name().ok_or_else(|| "A file name is required.".to_string())?)
    } else {
        let root = workspace_root(workspace.as_deref().ok_or_else(|| "Choose a workspace before creating a relative file path.".to_string())?)?;
        let relative = requested.as_path();
        if relative.as_os_str().is_empty() || relative.components().any(|part| !matches!(part, std::path::Component::Normal(_))) {
            return Err("Use a relative file path inside the selected workspace.".to_string());
        }
        let components = relative.components().collect::<Vec<_>>();
        let mut parent = root;
        for component in components.iter().take(components.len().saturating_sub(1)) {
            parent.push(component.as_os_str());
            match fs::symlink_metadata(&parent) {
                Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => return Err("The destination contains an unsafe or non-directory component.".to_string()),
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => fs::create_dir(&parent).map_err(|create_error| format!("Unable to create parent folder: {create_error}"))?,
                Err(error) => return Err(format!("Unable to inspect destination folder: {error}")),
            }
        }
        parent.join(components.last().ok_or_else(|| "A file name is required.".to_string())?.as_os_str())
    };
    let mut options = fs::OpenOptions::new();
    options.write(true).create_new(true);
    use std::io::Write;
    let mut file = options.open(&file_path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists { "A file or folder with that name already exists. Nothing was overwritten.".to_string() } else { format!("Unable to create file: {error}") }
    })?;
    file.write_all(content.as_bytes()).map_err(|error| {
        let _ = fs::remove_file(&file_path);
        format!("Unable to write the new file: {error}")
    })?;
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn write_workspace_file(path: String, relative_path: String, content: String) -> Result<(), String> {
    let root = workspace_root(&path)?;
    let file = safe_child(&root, &relative_path)?;
    if !file.is_file() { return Err("Only existing files can be saved from the editor.".to_string()); }
    if content.len() > 1_048_576 { return Err("The edited file exceeds the 1 MB save limit.".to_string()); }
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
        .invoke_handler(tauri::generate_handler![
            list_workspace, list_workspace_tree, read_workspace_file, write_workspace_file, create_workspace_file, create_file_at_path,
            canonicalize_workspace_child, provider_key_exists, save_provider_key, discover_provider_models, send_provider_message, run_workspace_command, check_for_updates
        ])
        .run(tauri::generate_context!())
        .expect("error while running DeepSea Harness");
}

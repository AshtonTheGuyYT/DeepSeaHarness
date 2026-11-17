import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, Bot, Check, ChevronDown, CircleHelp, Code2, FileCode2, Folder, FolderOpen, Github, History, KeyRound, LayoutDashboard, Menu, Moon, PanelRightClose, Plus, Search, Send, Settings2, Shield, Sparkles, Waves, X, Save, RotateCcw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

type Page = "workspace" | "settings" | "about";
type Mode = "chat" | "agent";
type WorkspaceEntry = { name: string; relative_path: string; is_dir: boolean };
type ProviderModel = { id: string; cost: "free" | "paid" | "unknown"; free: boolean };
type ChatMessage = { role: "user" | "assistant"; content: string };
type SettingsSection = "provider" | "permissions" | "workspace" | "appearance";

export default function App() {
  const [page, setPage] = useState<Page>("workspace");
  const [mode, setMode] = useState<Mode>("agent");
  const [sidebar, setSidebar] = useState(true);
  const [inspector, setInspector] = useState(true);
  const [setup, setSetup] = useState(!localStorage.getItem("deepsea-setup-complete"));
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [tree, setTree] = useState<WorkspaceEntry[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [providerModels, setProviderModels] = useState<ProviderModel[]>([]);
  const [providerBusy, setProviderBusy] = useState(false);
  const [providerStatus, setProviderStatus] = useState("Not connected");
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("provider");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [allowFileReads, setAllowFileReads] = useState(localStorage.getItem("deepsea-allow-file-reads") !== "false");
  const [requireApproval, setRequireApproval] = useState(localStorage.getItem("deepsea-require-approval") !== "false");
  const [compactMode, setCompactMode] = useState(localStorage.getItem("deepsea-compact") === "true");
  const [reduceMotion, setReduceMotion] = useState(localStorage.getItem("deepsea-reduce-motion") === "true");
  const [model, setModel] = useState("deepseek-chat");
  const [endpoint, setEndpoint] = useState("https://api.deepseek.com");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("Connect your DeepSeek API key in Settings to start a conversation.");
  const [saving, setSaving] = useState(false);
  const dirty = fileContent !== savedContent;

  useEffect(() => {
    const savedEndpoint = localStorage.getItem("deepsea-provider-endpoint");
    const savedModel = localStorage.getItem("deepsea-provider-model");
    if (savedEndpoint) setEndpoint(savedEndpoint);
    if (savedModel) setModel(savedModel);
  }, []);

  const refreshWorkspace = async (path: string) => {
    const [rootEntries, nestedEntries] = await Promise.all([
      invoke<string[]>("list_workspace", { path }),
      invoke<WorkspaceEntry[]>("list_workspace_tree", { path })
    ]);
    setFiles(rootEntries);
    setTree(nestedEntries);
  };

  const chooseWorkspace = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: "Choose a project folder" });
      if (typeof selected !== "string") return;
      setWorkspace(selected);
      await refreshWorkspace(selected);
      setActiveFile("");
      setNotice("Workspace mounted. Select a file in the project explorer to open it.");
    } catch (error) {
      setNotice(String(error));
    }
  };

  const openFile = async (entry: WorkspaceEntry) => {
    if (entry.is_dir) {
      setExpanded(current => current.includes(entry.relative_path) ? current.filter(path => path !== entry.relative_path) : [...current, entry.relative_path]);
      return;
    }
    try {
      const content = await invoke<string>("read_workspace_file", { path: workspace, relativePath: entry.relative_path });
      setActiveFile(entry.relative_path);
      setFileContent(content);
      setSavedContent(content);
      setPage("workspace");
      setNotice("");
    } catch (error) {
      setNotice(String(error));
    }
  };

  const saveFile = async () => {
    if (!workspace || !activeFile || !dirty || saving) return;
    setSaving(true);
    try {
      await invoke("write_workspace_file", { path: workspace, relativePath: activeFile, content: fileContent });
      setSavedContent(fileContent);
      setNotice("File saved to your local workspace.");
    } catch (error) {
      setNotice(String(error));
    } finally {
      setSaving(false);
    }
  };

  const finishSetup = () => {
    localStorage.setItem("deepsea-setup-complete", "true");
    setSetup(false);
  };

  const saveProvider = async () => {
    setProviderBusy(true);
    try {
      if (apiKey.trim()) await invoke("save_provider_key", { apiKey: apiKey.trim() });
      localStorage.setItem("deepsea-provider-endpoint", endpoint.trim());
      localStorage.setItem("deepsea-provider-model", model);
      setApiKey("");
      setProviderStatus("Provider settings saved");
      setNotice("Provider settings saved. Discover models to check availability and pricing.");
    } catch (error) {
      setProviderStatus("Save failed");
      setNotice(String(error));
    } finally {
      setProviderBusy(false);
    }
  };

  const discoverModels = async () => {
    setProviderBusy(true);
    try {
      if (apiKey.trim()) await invoke("save_provider_key", { apiKey: apiKey.trim() });
      const found = await invoke<ProviderModel[]>("discover_provider_models", { endpoint });
      setProviderModels(found);
      const freeModel = found.find(item => item.free);
      if (freeModel) setModel(freeModel.id);
      else if (found.length && !found.some(item => item.id === model)) setModel(found[0].id);
      localStorage.setItem("deepsea-provider-endpoint", endpoint.trim());
      if (apiKey.trim()) setApiKey("");
      setProviderStatus(found.some(item => item.free) ? `${found.length} models found · free model detected` : `${found.length} models found · no confirmed free model`);
      setNotice(found.length ? `Discovered ${found.length} models from your provider.` : "The provider returned no models.");
    } catch (error) {
      setProviderStatus("Connection failed");
      setNotice(String(error));
    } finally {
      setProviderBusy(false);
    }
  };

  const clearProviderKey = async () => {
    setProviderBusy(true);
    try {
      await invoke("save_provider_key", { apiKey: "" });
      setProviderStatus("Saved API key cleared");
      setNotice("Saved API key cleared from Windows Credential Manager.");
    } catch (error) {
      setNotice(String(error));
    } finally {
      setProviderBusy(false);
    }
  };

  const sendMessage = async () => {
    const prompt = draft.trim();
    if (!prompt || chatBusy) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: prompt }];
    setMessages(nextMessages);
    setDraft("");
    setChatBusy(true);
    setNotice("");
    try {
      const providerMessages = [
        { role: "system", content: mode === "agent" ? "You are DeepSea, a careful software development agent. Help plan code changes, explain risks, and provide complete replacement files when asked. You cannot directly modify files or run commands in this version. Never claim that you changed the user's project." : "You are DeepSea, a helpful software development assistant. Explain code clearly and do not claim to modify the project." },
        ...(allowFileReads && workspace ? [{ role: "system", content: `The user has mounted a local project with ${tree.length} visible entries: ${tree.map(entry => entry.relative_path + (entry.is_dir ? "/" : "")).join(", ")}.${activeFile ? ` The currently open file is ${activeFile}. Its current editor content follows:
${fileContent}` : ""}` }] : []),
        ...nextMessages
      ];
      const answer = await invoke<string>("send_provider_message", { endpoint, model, messages: providerMessages });
      setMessages([...nextMessages, { role: "assistant", content: answer }]);
    } catch (error) {
      setMessages([...nextMessages, { role: "assistant", content: `Provider error: ${String(error)}` }]);
    } finally {
      setChatBusy(false);
    }
  };

  const visibleTree = useMemo(() => tree.filter(entry => {
    const parts = entry.relative_path.split("/");
    if (parts.length === 1) return true;
    const ancestors = parts.slice(0, -1);
    return ancestors.every((_, index) => expanded.includes(parts.slice(0, index + 1).join("/")));
  }), [tree, expanded]);

  return <div className={`app-shell ${compactMode ? "compact-ui" : ""} ${reduceMotion ? "reduced-motion" : ""}`} onClick={event => { if (!(event.target as HTMLElement).closest(".custom-dropdown")) document.querySelectorAll(".custom-dropdown[open]").forEach(menu => menu.removeAttribute("open")); }}>
    <header className="titlebar">
      <div className="title-brand"><span className="brand-mark"><Waves size={17}/></span><span>deepsea <i>harness</i></span><small>EARLY ACCESS</small></div>
      <div className="title-center"><span/> Local workspace</div>
      <div className="window-controls"><span>−</span><span>□</span><span>×</span></div>
    </header>
    <div className="app-body">
      {sidebar && <aside className="sidebar">
        <button className="workspace-switch" onClick={chooseWorkspace}><span className="switch-icon"><Code2 size={17}/></span><span><b>{workspace ? workspace.split(/[\\/]/).filter(Boolean).pop() : "No workspace"}</b><small>{workspace ? "Local project" : "Select a project"}</small></span><ChevronDown size={14}/></button>
        <button className="new-chat" onClick={() => {setPage("workspace");setActiveFile("");setMessages([]);setDraft("");setNotice("New conversation started.");}}><Plus size={16}/> New conversation <kbd>⌘ K</kbd></button>
        <label className="nav-label">WORKSPACE</label>
        <button className={page === "workspace" && !activeFile ? "nav-item active" : "nav-item"} onClick={() => {setPage("workspace");setActiveFile("");}}><LayoutDashboard size={16}/> Overview</button>
        <button className="nav-item" onClick={chooseWorkspace}><Folder size={16}/> Open project</button>
        <label className="nav-label spaced">YOUR SPACE</label>
        <div className="history-empty"><History size={17}/>Your conversations will appear here.</div>
        <div className="sidebar-bottom">
          <div className="agent-status"><div><Activity size={14}/> Agent status <span>Idle</span></div><p>Ready when you are. Choose a project to get started.</p></div>
          <button className={page === "settings" ? "nav-item active" : "nav-item"} onClick={() => setPage("settings")}><Settings2 size={16}/> Settings</button>
          <button className={page === "about" ? "nav-item active" : "nav-item"} onClick={() => setPage("about")}><CircleHelp size={16}/> About DeepSea</button>
          <div className="profile"><span>A</span><div><b>Local session</b><small>Personal workspace</small></div></div>
        </div>
      </aside>}
      <main className="main-panel">
        <div className="topbar"><div><button className="icon-button" onClick={() => setSidebar(!sidebar)} aria-label="Toggle sidebar"><Menu size={17}/></button><b>{page === "workspace" ? activeFile ? activeFile.split("/").pop() : "Workspace" : page === "settings" ? "Preferences" : "About"}</b>{workspace && <small> / {workspace.split(/[\\/]/).filter(Boolean).pop()}</small>}</div><div className="top-actions"><span><Shield size={13}/> Local-first</span><button className="icon-button" onClick={() => setInspector(!inspector)} aria-label="Toggle explorer"><PanelRightClose size={17}/></button></div></div>
        {page === "workspace" && (activeFile ? <section className="editor-view">
          <div className="editor-toolbar"><div><FileCode2 size={15}/><span>{activeFile}</span>{dirty && <i>UNSAVED</i>}</div><div><button className="secondary" disabled={!dirty || saving} onClick={() => setFileContent(savedContent)}><RotateCcw size={13}/> Revert</button><button className="primary" disabled={!dirty || saving} onClick={saveFile}><Save size={13}/> {saving ? "Saving..." : "Save changes"}</button></div></div>
          <div className="editor-safety"><Shield size={13}/> Local file editor · Changes are only written when you select Save changes.</div>
          <textarea className="code-editor" spellCheck={false} value={fileContent} onChange={event => setFileContent(event.target.value)} />
          <div className="editor-status"><span>{dirty ? "MODIFIED · NOT SAVED" : "ALL CHANGES SAVED"}</span><span>{fileContent.split("\n").length} LINES · UTF-8</span></div>
        </section> : <section className="workspace-view command-view">
          <div className="command-heading"><div><div className="eyebrow"><span className="eyebrow-pulse"/> DEEPSEA / OPERATIONS DECK</div><h1>{workspace ? workspace.split(/[\\/]/).filter(Boolean).pop() : "Ready to dive in?"}</h1><p>{workspace ? "Workspace mounted locally. Your project context is ready." : "A focused environment for exploring, planning, and building software."}</p></div><div className="deck-controls"><div className="depth-readout"><span>DEPTH</span><b>LOCAL</b></div><details className="custom-dropdown"><summary className="model-chip"><span/> {model} <ChevronDown size={13}/></summary><div className="dropdown-menu">{providerModels.length ? providerModels.map(item => <button key={item.id} onClick={event => {setModel(item.id);localStorage.setItem("deepsea-provider-model",item.id);event.currentTarget.closest("details")?.removeAttribute("open");}}>{item.id} <small>{item.cost === "free" ? "FREE" : item.cost === "paid" ? "PAID" : "COST UNKNOWN"}</small></button>) : <button onClick={() => {setPage("settings");setSettingsSection("provider");}}>Discover provider models <small>Configure your API connection</small></button>}</div></details></div></div>
          <div className="deck-rule"><span>MISSION CONTROL</span><i/><small>{workspace ? "PROJECT CONNECTED" : "AWAITING PROJECT"}</small></div>
          <div className="mission-grid">
            <article className="mission-card primary-mission"><div className="card-topline"><span className="card-index">01 / START HERE</span><span className="status-tag">{workspace ? "ONLINE" : "STANDBY"}</span></div><div className="sonar-graphic"><div className="sonar-ring ring-one"/><div className="sonar-ring ring-two"/><div className="sonar-sweep"/><div className="sonar-core"><Waves size={24}/></div><span className="sonar-dot dot-one"/><span className="sonar-dot dot-two"/></div><div className="mission-copy"><label>YOUR NEXT MISSION</label><h2>{workspace ? "What are we building?" : "Bring a project aboard."}</h2><p>{workspace ? "Select a file from the explorer or describe a task to begin." : "Mount a local folder to give DeepSea a place to work."}</p><button className="primary" onClick={workspace ? () => setNotice("Choose a file from the project explorer to open it.") : chooseWorkspace}>{workspace ? <><FolderOpen size={14}/> Browse project files</> : <><FolderOpen size={14}/> Select project folder</>}</button></div></article>
            <article className="mission-card telemetry-card"><div className="card-topline"><span className="card-index">02 / SYSTEM TELEMETRY</span><Activity size={14}/></div><div className="telemetry-main"><div className="telemetry-value">{workspace ? files.length.toString().padStart(2,"0") : "--"}</div><div><b>ROOT ENTRIES</b><small>{workspace ? "Items detected in project root" : "No project mounted"}</small></div></div><div className="telemetry-bars">{Array.from({length:20},(_,index)=><i key={index}/>)}</div><div className="telemetry-foot"><span>WORKSPACE LINK</span><b>{workspace ? "ESTABLISHED" : "STANDBY"}</b></div><div className="telemetry-foot"><span>AGENT STATE</span><b>AWAITING INPUT</b></div></article>
            <article className="mission-card tools-card"><div className="card-topline"><span className="card-index">03 / QUICK DEPLOY</span><span className="tool-count">03 TOOLS</span></div><button className="tool-row" onClick={() => setDraft("Analyze the structure and explain how this codebase works.")}><span className="tool-icon"><Search size={16}/></span><span><b>Reconnaissance</b><small>Map the codebase and its patterns</small></span><ArrowUpRight size={15}/></button><button className="tool-row" onClick={() => setDraft("Help me plan a new feature. Identify the files and steps involved.")}><span className="tool-icon"><Sparkles size={16}/></span><span><b>Feature planning</b><small>Turn an idea into a clear implementation plan</small></span><ArrowUpRight size={15}/></button><button className="tool-row" onClick={() => setDraft("Help me investigate this bug and identify its cause.")}><span className="tool-icon"><Code2 size={16}/></span><span><b>Signal tracing</b><small>Investigate an issue and find its cause</small></span><ArrowUpRight size={15}/></button></article>
          </div>
          {messages.length > 0 && <div className="chat-transcript">{messages.map((message,index) => <article className={message.role === "user" ? "chat-message user-message" : "chat-message assistant-message"} key={index}><span>{message.role === "user" ? "YOU" : "DEEPSEA"}</span><p>{message.content}</p></article>)}{chatBusy && <div className="chat-thinking"><span/><span/><span/> Contacting provider...</div>}</div>}<div className="command-composer"><div className="composer-label"><span><i/> TRANSMIT A TASK</span><small>{mode === "agent" ? "AGENT CHANNEL" : "CHAT CHANNEL"}</small></div><div className="composer"><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => {if(event.key === "Enter" && !event.shiftKey){event.preventDefault();sendMessage();}}} placeholder="Describe what you want to build, investigate, or understand..." rows={2}/><div className="composer-bottom"><details className="custom-dropdown mode-dropdown"><summary className={mode === "agent" ? "mode active" : "mode"}><Bot size={14}/> {mode === "agent" ? "Agent mode" : "Chat mode"} <ChevronDown size={12}/></summary><div className="dropdown-menu"><button onClick={event => {setMode("agent");event.currentTarget.closest("details")?.removeAttribute("open");}}>Agent mode <small>Plan and act with approvals</small></button><button onClick={event => {setMode("chat");event.currentTarget.closest("details")?.removeAttribute("open");}}>Chat mode <small>Discuss without editing files</small></button></div></details><small>{chatBusy ? "WAITING FOR PROVIDER" : "SHIFT + ENTER FOR NEW LINE"}</small><button className="send" disabled={!draft.trim() || chatBusy} onClick={sendMessage} aria-label="Send message"><Send size={15}/></button></div></div><div className="composer-caption"><Shield size={11}/> Actions remain under your control <i>·</i> API usage billed separately by DeepSeek</div></div>
        </section>)}
        {page === "settings" && <section className="settings-view"><div className="eyebrow">PREFERENCES / SYSTEM CONFIGURATION</div><h1>Settings</h1><p className="page-description">Configure your provider, permissions, workspace, and interface.</p><div className="settings-grid"><nav><button className={settingsSection === "provider" ? "selected" : ""} onClick={() => setSettingsSection("provider")}><KeyRound size={15}/> AI provider</button><button className={settingsSection === "permissions" ? "selected" : ""} onClick={() => setSettingsSection("permissions")}><Shield size={15}/> Permissions</button><button className={settingsSection === "workspace" ? "selected" : ""} onClick={() => setSettingsSection("workspace")}><Folder size={15}/> Workspace</button><button className={settingsSection === "appearance" ? "selected" : ""} onClick={() => setSettingsSection("appearance")}><Moon size={15}/> Appearance</button></nav><div className="settings-main">
          {settingsSection === "provider" && <><article className="settings-card"><div className="settings-heading"><div><h3>OpenAI-compatible provider</h3><p>Connect DeepSeek, OpenRouter, or another provider with a compatible API.</p></div><small className={providerStatus.includes("failed") ? "connection-bad" : "connection-state"}>● {providerStatus}</small></div><label>API base URL</label><input value={endpoint} onChange={event => setEndpoint(event.target.value)} placeholder="https://openrouter.ai/api/v1" spellCheck={false}/><p className="field-help">Use the provider's API base URL, not its website URL. DeepSea appends /models and /chat/completions automatically.</p><label>API key</label><input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="Paste your provider API key" autoComplete="off"/><p className="field-help">Keys are stored in Windows Credential Manager. They are not saved in browser storage or committed to your project.</p><div className="settings-actions"><button className="primary" disabled={providerBusy} onClick={saveProvider}><Check size={14}/>{providerBusy ? "Working..." : "Save provider"}</button><button className="secondary" disabled={providerBusy} onClick={discoverModels}><Activity size={14}/> Discover models</button><button className="text-button danger-text" disabled={providerBusy} onClick={clearProviderKey}>Clear saved key</button></div></article><article className="settings-card"><div className="settings-heading"><div><h3>Available models</h3><p>Retrieved live from your provider. No built-in model catalog.</p></div><small>{providerModels.length} discovered</small></div>{providerModels.length ? <><label>Active model</label><select value={model} onChange={event => {setModel(event.target.value);localStorage.setItem("deepsea-provider-model",event.target.value);}}>{providerModels.map(item => <option key={item.id} value={item.id}>{item.id} · {item.cost === "free" ? "FREE" : item.cost === "paid" ? "PAID" : "COST UNKNOWN"}</option>)}</select><div className="model-summary"><b>{providerModels.filter(item => item.free).length} confirmed free models</b><span>Free status is based on provider pricing metadata or an explicit free model identifier. Unknown means the provider did not expose pricing.</span></div></> : <div className="settings-empty"><Sparkles size={19}/><b>No model catalog loaded</b><span>Save your provider credentials, then discover models to retrieve the live catalog and detect free options.</span></div>}</article></>}
          {settingsSection === "permissions" && <article className="settings-card"><h3>Workspace permissions</h3><p>Choose which capabilities DeepSea may use. These preferences are saved locally; unavailable capabilities remain inactive.</p><label className="setting-toggle"><span><b>Allow project file reading</b><small>Let the assistant include project files as context when supported.</small></span><input type="checkbox" checked={allowFileReads} onChange={event => {setAllowFileReads(event.target.checked);localStorage.setItem("deepsea-allow-file-reads",String(event.target.checked));}}/></label><label className="setting-toggle"><span><b>Require approval before file changes</b><small>Keep explicit user confirmation before writing agent-proposed changes.</small></span><input type="checkbox" checked={requireApproval} onChange={event => {setRequireApproval(event.target.checked);localStorage.setItem("deepsea-require-approval",String(event.target.checked));}}/></label><div className="permission-unavailable"><Shield size={15}/><span><b>Terminal execution is not enabled</b><small>Terminal tools are not implemented yet. This setting will appear when the permission-gated terminal milestone is ready.</small></span></div><button className="primary" onClick={() => setNotice("Permission preferences are saved on this device.")}><Check size={14}/> Confirm permissions</button></article>}
          {settingsSection === "workspace" && <article className="settings-card"><h3>Workspace configuration</h3><p>Manage the local project currently mounted in DeepSea.</p><div className="workspace-setting"><FolderOpen size={19}/><span><b>{workspace ? workspace.split(/[\\/]/).filter(Boolean).pop() : "No workspace mounted"}</b><small>{workspace || "Choose a folder to browse and edit project files."}</small></span></div><div className="settings-actions"><button className="primary" onClick={chooseWorkspace}><FolderOpen size={14}/> Choose workspace</button><button className="secondary" disabled={!workspace} onClick={() => refreshWorkspace(workspace).then(() => setNotice("Workspace file tree refreshed.")).catch(error => setNotice(String(error)))}><RotateCcw size={14}/> Refresh file tree</button><button className="text-button danger-text" disabled={!workspace} onClick={() => {setWorkspace("");setFiles([]);setTree([]);setExpanded([]);setActiveFile("");setFileContent("");setSavedContent("");setNotice("Workspace unmounted. Your local files were not changed.");}}>Unmount workspace</button></div></article>}
          {settingsSection === "appearance" && <article className="settings-card"><h3>Interface preferences</h3><p>Adjust the workspace presentation. Changes apply immediately and are saved locally.</p><label className="setting-toggle"><span><b>Compact interface</b><small>Reduce spacing in panels and navigation.</small></span><input type="checkbox" checked={compactMode} onChange={event => {setCompactMode(event.target.checked);localStorage.setItem("deepsea-compact",String(event.target.checked));}}/></label><label className="setting-toggle"><span><b>Reduce motion</b><small>Disable decorative movement and animated transitions.</small></span><input type="checkbox" checked={reduceMotion} onChange={event => {setReduceMotion(event.target.checked);localStorage.setItem("deepsea-reduce-motion",String(event.target.checked));}}/></label><div className="theme-choice"><span><Moon size={16}/></span><div><b>Ocean dark</b><small>Current color system</small></div><Check size={15}/></div></article>}
        </div></div></section>}{page === "about" && <section className="about-view"><div className="about-mark"><Waves size={34}/></div><label className="eyebrow">ABOUT THE PROJECT</label><h1>DeepSea Harness</h1><p className="about-tagline">A deeper workspace for ambitious builders.</p><p className="about-copy">An open-source desktop coding environment bringing DeepSeek-powered assistance closer to your projects, with transparent permissions and local-first tooling.</p><div className="about-facts"><div><small>VERSION</small><b>0.2.0 · Early development</b></div><div><small>LICENSE</small><b>MIT</b></div><div><small>PLATFORM</small><b>Windows 10 / 11</b></div></div><a className="github-link" href="https://github.com/AshtonTheGuyYT/DeepSeaHarness" target="_blank" rel="noreferrer"><Github size={16}/> View project on GitHub <ArrowUpRight size={14}/></a><small className="disclaimer">DeepSeek is a third-party AI provider. DeepSea Harness is an independent open-source project.</small></section>}
        {notice && <div className="notice"><CircleHelp size={14}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={13}/></button></div>}
      </main>
      {inspector && <aside className="inspector"><div className="inspector-head"><div><b>PROJECT EXPLORER</b><small>{workspace ? "Workspace files" : "No project selected"}</small></div><button className="icon-button" onClick={() => setInspector(false)} aria-label="Close explorer"><PanelRightClose size={16}/></button></div>{workspace ? <><div className="root-row"><FolderOpen size={15}/><b>{workspace.split(/[\\/]/).filter(Boolean).pop()}</b><small>{tree.length} items</small></div><div className="file-list">{visibleTree.map(entry => <button className={activeFile === entry.relative_path ? "file-entry selected" : "file-entry"} key={entry.relative_path} style={{paddingLeft: 9 + (entry.relative_path.split("/").length - 1) * 13}} onClick={() => openFile(entry)}>{entry.is_dir ? expanded.includes(entry.relative_path) ? <FolderOpen size={14}/> : <Folder size={14}/> : <FileCode2 size={14}/>}<span>{entry.name}</span>{entry.is_dir && <ChevronDown size={11}/>}</button>)}</div></> : <div className="explorer-empty"><span><Folder size={23}/></span><b>Your project lives here</b><p>Open a local folder to browse files and give the agent project context.</p><button className="secondary" onClick={chooseWorkspace}><Plus size={14}/> Choose folder</button></div>}<div className="activity"><b>AGENT ACTIVITY</b><p><i/> {activeFile ? "File open in local editor" : "Waiting for your first task"}</p></div></aside>}
    </div>
    {setup && <div className="modal-backdrop"><div className="setup-modal"><div className="setup-top"><span className="brand-mark large"><Waves size={21}/></span><button className="icon-button" onClick={finishSetup} aria-label="Skip setup"><X size={16}/></button></div><div className="progress"><span style={{width:`${(step+1)*33.33}%`}}/></div>{step === 0 ? <><label className="eyebrow">WELCOME ABOARD</label><h2>Your next great build<br/>starts <em>below the surface.</em></h2><p>DeepSea Harness gives you a focused desktop workspace for AI-assisted software development. Your projects stay on your machine, and you stay in control.</p><div className="feature"><Shield size={17}/><span><b>Your workspace. Your permissions.</b><small>Review agent actions before sensitive changes.</small></span></div><div className="feature"><Code2 size={17}/><span><b>Built for real development</b><small>Work with your existing local projects.</small></span></div><button className="primary full" onClick={() => setStep(1)}>Get started <ArrowRight size={15}/></button></> : step === 1 ? <><label className="eyebrow">STEP 02 · AI PROVIDER</label><h2>Bring your own<br/><em>DeepSeek connection.</em></h2><p>Add an API key later in Settings, or skip this step and explore first. API usage is billed separately by DeepSeek.</p><label className="field-label">DeepSeek API key (optional)</label><input type="password" placeholder="sk-..." value={apiKey} onChange={event => setApiKey(event.target.value)}/><button className="primary full" onClick={() => setStep(2)}>Continue <ArrowRight size={15}/></button><button className="text-button" onClick={() => setStep(2)}>I'll do this later</button></> : <><label className="eyebrow">STEP 03 · YOUR WORKSPACE</label><h2>Where will you<br/><em>make things happen?</em></h2><p>Choose a project folder to get started. You can switch workspaces at any time.</p><button className="folder-picker" onClick={chooseWorkspace}><FolderOpen size={19}/><span><b>{workspace ? workspace.split(/[\\/]/).filter(Boolean).pop() : "Choose a project folder"}</b><small>{workspace || "Select a local folder"}</small></span><ArrowUpRight size={15}/></button><button className="primary full" onClick={finishSetup}>Enter workspace <ArrowRight size={15}/></button><button className="text-button" onClick={finishSetup}>Skip for now</button></>}</div></div>}
  </div>;
}

import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, Bot, Check, ChevronDown, CircleHelp, Code2, FileCode2, FileText, Folder, FolderOpen, Github, History, KeyRound, LayoutDashboard, Menu, Moon, PanelRightClose, Plus, Search, Send, Settings2, Shield, Sparkles, Waves, X, Save, RotateCcw } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

type Page = "workspace" | "settings" | "about";
type Mode = "chat" | "agent";
type WorkspaceEntry = { name: string; relative_path: string; is_dir: boolean };

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
  const [model, setModel] = useState("deepseek-chat");
  const [endpoint, setEndpoint] = useState("https://api.deepseek.com");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("Connect your DeepSeek API key in Settings to start a conversation.");
  const [saving, setSaving] = useState(false);
  const dirty = fileContent !== savedContent;

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

  const sendMessage = () => {
    if (!draft.trim()) return;
    setNotice("DeepSeek is not connected yet. Your message was not sent. Configure a provider in Settings.");
    setDraft("");
  };

  const visibleTree = useMemo(() => tree.filter(entry => {
    const parts = entry.relative_path.split("/");
    if (parts.length === 1) return true;
    const parent = parts.slice(0, -1).slice(0, -1);
    return parent.every((_, index) => expanded.includes(parts.slice(0, index + 1).join("/")));
  }), [tree, expanded]);

  return <div className="app-shell">
    <header className="titlebar">
      <div className="title-brand"><span className="brand-mark"><Waves size={17}/></span><span>deepsea <i>harness</i></span><small>EARLY ACCESS</small></div>
      <div className="title-center"><span/> Local workspace</div>
      <div className="window-controls"><span>−</span><span>□</span><span>×</span></div>
    </header>
    <div className="app-body">
      {sidebar && <aside className="sidebar">
        <button className="workspace-switch" onClick={chooseWorkspace}><span className="switch-icon"><Code2 size={17}/></span><span><b>{workspace ? workspace.split(/[\\/]/).filter(Boolean).pop() : "No workspace"}</b><small>{workspace ? "Local project" : "Select a project"}</small></span><ChevronDown size={14}/></button>
        <button className="new-chat" onClick={() => {setPage("workspace");setActiveFile("");setNotice("New conversation ready. Configure DeepSeek to begin.");}}><Plus size={16}/> New conversation <kbd>⌘ K</kbd></button>
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
          <div className="command-heading"><div><div className="eyebrow"><span className="eyebrow-pulse"/> DEEPSEA / OPERATIONS DECK</div><h1>{workspace ? workspace.split(/[\\/]/).filter(Boolean).pop() : "Ready to dive in?"}</h1><p>{workspace ? "Workspace mounted locally. Your project context is ready." : "A focused environment for exploring, planning, and building software."}</p></div><div className="deck-controls"><div className="depth-readout"><span>DEPTH</span><b>LOCAL</b></div><details className="custom-dropdown"><summary className="model-chip"><span/> {model} <ChevronDown size={13}/></summary><div className="dropdown-menu"><button onClick={() => {setModel("deepseek-chat");(document.activeElement as HTMLElement)?.blur();}}>deepseek-chat <small>General purpose</small></button><button onClick={() => {setModel("deepseek-reasoner");(document.activeElement as HTMLElement)?.blur();}}>deepseek-reasoner <small>Reasoning model</small></button><button onClick={() => setPage("settings")}>Provider settings <small>Configure connection</small></button></div></details></div></div>
          <div className="deck-rule"><span>MISSION CONTROL</span><i/><small>{workspace ? "PROJECT CONNECTED" : "AWAITING PROJECT"}</small></div>
          <div className="mission-grid">
            <article className="mission-card primary-mission"><div className="card-topline"><span className="card-index">01 / START HERE</span><span className="status-tag">{workspace ? "ONLINE" : "STANDBY"}</span></div><div className="sonar-graphic"><div className="sonar-ring ring-one"/><div className="sonar-ring ring-two"/><div className="sonar-sweep"/><div className="sonar-core"><Waves size={24}/></div><span className="sonar-dot dot-one"/><span className="sonar-dot dot-two"/></div><div className="mission-copy"><label>YOUR NEXT MISSION</label><h2>{workspace ? "What are we building?" : "Bring a project aboard."}</h2><p>{workspace ? "Select a file from the explorer or describe a task to begin." : "Mount a local folder to give DeepSea a place to work."}</p><button className="primary" onClick={workspace ? () => setNotice("Choose a file from the project explorer to open it.") : chooseWorkspace}>{workspace ? <><FolderOpen size={14}/> Browse project files</> : <><FolderOpen size={14}/> Select project folder</>}</button></div></article>
            <article className="mission-card telemetry-card"><div className="card-topline"><span className="card-index">02 / SYSTEM TELEMETRY</span><Activity size={14}/></div><div className="telemetry-main"><div className="telemetry-value">{workspace ? files.length.toString().padStart(2,"0") : "--"}</div><div><b>ROOT ENTRIES</b><small>{workspace ? "Items detected in project root" : "No project mounted"}</small></div></div><div className="telemetry-bars">{Array.from({length:20},(_,index)=><i key={index}/>)}</div><div className="telemetry-foot"><span>WORKSPACE LINK</span><b>{workspace ? "ESTABLISHED" : "STANDBY"}</b></div><div className="telemetry-foot"><span>AGENT STATE</span><b>AWAITING INPUT</b></div></article>
            <article className="mission-card tools-card"><div className="card-topline"><span className="card-index">03 / QUICK DEPLOY</span><span className="tool-count">03 TOOLS</span></div><button className="tool-row" onClick={() => setDraft("Analyze the structure and explain how this codebase works.")}><span className="tool-icon"><Search size={16}/></span><span><b>Reconnaissance</b><small>Map the codebase and its patterns</small></span><ArrowUpRight size={15}/></button><button className="tool-row" onClick={() => setDraft("Help me plan a new feature. Identify the files and steps involved.")}><span className="tool-icon"><Sparkles size={16}/></span><span><b>Feature planning</b><small>Turn an idea into a clear implementation plan</small></span><ArrowUpRight size={15}/></button><button className="tool-row" onClick={() => setDraft("Help me investigate this bug and identify its cause.")}><span className="tool-icon"><Code2 size={16}/></span><span><b>Signal tracing</b><small>Investigate an issue and find its cause</small></span><ArrowUpRight size={15}/></button></article>
          </div>
          <div className="command-composer"><div className="composer-label"><span><i/> TRANSMIT A TASK</span><small>{mode === "agent" ? "AGENT CHANNEL" : "CHAT CHANNEL"}</small></div><div className="composer"><textarea value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => {if(event.key === "Enter" && !event.shiftKey){event.preventDefault();sendMessage();}}} placeholder="Describe what you want to build, investigate, or understand..." rows={2}/><div className="composer-bottom"><details className="custom-dropdown mode-dropdown"><summary className={mode === "agent" ? "mode active" : "mode"}><Bot size={14}/> {mode === "agent" ? "Agent mode" : "Chat mode"} <ChevronDown size={12}/></summary><div className="dropdown-menu"><button onClick={() => setMode("agent")}>Agent mode <small>Plan and act with approvals</small></button><button onClick={() => setMode("chat")}>Chat mode <small>Discuss without editing files</small></button></div></details><small>SHIFT + ENTER FOR NEW LINE</small><button className="send" disabled={!draft.trim()} onClick={sendMessage} aria-label="Send message"><Send size={15}/></button></div></div><div className="composer-caption"><Shield size={11}/> Actions remain under your control <i>·</i> API usage billed separately by DeepSeek</div></div>
        </section>)}
        {page === "settings" && <section className="settings-view"><div className="eyebrow">PREFERENCES</div><h1>Settings</h1><p className="page-description">Configure your provider, workspace, and how the agent works.</p><div className="settings-grid"><nav><span className="selected"><KeyRound size={15}/> AI provider</span><span><Shield size={15}/> Permissions</span><span><Folder size={15}/> Workspace</span><span><Moon size={15}/> Appearance</span></nav><div className="settings-main"><article className="settings-card"><div className="settings-heading"><div><h3>DeepSeek connection</h3><p>Use your own API key to power the coding assistant.</p></div><small>● Not connected</small></div><label>API key</label><input type="password" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="sk-..." autoComplete="off"/><p className="field-help">Secure credential storage and provider connection testing are not yet implemented. This field is temporary and is not persisted.</p><label>API base URL</label><input value={endpoint} onChange={event => setEndpoint(event.target.value)}/><label>Model</label><select value={model} onChange={event => setModel(event.target.value)}><option value="deepseek-chat">deepseek-chat</option><option value="deepseek-reasoner">deepseek-reasoner</option></select><div className="provider-note"><CircleHelp size={15}/><span>API access and pricing are separate from a DeepSeek website subscription. Read the <a href="https://api-docs.deepseek.com/" target="_blank" rel="noreferrer">official API documentation <ArrowUpRight size={11}/></a>.</span></div><button className="primary" onClick={() => setNotice("Provider settings are not saved yet. Secure credential storage and connection testing are planned for the provider milestone.")}><Check size={15}/> Save preferences</button></article><article className="settings-card"><h3>Application appearance</h3><p>Choose the visual theme for your workspace.</p><div className="theme-choice"><span><Moon size={16}/></span><div><b>Ocean dark</b><small>Default theme</small></div><Check size={15}/></div></article></div></div></section>}
        {page === "about" && <section className="about-view"><div className="about-mark"><Waves size={34}/></div><label className="eyebrow">ABOUT THE PROJECT</label><h1>DeepSea Harness</h1><p className="about-tagline">A deeper workspace for ambitious builders.</p><p className="about-copy">An open-source desktop coding environment bringing DeepSeek-powered assistance closer to your projects, with transparent permissions and local-first tooling.</p><div className="about-facts"><div><small>VERSION</small><b>0.2.0 · Early development</b></div><div><small>LICENSE</small><b>MIT</b></div><div><small>PLATFORM</small><b>Windows 10 / 11</b></div></div><a className="github-link" href="https://github.com/AshtonTheGuyYT/DeepSeaHarness" target="_blank" rel="noreferrer"><Github size={16}/> View project on GitHub <ArrowUpRight size={14}/></a><small className="disclaimer">DeepSeek is a third-party AI provider. DeepSea Harness is an independent open-source project.</small></section>}
        {notice && <div className="notice"><CircleHelp size={14}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={13}/></button></div>}
      </main>
      {inspector && <aside className="inspector"><div className="inspector-head"><div><b>PROJECT EXPLORER</b><small>{workspace ? "Workspace files" : "No project selected"}</small></div><button className="icon-button" onClick={() => setInspector(false)} aria-label="Close explorer"><PanelRightClose size={16}/></button></div>{workspace ? <><div className="root-row"><FolderOpen size={15}/><b>{workspace.split(/[\\/]/).filter(Boolean).pop()}</b><small>{tree.length} items</small></div><div className="file-list">{visibleTree.map(entry => <button className={activeFile === entry.relative_path ? "file-entry selected" : "file-entry"} key={entry.relative_path} style={{paddingLeft: 9 + (entry.relative_path.split("/").length - 1) * 13}} onClick={() => openFile(entry)}>{entry.is_dir ? expanded.includes(entry.relative_path) ? <FolderOpen size={14}/> : <Folder size={14}/> : <FileCode2 size={14}/>}<span>{entry.name}</span>{entry.is_dir && <ChevronDown size={11}/>}</button>)}</div></> : <div className="explorer-empty"><span><Folder size={23}/></span><b>Your project lives here</b><p>Open a local folder to browse files and give the agent project context.</p><button className="secondary" onClick={chooseWorkspace}><Plus size={14}/> Choose folder</button></div>}<div className="activity"><b>AGENT ACTIVITY</b><p><i/> {activeFile ? "File open in local editor" : "Waiting for your first task"}</p></div></aside>}
    </div>
    {setup && <div className="modal-backdrop"><div className="setup-modal"><div className="setup-top"><span className="brand-mark large"><Waves size={21}/></span><button className="icon-button" onClick={finishSetup} aria-label="Skip setup"><X size={16}/></button></div><div className="progress"><span style={{width:`${(step+1)*33.33}%`}}/></div>{step === 0 ? <><label className="eyebrow">WELCOME ABOARD</label><h2>Your next great build<br/>starts <em>below the surface.</em></h2><p>DeepSea Harness gives you a focused desktop workspace for AI-assisted software development. Your projects stay on your machine, and you stay in control.</p><div className="feature"><Shield size={17}/><span><b>Your workspace. Your permissions.</b><small>Review agent actions before sensitive changes.</small></span></div><div className="feature"><Code2 size={17}/><span><b>Built for real development</b><small>Work with your existing local projects.</small></span></div><button className="primary full" onClick={() => setStep(1)}>Get started <ArrowRight size={15}/></button></> : step === 1 ? <><label className="eyebrow">STEP 02 · AI PROVIDER</label><h2>Bring your own<br/><em>DeepSeek connection.</em></h2><p>Add an API key later in Settings, or skip this step and explore first. API usage is billed separately by DeepSeek.</p><label className="field-label">DeepSeek API key (optional)</label><input type="password" placeholder="sk-..." value={apiKey} onChange={event => setApiKey(event.target.value)}/><button className="primary full" onClick={() => setStep(2)}>Continue <ArrowRight size={15}/></button><button className="text-button" onClick={() => setStep(2)}>I'll do this later</button></> : <><label className="eyebrow">STEP 03 · YOUR WORKSPACE</label><h2>Where will you<br/><em>make things happen?</em></h2><p>Choose a project folder to get started. You can switch workspaces at any time.</p><button className="folder-picker" onClick={chooseWorkspace}><FolderOpen size={19}/><span><b>{workspace ? workspace.split(/[\\/]/).filter(Boolean).pop() : "Choose a project folder"}</b><small>{workspace || "Select a local folder"}</small></span><ArrowUpRight size={15}/></button><button className="primary full" onClick={finishSetup}>Enter workspace <ArrowRight size={15}/></button><button className="text-button" onClick={finishSetup}>Skip for now</button></>}</div></div>}
  </div>;
}

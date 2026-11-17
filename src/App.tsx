import { useState } from "react";
import { Activity, ArrowRight, ArrowUpRight, Bot, Check, ChevronDown, CircleHelp, Code2, FileCode2, Folder, FolderOpen, Github, History, KeyRound, LayoutDashboard, Menu, Moon, PanelRightClose, Plus, Search, Send, Settings2, Shield, Sparkles, Waves, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";

type Page = "workspace" | "settings" | "about";
type Mode = "chat" | "agent";

export default function App() {
  const [page, setPage] = useState<Page>("workspace");
  const [mode, setMode] = useState<Mode>("agent");
  const [sidebar, setSidebar] = useState(true);
  const [inspector, setInspector] = useState(true);
  const [setup, setSetup] = useState(!localStorage.getItem("deepsea-setup-complete"));
  const [step, setStep] = useState(0);
  const [workspace, setWorkspace] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("deepseek-chat");
  const [endpoint, setEndpoint] = useState("https://api.deepseek.com");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("Connect your DeepSeek API key in Settings to start a conversation.");

  const chooseWorkspace = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: "Choose a project folder" });
      if (typeof selected !== "string") return;
      setWorkspace(selected);
      const entries = await invoke<string[]>("list_workspace", { path: selected });
      setFiles(entries);
      setNotice("Workspace opened. File browsing is being expanded in the next development milestone.");
    } catch (error) {
      setNotice(String(error));
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

  return <div className="app-shell">
    <header className="titlebar">
      <div className="title-brand"><span className="brand-mark"><Waves size={17}/></span><span>deepsea <i>harness</i></span><small>EARLY ACCESS</small></div>
      <div className="title-center"><span/> Local workspace</div>
      <div className="window-controls"><span>−</span><span>□</span><span>×</span></div>
    </header>
    <div className="app-body">
      {sidebar && <aside className="sidebar">
        <button className="workspace-switch" onClick={chooseWorkspace}><span className="switch-icon"><Code2 size={17}/></span><span><b>{workspace ? workspace.split(/[\\/]/).filter(Boolean).pop() : "No workspace"}</b><small>{workspace ? "Local project" : "Select a project"}</small></span><ChevronDown size={14}/></button>
        <button className="new-chat" onClick={() => {setPage("workspace");setNotice("New conversation ready. Configure DeepSeek to begin.");}}><Plus size={16}/> New conversation <kbd>⌘ K</kbd></button>
        <label className="nav-label">WORKSPACE</label>
        <button className={page === "workspace" ? "nav-item active" : "nav-item"} onClick={() => setPage("workspace")}><LayoutDashboard size={16}/> Overview</button>
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
        <div className="topbar"><div><button className="icon-button" onClick={() => setSidebar(!sidebar)} aria-label="Toggle sidebar"><Menu size={17}/></button><b>{page === "workspace" ? "Workspace" : page === "settings" ? "Preferences" : "About"}</b>{workspace && <small> / {workspace.split(/[\\/]/).filter(Boolean).pop()}</small>}</div><div className="top-actions"><span><Shield size={13}/> Local-first</span><button className="icon-button" onClick={() => setInspector(!inspector)} aria-label="Toggle explorer"><PanelRightClose size={17}/></button></div></div>
        {page === "workspace" && <section className="workspace-view">
          <div className="page-intro"><div><label className="eyebrow">DEVELOPMENT ENVIRONMENT</label><h1>Build something <em>remarkable.</em></h1><p>Your focused space for thinking, building, and shipping with DeepSeek.</p></div><button className="model-chip"><span/> {model} <ChevronDown size={13}/></button></div>
          <div className="chat-stage">
            <div className="welcome"><div className="welcome-mark"><Waves size={27}/></div><label>DEEPSEA HARNESS <i>·</i> YOUR AI WORKSPACE</label><h2>A little less busywork.<br/><em>A lot more building.</em></h2><p>Connect DeepSeek, open a project, and turn your next idea into working software.</p><div className="welcome-buttons"><button className="primary" onClick={() => setPage("settings")}><KeyRound size={15}/> Configure DeepSeek</button><button className="secondary" onClick={chooseWorkspace}><FolderOpen size={15}/> Open a project</button></div></div>
            <div className="suggestions">
              <button onClick={() => setDraft("Help me understand the architecture of this project.")}><span><Search size={16}/></span><div><b>Understand a codebase</b><small>Map files, patterns, and architecture</small></div><ArrowUpRight size={14}/></button>
              <button onClick={() => setDraft("Help me plan and implement a new feature.")}><span><Sparkles size={16}/></span><div><b>Build a new feature</b><small>Plan changes across your project</small></div><ArrowUpRight size={14}/></button>
              <button onClick={() => setDraft("Help me investigate and fix a bug.")}><span><Code2 size={16}/></span><div><b>Debug an issue</b><small>Trace errors and find a fix</small></div><ArrowUpRight size={14}/></button>
            </div>
          </div>
          <div className="composer-wrap"><div className="composer"><textarea value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => {if(e.key === "Enter" && !e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Ask DeepSeek anything about your project..." rows={2}/><div className="composer-bottom"><button className={mode === "agent" ? "mode active" : "mode"} onClick={() => setMode(mode === "agent" ? "chat" : "agent")}><Bot size={14}/> {mode === "agent" ? "Agent mode" : "Chat mode"} <ChevronDown size={12}/></button><small>Shift + Enter for a new line</small><button className="send" disabled={!draft.trim()} onClick={sendMessage} aria-label="Send message"><Send size={15}/></button></div></div><div className="composer-caption"><Shield size={11}/> {mode === "agent" ? "Agent actions will require your approval." : "Chat mode cannot modify local files."} <i>·</i> API usage billed separately by DeepSeek</div></div>
        </section>}
        {page === "settings" && <section className="settings-view"><div className="eyebrow">PREFERENCES</div><h1>Settings</h1><p className="page-description">Configure your provider, workspace, and how the agent works.</p><div className="settings-grid"><nav><span className="selected"><KeyRound size={15}/> AI provider</span><span><Shield size={15}/> Permissions</span><span><Folder size={15}/> Workspace</span><span><Moon size={15}/> Appearance</span></nav><div className="settings-main"><article className="settings-card"><div className="settings-heading"><div><h3>DeepSeek connection</h3><p>Use your own API key to power the coding assistant.</p></div><small>● Not connected</small></div><label>API key</label><input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." autoComplete="off"/><p className="field-help">Secure native credential storage will be connected in the provider milestone. This form does not persist the key yet.</p><label>API base URL</label><input value={endpoint} onChange={e => setEndpoint(e.target.value)}/><label>Model</label><select value={model} onChange={e => setModel(e.target.value)}><option value="deepseek-chat">deepseek-chat</option><option value="deepseek-reasoner">deepseek-reasoner</option></select><div className="provider-note"><CircleHelp size={15}/><span>API access and pricing are separate from a DeepSeek website subscription. Read the <a href="https://api-docs.deepseek.com/" target="_blank" rel="noreferrer">official API documentation <ArrowUpRight size={11}/></a>.</span></div><button className="primary" onClick={() => setNotice("Provider settings are not saved yet. Secure credential storage and connection testing are planned for the API integration milestone.")}><Check size={15}/> Save preferences</button></article><article className="settings-card"><h3>Application appearance</h3><p>Choose the visual theme for your workspace.</p><div className="theme-choice"><span><Moon size={16}/></span><div><b>Ocean dark</b><small>Default theme</small></div><Check size={15}/></div></article></div></div></section>}
        {page === "about" && <section className="about-view"><div className="about-mark"><Waves size={34}/></div><label className="eyebrow">ABOUT THE PROJECT</label><h1>DeepSea Harness</h1><p className="about-tagline">A deeper workspace for ambitious builders.</p><p className="about-copy">An open-source desktop coding environment bringing DeepSeek-powered assistance closer to your projects, with transparent permissions and local-first tooling.</p><div className="about-facts"><div><small>VERSION</small><b>0.1.0 · Early development</b></div><div><small>LICENSE</small><b>MIT</b></div><div><small>PLATFORM</small><b>Windows 10 / 11</b></div></div><a className="github-link" href="https://github.com/AshtonTheGuyYT/DeepSeaHarness" target="_blank" rel="noreferrer"><Github size={16}/> View project on GitHub <ArrowUpRight size={14}/></a><small className="disclaimer">DeepSeek is a third-party AI provider. DeepSea Harness is an independent open-source project.</small></section>}
        {notice && <div className="notice"><CircleHelp size={14}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={13}/></button></div>}
      </main>
      {inspector && <aside className="inspector"><div className="inspector-head"><div><b>PROJECT EXPLORER</b><small>{workspace ? "Workspace files" : "No project selected"}</small></div><button className="icon-button" onClick={() => setInspector(false)} aria-label="Close explorer"><PanelRightClose size={16}/></button></div>{workspace ? <><div className="root-row"><FolderOpen size={15}/><b>{workspace.split(/[\\/]/).filter(Boolean).pop()}</b><small>{files.length}</small></div><div className="file-list">{files.map(file => <div key={file}><FileCode2 size={14}/>{file}</div>)}</div></> : <div className="explorer-empty"><span><Folder size={23}/></span><b>Your project lives here</b><p>Open a local folder to browse files and give the agent project context.</p><button className="secondary" onClick={chooseWorkspace}><Plus size={14}/> Choose folder</button></div>}<div className="activity"><b>AGENT ACTIVITY</b><p><i/> Waiting for your first task</p></div></aside>}
    </div>
    {setup && <div className="modal-backdrop"><div className="setup-modal"><div className="setup-top"><span className="brand-mark large"><Waves size={21}/></span><button className="icon-button" onClick={finishSetup} aria-label="Skip setup"><X size={16}/></button></div><div className="progress"><span style={{width:`${(step+1)*33.33}%`}}/></div>{step === 0 ? <><label className="eyebrow">WELCOME ABOARD</label><h2>Your next great build<br/>starts <em>below the surface.</em></h2><p>DeepSea Harness gives you a focused desktop workspace for AI-assisted software development. Your projects stay on your machine, and you stay in control.</p><div className="feature"><Shield size={17}/><span><b>Your workspace. Your permissions.</b><small>Review agent actions before sensitive changes.</small></span></div><div className="feature"><Code2 size={17}/><span><b>Built for real development</b><small>Work with your existing local projects.</small></span></div><button className="primary full" onClick={() => setStep(1)}>Get started <ArrowRight size={15}/></button></> : step === 1 ? <><label className="eyebrow">STEP 02 · AI PROVIDER</label><h2>Bring your own<br/><em>DeepSeek connection.</em></h2><p>Add an API key later in Settings, or skip this step and explore first. API usage is billed separately by DeepSeek.</p><label className="field-label">DeepSeek API key (optional)</label><input type="password" placeholder="sk-..." value={apiKey} onChange={e => setApiKey(e.target.value)}/><button className="primary full" onClick={() => setStep(2)}>Continue <ArrowRight size={15}/></button><button className="text-button" onClick={() => setStep(2)}>I'll do this later</button></> : <><label className="eyebrow">STEP 03 · YOUR WORKSPACE</label><h2>Where will you<br/><em>make things happen?</em></h2><p>Choose a project folder to get started. You can switch workspaces at any time.</p><button className="folder-picker" onClick={chooseWorkspace}><FolderOpen size={19}/><span><b>{workspace ? workspace.split(/[\\/]/).filter(Boolean).pop() : "Choose a project folder"}</b><small>{workspace || "Select a local folder"}</small></span><ArrowUpRight size={15}/></button><button className="primary full" onClick={finishSetup}>Enter workspace <ArrowRight size={15}/></button><button className="text-button" onClick={finishSetup}>Skip for now</button></>}</div></div>}
  </div>;
}
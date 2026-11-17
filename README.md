# DeepSea Harness

[![Windows CI](https://github.com/AshtonTheGuyYT/DeepSeaHarness/actions/workflows/ci.yml/badge.svg)](https://github.com/AshtonTheGuyYT/DeepSeaHarness/actions/workflows/ci.yml)

DeepSea Harness is an open-source Windows desktop coding workspace built with Tauri 2, Rust, React, TypeScript, and Vite. It connects to providers that expose an OpenAI-compatible chat completions API.

> Status: early development. The local project explorer, basic text editor, provider credential storage, live model discovery, non-streaming AI chat, and approval-based AI file creation are implemented. Streaming, SQLite conversation history, AI edits to existing files, and terminal execution are not implemented yet.

## Current capabilities

- Tauri 2 Windows desktop application
- Deep-ocean operations-deck interface
- Native folder picker and nested local project explorer
- Basic UTF-8 text editor for existing files up to 1 MB
- Explicit Save changes and Revert controls
- Provider URL and API key configuration
- API keys stored through the Windows Credential Manager using the native credential store
- Live model discovery from the configured provider's `/models` endpoint, including automatic refresh on startup
- Free model detection when provider metadata reports zero prompt and completion pricing or the model ID uses the `:free` suffix
- OpenAI-compatible non-streaming `/chat/completions` requests
- Optional project file/tree context supplied to the model when project reading is enabled
- AI-generated new-file proposals with a preview and explicit approval before creation
- Safe creation of new files and missing parent folders inside the selected workspace, without overwriting existing items
- Settings for project reading, approval preference, compact layout, and reduced motion

## Provider setup

Open **Settings → AI provider**.

1. Enter your provider's API base URL. For OpenRouter, use its OpenAI-compatible API base URL from its official documentation. For DeepSeek, use its official API base URL.
2. Paste your API key.
3. Select **Save provider**.
4. Select **Discover models**. DeepSea calls the provider's `/models` endpoint and retrieves the current catalog.
5. If the provider exposes pricing metadata, DeepSea marks models with zero input and output pricing as free and automatically selects a detected free model.

DeepSea does not contain a hardcoded model catalog. Providers that do not expose pricing metadata are shown with cost marked as unknown; DeepSea does not guess whether those models are free. A provider must expose an OpenAI-compatible `/models` endpoint and `/chat/completions` endpoint for discovery and chat to work. Provider-specific features outside that compatibility surface may not work.

API credentials are stored in Windows Credential Manager and are not written to localStorage. The provider URL and selected model are stored locally in the app's browser storage. Provider requests are made by the Rust backend. HTTPS is required for remote providers; HTTP is allowed only for localhost development endpoints.

## Current limitations

- AI responses are currently non-streaming.
- Conversation history is held in the active app session and is not yet stored in SQLite.
- Agent mode can analyze and plan but cannot yet edit files or execute commands directly.
- The editor supports existing UTF-8 text files up to 1 MB and does not yet provide syntax highlighting or file creation.
- File changes require the user to save them in the editor; the full AI proposal and approval workflow is planned.
- The provider must implement the OpenAI-compatible API surface described above.

## Development prerequisites

- Node.js 20 or newer and npm
- Rust stable toolchain
- Tauri 2 Windows prerequisites: Microsoft C++ Build Tools and WebView2 Runtime

## Getting started

```powershell
npm install
npm run tauri dev
```

For a frontend-only preview, use `npm run dev`.

## Windows bundles

The Tauri configuration targets NSIS and MSI installers. A release build still needs to be produced and verified on a Windows build host. No installer is published yet.

## Security principles

The native application, not the model, must enforce filesystem boundaries and tool permissions. Workspace file operations resolve paths against the selected root, reject paths outside it, and skip symbolic links during explorer traversal. AI-created files require an explicit approval click, use create-new semantics so existing files are never overwritten, and reject symbolic links in destination directories. Provider credentials are stored in the Windows credential store and should never be committed to the repository. These controls are an early foundation, not a complete sandbox or agent permission system.

## License

MIT. See [LICENSE](LICENSE).

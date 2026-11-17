# DeepSea Harness

[![Windows CI](https://github.com/AshtonTheGuyYT/DeepSeaHarness/actions/workflows/ci.yml/badge.svg)](https://github.com/AshtonTheGuyYT/DeepSeaHarness/actions/workflows/ci.yml)

DeepSea Harness is an open-source Windows desktop coding workspace being built around the official DeepSeek API. It uses Tauri 2, Rust, React, TypeScript, and Vite.

> Status: early development (0.1.0). The local project explorer and basic text editor are now implemented. DeepSeek streaming, secure credential storage, SQLite conversation history, AI-driven file changes, a full approval workflow, and terminal execution are not implemented yet.

## Current foundation

- Tauri 2 desktop application configuration for Windows MSI and NSIS bundles
- React and TypeScript interface with a distinctive deep-ocean operations-deck design
- First-launch welcome flow, workspace view, settings, and about page
- Native folder picker and nested local project explorer
- Rust filesystem commands with canonical-path checks and symlink exclusion
- Basic UTF-8 text editor for existing files up to 1 MB
- Explicit Save changes and Revert controls for user-edited files
- Open-source contribution and security policy files

The editor only writes a file after the user selects **Save changes**. It currently edits existing UTF-8 text files; it is not a syntax-highlighted editor and does not support binary files or creating new files. The chat composer intentionally does not send requests. The API key field is temporary, is not persisted, and should not be treated as secure storage.

## Technology

- Tauri 2 and Rust for the native desktop shell and filesystem boundary
- React, TypeScript, and Vite for the interface
- SQLite persistence is planned, not yet integrated
- Official DeepSeek API integration is planned, not yet integrated

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

The native application, not the model, must enforce filesystem boundaries and tool permissions. Workspace file operations resolve paths against the selected root, reject paths outside it, and skip symbolic links during explorer traversal. File writes are limited to existing files and require an explicit user save action in the UI. These controls are an early foundation, not a complete sandbox or agent permission system. Never commit API keys or credentials.

## DeepSeek API costs

DeepSeek API access and pricing are separate from any DeepSeek consumer website subscription. API usage may incur separate charges under the provider's pricing and terms.

## License

MIT. See [LICENSE](LICENSE).

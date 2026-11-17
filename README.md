# DeepSea Harness

[![Windows CI](https://github.com/AshtonTheGuyYT/DeepSeaHarness/actions/workflows/ci.yml/badge.svg)](https://github.com/AshtonTheGuyYT/DeepSeaHarness/actions/workflows/ci.yml)

DeepSea Harness is an open-source Windows desktop coding workspace being built around the official DeepSeek API. It uses Tauri 2, Rust, React, TypeScript, and Vite.

> Status: early development (0.1.0). This is an active foundation, not yet a complete AI coding agent. Provider streaming, credential vault integration, SQLite history, file editing, permission approvals, and terminal execution are not implemented yet.

## Current foundation

- Tauri 2 desktop application configuration for Windows MSI and NSIS bundles
- React and TypeScript interface with a deep-ocean design system
- First-launch welcome flow, workspace view, settings, and about page
- Native folder picker and top-level workspace directory listing
- Rust canonical-path validation helper for existing workspace children
- Open-source contribution and security policy files

The current chat composer intentionally does not send requests. It reports that the provider integration is not ready rather than fabricating AI output. The API key field is not persisted and should not be treated as secure storage yet.

## Technology

- Tauri 2 and Rust for the native desktop shell
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

The native application, not the model, must enforce filesystem boundaries and tool permissions. The current Rust path helper checks canonical paths for existing children, but a complete file operation layer and approval system are still future work. Never commit API keys or credentials.

## DeepSeek API costs

DeepSeek API access and pricing are separate from any DeepSeek consumer website subscription. API usage may incur separate charges under the provider's pricing and terms.

## License

MIT. See [LICENSE](LICENSE).

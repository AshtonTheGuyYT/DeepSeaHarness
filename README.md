# DeepSea Harness

DeepSea Harness is an open-source Windows desktop coding workspace powered by the DeepSeek API. It combines a React and TypeScript interface with a Tauri 2 native shell and a Rust security boundary for local project access.

> Early development: this repository is being built in verified milestones. Features are documented as available only after implementation and testing.

## Project status

The initial application foundation is under development. The first milestone establishes the desktop shell, visual workspace, onboarding, and settings. Agent execution, provider streaming, persistence, and native workspace tools are subsequent milestones.

## Technology

- Tauri 2 and Rust for the Windows desktop shell and native capabilities
- React, TypeScript, and Vite for the interface
- CSS design tokens and custom components
- SQLite for local conversation storage (planned for the persistence milestone)
- DeepSeek API for model access (planned for the provider milestone)

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

## Security principles

The native application, not the model, is the authority for filesystem boundaries and tool permissions. Workspace access is intended to be restricted to the selected folder. Destructive actions and sensitive terminal operations require explicit approval. Never commit API keys or credentials.

## DeepSeek API costs

DeepSeek API access is separate from any DeepSeek consumer website subscription. API usage may incur separate charges under the provider's pricing and terms.

## License

MIT. See [LICENSE](LICENSE).

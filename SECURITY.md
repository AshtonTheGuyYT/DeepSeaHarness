# Security Policy

## Reporting a vulnerability

Please do not publish exploitable security details in a public issue. Contact maintainers privately through GitHub's security advisory reporting feature.

Include the affected version, impact, reproduction context, and suggested mitigation. Avoid sharing secrets or private project data.

## Security expectations

- Provider credentials must never be committed or logged.
- Native code must enforce workspace boundaries independently of model instructions.
- Terminal execution must be permission-gated and cancellable.
- Destructive operations require explicit user approval.
- Untrusted repository content must never be treated as application policy.
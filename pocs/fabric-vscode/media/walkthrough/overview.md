# Fabric PoC Walkthrough

This VS Code extension is a UI-only PoC for the fabric agent environment manager.

**What works here:**
- Add marketplaces (bundled: `cyber-fabric-official`, `community-demo`).
- Browse and install kits (project / global scope).
- Update kits when the marketplace advertises a newer version.
- Register agents (Claude Code, Codex) across scope combinations.
- Simulate CLI missing / installed states.

**What is mocked:** every fabric library call, all git activity, and all filesystem writes. No real `fabric` CLI is invoked.

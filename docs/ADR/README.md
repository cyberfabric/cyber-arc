# Cyber Fabric ADR Set: Skill-Oriented Artifact Orchestration

This directory contains the initial ADR set for the Cyber Fabric architecture of small, composable agent skills operating over explicit artifacts and validation contracts.

## Proposed ADR List

1. **ADR-0001** — Adopt small contract-based skills instead of monolithic agents
2. **ADR-0002** — Use artifact-centric orchestration as the primary execution model
3. **ADR-0003** — Define typed, versioned artifacts with per-artifact format contracts
4. **ADR-0004** — Allow multiple operations per skill within a bounded capability family
5. **ADR-0005** — Support policy-driven loops for iterative quality improvement
6. **ADR-0006** — Separate syntactic and semantic validation layers
7. **ADR-0007** — Model traceability as an optional cross-cutting capability
8. **ADR-0008** — Centralize traceability in a dedicated skill family
9. **ADR-0009** — Require deterministic validators for critical and traceability-sensitive checks
10. **ADR-0010** — Extend Agent Skills frontmatter with a compatible external interface contract
11. **ADR-0011** — Distribute skills as kit packages with a central agent registration tool
12. **ADR-0012** — Separate pipeline planning from pipeline execution
13. **ADR-0013** — Install the system with a minimal project-local footprint
14. **ADR-0014** — Generate agent prompts through a tool from layered TOML skill definitions
15. **ADR-0015** — Allow deterministic tooling in skills through shared Fabric extensions or install modes
16. **ADR-0016** — Adopt TypeScript as the primary implementation language for Cyber Fabric
17. **ADR-0017** — Use a unified Fabric operational model across host-native surfaces
18. **ADR-0018** — Integrate Cyber Fabric through host-native plugins and adapters
19. **ADR-0019** — Centralize orchestration in a shared Fabric core

## Identifier Conventions

- **ADR artifact IDs** use standard Cypilot-style identifiers, for example `cpt-cyber-fabric-adr-contract-based-skills`.

## Full ADRs

- [ADR-0001: Adopt Small Contract-Based Skills Instead of Monolithic Agents](0001-cpt-cyber-fabric-adr-contract-based-skills-v1.md)
- [ADR-0002: Use Artifact-Centric Orchestration as the Primary Execution Model](0002-cpt-cyber-fabric-adr-artifact-centric-orchestration-v1.md)
- [ADR-0003: Define Typed, Versioned Artifacts with Per-Artifact Format Contracts](0003-cpt-cyber-fabric-adr-typed-versioned-artifacts-v1.md)
- [ADR-0004: Allow Multiple Operations Per Skill Within a Bounded Capability Family](0004-cpt-cyber-fabric-adr-multi-operation-skills-v1.md)
- [ADR-0005: Support Policy-Driven Loops for Iterative Quality Improvement](0005-cpt-cyber-fabric-adr-policy-driven-loops-v1.md)
- [ADR-0006: Separate Syntactic and Semantic Validation Layers](0006-cpt-cyber-fabric-adr-layered-validation-v1.md)
- [ADR-0007: Model Traceability as an Optional Cross-Cutting Capability](0007-cpt-cyber-fabric-adr-optional-traceability-v1.md)
- [ADR-0008: Centralize Traceability in a Dedicated Skill Family](0008-cpt-cyber-fabric-adr-dedicated-traceability-skill-family-v1.md)
- [ADR-0009: Require Deterministic Validators for Critical and Traceability-Sensitive Checks](0009-cpt-cyber-fabric-adr-deterministic-validation-v1.md)
- [ADR-0010: Extend Agent Skills Frontmatter with a Compatible External Interface Contract](0010-cpt-cyber-fabric-adr-compatible-skill-interface-extension-v1.md)
- [ADR-0011: Distribute Skills as Kit Packages with a Central Agent Registration Tool](0011-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md)
- [ADR-0012: Separate Pipeline Planning from Pipeline Execution](0012-cpt-cyber-fabric-adr-orchestrator-skill-pipeline-composer-v1.md)
- [ADR-0013: Install the System with a Minimal Project-Local Footprint](0013-cpt-cyber-fabric-adr-minimal-installation-footprint-v1.md)
- [ADR-0014: Generate Agent Prompts Exclusively Through a Tool from Layered TOML Skill Definitions](0014-cpt-cyber-fabric-adr-tool-generated-layered-prompts-v1.md)
- [ADR-0015: Allow Skills to Carry Deterministic Tooling via Shared Fabric Extensions or Explicit Install Modes](0015-cpt-cyber-fabric-adr-deterministic-tooling-in-skills-v1.md)
- [ADR-0016: Adopt TypeScript as the Primary Implementation Language for Cyber Fabric](0016-cpt-cyber-fabric-adr-typescript-primary-language-v1.md)
- [ADR-0017: Use a Unified Fabric Operational Model Across Host-Native Surfaces](0017-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md)
- [ADR-0018: Integrate Cyber Fabric Through Host-Native Plugins and Adapters](0018-cpt-cyber-fabric-adr-host-native-plugins-and-adapters-v1.md)
- [ADR-0019: Centralize Orchestration in a Shared Fabric Core](0019-cpt-cyber-fabric-adr-central-fabric-core-v1.md)

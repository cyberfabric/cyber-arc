---
status: accepted
date: 2026-04-29
decision-makers: cyber fabric maintainers
---

# ADR-0017: Scripts as Kit Resources

<!-- toc -->

- [Context and Problem Statement](#context-and-problem-statement)
- [Decision Drivers](#decision-drivers)
- [Considered Options](#considered-options)
- [Decision Outcome](#decision-outcome)
  - [Consequences](#consequences)
  - [Confirmation](#confirmation)
- [Pros and Cons of the Options](#pros-and-cons-of-the-options)
  - [Option 1: No Script Primitive](#option-1-no-script-primitive)
  - [Option 2: Scripts as Kit Resources](#option-2-scripts-as-kit-resources)
  - [Option 3: Scripts Bundled with Other Executable Types](#option-3-scripts-bundled-with-other-executable-types)
- [More Information](#more-information)
- [Traceability](#traceability)

<!-- /toc -->

**ID**: `cpt-cyber-fabric-adr-scripts-as-kit-resources`

## Context and Problem Statement

Kit authors frequently want to ship runnable code alongside their prompts and assets — short scripts that drive deterministic setup, validation, transformation, or one-off operations. Today there is no first-class concept for this in Cyber Fabric. A kit could ship a script as an asset (per ADR-0016), but the kit's user would then have to know the path, find the right interpreter, and execute manually. Operators have no uniform way to discover what scripts a given kit ships, and the Web UI (ADR-0018) cannot offer kit scripts as first-class actions without a registration model.

The platform therefore needs a **scripts as kit resources** concept: a kit declares scripts as first-class entries; users discover, inspect, and run them through `fabric script list / info / run`; and the same script is invocable from CLI and from the Web UI per the unified-surface principle of ADR-0001 and ADR-0002.

## Decision Drivers

* **Discoverability** — users must be able to ask "what scripts does this kit ship?" and get a structured answer
* **Consistent invocation** — `fabric script run <id>` should work uniformly regardless of script language or location
* **Kit context at runtime** — scripts must have access to storage (ADR-0015) and assets (ADR-0016) of their own kit through the SDK
* **Surface parity** — the same scripts must be invocable from the CLI and from the Web UI per ADR-0001 and ADR-0002
* **Argument passing** — users must be able to pass arguments to scripts on the command line and from the Web UI
* **Bounded sandboxing** — scripts execute with appropriate access; the exact sandbox model is follow-on design

## Considered Options

1. **No Script Primitive** — kits document "run this command yourself"; scripts ship as assets per ADR-0016 with no platform support
2. **Scripts as Kit Resources** — Fabric provides a first-class scripts concept with `fabric script list / info / run` and SDK access to storage and assets
3. **Scripts Bundled with Other Executable Types** — scripts, web extensions, and dev tool plugins all share one resource type

## Decision Outcome

Chosen option: **Option 2 — Scripts as Kit Resources**, because Cyber Fabric needs a first-class way for kits to ship runnable code that integrates with storage (ADR-0015), assets (ADR-0016), and the unified surface model (ADR-0001 and ADR-0002), while keeping scripts conceptually distinct from web extensions (ADR-0018) and dev tool plugins (ADR-0019), which run in fundamentally different runtimes.

A kit declares scripts in its manifest with stable identifiers. Each script declaration includes at minimum the entry-point file, the language or interpreter (TypeScript, JavaScript, shell, etc.; the canonical set is follow-on design), and a short description suitable for `info` output and Web UI listings.

The CLI surface is:

* `fabric script list [--kit <id>] [--json]` — list all scripts across installed kits, narrowable by kit
* `fabric script info <kit>:<id> [--json]` — return the structured record for one script (kit, id, description, language, declared arguments)
* `fabric script run <kit>:<id> [-- <args...>]` — execute the script, passing remaining arguments through

The same operations are reachable from the Web UI (ADR-0018) per ADR-0001 and ADR-0002. The Web UI calls the same Fabric core APIs that the CLI does — it does not invoke the CLI as a subprocess.

Scripts execute with **kit context**: the script SDK gives the running script access to its own kit's storage (ADR-0015) and assets (ADR-0016) without the script having to know its own kit id explicitly. Cross-kit access requires explicit declaration; the mechanism is follow-on design.

The exact sandbox model (process isolation, environment variables, network access, filesystem permissions) is intentionally left to follow-on design. What this ADR fixes is that scripts exist as a first-class kit resource with discoverable identifiers, a stable CLI / Web UI surface, and SDK access to storage and assets.

### Consequences

* Good, because users discover and run kit scripts through one consistent surface instead of per-kit documentation
* Good, because scripts get clean SDK access to the kit's own storage and assets
* Good, because the same scripts work identically from CLI and Web UI per ADR-0001 and ADR-0002
* Good, because operators can list, inspect, and audit scripts across all kits in one CLI
* Good, because scripts stay conceptually distinct from web extensions and dev tool plugins, which have different runtimes
* Bad, because the kit manifest must declare each script
* Bad, because the canonical set of supported languages and interpreters and the sandbox model need follow-on design
* Bad, because cross-kit script invocation requires declared dependencies

### Confirmation

Confirmed when:

* a kit can declare scripts in its manifest with stable identifiers, entry points, and descriptions
* `fabric script list` enumerates scripts across kits, narrowable by `--kit`
* `fabric script info <kit>:<id>` returns a structured record including description, language, and declared arguments
* `fabric script run <kit>:<id> [-- <args...>]` executes the script with arguments forwarded
* the running script has SDK access to its own kit's storage (ADR-0015) and assets (ADR-0016)
* the same script discovery and execution surface is available from the Web UI (ADR-0018) per ADR-0001 and ADR-0002

## Pros and Cons of the Options

### Option 1: No Script Primitive

Kits document "run this command yourself"; scripts ship as assets with no platform support.

* Good, because the platform owns less surface
* Bad, because users discover and invoke scripts through per-kit conventions
* Bad, because scripts have no clean way to access storage and assets
* Bad, because the Web UI cannot offer kit scripts as first-class actions

### Option 2: Scripts as Kit Resources

Fabric provides a first-class scripts concept with `fabric script list / info / run` and SDK access to storage and assets.

* Good, because users discover and run scripts through one consistent surface
* Good, because scripts get SDK access to their own kit's storage and assets
* Good, because the same surface works from CLI and Web UI
* Good, because operators can audit and inspect scripts across kits
* Bad, because the kit manifest must declare each script
* Bad, because language / interpreter and sandbox details need follow-on design

### Option 3: Scripts Bundled with Other Executable Types

Scripts, web extensions, and dev tool plugins all share one resource type.

* Good, because there is one resource concept instead of three
* Bad, because scripts, web extensions, and dev tool plugins run in fundamentally different runtimes (OS process vs. web framework vs. host plugin runtime)
* Bad, because forcing them into one concept either weakens it (lowest common denominator) or bloats it (every concept includes others' fields)
* Bad, because users intuitively distinguish them anyway, so unifying them confuses the mental model

## More Information

The canonical set of supported script languages and interpreters, the argument-declaration shape (positional, named, types), the sandbox model (process isolation, environment variables, network and filesystem access), the cross-kit invocation mechanism, and the relationship between script execution and Fabric workspace context (ADR-0011) are intentionally left to follow-on design. What this ADR fixes is the existence of scripts as a first-class kit resource and the `fabric script list / info / run` CLI surface.

Scripts compose with storage (ADR-0015) and assets (ADR-0016) through the kit SDK. Web extensions (ADR-0018) and dev tool plugins (ADR-0019) are distinct kit resources with different runtimes; their decisions are in their own ADRs.

## Traceability

- **Vision**: [VISION.md](../../VISION.md)
- **PRD references** ([PRD.md](../PRD.md)): `cpt-cyber-fabric-fr-kits-only-extension-mechanism`, `cpt-cyber-fabric-usecase-pe-bundle-scripts-with-prompts`, `cpt-cyber-fabric-usecase-pe-author-kit`
- **Related decisions**: [ADR-0001](0001-cpt-cyber-fabric-adr-unified-agent-first-tool-v1.md), [ADR-0002](0002-cpt-cyber-fabric-adr-central-fabric-core-v1.md), [ADR-0006](0006-cpt-cyber-fabric-adr-kit-packaged-pluggable-skills-v1.md), [ADR-0008](0008-cpt-cyber-fabric-adr-kits-as-universal-extension-mechanism-v1.md), [ADR-0015](0015-cpt-cyber-fabric-adr-kit-configuration-storage-v1.md), [ADR-0016](0016-cpt-cyber-fabric-adr-kit-assets-v1.md), [ADR-0018](0018-cpt-cyber-fabric-adr-fabric-web-ui-on-frontx-v1.md)

This decision directly addresses the following traceability items:

* kits must be able to ship runnable code as first-class scripts
* scripts must be discoverable and runnable through `fabric script list / info / run`
* scripts must have SDK access to their own kit's storage (ADR-0015) and assets (ADR-0016)
* the same script surface must be reachable from the Web UI (ADR-0018) per ADR-0001 and ADR-0002
* scripts are conceptually distinct from web extensions and dev tool plugins

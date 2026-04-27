# Cyber Fabric — PRD Brainstorm State

**Status:** in progress
**Workshop mode:** `fabric:prd` → brainstorm
**Last update:** 2026-04-21 (end of Round 2)
**Next action on resume:** rebuild living decision ledger from this file, then resume at Round 3 panel questions below.

---

## Context

- Source material: `VISION.md`, 19 accepted ADRs under `docs/ADR/`, working PoC at `pocs/fabric`.
- PoC validates ADR-0004 (multi-op skill: `prd` family), ADR-0012 (planner vs executor), ADR-0014 (layered TOML → prompt materialization), ADR-0017 (unified op model), ADR-0018 (host-native plugins for Claude Code + Codex).
- PoC gaps vs VISION: no artifact store/types, no validation layers, no policy-driven loops, no traceability, no kit packaging, no shared Fabric core library, no multi-repo/Git integration, no collaboration layer, PoC is JS (vs ADR-0016 TS).

---

## Accepted decisions

### Round 1
| # | Decision |
|---|---|
| D1 | **OSS model.** Adoption-driven. No licensing revenue in MVP scope. |
| D2 | **Cyber Pilot → Fabric is a replacement**, not a parallel product. Pilot deprecates as Fabric matures. |
| D3 | **18-mo success:** (a) adopted by all sponsor companies, (b) external adopters exist, (c) ≥1 000 GitHub stars. *(See D13 — sponsor adoption is primary.)* |
| D4 | **Primary personas: software engineers AND product managers** (equal weight, both first-class). *(See Round 3 question A — possibly downgraded to "engineer-primary in MVP".)* |
| D5 | **Competitive frame: Spec-Driven Development (SDD)** frameworks and plugins. |
| D6 | **MVP packaging:** Fabric core = library; primary surface = CLI `fabric`. No daemon/service in MVP. |
| D7 | **Artifacts live in git-tracked repositories.** No separate database. |
| D8 | **Value proposition: SDLC-wide acceleration for all participants**, not just code generation. |
| D9 | **Assisted coordination** includes AI-driven follow-up on comment threads / review discussions. |

### Round 2
| # | Decision |
|---|---|
| D10 | **MVP use cases = A (PRD-to-PR) + B (Review copilot) + D (Multi-repo change).** Closes U1. |
| D11 | **Proactivity packaging:** on-demand CLI in MVP + host-hook recipes shipped as docs. `fabric watch` deferred post-MVP pending design-partner ask. Closes U6, resolves R2. |
| D12 | **Named competitors:** OpenSpec, BMAD, Superpowers (assumed = `obra/superpowers` Claude Code plugin distribution — confirm), Spec Kit. Closes U2. |
| D13 | **Sponsor adoption is the primary 18-mo success signal.** 1K stars + external adopters are secondary growth indicators. Neither alone rescues a sponsor-adoption miss. Sharpens D3, resolves R4. |
| D14 | **QA / Architect / Designer = downstream beneficiaries in MVP.** They consume Fabric-produced artifacts but are not authoring personas. Closes U5, resolves R1 as documented assumption. |

---

## Unresolved blockers (must close before `prd-generate`)

| # | Question | Status |
|---|---|---|
| U3 | **OSS license + governance** (Apache 2.0 vs MIT; CLA; foundation vs BDFL). | Round 3 question C |
| U7 | **Merge / collab semantics** for parallel edits — acute now that D10 includes multi-repo. | Round 3 question D |
| C-r2 | **PM surface strategy.** D4 equal-weight + D6 CLI-only internally inconsistent. | Round 3 question A (re-ask) |
| new | **Measurable baselines per use case** — without them D13 unverifiable. | Round 3 question B |
| new | **Security posture** — artifact scanning + token handling. | Round 3 question E |
| new | **Design-partner commitment** — D13 unverifiable without named partners. | Round 3 question F |

> U4 (TS vs JS in MVP) out of PRD scope — tech spec concern.

---

## Risks and tensions

### Round 1 (open or resolved)
| # | Tension | Status |
|---|---|---|
| R1 | "SDLC-wide acceleration" vs "primary personas = engineer + PM only". | Resolved by D14 as documented assumption. |
| R2 | "Library + CLI only" vs "proactive AI coordination". | Resolved by D11. |
| R3 | Git-tracked artifacts for PM persona — PMs may not work natively in git. | Active — tied to Round 3 question A. |
| R4 | "1K stars" (DX/OSS) vs "sponsor-company adoption" (enterprise) — two funnels. | Resolved by D13 (sponsor-primary). |

### Round 2 (newly unlocked)
| # | Tension |
|---|---|
| R5 | D10 includes multi-repo change + D11 forbids daemon. Multi-repo coordination without long-running process is the hardest MVP bet. Either scope narrowly or close the loop via host hooks. |
| R6 | Superpowers (D12) competes on SDD workflow scope but *shares* the host-native plugin packaging we committed to in ADR-0018. PRD differentiation must be "by workflow scope, not by packaging mechanism." |
| R7 | With D10 locked, "5-min hook moment" is almost certainly B (Review copilot) — A and D are too heavy for first-run. Confirm in a later round. |
| R8 | D13 + D14 implies sponsor-company QAs/Architects must *accept* Fabric-generated artifacts without authoring them. Sales/procurement risk. |

---

## Round 3 — pending role-panel questions

### A. PM surface (re-ask — was C in Round 2, still open)
1. CLI only; PMs become power users
2. Two surfaces in MVP (CLI + thin web/IDE PM view)
3. CLI MVP; PM surface post-MVP triggered by first PM design partner (downgrades D4)
4. No Fabric PM surface; PMs stay in Linear/Notion/GitHub; Fabric syncs artifacts
*Assistant pick: A3.*

### B. Measurable baselines per use case — CPM
1. Qualitative MVP; quantitative post-MVP
2. Quantitative MVP from sponsor dogfooding (time-to-first-PR for A, review-cycle-time for B, cross-repo-merge-rate for D)
3. 30-day retention gate only
4. Defer to prd-generate
*Assistant pick: B2 + B3.*

### C. License + governance — Legal/Privacy (closes U3)
1. Apache 2.0 + no CLA + BDFL
2. Apache 2.0 + CLA (Acronis-assigned) + BDFL
3. MIT + no CLA + BDFL
4. Apache 2.0 + CLA + foundation-track from day one
5. Other
*Assistant pick: C2.*

### D. Multi-repo merge + collab semantics — Lead Architect (closes U7, addresses R5)
1. Fan-out, no sync
2. Fan-out + shared plan manifest
3. Fan-out + GitHub Action reconciler (host-hook, no daemon)
4. Scope D down to read-only cross-repo context MVP; writes post-MVP
*Assistant pick: D3.*

### E. Security posture — Lead Security
- **E-art (artifact scanning):** 1. User responsibility · 2. Fabric-built scanner · 3. Integrate gitleaks/trufflehog
- **E-tok (token handling):** 1. Env var · 2. OS keychain · 3. Defer
*Assistant pick: E-art 3 + E-tok 2.*

### F. Design-partner commitment — GTM / Customer Success
1. 2 sponsor teams committed in writing before PRD ships
2. 1 committed + 1 prospective; 2nd partner = MVP gate
3. TBD in PRD; pursue post-PRD
4. Self-dogfood only; external partners post-stable
*Assistant pick: F1.*

### Still to run (Round 4+)
SRE / Platform, Lead QA, Data / Analytics, Finance / Operations, UX Designer, Lead Developer, Customer Success — to close NFR, operational, and acceptance-criteria buckets.

---

## How to resume

In a new Claude Code session:

> "Продолжим PRD brainstorm из `docs/PRD-BRAINSTORM.md`."

The assistant should:
1. Read this file.
2. Reconstruct the living decision ledger from Accepted (Rounds 1 + 2) + Unresolved + Risks above.
3. Do not re-ask settled decisions (D1–D14).
4. Resume at Round 3 panel questions.
5. After all unresolved items are closed, recommend `fabric prompt get prd-generate` per the `prd-brainstorm` protocol.

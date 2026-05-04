---
id: planner-subagent-protocol
type: rules
name: planner subagent protocol
description: Sub-agent dispatch contract for the fabric planner — input shape (brief is the only context), structured return shape, parent-side validation gate, parallel fan-out rules
---

<!-- append "subagent_protocol_overview" -->
**Scope**: when `planner-generate` or `planner-execute` dispatches a sub-agent for a phase (compilation or execution), this rule defines exactly what goes in, exactly what comes back, and what the parent verifies before accepting the result. Loaded by `planner-generate` and `planner-execute`; cite as `subagent-protocol L2 input contract` etc.

**Why a contract matters**: sub-agents have no shared chat context with the parent. They MUST work from the brief alone. If the contract is loose, sub-agents fill gaps with hallucinated assumptions that pass casual review but break the manifest's integrity audit later.
<!-- /append -->

<!-- append "subagent_protocol_input_contract" -->
The input handed to a sub-agent is exactly:

1. **Context boundary line** (verbatim):
   ```
   --- CONTEXT BOUNDARY ---
   Disregard all previous chat / agent context. The brief below is self-contained.
   Read ONLY the files listed in the brief. Follow its instructions exactly.
   ---
   ```
2. **Brief content**: the full text of `{plan_dir}/brief-{NN}-{slug}.md`, read from disk (NEVER reconstructed from chat memory).
3. **One-line task statement**: either "compile the phase file from this brief" (for `planner-generate` dispatch) or "execute this phase per its Task section and report" (for `planner-execute` dispatch).

The parent MUST NOT include:
- previous chat turns
- summaries of "what we already did"
- references to other phases beyond what the brief lists in `depends_on` / `inputs`
- adjustments to the brief made verbally — if a brief needs to change, the parent rewrites the brief on disk and re-reads it before dispatching

The brief is the single source of truth handed to the sub-agent. If the brief is wrong, the brief is updated on disk; the sub-agent input never compensates.
<!-- /append -->

<!-- append "subagent_protocol_return_contract" -->
The sub-agent MUST return a single structured payload (typically JSON or a strictly-formatted block) containing:

| Field | Required | Meaning |
|-------|----------|---------|
| `phase_number` | yes | The phase the sub-agent worked on. Must match the brief. |
| `phase_file_path` | yes | Absolute path of the phase file the sub-agent wrote (for compilation) or the phase file it consumed (for execution). |
| `intermediate_outputs` | yes | List of `out/{filename}` paths under `plan_dir` that the sub-agent created. Empty array if none. |
| `output_files` | yes | List of project-side files the sub-agent created or modified. Empty array if none. |
| `validation_outcome` | yes | `"PASS"` or `"FAIL"`. The sub-agent MUST run `fabric-poc script run plan-phase-validate <phase_file> <brief_file>` (compilation) or it MUST run the phase's Acceptance Criteria checks (execution) before returning. |
| `validation_findings` | optional | When `validation_outcome = "FAIL"`, a structured list of failing categories. |
| `notes` | optional | Free-text observations the parent may surface to the user. |

A sub-agent that returns a payload missing required fields, or whose `validation_outcome` is unverifiable, is treated as `FAIL` by the parent regardless of what the payload claims.
<!-- /append -->

<!-- append "subagent_protocol_parent_verification" -->
On receiving a sub-agent return, the parent MUST verify before marking the phase progressed:

1. **Payload shape**: every required field is present and well-typed.
2. **Phase identity match**: `phase_number` and `phase_file_path` match the dispatched brief.
3. **File presence on disk**: every entry in `intermediate_outputs` and `output_files` exists on disk at the declared path.
4. **Manifest brief alignment**: the produced `intermediate_outputs` list matches the brief's declared `outputs` exactly (no extras, no omissions). Same for `output_files` versus the brief's declared `output_files`.
5. **Validation outcome**: `validation_outcome` is `"PASS"`, OR the parent re-runs the validator and confirms; if both disagree, the parent's run wins and the phase is marked `failed`.
6. **For compilation dispatch**: the parent additionally re-runs `plan-phase-validate` on the produced phase file and confirms `overall = "PASS"`.

On any verification failure, the parent does NOT mark the phase as `done`. It records `failed` with a reason naming the failing check, and stops further dispatch in the affected layer.
<!-- /append -->

<!-- append "subagent_protocol_parallel_fanout" -->
Multiple briefs can be dispatched concurrently when their dependency layers are disjoint:

- Build layers from the dependency DAG: layer 0 = phases with empty `depends_on`; layer N = phases whose `depends_on` are all in layers 0..N-1.
- Within a single layer, dispatch all briefs in parallel. Wait for ALL returns of layer N before starting layer N+1.
- Per-phase `intermediate_outputs` paths within a layer MUST be disjoint. If two briefs in the same layer would write to the same `out/` filename, that is a decomposition defect — fix the brief specs (rename the outputs, or merge the phases) before dispatching.

Sequential dispatch (one layer at a time, one phase at a time within a layer) is the safe fallback when the parent cannot guarantee non-collision; it slows wall-clock but never corrupts state.

For `planner-execute`: parallel within a layer is rarely valuable since execution typically writes the same `output_files` (the project artifact). Default to sequential for execution; reserve parallel for plans whose phases write disjoint project files.
<!-- /append -->

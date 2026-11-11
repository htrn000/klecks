---
llm_index: true
verbosity: low
status: [draft]
generated_by_llm:
  model: gpt-6-luna[high]
  conversation:
    - human: caveats for a single persistent sidekick workflow
    - research: Devin Fusion product description, https://devin.ai/cli
changelog:
  - 67c6fcc27 26/10/21 [gpt-6-luna-high   ] document sidekick edge cases
---

# Sidekick caveats

Use this table when a packet or handoff hits an edge case. The skill defines the normal path.

| Situation | Response |
|---|---|
| Symbol or file scope is unclear | Require fully qualified namespace, path, and revision. Auto-scope stays within the packet goal; report the exact boundary used. |
| Research summary loses nuance | Keep allowed raw excerpts/transcriptions beside the inference, with canonical URL, retrieval date, and citation locator. Re-read the source before relying on disputed claims. |
| Evidence or branch may be stale | Record revision and retrieval time. Re-check the current source or checkout before integration; treat old evidence as a lead. |
| Context, cache, or platform does not preserve worker state | Treat `/tmp` as ephemeral. Verify artifact location and revision; resume from confirmed files only, or report that no durable checkpoint is available. |
| Requested model or effort is unavailable | Report the unavailable label and mapping options. Wait for the orchestrator's choice; do not substitute silently. |
| Worker claims a check passed without evidence | Ask for exact command, exit status, and log locator; rerun or inspect the relevant check before accepting it. |
| Compaction or model switch is needed | Checkpoint orchestrator and worker separately: plan, state, revision, artifacts, commands/results, and next action. Verify both on resume. |
| Bug repeats or work stops progressing | Pause the loop; provide hypothesis, minimal reproduction, attempts, and relevant transcript/output. Orchestrator decides the next packet or escalation. |
| Optional human preference times out | Record the assumption and use a reversible default; continue independent tasks. |
| Approval, credentials, or irreversible action is required | A timeout is not consent. Stop dependent work and wait for explicit authorization or required credentials. |

Vendor Fusion descriptions motivate separating lead decisions from bounded sidekick work. They do not establish persistence guarantees, model availability, or the model/effort pairing specified by this workflow. See [Devin CLI](https://devin.ai/cli) for the cited product description.

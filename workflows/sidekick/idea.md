---
llm_index: true
verbosity: low
status: [draft]
generated_by_llm:
  model: codex
changelog:
  - 67c6fcc27 26/10/21 [codex             ] define single-sidekick context and delivery contract
---

# Sidekick: dense decisions, local exploration

Use existing harness delegation to ship one bounded product deliverable. Keep exploratory tool traffic in one reusable worker context; return only the evidence needed for the next decision. This is a prompt workflow, with no scheduler, routing service, or cross-harness memory prerequisite.

| Role | Requested model | Owns |
|---|---|---|
| Orchestrator | `opus-5.5[any]` or `gpt-6.1-sol[any]` | Direction, milestones, architecture, deployment design, review, research synthesis, concise idea documentation |
| Single sidekick | `gpt-6-luna[hi/xhi]` | Most file/web/codebase scouting; sequential implementation, tests, lint/format, troubleshooting, substantial documentation from an approved outline |

These are requested routing labels, not availability claims. Resolve them to the harness's actual model/effort settings. Reuse the same worker while available; persistence and cache hits depend on the harness and provider.

The orchestrator first defines observable acceptance and a deployment path: artifact, target, configuration/secrets boundary, launch/update procedure, health evidence, rollback. Then assign one bounded milestone at a time, review its diff and evidence, request fixes, and advance. Deployment follows existing authorization. Ask humans for essential setup/input early; keep independent work moving. Optional preferences may time out to a stated reversible default; required inputs and approval remain blocking.

The information boundary is a task packet and a compact evidence packet. Every code locator includes file, qualified symbol, and revision; every research claim points to source and retained evidence. Keep permitted source material/tool transcripts outside the conversation, distinguish observation from inference, and retrieve only targeted excerpts for synthesis. Compaction checkpoints preserve decisions and evidence separately for both roles; coordinate rare model changes with those checkpoints, especially escalation on a stubborn bug.

Use [SKILL.md](SKILL.md) as the hand-down prompt; consult the top failure cases in [caveats.md](caveats.md) when relevant. Evaluate on a real deliverable: completed acceptance, orchestrator context growth, correction/re-read count, and latency/cost where measurable. Context reduction is useful only if the delivered result stays correct.

Inspiration: the requested [Devin Fusion URL](https://devin.ai/fusion) was inaccessible during research; [Devin CLI](https://devin.ai/cli) describes a frontier lead and cheaper sidekick with separate context for exploration and tests (retrieved 2026-10-21). Persistent-worker reuse, these model pairings, and sequential code authorship are this proposal's choices.

### brainstorms

- [sidekick-replies] agree upon a shared canvas for session if it's a
long-running session. shifts context space on answering in-loop human question
from orchestrator model into efficient model instead of intelligent model.
this does require the orchestrator to put info onto sidekick and hope it sticks.
with enough good context in sidekick, and sidekick's sane intelligence level,
should be preferred over

# AGENTS.md

## Project Specifications & References (Single Source of Truth)

AI agents working on this project must consult and adhere to the following specification documents:

1. **Primary PRD (Active Architecture & Feature Spec):**
   * [`PRD_DESKTOP_TAURI.md`](PRD_DESKTOP_TAURI.md)
   * **Target:** Windows Desktop Application (`.exe` / `.msi` via Tauri v2 + Rust + React + Remotion).
   * **Key Priorities:** TikTok-First (P0), Local Rendering (Rp 0 / Zero Cloud Costs), Video Stock Inventory, Scheduling & Account Analytics (Views, Likes, Followers).
2. **Cloud/Serverless Architecture Reference (Secondary/Legacy):**
   * [`PRD_VERCEL_OPTIMIZED.md`](PRD_VERCEL_OPTIMIZED.md)
   * Reference for web/cloud concepts if hybrid features are requested.
3. **Original Background PRD:**
   * `PRD - Platform Otomasi Konten Sosmed dengan Remotion.docx`
   * Initial concept draft for Remotion-based automated social media video generation.

---

## Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes, derived from Andrej Karpathy's observations on LLM coding pitfalls.

**Tradeoff:** These guidelines prioritize caution and precision over raw speed. For trivial tasks, exercise appropriate judgment.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- **State assumptions explicitly:** If uncertain, ask rather than guess.
- **Present alternatives:** If multiple valid interpretations exist, lay them out—do not pick one silently.
- **Surface simpler solutions:** If a simpler approach exists, mention it. Push back respectfully when warranted.
- **Stop when confused:** If something is ambiguous or contradicts the existing setup, stop and ask.

---

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- **No unrequested features:** Implement only what was directly asked.
- **No speculative abstractions:** Avoid creating classes, wrappers, or generic patterns for single-use code.
- **No unnecessary configurability:** Do not over-parameterize code unless required.
- **No handling for impossible cases:** Avoid defensive clutter for scenarios that cannot happen in practice.
- **Conciseness rule:** If a solution takes 200 lines but could cleanly fit in 50, rewrite and simplify it.

> *The test:* Would a senior engineer consider this overcomplicated? If yes, simplify.

---

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- **Preserve surrounding code:** Do not modify adjacent formatting, comments, or style unless explicitly asked.
- **No drive-by refactoring:** Do not refactor code that is working and unrelated to the task.
- **Respect codebase style:** Match existing idioms and naming conventions.
- **Dead code awareness:** If you notice unrelated dead code, mention it instead of silently deleting it.

When your changes create orphans:
- Remove imports, variables, or functions that became unused *because of your changes*.
- Do not purge pre-existing unused elements without instruction.

> *The test:* Every changed line in the diff should trace directly back to the user's request.

---

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform vague or imperative tasks into verifiable goals:
- Instead of *"Add validation"*, define: *"Write tests or checks for invalid inputs, then verify they pass."*
- Instead of *"Fix the bug"*, define: *"Reproduce the failure first, then verify the fix resolves it without regressions."*
- Instead of *"Refactor X"*, define: *"Ensure test suite/behavior passes before and after the change."*

For multi-step implementations, maintain a lightweight verification plan:
```text
1. [Step 1] -> verify: [Verification check]
2. [Step 2] -> verify: [Verification check]
3. [Step 3] -> verify: [Verification check]
```

---

## Success Indicators

These guidelines are functioning effectively when:
- Diffs contain zero unrelated modifications.
- Solutions avoid premature abstractions and remain easy to read.
- Clarifying questions are raised **before** committing to flawed implementations.
- PRs/commits remain minimal, clean, and directly tied to requirements.


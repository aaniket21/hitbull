# AGENT_RULES.md — Universal Agent Rulebook

> **THIS FILE IS THE SINGLE SOURCE OF TRUTH FOR ALL AI AGENTS ON THIS PROJECT.**
> Every AI model (Claude, Gemini, GPT, or any other) MUST read this file before doing anything.
> All rules are MANDATORY for every session, every model, every task.
> The only exception is if the human user explicitly says:
> `"Override rule: [rule name] for this step only"` OR `"Override rule: [rule name] for this entire session"`

---

## 🔴 PRIME DIRECTIVE — READ THIS FIRST

You are a disciplined software engineering agent on this project. It does not matter which AI model you are. These rules apply to you equally. Follow every rule below on every execution without exception.

**Before doing ANY work, complete this startup sequence in order:**
1. Read AGENT_RULES.md (this file) — confirm all rules are loaded
2. Read PRD.md — understand project requirements
3. Read TASK_LIST.md — understand current phase and next task (create it if missing)
4. Output the AGENT READY confirmation block (format defined in Rule 0 below)
5. Wait for the user to assign a task

---

## 📋 RULE 0 — Session Startup

> **Applies to:** Every model, every session, without exception.

At the start of every session, before any code or action, output this block exactly:

```
### 🤖 AGENT READY

Model: [State which AI model you are]
AGENT_RULES.md: ✅ Loaded — [N] rules active
PRD.md: ✅ Read | Project: [project name] | [one line summary]
TASK_LIST.md: ✅ Loaded | Phase: [current phase] | Next task: [next task name]

Active rules: TDD | PRD Reference | Task Tracking | Code Quality | Clarification First | Small Steps Only | Model Handoff

⏸️ Ready. Tell me which feature or task to begin.
```

**If PRD.md does not exist:**
Output: `⚠️ PRD.md not found. Please fill in PRD.md before I begin implementing anything.`

**If TASK_LIST.md does not exist:**
Create it immediately using the format in Rule 3, then continue startup.

---

## 📋 RULE 1 — Test-Driven Development (TDD)

> **Purpose:** Every feature must be provably correct before it is considered done.

Every feature implementation MUST follow this exact cycle with no shortcuts:

### The TDD Cycle

**Step 1 — Write a FAILING test**
Write the test first. No implementation code exists yet. Run it. Confirm it fails.

**Step 2 — Write MINIMAL implementation**
Write only enough code to make that one test pass. Nothing extra.

**Step 3 — Refactor**
Improve structure, readability, naming. Do not change behaviour. All tests still pass.

### Hard Prohibitions

❌ Never write implementation before a test exists
❌ Never implement multiple features in one step
❌ Never skip the failing test confirmation
❌ Never generate a full solution in one response

### Step Output Format

After EVERY step, stop and output this format exactly:

```
### ✅ STEP COMPLETE: [Step name]

What was done: [1–3 sentences — what changed and why]
Test status: FAILING / PASSING
Files changed: [list files]
Suggested commit: `[type]: [short description]`
(type = feat | fix | test | refactor | chore)
Next step: [one sentence describing only the next action]

⏸️ Awaiting confirmation. Reply "yes" or "proceed" to continue.
```

**Do NOT proceed until the user confirms.**
Exception: if session-wide override is active (see Rule 6), auto-proceed.

---

## 📋 RULE 2 — PRD Reference

> **Purpose:** Every decision traces back to a written requirement. Nothing is invented.

- Read PRD.md before implementing any feature, every time
- Every implementation decision must trace back to a requirement in PRD.md
- If a requirement is unclear or missing, ask before writing code:
  `"Before I proceed — [specific question about PRD]?"`
- Reference PRD sections explicitly when implementing:
  `"Per PRD.md Feature 2 — User Auth..."`
- Never invent or assume requirements not written in PRD.md

---

## 📋 RULE 3 — Task Tracking

> **Purpose:** No work is ever lost or repeated. Every session picks up exactly where the last one ended.

Maintain these two files throughout every session:

- **TASK_LIST.md** — current and upcoming tasks (never delete — move to PREVIOUS_TASKS.md)
- **PREVIOUS_TASKS.md** — archive of all completed tasks with module labels and commit references

### TASK_LIST.md Format

```markdown
# TASK LIST
Last Updated: [date]
Current Phase: [phase name]
Active Model: [AI model name]

## 🔁 LAST SESSION HANDOFF
Model: [model name]
Date: [date]
Completed this session: [list]
Stopped at: [exact task and step]
Next action needed: [one sentence]

## 🔵 Phase 1 — [Phase Name]
- [x] Completed task
- [~] Task currently in progress
- [ ] Pending task

## 🔵 Phase 2 — [Phase Name]
- [ ] Task
```

### PREVIOUS_TASKS.md Format

```markdown
# PREVIOUS TASKS (Completed)

## Module: [Module Name]
- [x] Task description | Date: [date] | Model: [AI model] | Commit: `type: description`
```

### Tracking Rules

- Update TASK_LIST.md after every single step
- Move completed tasks to PREVIOUS_TASKS.md — never delete them
- Mark in-progress tasks with [~] and completed with [x]
- Always record which AI model completed each task in PREVIOUS_TASKS.md

---

## 📋 RULE 4 — Code Quality

> **Purpose:** Every line of code is readable, maintainable, and purposeful.

- Write simple, readable, maintainable code — not clever code
- Follow clean architecture — strictly separate: UI / business logic / data / utilities
- Each function does exactly ONE thing
- Name things clearly: functions say what they do, variables say what they hold
- No dead code, no commented-out blocks, no unresolved TODOs in committed code
- If you must leave a TODO, format it as:
  `// TODO: [description] — [reason it is deferred]`

---

## 📋 RULE 5 — Clarification Before Action

> **Purpose:** Never waste time building the wrong thing because of an assumption.

If ANYTHING is unclear before starting a task:

- Stop immediately
- Ask exactly ONE specific question
- Format: `"Before I proceed — [your question]?"`
- Wait for the answer before writing a single line of code
- Never assume. Never guess. Never fill gaps silently.

---

## 📋 RULE 6 — Small Steps Only

> **Purpose:** Small steps are easier to review, easier to revert, and easier to debug.

- One logical change per step
- One test per step
- One commit message per step
- If you feel the urge to do more than one thing, stop and ask:
  `"This could be split into [N] steps. Do you want me to batch them or go one at a time?"`

### Override Options

| Override | Trigger | Effect |
|----------|---------|--------|
| Per-step | User says `"Override rule: confirmation wait for this step only"` | Skip confirmation for that one step only, then revert |
| Session-wide | User says `"Override rule: confirmation wait for this entire session"` | Auto-proceed through all steps, only stop at blockers |

When session-wide override is active:
- Auto-proceed through all steps without waiting for confirmation
- Only stop if you hit a blocker that requires user input
- State the blocker clearly and wait for input before continuing

---

## 📋 RULE 7 — Model Handoff Protocol

> **Purpose:** Any AI model can pick up exactly where the previous one stopped, with no context lost.

### When you START a session

- Read TASK_LIST.md to understand what the previous model did
- Read PREVIOUS_TASKS.md to see full history
- Do NOT redo completed work
- Do NOT contradict architectural decisions already made unless the user asks
- If you notice something wrong in previous work, flag it:
  `"I noticed [issue] in [file] from a previous session. Should I fix it before continuing?"`

### When you END a session or hand off

- Ensure TASK_LIST.md is fully up to date
- Ensure all completed tasks are in PREVIOUS_TASKS.md with your model name recorded
- Write a handoff note at the top of TASK_LIST.md:

```markdown
## 🔁 LAST SESSION HANDOFF
Model: [your model name]
Date: [date]
Completed this session: [list tasks]
Stopped at: [exact task name and step]
Next action needed: [one sentence]
```

---

## 📋 How to Modify These Rules

> For the project owner — instructions on managing this rulebook.

**Add a rule:** Add a new `## 📋 RULE [N] — [NAME]` section following the format above. Be specific. Use ❌ for hard stops.

**Remove a rule:** Delete that rule's section entirely.

**Disable temporarily:** Wrap in `<!-- DISABLED ... DISABLED -->` comment block.

**Override for one step:** Say `"Override rule: [name] for this step only"`

**Override for session:** Say `"Override rule: [name] for this entire session"`

**Force agent to re-read:** Say `"Re-read AGENT_RULES.md"`

---

*AGENT_RULES.md — Last updated: 2026-05-10 | Rules: 8 (Rule 0 through Rule 7)*
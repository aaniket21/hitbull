# TASK LIST
Last Updated: 2026-10-07
Current Phase: Phase 5 — Hardening and Release
Active Model: GitHub Copilot

## 🔁 LAST SESSION HANDOFF
Model: GitHub Copilot
Date: 2026-10-07
Completed this session: Fixed idempotent toolbar Start, automatic key selection for toolbar Check, and current radio-group detection for tests opened on any question number; 23 automated tests pass.
Stopped at: Manual browser verification of the real Gemini response and question-selection flow.
Next action needed: Reload the published extension and test the toolbar on Question 11 and a later question.

## 🔵 Phase 1 — Foundation and Contracts
- [x] Define v2 requirements in PRD.md
- [x] Create implementation task tracking
- [x] Record initial project planning work
- [x] Add a minimal test harness for pure JavaScript modules
- [x] Add failing tests for Gemini response parsing
- [x] Implement the minimal Gemini response parser
- [x] Add failing tests for API-key rotation and cooldown behavior
- [x] Implement the minimal key manager
- [x] Add failing tests for execution state transitions
- [x] Implement persisted execution state

## 🔵 Phase 2 — Extension Messaging and Page State
- [x] Define message types between popup, service worker, and content script
- [x] Add failing tests for question/option mapping
- [x] Implement question readiness and option discovery
- [x] Implement verified option selection
- [x] Implement reliable next-question navigation
- [x] Add pause, resume, stop, retry, and completion handling

## 🔵 Phase 3 — Gemini Integration
- [x] Add failing tests for Gemini multimodal request and error handling
- [x] Add required manifest permissions and Gemini host access
- [x] Implement visible-tab screenshot capture
- [x] Implement Gemini multimodal request handling
- [x] Connect response parsing to the current-question state
- [x] Implement serialized per-tab orchestration
- [x] Implement retry, backoff, rotation, and key cooldowns

## 🔵 Phase 4 — Popup and Settings UI
- [x] Add multiple-key management UI
- [x] Add masked key display and local-storage warning
- [x] Add model, delay, confidence, and auto-submit settings as specified
- [x] Add live run status and progress display
- [x] Add pause, resume, stop, and retry controls

## 🔵 Phase 5 — Hardening and Release
- [ ] Test slow page loads and delayed navigation in a live Hitbullseye session
- [x] Test malformed Gemini responses
- [x] Test quota failures and exhausted keys
- [x] Test popup closure and service-worker suspension recovery through persisted-state tests
- [x] Test final-question completion behavior through completion-state tests
- [x] Run JavaScript syntax checks and focused tests
- [x] Update README.md with v2 setup and privacy notes
- [x] Align extension, popup, and documentation version numbers
- [x] Create the manual browser testing checklist
- [x] Update Gemini default model to 3.5 Flash-Lite with 3.5 Flash alternative
- [x] Add Firefox Manifest V3 background-script compatibility

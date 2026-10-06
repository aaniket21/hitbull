# Product Requirements Document

## Project
Hitbullseye Automate Tool v2

## Purpose
Upgrade the existing Chrome extension so a user can provide multiple Gemini API keys, have the extension capture the visible test question, ask Gemini to identify the correct option, select that option, and continue through the test until completion or manual stop.

## Scope

### In Scope
- Chrome Manifest V3 extension support.
- Firefox Manifest V3 temporary-add-on support.
- Multiple Gemini API key storage and management.
- Visible-tab screenshot capture for each question.
- Gemini multimodal request using the screenshot.
- Strict answer parsing from Gemini responses.
- Automatic option selection and next-question navigation.
- Start, pause, resume, stop, retry, and progress status.
- API-key rotation and temporary cooldown after quota or rate-limit failures.
- Persistent execution state so closing the popup does not stop the active run.
- Defensive handling of slow page loads, missing options, navigation failures, malformed responses, and API errors.
- User-visible status and error messages.

### Out of Scope
- A remote backend server.
- Storage of API keys outside the local browser profile.
- Capturing the full desktop or other browser tabs.
- Solving questions without a visible test page.
- Automatic submission without an explicit completion policy in the settings.

## Functional Requirements

### Feature 1 — API Key Management
1. The user can add any number of Gemini API keys.
2. The user can remove a key and enable or disable it.
3. Keys are stored using Chrome extension storage.
4. Keys are never written to logs, page content, or visible error messages.
5. The UI shows masked keys and basic status only.
6. The user can test a key before starting automation.
7. The user receives a warning that local extension storage is not a secure secrets vault.

### Feature 2 — Gemini Answering
1. For the active question, the extension captures the visible browser tab.
2. The screenshot is sent to Gemini as image input.
3. The request asks Gemini to return one option identifier and a confidence value as JSON.
4. The extension rejects malformed, missing, or ambiguous answers.
5. The extension does not advance to the next question until a valid answer is received.
6. The model name and request delay are configurable where practical.

### Feature 3 — Key Rotation
1. Requests use only enabled keys.
2. Keys are rotated after HTTP 401, 403, 429, quota, or rate-limit failures.
3. Failed keys enter a temporary cooldown.
4. Transient failures use bounded retries and backoff.
5. The run stops with a clear error when no usable key remains.
6. Requests are serialized per tab to preserve question order.

### Feature 4 — Question Automation
1. The content script detects the current question and available options.
2. The extension waits for the question DOM to be ready before capturing.
3. The answer returned by Gemini is mapped to an actual option element.
4. The option is selected and verified before navigation.
5. The extension waits for the next question to load instead of relying only on a fixed interval.
6. The extension detects completion and does not click missing elements.
7. The user can stop automation at any point.
8. The extension does not submit the test unless the user enables an explicit auto-submit setting.

### Feature 5 — Controls and Progress
1. The user can start a run from the popup.
2. The user can pause and resume without losing the current question.
3. The user can stop the run and cancel pending work.
4. The user can retry the current question after an error.
5. The popup shows running state, current question, completed count, active key status, and last error.
6. Execution state survives popup closure and service-worker suspension.

## Technical Requirements

### Extension Components
- `manifest.json`: permissions, host permissions, popup, service worker, and content scripts.
- `background.js`: orchestration, screenshot capture, Gemini requests, key rotation, state persistence, and message routing.
- `content.js`: page detection, question readiness, option selection, navigation, and completion reporting.
- `popup/`: controls, key management, progress display, and settings.
- Utility modules may be added for storage, Gemini requests, state management, and response validation.

### Permissions
Use the minimum permissions required for active-tab capture, extension storage, tab communication, scripting, and Gemini API requests. Do not add broad host access unless required by the implementation.

Chrome uses the Manifest V3 service worker background, while Firefox uses the Manifest V3 background script fallback from the same manifest.

### Gemini Response Contract
The preferred response shape is:

```json
{
  "answer": "A",
  "confidence": 0.95
}
```

`answer` must match one visible option. `confidence` must be a number from 0 to 1. Extra model text must not be trusted as structured output.

### Security and Privacy
- API keys remain local to the browser profile.
- Do not include API keys in console output, exceptions, screenshots, or messages to the content page.
- Screenshots are sent to the configured Gemini endpoint only.
- The UI must explain that extension-local storage does not provide strong secret protection.

## Acceptance Criteria
- A user can add two or more keys and start a run.
- A visible question is captured and sent to Gemini.
- A valid Gemini answer selects the matching option and advances exactly once.
- A failed key rotates to another usable key without losing the current question.
- Pause and stop prevent further screenshots, API requests, and clicks.
- Slow navigation does not cause duplicate clicks or skipped questions.
- Closing and reopening the popup shows the current run status.
- Malformed Gemini output produces an actionable error and does not advance.
- The run completes without uncaught errors when the page reaches its final question.

## Non-Functional Requirements
- Keep the implementation dependency-free unless a dependency materially improves reliability.
- Preserve the existing extension's simple load-unpacked workflow.
- Keep modules small and responsibilities separated.
- Add focused tests for pure logic such as response parsing, key rotation, state transitions, and option mapping.

# Hitbullseye Automate Tool v2

Chrome extension for processing multiple-choice questions on the Hitbullseye online test page with Gemini image understanding.

## What v2 Does

- Stores multiple Gemini API keys locally and lets you enable, disable, remove, or test each key.
- Captures the visible test tab for the current question.
- Sends the screenshot to Gemini and requires a structured option letter plus confidence.
- Selects and verifies the matching radio option before moving forward.
- Rotates enabled keys after authentication, quota, rate-limit, or server failures.
- Supports start, pause, resume, retry, and stop controls.
- Persists run state when the popup closes or the service worker is suspended.
- Stops on malformed answers, missing controls, low confidence, or navigation errors instead of guessing.

## Installation

### Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode**.
3. Select **Load unpacked**.
4. Choose this project directory.

### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Select **Load Temporary Add-on...**.
3. Select this project’s `manifest.json`.
4. Keep the Firefox window open while testing; temporary add-ons are removed when Firefox restarts.

After installation in either browser, open a supported Hitbullseye test page, open the extension popup, and add one or more Gemini API keys. Use **Test** beside each key, configure the model and pacing, then select **Start**.

## Normal Workflow

1. Open the Hitbullseye dashboard or test page.
2. Open the extension popup and add at least one Gemini API key.
3. Click **Check** beside a key. The extension captures the current visible page and shows either Gemini's answer or `No question detected`.
4. Choose the Gemini model and adjust delay or confidence.
5. Click **Save** to store changed settings.
6. Click **Start**. From the dashboard, the extension waits for the `online_load` test page; from an already-open test page, it starts immediately.
7. When the test page opens, the extension attempts to enter fullscreen, captures each visible question, asks Gemini, selects the returned option, and moves to the next question.
8. Use **Pause**, **Resume**, or **Stop** at any time. Stop restores the previous window state when possible.
9. Use **Retry** after a recoverable error.

The extension has no build step and is intended to remain loadable as an unpacked Manifest V3 extension.

## API Keys and Privacy

Keys are stored in `chrome.storage.local` and are sent only to the configured Gemini API endpoint. They are masked in the popup and never included in page messages or extension logs.

Chrome extension-local storage is not a secure secrets vault. Do not use this extension on a shared or untrusted browser profile. Screenshots contain the visible browser viewport and are sent to Gemini for analysis.

## Controls

- **Start** begins at the current test question.
- **Pause** stops new processing while preserving progress.
- **Resume** continues from the current question.
- **Retry** retries a run that stopped on an error.
- **Stop** cancels the active workflow.
- **Minimum confidence** prevents advancement when Gemini is uncertain.
- **Auto-submit** is disabled by default and must be explicitly enabled.

The default model is `gemini-3.5-flash-lite`. `gemini-3.5-flash` is also available in the model selector.

## Limitations

- Only `onlinetest.hitbullseye.com` pages matching the extension manifest are supported.
- Screenshot capture covers the visible tab viewport, not the full desktop or another monitor.
- The page must remain the active visible tab while a screenshot is captured.
- API quota, network availability, and Gemini response quality affect the run.
- The extension does not include a backend service or external key vault.

## Development

Run the dependency-free test suite with:

```powershell
npm test
```

The tests cover Gemini response parsing, API-key rotation and cooldowns, run-state transitions, persistence, option mapping, Gemini requests, and key validation.

## Author

- **Author:** Aniket Kumar
- **GitHub:** [aaniket21](https://github.com/aaniket21/hitbull)

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).

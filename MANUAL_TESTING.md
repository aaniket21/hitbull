# Manual Testing Checklist

## Test Setup

- [ ] Use Chrome with the unpacked extension loaded from this project directory.
- [ ] Have one valid Gemini API key available.
- [ ] Have a second valid Gemini API key available for rotation testing.
- [ ] Have an invalid or revoked Gemini API key available for failure testing.
- [ ] Open a real Hitbullseye online test page at `onlinetest.hitbullseye.com/online_load`.
- [ ] Ensure the test page is the active visible tab during automation.
- [ ] Record Chrome version, extension version, Gemini model, and test date.

## 1. Installation and Popup

### 1.1 Load the extension
- [ ] Open `chrome://extensions/`.
- [ ] Enable Developer mode.
- [ ] Load the project folder as an unpacked extension.
- Expected: the extension loads without a manifest or service-worker error.

### 1.2 Open the popup outside a test page
- [ ] Open the popup on a normal webpage.
- Expected: the popup opens and shows the v2 controls.
- Expected: no API key is shown in plaintext.

### 1.3 Popup reload
- [ ] Close and reopen the popup several times.
- Expected: saved keys and settings remain visible.
- Expected: popup opening does not start or stop an existing run.

## 2. Gemini Key Management

### 2.1 Add keys
- [ ] Add the first valid key.
- [ ] Add the second valid key.
- Expected: both appear masked, showing only their final characters.
- Expected: the key count is correct.

### 2.2 Duplicate key protection
- [ ] Try to add the same key again.
- Expected: no duplicate row is created.

### 2.3 Disable and enable
- [ ] Disable one key.
- [ ] Reload the popup.
- Expected: the key remains disabled.
- [ ] Enable it again.
- Expected: the key is available for future requests.

### 2.4 Remove a key
- [ ] Remove one key.
- [ ] Reload the popup.
- Expected: the removed key is no longer listed or used.

### 2.5 Test a valid key
- [ ] Open a visible question and click **Check** beside a valid key.
- Expected: the current screenshot is sent to Gemini.
- Expected: the popup shows an answer and confidence response without changing the browser page.
- Expected: the key value is not shown in the response.

### 2.6 Test an invalid key
- [ ] Add or enable an invalid key.
- [ ] Click **Check**.
- Expected: a clear failure is shown.
- Expected: the API key itself is not displayed in the error.

### 2.7 Check with no question
- [ ] Open the Hitbullseye dashboard or another page without a visible question.
- [ ] Click **Check** beside an enabled key.
- Expected: the popup shows `No question detected`.
- Expected: no option is selected and the page does not navigate.

## 3. Settings

### 3.1 Model setting
- [ ] Set the Gemini model field to the intended model.
- [ ] Reload the popup.
- Expected: the model setting persists.

### 3.2 Delay setting
- [ ] Move the question-delay slider to a visibly longer delay.
- [ ] Start a run later and observe the gap between navigation and processing.
- Expected: the configured delay is applied before the next question is clicked.

### 3.3 Confidence setting
- [ ] Set minimum confidence to a high value such as 95%.
- Expected: an answer below that value stops the run with an error and does not advance.
- [ ] Restore the confidence threshold to a practical value for normal testing.

### 3.4 Auto-submit disabled
- [ ] Confirm auto-submit is disabled.
- Expected: completing the final question does not submit the test automatically.

## 4. Basic Question Workflow

### 4.1 Start
- [ ] Add and enable at least one valid key.
- [ ] Open the extension popup on the active test page.
- [ ] Click **Start**.
- Expected: status changes from Ready to an active state.
- Expected: the current visible question is captured.
- Expected: Gemini receives the screenshot.

### 4.2 Answer selection
- [ ] Watch the first question after Gemini responds.
- Expected: exactly one matching option is selected.
- Expected: the selected option remains checked before navigation.
- Expected: no unrelated option is clicked.

### 4.3 Next-question navigation
- [ ] Observe the first transition.
- Expected: the next control is clicked once.
- Expected: the extension waits for the next question to appear.
- Expected: the next question is processed once, without duplicate API requests or duplicate clicks.

### 4.4 Four-step workflow check
- [ ] Open the popup while a run is active.
- Expected: progress identifies the current stage as Capture screenshot, Analyze answer, Select option, or Save & Next.
- Expected: the stage does not advance when Gemini fails or when the radio option cannot be checked.
- Expected: Save & Next is clicked only after the selected radio input is visibly checked.

### 4.4 Progress display
- [ ] Reopen the popup while the run is active.
- Expected: the popup shows active status, question progress, completed count, and the last known key identifier/status.

## 5. Pause, Resume, Stop, and Retry

### 5.1 Pause during processing
- [ ] Click **Pause** while Gemini is processing or while the page is waiting.
- Expected: no new screenshot, answer click, or next navigation occurs after the pause takes effect.
- Expected: current progress remains intact.

### 5.2 Resume
- [ ] Click **Resume**.
- Expected: processing resumes from the current question rather than restarting the test.

### 5.3 Stop during delay
- [ ] Start a run with a long question delay.
- [ ] Click **Stop** before navigation occurs.
- Expected: the pending navigation is cancelled.
- Expected: no further question is captured or clicked.

### 5.4 Retry after an error
- [ ] Cause a recoverable error, such as disabling all keys temporarily or using an invalid model.
- [ ] Confirm the run enters an error state.
- [ ] Restore the configuration and click **Retry**.
- Expected: the current question is retried.
- Expected: completed-question count is not reset.

## 6. Key Rotation and API Failures

### 6.1 Invalid first key, valid second key
- [ ] Put an invalid key before a valid key in the list.
- [ ] Start a run.
- Expected: the invalid key fails without exposing its value.
- Expected: the next enabled key is used.
- Expected: the current question is not skipped.

### 6.2 Disabled key is ignored
- [ ] Disable the valid key and leave only the invalid key enabled.
- [ ] Start or retry.
- Expected: the run stops with a clear no-usable-key or API error.

### 6.3 Temporary API failure
- [ ] Use a key/API condition that returns a rate-limit or quota response when available.
- Expected: bounded retries occur.
- Expected: the failed key enters cooldown.
- Expected: another enabled key is attempted before the current question is abandoned.

## 7. Slow Page and Navigation Behavior

### 7.1 Slow question load
- [ ] Use browser throttling or a naturally slow test page if available.
- [ ] Start or continue a run.
- Expected: the extension waits for the option group rather than clicking missing elements.
- Expected: no duplicate question processing occurs.

### 7.2 Navigation timeout
- [ ] Prevent the next question from loading, if safely reproducible.
- Expected: the run stops after the timeout with an actionable error.
- Expected: it does not poll forever or keep sending screenshots.

## 8. Completion and Submission

### 8.1 Final question with auto-submit disabled
- [ ] Process a test through its final question.
- Expected: status becomes completed.
- Expected: the test is not submitted automatically.

### 8.2 Final question with auto-submit enabled
- [ ] Enable auto-submit.
- [ ] Run a test through its final question.
- Expected: completion is detected.
- Expected: the submission confirmation controls are activated once.

## 9. Persistence and Recovery

### 9.1 Close popup during a run
- [ ] Start a run.
- [ ] Close the popup while Gemini or navigation is active.
- [ ] Reopen the popup.
- Expected: the run continues or shows its persisted state.
- Expected: question progress is not reset.

### 9.2 Reload extension during an idle state
- [ ] Stop the run.
- [ ] Reload the extension from `chrome://extensions/`.
- [ ] Reopen the popup.
- Expected: keys and settings remain stored.

### 9.3 Service-worker suspension
- [ ] Leave the extension idle long enough for the service worker to suspend, if observable.
- [ ] Reopen the popup or resume a paused run.
- Expected: persisted state loads without an uncaught error.

## 10. Privacy and Error Checks

- [ ] Inspect the extension service-worker console during a run.
- Expected: no API key appears in logs.
- [ ] Inspect content-page messages and visible toasts.
- Expected: no API key appears in page content or errors.
- [ ] Confirm screenshots are only sent while a run is active.
- [ ] Confirm stopping the run prevents additional API requests.

## Test Report

Date:

Chrome version:

Extension version:

Gemini model:

Passed cases:

Failed cases:

Console errors:

Screenshots or notes:

Reproduction steps for failures:

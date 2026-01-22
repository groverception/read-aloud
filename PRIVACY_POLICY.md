# Privacy Policy for Read Aloud

**Last updated: January 22, 2026**

This Privacy Policy describes how Read Aloud ("we", "us", or "our") handles your information in connection with the Read Aloud Chrome Extension (the "Extension").

## 1. Information Collection and Use

**We do not collect, transmit, or store any personal information.**

The Extension operates entirely locally on your device. It interacts with the content of the web pages you visit (specifically x.com and twitter.com) solely for the purpose of converting text to speech using your browser's built-in Web Speech API.

### Usage of Data

-   **Web Page Content**: The Extension temporarily reads the text content of the articles you view on X (Twitter) to process it for audio playback. This data is processed in your browser's memory and is not sent to any external servers.
-   **User Preferences**: We store your preferences (such as selected voice, reading speed, and player position) locally on your device using the Chrome Storage API (`chrome.storage`). This data never leaves your browser.

## 2. Third-Party Services

The Extension uses the `SpeechSynthesis` API provided by your web browser (Google Chrome). The voice synthesis is handled by your browser and operating system. Please refer to Google Chrome's privacy policy for information on how they handle speech synthesis data.

The Extension does not use any third-party analytics, tracking tools, or advertising services.

## 3. Data Retention

Since we do not collect any user data, we do not retain any user data. Your local preferences stored in `chrome.storage` persist on your device until you uninstall the Extension or clear your browsing data.

## 4. Permissions

The Extension requires the following permissions to function:

-   **activeTab**: To detect user interactions and trigger reading commands.
-   **scripting**: To display the player interface and notifications on the page.
-   **storage**: To save your reading preferences (voice, speed, etc.).
-   **Host Permissions (x.com, twitter.com)**: To detect articles and threads on X/Twitter to provide the reading functionality.

## 5. Contact Us

If you have any questions about this Privacy Policy, please contact us via our GitHub repository.

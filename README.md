# Read Aloud - X/Twitter Articles

A Chrome extension that reads Twitter/X articles aloud with natural voice using the Web Speech API.

## Features

- **Auto-detection**: Automatically detects X Articles and long-form content
- **Natural TTS**: Uses high-quality system voices via Web Speech API
- **Floating Player**: Draggable player with play/pause, stop, and skip controls
- **Voice Selection**: Choose from available system voices
- **Speed Control**: Adjustable reading speed (0.5x - 1.5x)
- **Transcript View**: See what's being read with clickable paragraphs
- **Dark Mode Support**: Automatically adapts to system theme
- **Keyboard Shortcut**: Press `Alt+R` to toggle reading

## Installation

### From Source (Developer Mode)

1. Clone this repository:
   ```bash
   git clone https://github.com/groverception/read-aloud.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" (toggle in top right)

4. Click "Load unpacked" and select the `read-aloud` folder

5. The extension icon will appear in your toolbar

## Usage

1. Navigate to any X/Twitter article (long-form content, threads, or articles)
2. The Read Aloud player will automatically appear
3. Click **Play** to start reading
4. Use the controls to pause, skip paragraphs, or stop
5. Click on any paragraph in the transcript to jump to it

## Project Structure

```
read-aloud/
├── manifest.json              # Extension manifest
├── src/
│   ├── background/
│   │   └── service-worker.js  # Background script for shortcuts & icon clicks
│   ├── content/
│   │   ├── articleParser.js   # Detects articles and extracts content
│   │   ├── content.js         # Main content script with player UI
│   │   └── content.css        # Player styles
│   └── utils/
│       └── tts.js             # Text-to-Speech wrapper module
└── icons/                     # Extension icons
```

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Test on both light and dark themes
- Ensure the extension works on various X article types
- Add comments for complex logic

### Ideas for Contribution

- [ ] Add more voice options/settings
- [ ] Implement scroll and highlight feature for article paragraphs
- [ ] Add support for other languages
- [ ] Create options page for settings
- [ ] Add reading progress persistence
- [ ] Support for X Spaces transcripts

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Anuj Grover** ([@groverception](https://github.com/groverception))

## Acknowledgments

- Built with Web Speech API (SpeechSynthesis)
- Designed for Twitter/X platform

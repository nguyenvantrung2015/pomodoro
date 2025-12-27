# Pomodoro Timer Chrome Extension

A Chrome extension that implements the Pomodoro Technique with integrated YouTube music playback during breaks.

## Features

- **Classic Pomodoro Timer**: 25-minute work sessions followed by 5-minute breaks
- **Long Breaks**: After 4 work sessions, enjoy a 15-minute long break
- **Customizable Durations**: Adjust work, break, and long break durations to your preference
- **YouTube Integration**: Set a YouTube URL to automatically play music when break time starts
- **Notifications**: Get notified when sessions complete
- **Persistent Settings**: Your preferences are saved across browser sessions

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select the `pomodoro-chrome-extension` folder

## Adding Icons

Before loading the extension, you need to add icon images to the `icons` folder:

- `icon16.png` - 16x16 pixels
- `icon48.png` - 48x48 pixels
- `icon128.png` - 128x128 pixels

You can create simple red tomato icons or use any design you prefer. There are many free icon generators online:
- https://www.favicon-generator.org/
- https://favicon.io/

Alternatively, you can use placeholder images temporarily.

## Usage

1. Click the extension icon in your Chrome toolbar to open the Pomodoro timer
2. Configure your settings:
   - **Work Duration**: How long each work session should last (default: 25 minutes)
   - **Break Duration**: How long short breaks should last (default: 5 minutes)
   - **Long Break Duration**: How long long breaks should last (default: 15 minutes)
   - **YouTube URL**: Paste a YouTube video URL to play automatically during breaks
3. Click "Save Settings"
4. Click "Start" to begin your first work session
5. When break time arrives, YouTube music will automatically open in a new tab (if configured)

## YouTube URL Format

The extension supports various YouTube URL formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`

## How It Works

The Pomodoro Technique follows this cycle:
1. Work for 25 minutes (configurable)
2. Take a 5-minute break (configurable)
3. Repeat steps 1-2 three more times
4. Take a longer 15-minute break (configurable)
5. Repeat from step 1

## Development

### File Structure

```
pomodoro-chrome-extension/
├── manifest.json       # Extension configuration
├── popup.html          # Popup UI structure
├── popup.css           # Popup styling
├── popup.js            # Popup logic and user interactions
├── background.js       # Background service worker (timer logic)
├── icons/              # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # Documentation
```

### Key Technologies

- **Manifest V3**: Latest Chrome extension format
- **Chrome Storage API**: Persistent settings storage
- **Chrome Notifications API**: Session completion notifications
- **Chrome Alarms API**: Keep service worker alive
- **Service Workers**: Background timer management

## Customization

You can easily customize:
- Default timer durations in `background.js` (lines 5-9)
- UI colors and styling in `popup.css`
- Notification messages in `background.js` (handleSessionComplete function)

## Troubleshooting

**Timer stops working after a while**
- This is due to Chrome's service worker lifecycle. The extension uses alarms to keep it active, but occasionally Chrome may still suspend it. Simply click the extension icon to reactivate it.

**YouTube doesn't autoplay**
- Some browsers may block autoplay. You may need to interact with the YouTube tab for the video to start playing.
- Make sure you've entered a valid YouTube URL in the settings.

**Settings not saving**
- Make sure you click "Save Settings" after making changes
- Check that you have sync enabled in Chrome

## License

MIT License - Feel free to modify and use this extension as you wish!

## Credits

Created with Claude Code

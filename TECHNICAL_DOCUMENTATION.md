# Pomodoro Chrome Extension - Technical Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [File Structure](#file-structure)
3. [Core Technologies](#core-technologies)
4. [Detailed Code Explanation](#detailed-code-explanation)
5. [Data Flow](#data-flow)
6. [Chrome APIs Used](#chrome-apis-used)

---

## Architecture Overview

This is a Chrome Extension built using **Manifest V3** (the latest Chrome extension format). The extension follows a **background service worker architecture** with the following components:

```
┌─────────────────┐
│   popup.html    │ ← User Interface (UI)
│   popup.css     │
│   popup.js      │ ← UI Logic & User Interactions
└────────┬────────┘
         │
         │ chrome.runtime.sendMessage()
         │ chrome.storage API
         ↓
┌─────────────────┐
│ background.js   │ ← Core Timer Logic & YouTube Control
│ (Service Worker)│ ← Chrome Alarms & Notifications
└─────────────────┘
```

### Key Architectural Decisions:

1. **Separation of Concerns**: UI logic (popup.js) is separated from business logic (background.js)
2. **Persistent Storage**: Uses Chrome Storage API for settings and timer state
3. **Message Passing**: Communication between popup and background via Chrome's messaging system
4. **Service Worker**: Background script runs as a service worker (Manifest V3 requirement)
5. **Tab Control**: Uses Chrome Scripting API to inject scripts and control YouTube playback

---

## File Structure

```
pomodoro-chrome-extension/
│
├── manifest.json              # Extension configuration & permissions
├── popup.html                 # UI structure (HTML)
├── popup.css                  # UI styling (CSS)
├── popup.js                   # UI logic & event handlers
├── background.js              # Core timer & YouTube control logic
├── icons/                     # Extension icons (16, 48, 128px)
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── create-icons.html          # Icon generator utility
└── README.md                  # User documentation
```

---

## Core Technologies

### 1. **Chrome Extension APIs**
- `chrome.storage` - Persistent data storage
- `chrome.runtime` - Message passing between components
- `chrome.alarms` - Scheduled tasks & timers
- `chrome.notifications` - Desktop notifications
- `chrome.tabs` - Tab management
- `chrome.scripting` - Script injection for YouTube control

### 2. **JavaScript (ES6+)**
- Async/await for asynchronous operations
- Arrow functions
- Template literals
- Destructuring
- Modern DOM manipulation

### 3. **CSS3**
- CSS Variables (Custom Properties)
- Flexbox layout
- CSS Grid (for settings layout)
- Animations & Transitions
- Gradients & Shadows

---

## Detailed Code Explanation

### **manifest.json** - Extension Configuration

```json
{
  "manifest_version": 3,
  "name": "Pomodoro Timer with YouTube",
  "version": "1.0.0",
  "permissions": [
    "storage",      // Store settings & state
    "notifications", // Show desktop notifications
    "alarms",       // Schedule day start sessions
    "tabs",         // Query & manage tabs
    "scripting"     // Inject scripts to control YouTube
  ],
  "host_permissions": [
    "*://*.youtube.com/*"  // Access YouTube domains
  ],
  "action": {
    "default_popup": "popup.html"  // Popup UI
  },
  "background": {
    "service_worker": "background.js"  // Background script
  }
}
```

**Key Points:**
- Manifest V3 uses `service_worker` instead of background pages
- `host_permissions` required for accessing YouTube domains
- `action` defines what happens when extension icon is clicked

---

### **background.js** - Core Business Logic

This file contains all the timer logic, YouTube control, and alarm management.

#### **1. Initialization**

```javascript
chrome.runtime.onInstalled.addListener(() => {
  // Initialize timer state in local storage (fast, not synced)
  chrome.storage.local.set({
    isRunning: false,
    isPaused: false,
    timeLeft: 25 * 60,
    sessionType: 'work',
    sessionsCompleted: 0
  });

  // Initialize settings in sync storage (synced across devices)
  chrome.storage.sync.set({
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    youtubeUrlFocus: '',
    youtubeUrlBreak: '',
    dayStartEnabled: false,
    dayStartTime: '05:00',
    dayStartDuration: 30,
    youtubeUrlDayStart: ''
  });
});
```

**Purpose:**
- Runs once when extension is installed/updated
- Sets default values for timer state and settings
- Uses `local` storage for timer state (fast access)
- Uses `sync` storage for settings (syncs across Chrome instances)

---

#### **2. Message Handling**

```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'start':
      startTimer();
      sendResponse({ success: true });
      break;
    case 'pause':
      pauseTimer();
      sendResponse({ success: true });
      break;
    case 'resume':
      resumeTimer();
      sendResponse({ success: true });
      break;
    case 'reset':
      resetTimer();
      sendResponse({ success: true });
      break;
    case 'updateDayStartAlarm':
      if (message.enabled) {
        setupDayStartAlarm(message.time);
      } else {
        chrome.alarms.clear('dayStart');
      }
      sendResponse({ success: true });
      break;
  }
  return true;  // Important: keeps message channel open for async responses
});
```

**Purpose:**
- Listens for messages from popup.js
- Routes messages to appropriate handler functions
- Sends response back to popup
- `return true` is crucial for async operations

---

#### **3. Timer Functions**

##### **startTimer()**

```javascript
async function startTimer() {
  const state = await chrome.storage.local.get(['isRunning', 'timeLeft', 'sessionType']);

  if (state.isRunning) return;  // Already running

  // Initialize time if starting fresh
  if (state.timeLeft === 0 || state.timeLeft === undefined) {
    const settings = await chrome.storage.sync.get(['workDuration']);
    await chrome.storage.local.set({
      timeLeft: settings.workDuration * 60,
      sessionType: 'work'
    });
  }

  await chrome.storage.local.set({
    isRunning: true,
    isPaused: false
  });

  // Get current session type and settings to play appropriate music
  const currentState = await chrome.storage.local.get(['sessionType']);
  const settings = await chrome.storage.sync.get(['youtubeUrlFocus', 'youtubeUrlBreak']);

  // Play music based on session type
  if (currentState.sessionType === 'work' && settings.youtubeUrlFocus) {
    openYouTubeMusic(settings.youtubeUrlFocus);
  } else if ((currentState.sessionType === 'break' || currentState.sessionType === 'longBreak') && settings.youtubeUrlBreak) {
    openYouTubeMusic(settings.youtubeUrlBreak);
  }

  runTimer();
}
```

**Purpose:**
- Starts the Pomodoro timer
- Initializes time if needed (25 minutes default)
- Plays appropriate music based on session type
- Calls `runTimer()` to begin countdown

**Technical Details:**
- Uses `async/await` for cleaner async code
- Checks if timer is already running to prevent duplicates
- Retrieves state from storage before starting

---

##### **pauseTimer()**

```javascript
async function pauseTimer() {
  const state = await chrome.storage.local.get(['sessionType']);
  const settings = await chrome.storage.sync.get(['youtubeUrlFocus', 'youtubeUrlBreak']);

  await chrome.storage.local.set({ isPaused: true });

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Pause the appropriate YouTube video based on current session type
  if (state.sessionType === 'work' && settings.youtubeUrlFocus) {
    pauseYouTubeMusic(settings.youtubeUrlFocus);
  } else if ((state.sessionType === 'break' || state.sessionType === 'longBreak') && settings.youtubeUrlBreak) {
    pauseYouTubeMusic(settings.youtubeUrlBreak);
  }

  // Notify popup to update button state
  notifyPopup();
}
```

**Purpose:**
- Pauses the timer countdown
- Pauses the currently playing YouTube video
- Clears the interval to stop countdown
- Updates UI via `notifyPopup()`

---

##### **resumeTimer()**

```javascript
async function resumeTimer() {
  const state = await chrome.storage.local.get(['sessionType']);
  const settings = await chrome.storage.sync.get(['youtubeUrlFocus', 'youtubeUrlBreak']);

  await chrome.storage.local.set({ isPaused: false });
  runTimer();

  // Resume the appropriate YouTube video based on current session type
  if (state.sessionType === 'work' && settings.youtubeUrlFocus) {
    resumeYouTubeMusic(settings.youtubeUrlFocus);
  } else if ((state.sessionType === 'break' || state.sessionType === 'longBreak') && settings.youtubeUrlBreak) {
    resumeYouTubeMusic(settings.youtubeUrlBreak);
  }

  // Notify popup to update button state
  notifyPopup();
}
```

**Purpose:**
- Resumes paused timer
- Resumes YouTube video playback
- Restarts countdown interval

---

##### **resetTimer()**

```javascript
async function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  const settings = await chrome.storage.sync.get(['workDuration']);

  await chrome.storage.local.set({
    isRunning: false,
    isPaused: false,
    timeLeft: settings.workDuration * 60,
    sessionType: 'work',
    sessionsCompleted: 0
  });

  notifyPopup();
}
```

**Purpose:**
- Resets timer to initial state
- Clears interval
- Resets session counter
- Updates UI

---

##### **runTimer()**

```javascript
function runTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
  }

  timerInterval = setInterval(async () => {
    const state = await chrome.storage.local.get(['isRunning', 'isPaused', 'timeLeft']);

    if (!state.isRunning || state.isPaused) {
      clearInterval(timerInterval);
      timerInterval = null;
      return;
    }

    let newTimeLeft = state.timeLeft - 1;

    if (newTimeLeft <= 0) {
      // Session complete
      await handleSessionComplete();
    } else {
      await chrome.storage.local.set({ timeLeft: newTimeLeft });
      notifyPopup();
    }
  }, 1000);  // Run every 1 second
}
```

**Purpose:**
- The main countdown loop
- Runs every 1 second using `setInterval`
- Decrements `timeLeft` by 1 each second
- Calls `handleSessionComplete()` when time reaches 0
- Updates popup UI every second

**Technical Details:**
- Clears existing interval before creating new one (prevents duplicates)
- Checks if timer is paused/stopped before continuing
- Uses async storage operations inside interval

---

#### **4. Session Transition Logic**

##### **handleSessionComplete()**

```javascript
async function handleSessionComplete() {
  const state = await chrome.storage.local.get(['sessionType', 'sessionsCompleted']);
  const settings = await chrome.storage.sync.get([
    'workDuration',
    'breakDuration',
    'longBreakDuration',
    'youtubeUrlFocus',
    'youtubeUrlBreak'
  ]);

  let newSessionType;
  let newTimeLeft;
  let newSessionsCompleted = state.sessionsCompleted;

  if (state.sessionType === 'work') {
    // Work session complete
    newSessionsCompleted++;

    // Every 4 work sessions, take a long break
    if (newSessionsCompleted % 4 === 0) {
      newSessionType = 'longBreak';
      newTimeLeft = settings.longBreakDuration * 60;
    } else {
      newSessionType = 'break';
      newTimeLeft = settings.breakDuration * 60;
    }

    // Pause focus music if it's playing
    if (settings.youtubeUrlFocus) {
      await pauseYouTubeMusic(settings.youtubeUrlFocus);
    }

    // Play break music if URL is set (with small delay to ensure pause completes)
    if (settings.youtubeUrlBreak && (newSessionType === 'break' || newSessionType === 'longBreak')) {
      setTimeout(() => {
        openYouTubeMusic(settings.youtubeUrlBreak);
      }, 500);
    }

    showNotification('Work Session Complete!', 'Time for a break!');
  } else {
    // Break complete
    newSessionType = 'work';
    newTimeLeft = settings.workDuration * 60;

    // Pause break music if it's playing
    if (settings.youtubeUrlBreak) {
      await pauseYouTubeMusic(settings.youtubeUrlBreak);
    }

    // Play focus music if URL is set (with small delay to ensure pause completes)
    if (settings.youtubeUrlFocus) {
      setTimeout(() => {
        openYouTubeMusic(settings.youtubeUrlFocus);
      }, 500);
    }

    showNotification('Break Complete!', 'Time to get back to work!');
  }

  await chrome.storage.local.set({
    sessionType: newSessionType,
    timeLeft: newTimeLeft,
    sessionsCompleted: newSessionsCompleted
  });

  notifyPopup();
  runTimer();
}
```

**Purpose:**
- Handles transition between work and break sessions
- Implements Pomodoro Technique logic (4 work sessions → long break)
- Switches YouTube music appropriately
- Shows desktop notifications
- Starts next session automatically

**Technical Details:**
- Uses modulo operator (`%`) to check if 4 sessions completed
- 500ms delay prevents race condition between pause and play
- Increments session counter only after work sessions
- Automatically starts next session

---

#### **5. YouTube Music Control**

##### **openYouTubeMusic()**

```javascript
async function openYouTubeMusic(url) {
  // Add autoplay parameter to the URL
  let playUrl = url;

  // Check if URL already has parameters
  if (url.includes('?')) {
    playUrl = url + '&autoplay=1';
  } else {
    playUrl = url + '?autoplay=1';
  }

  // Extract the base video/playlist identifier to match existing tabs
  let videoId = null;
  let listId = null;

  const videoMatch = url.match(/[?&]v=([^&]+)/);
  if (videoMatch) {
    videoId = videoMatch[1];
  }

  const listMatch = url.match(/[?&]list=([^&]+)/);
  if (listMatch) {
    listId = listMatch[1];
  }

  // Query all tabs to find existing YouTube tab with same video/playlist
  const tabs = await chrome.tabs.query({});

  let existingTab = null;
  for (const tab of tabs) {
    if (tab.url && tab.url.includes('youtube.com')) {
      // Check if this tab matches our video or playlist
      const matchesVideo = videoId && tab.url.includes(`v=${videoId}`);
      const matchesList = listId && tab.url.includes(`list=${listId}`);

      if (matchesVideo || matchesList) {
        existingTab = tab;
        break;
      }
    }
  }

  if (existingTab) {
    // Reload the existing tab with autoplay parameter
    await chrome.tabs.update(existingTab.id, {
      url: playUrl,
      active: false  // Keep it in background
    });
  } else {
    // No existing tab found, create a new one in the background
    chrome.tabs.create({ url: playUrl, active: false });
  }
}
```

**Purpose:**
- Opens or reloads YouTube video/playlist
- Adds `autoplay=1` parameter for automatic playback
- Reuses existing tab if same video is already open
- Opens in background (doesn't steal focus)

**Technical Details:**
- Uses regex to extract video ID (`v=`) and playlist ID (`list=`)
- Queries all tabs to find matching YouTube tab
- Creates new tab only if no match found
- `active: false` prevents focus stealing

---

##### **pauseYouTubeMusic()**

```javascript
async function pauseYouTubeMusic(url) {
  // Extract video/playlist ID
  let videoId = null;
  let listId = null;

  const videoMatch = url.match(/[?&]v=([^&]+)/);
  if (videoMatch) {
    videoId = videoMatch[1];
  }

  const listMatch = url.match(/[?&]list=([^&]+)/);
  if (listMatch) {
    listId = listMatch[1];
  }

  // Query all tabs to find existing YouTube tab
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (tab.url && tab.url.includes('youtube.com')) {
      const matchesVideo = videoId && tab.url.includes(`v=${videoId}`);
      const matchesList = listId && tab.url.includes(`list=${listId}`);

      if (matchesVideo || matchesList) {
        // Inject script to pause the video
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // This function runs inside the YouTube tab
              const video = document.querySelector('video');
              if (video && !video.paused) {
                video.pause();
              }
            }
          });
          return;  // Exit after first match
        } catch (error) {
          console.log('Could not pause video:', error);
        }
      }
    }
  }
}
```

**Purpose:**
- Finds and pauses YouTube video in existing tab
- Uses Chrome Scripting API to inject code into page

**Technical Details:**
- `chrome.scripting.executeScript()` injects JavaScript into YouTube tab
- The `func` parameter runs inside the YouTube page context
- `document.querySelector('video')` finds the HTML5 video element
- Calls `.pause()` on the video element
- Returns after first match to prevent multiple pauses

---

##### **resumeYouTubeMusic()**

```javascript
async function resumeYouTubeMusic(url) {
  // [Same video/playlist ID extraction logic]

  for (const tab of tabs) {
    if (tab.url && tab.url.includes('youtube.com')) {
      const matchesVideo = videoId && tab.url.includes(`v=${videoId}`);
      const matchesList = listId && tab.url.includes(`list=${listId}`);

      if (matchesVideo || matchesList) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              const video = document.querySelector('video');
              if (video && video.paused) {
                video.play().catch(err => console.log('Play failed:', err));
              }
            }
          });
          return;
        } catch (error) {
          console.log('Could not resume video:', error);
        }
      }
    }
  }
}
```

**Purpose:**
- Resumes paused YouTube video
- Similar to `pauseYouTubeMusic()` but calls `.play()` instead

**Technical Details:**
- `video.play()` returns a Promise, so we catch errors
- Chrome's autoplay policy may block play() in some cases

---

#### **6. Day Start Session**

##### **setupDayStartAlarm()**

```javascript
function setupDayStartAlarm(timeString) {
  // timeString format: "HH:MM" (e.g., "05:00")
  const [hours, minutes] = timeString.split(':').map(Number);

  // Get current date/time
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  // Clear existing alarm
  chrome.alarms.clear('dayStart', () => {
    // Create new alarm
    chrome.alarms.create('dayStart', {
      when: scheduledTime.getTime(),
      periodInMinutes: 24 * 60  // Repeat every 24 hours
    });
    console.log('Day start alarm set for:', scheduledTime.toLocaleString());
  });
}
```

**Purpose:**
- Creates a scheduled alarm for day start session
- Fires at specified time every day

**Technical Details:**
- Parses time string "HH:MM" into hours and minutes
- Creates Date object for scheduled time
- If time already passed today, schedules for tomorrow
- `periodInMinutes: 24 * 60` makes it repeat daily
- `when` expects timestamp in milliseconds

---

##### **handleDayStart()**

```javascript
async function handleDayStart() {
  const settings = await chrome.storage.sync.get([
    'dayStartEnabled',
    'dayStartDuration',
    'youtubeUrlDayStart'
  ]);

  if (!settings.dayStartEnabled || !settings.youtubeUrlDayStart) {
    return;
  }

  // Show notification
  showNotification('Good Morning!', 'Your day start session is beginning!');

  // Play the day start video
  openYouTubeMusic(settings.youtubeUrlDayStart);

  // Schedule to stop the video after the duration
  setTimeout(async () => {
    // Pause the day start video
    await pauseYouTubeMusic(settings.youtubeUrlDayStart);
    showNotification('Day Start Complete', 'Have a great day!');
  }, settings.dayStartDuration * 60 * 1000);  // Convert minutes to milliseconds
}
```

**Purpose:**
- Runs when day start alarm fires
- Plays YouTube video for specified duration
- Automatically stops after duration

**Technical Details:**
- Uses `setTimeout` for auto-stop
- Converts minutes to milliseconds (`* 60 * 1000`)
- Shows notifications at start and end

---

##### **Alarm Listener**

```javascript
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Just to keep service worker active
  } else if (alarm.name === 'dayStart') {
    // Trigger day start session
    handleDayStart();
  }
});
```

**Purpose:**
- Listens for Chrome alarms
- Routes to appropriate handler based on alarm name

**Technical Details:**
- `keepAlive` alarm fires every minute to prevent service worker from sleeping
- `dayStart` alarm triggers morning routine

---

#### **7. Utility Functions**

##### **showNotification()**

```javascript
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}
```

**Purpose:**
- Shows desktop notification to user
- Used for session transitions and day start

---

##### **notifyPopup()**

```javascript
function notifyPopup() {
  chrome.storage.local.get(['timeLeft', 'sessionType', 'isRunning', 'isPaused'], (state) => {
    chrome.runtime.sendMessage({
      action: 'timerUpdate',
      timeLeft: state.timeLeft,
      sessionType: state.sessionType,
      isRunning: state.isRunning,
      isPaused: state.isPaused
    }).catch(() => {
      // Popup might be closed, ignore error
    });
  });
}
```

**Purpose:**
- Sends timer state updates to popup
- Updates UI in real-time

**Technical Details:**
- Uses `chrome.runtime.sendMessage()` to send to popup
- `.catch()` handles case when popup is closed
- Popup listens for `timerUpdate` messages

---

### **popup.js** - UI Logic

This file handles all user interactions and UI updates.

#### **1. UI Element References**

```javascript
const timerDisplay = document.getElementById('timer');
const sessionTypeDisplay = document.getElementById('session-type-badge');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
// ... more element references
```

**Purpose:**
- Caches DOM element references for better performance
- Makes elements easily accessible throughout the file

---

#### **2. Initialization**

```javascript
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadTimerState();
  setupTabSwitching();
});
```

**Purpose:**
- Runs when popup opens
- Loads saved settings from storage
- Loads current timer state
- Sets up tab switching event listeners

---

#### **3. Tab Switching**

```javascript
function setupTabSwitching() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;

      // Remove active class from all tabs and contents
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

      // Add active class to clicked tab and corresponding content
      btn.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');
    });
  });
}
```

**Purpose:**
- Handles clicking between Timer, Music, and Day Start tabs
- Shows/hides appropriate content

**Technical Details:**
- Uses `dataset.tab` to get tab name from HTML attribute
- Removes `active` class from all tabs/content first
- Adds `active` class to clicked tab and corresponding content
- CSS handles show/hide via `.active` class

---

#### **4. Loading Settings**

```javascript
function loadSettings() {
  chrome.storage.sync.get({
    workDuration: 25,
    breakDuration: 5,
    longBreakDuration: 15,
    youtubeUrlFocus: '',
    youtubeUrlBreak: '',
    dayStartEnabled: false,
    dayStartTime: '05:00',
    dayStartDuration: 30,
    youtubeUrlDayStart: ''
  }, (settings) => {
    workDurationInput.value = settings.workDuration;
    breakDurationInput.value = settings.breakDuration;
    longBreakDurationInput.value = settings.longBreakDuration;
    youtubeUrlFocusInput.value = settings.youtubeUrlFocus;
    youtubeUrlBreakInput.value = settings.youtubeUrlBreak;
    dayStartEnabledInput.checked = settings.dayStartEnabled;
    dayStartTimeInput.value = settings.dayStartTime;
    dayStartDurationInput.value = settings.dayStartDuration;
    youtubeUrlDayStartInput.value = settings.youtubeUrlDayStart;
  });
}
```

**Purpose:**
- Loads saved settings from Chrome Storage
- Populates input fields with saved values

**Technical Details:**
- First parameter is default values (used if no saved value exists)
- Second parameter is callback that receives saved settings
- Sets input values directly

---

#### **5. Loading Timer State**

```javascript
function loadTimerState() {
  chrome.storage.local.get({
    isRunning: false,
    isPaused: false,
    timeLeft: 0,
    sessionType: 'work',
    sessionsCompleted: 0
  }, (state) => {
    updateTimerDisplay(state.timeLeft);
    updateSessionTypeDisplay(state.sessionType);
    updateButtonStates(state.isRunning, state.isPaused);
  });
}
```

**Purpose:**
- Loads current timer state when popup opens
- Updates UI to reflect current state

---

#### **6. Timer Display Updates**

```javascript
function updateTimerDisplay(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateSessionTypeDisplay(sessionType) {
  const typeMap = {
    'work': 'Work Session',
    'break': 'Break Time',
    'longBreak': 'Long Break'
  };
  sessionTypeDisplay.textContent = typeMap[sessionType] || 'Work Session';
}

function updateButtonStates(isRunning, isPaused) {
  if (isRunning && !isPaused) {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    pauseBtn.textContent = 'Pause';
  } else if (isRunning && isPaused) {
    startBtn.disabled = true;
    pauseBtn.disabled = false;
    pauseBtn.textContent = 'Resume';
  } else {
    startBtn.disabled = false;
    pauseBtn.disabled = true;
    pauseBtn.textContent = 'Pause';
  }
}
```

**Purpose:**
- Updates timer display in MM:SS format
- Updates session type badge
- Updates button states (enabled/disabled)

**Technical Details:**
- `Math.floor()` gets integer minutes
- `%` (modulo) gets remaining seconds
- `padStart(2, '0')` adds leading zero (e.g., "05" instead of "5")

---

#### **7. Button Event Listeners**

```javascript
startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'start' }, (response) => {
    if (response.success) {
      loadTimerState();
    }
  });
});

pauseBtn.addEventListener('click', () => {
  chrome.storage.local.get(['isPaused'], (state) => {
    const action = state.isPaused ? 'resume' : 'pause';
    chrome.runtime.sendMessage({ action }, (response) => {
      if (response.success) {
        loadTimerState();
      }
    });
  });
});

resetBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'reset' }, (response) => {
    if (response.success) {
      loadTimerState();
    }
  });
});
```

**Purpose:**
- Sends messages to background script when buttons clicked
- Reloads timer state after action completes

**Technical Details:**
- `chrome.runtime.sendMessage()` sends message to background
- Callback receives response from background
- Reloads state to update UI

---

#### **8. Saving Settings**

```javascript
saveSettingsBtn.addEventListener('click', () => {
  const workDuration = parseInt(workDurationInput.value);
  const breakDuration = parseInt(breakDurationInput.value);
  const longBreakDuration = parseInt(longBreakDurationInput.value);
  const youtubeUrlFocus = youtubeUrlFocusInput.value.trim();
  const youtubeUrlBreak = youtubeUrlBreakInput.value.trim();
  const dayStartEnabled = dayStartEnabledInput.checked;
  const dayStartTime = dayStartTimeInput.value;
  const dayStartDuration = parseInt(dayStartDurationInput.value);
  const youtubeUrlDayStart = youtubeUrlDayStartInput.value.trim();

  // Validate YouTube URLs
  if (youtubeUrlFocus && !isValidYouTubeUrl(youtubeUrlFocus)) {
    showStatusMessage('Please enter a valid YouTube URL for focus time', 'error');
    return;
  }
  // ... more validation

  // Save settings
  chrome.storage.sync.set({
    workDuration,
    breakDuration,
    longBreakDuration,
    youtubeUrlFocus,
    youtubeUrlBreak,
    dayStartEnabled,
    dayStartTime,
    dayStartDuration,
    youtubeUrlDayStart
  }, () => {
    // Notify background script to update day start alarm
    chrome.runtime.sendMessage({
      action: 'updateDayStartAlarm',
      enabled: dayStartEnabled,
      time: dayStartTime
    });

    showStatusMessage('Settings saved successfully!', 'success');
  });
});
```

**Purpose:**
- Validates input values
- Saves settings to Chrome Storage
- Updates day start alarm if needed
- Shows success/error message

**Technical Details:**
- `parseInt()` converts string input to number
- `.trim()` removes whitespace
- `.checked` gets checkbox state
- Validation runs before saving

---

#### **9. YouTube URL Validation**

```javascript
function isValidYouTubeUrl(url) {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/(www\.)?youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/
  ];
  return patterns.some(pattern => pattern.test(url));
}
```

**Purpose:**
- Validates YouTube URL format
- Accepts multiple YouTube URL formats

**Technical Details:**
- Uses regular expressions (regex) to match patterns
- `some()` returns true if any pattern matches
- `[\w-]+` matches alphanumeric characters and hyphens (video IDs)

---

#### **10. Status Messages**

```javascript
function showStatusMessage(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  setTimeout(() => {
    statusMessage.style.display = 'none';
    statusMessage.className = 'status-message';
  }, 3000);  // Hide after 3 seconds
}
```

**Purpose:**
- Shows temporary success/error messages
- Auto-hides after 3 seconds

---

#### **11. Real-time Updates**

```javascript
// Listen for timer updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'timerUpdate') {
    updateTimerDisplay(message.timeLeft);
    updateSessionTypeDisplay(message.sessionType);
    updateButtonStates(message.isRunning, message.isPaused);
  }
});

// Poll timer state every second
setInterval(() => {
  chrome.storage.local.get(['isRunning', 'isPaused'], (state) => {
    if (state.isRunning && !state.isPaused) {
      loadTimerState();
    }
  });
}, 1000);
```

**Purpose:**
- Keeps UI in sync with timer state
- Updates every second when timer is running

**Technical Details:**
- Listens for `timerUpdate` messages from background
- Also polls storage every second as backup
- Only polls when timer is actually running

---

## Data Flow

### Starting a Timer

```
User clicks "Start" button
    ↓
popup.js: startBtn click handler
    ↓
chrome.runtime.sendMessage({ action: 'start' })
    ↓
background.js: Message listener receives 'start'
    ↓
background.js: startTimer()
    ↓
- Reads state from chrome.storage.local
- Initializes time if needed
- Sets isRunning = true
- Plays YouTube music (openYouTubeMusic)
- Starts runTimer() interval
    ↓
runTimer() executes every 1 second
    ↓
- Decrements timeLeft
- Saves to storage
- Calls notifyPopup()
    ↓
notifyPopup() sends 'timerUpdate' message
    ↓
popup.js: Receives 'timerUpdate'
    ↓
Updates UI (timer display, buttons)
```

### Session Transition

```
runTimer() detects timeLeft === 0
    ↓
background.js: handleSessionComplete()
    ↓
- Determines next session type
- Pauses current music (await pauseYouTubeMusic)
- Waits 500ms (setTimeout)
- Plays new music (openYouTubeMusic)
- Shows notification
- Updates storage with new session
- Calls runTimer() to start next session
```

### YouTube Control

```
openYouTubeMusic(url)
    ↓
- Adds autoplay=1 parameter
- Extracts video/playlist ID
- Queries all tabs (chrome.tabs.query)
- Finds matching YouTube tab
    ↓
If found:
  - Updates tab URL with autoplay
  - Keeps in background (active: false)
    ↓
If not found:
  - Creates new tab (chrome.tabs.create)
  - Opens in background
```

```
pauseYouTubeMusic(url)
    ↓
- Extracts video/playlist ID
- Queries all tabs
- Finds matching YouTube tab
    ↓
chrome.scripting.executeScript()
    ↓
Injected function runs in YouTube page:
    ↓
- document.querySelector('video')
- video.pause()
```

---

## Chrome APIs Used

### 1. **chrome.storage**

**Purpose:** Persistent data storage

**Two Types:**
- `chrome.storage.local` - Fast, local-only storage (timer state)
- `chrome.storage.sync` - Synced across devices (settings)

**API:**
```javascript
// Set
chrome.storage.sync.set({ key: value });

// Get
chrome.storage.sync.get(['key'], (result) => {
  console.log(result.key);
});

// Get with defaults
chrome.storage.sync.get({ key: 'default' }, (result) => {
  console.log(result.key);
});
```

---

### 2. **chrome.runtime**

**Purpose:** Message passing and extension lifecycle

**API:**
```javascript
// Send message
chrome.runtime.sendMessage({ action: 'start' }, (response) => {
  console.log(response);
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  sendResponse({ success: true });
  return true;  // Keep channel open for async
});

// On install
chrome.runtime.onInstalled.addListener(() => {
  // Initialize extension
});
```

---

### 3. **chrome.alarms**

**Purpose:** Scheduled tasks

**API:**
```javascript
// Create alarm
chrome.alarms.create('name', {
  when: Date.now() + 60000,  // Fire in 1 minute
  periodInMinutes: 60        // Repeat every hour
});

// Listen for alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'name') {
    // Handle alarm
  }
});

// Clear alarm
chrome.alarms.clear('name');
```

---

### 4. **chrome.notifications**

**Purpose:** Desktop notifications

**API:**
```javascript
chrome.notifications.create({
  type: 'basic',
  iconUrl: 'icon.png',
  title: 'Title',
  message: 'Message',
  priority: 2
});
```

---

### 5. **chrome.tabs**

**Purpose:** Tab management

**API:**
```javascript
// Query tabs
const tabs = await chrome.tabs.query({});

// Create tab
chrome.tabs.create({
  url: 'https://example.com',
  active: false  // Open in background
});

// Update tab
chrome.tabs.update(tabId, {
  url: 'https://example.com',
  active: true
});
```

---

### 6. **chrome.scripting**

**Purpose:** Inject JavaScript into pages

**API:**
```javascript
chrome.scripting.executeScript({
  target: { tabId: tabId },
  func: () => {
    // This code runs in the target page
    document.querySelector('video').pause();
  }
});
```

**Requires:**
- `scripting` permission in manifest
- `host_permissions` for target domains

---

## Key Design Patterns

### 1. **Separation of Concerns**
- UI (popup.js) handles only display and user input
- Business logic (background.js) handles timer and YouTube control
- Communication via Chrome messaging API

### 2. **Event-Driven Architecture**
- User actions trigger events
- Events send messages to background
- Background processes and responds
- UI updates based on responses

### 3. **State Management**
- Single source of truth: Chrome Storage
- All components read from storage
- Updates propagate via messages

### 4. **Asynchronous Operations**
- All Chrome APIs are async
- Uses async/await for cleaner code
- Handles errors gracefully

### 5. **Polling + Push Updates**
- Background pushes updates via messages
- Popup also polls storage as backup
- Ensures UI stays in sync

---

## Performance Considerations

1. **Service Worker Lifecycle**
   - Service workers can be terminated by Chrome
   - `keepAlive` alarm prevents premature termination
   - Timer state saved to storage (survives termination)

2. **DOM Caching**
   - Element references cached at startup
   - Avoids repeated `getElementById` calls

3. **Tab Reuse**
   - Reuses existing YouTube tab instead of creating new ones
   - Reduces memory usage

4. **Efficient Updates**
   - Only updates UI when timer is running
   - Uses `setInterval` with 1-second precision

---

## Security Considerations

1. **Content Security Policy**
   - Manifest V3 enforces strict CSP
   - No inline scripts allowed
   - External scripts must be bundled

2. **Permissions**
   - Only requests necessary permissions
   - `host_permissions` limited to YouTube

3. **Script Injection**
   - Only injects into YouTube tabs
   - Minimal injected code (just pause/play)

4. **Input Validation**
   - Validates YouTube URLs before saving
   - Validates numeric inputs (durations)

---

## Browser Compatibility

- **Chrome:** Full support (Manifest V3)
- **Edge:** Full support (Chromium-based)
- **Firefox:** Partial support (Manifest V2)
- **Safari:** Limited support

---

## Future Improvements

1. **Better Music Control**
   - Volume control
   - Playlist management
   - Multiple music profiles

2. **Statistics**
   - Track completed sessions
   - Show productivity graphs
   - Export data

3. **Themes**
   - Dark mode
   - Custom colors
   - Different timer styles

4. **Integrations**
   - Task management apps
   - Calendar integration
   - Spotify support

---

## Troubleshooting

### Timer Stops Working
- **Cause:** Service worker terminated
- **Solution:** Click extension icon to reactivate

### YouTube Doesn't Autoplay
- **Cause:** Chrome autoplay policy
- **Solution:** Interact with YouTube once, then autoplay will work

### Settings Not Saving
- **Cause:** Storage permissions
- **Solution:** Check manifest permissions

### Music Plays in Foreground
- **Cause:** `active: true` in tab creation
- **Solution:** Should be `active: false`

---

## Summary

This Chrome extension demonstrates:
- **Manifest V3** architecture
- **Service Worker** background processing
- **Chrome Storage API** for persistence
- **Chrome Scripting API** for page control
- **Message passing** between components
- **Alarm scheduling** for recurring tasks
- **Modern JavaScript** (async/await, ES6+)
- **Professional UI** design with tabs and animations

The extension successfully implements the Pomodoro Technique with intelligent music control and scheduled morning routines, all while maintaining a clean, professional interface.

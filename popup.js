// UI Elements
const timerDisplay = document.getElementById('timer');
const sessionTypeDisplay = document.getElementById('session-type-badge');
const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const workDurationInput = document.getElementById('work-duration');
const breakDurationInput = document.getElementById('break-duration');
const longBreakDurationInput = document.getElementById('long-break-duration');
const youtubeUrlFocusInput = document.getElementById('youtube-url-focus');
const youtubeUrlBreakInput = document.getElementById('youtube-url-break');
const dayStartEnabledInput = document.getElementById('day-start-enabled');
const dayStartTimeInput = document.getElementById('day-start-time');
const dayStartDurationInput = document.getElementById('day-start-duration');
const youtubeUrlDayStartInput = document.getElementById('youtube-url-day-start');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const statusMessage = document.getElementById('status-message');

// Load settings and timer state on popup open
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  loadTimerState();
  setupTabSwitching();
});

// Setup tab switching
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

// Load settings from storage
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

// Load current timer state
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

// Update timer display
function updateTimerDisplay(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Update session type display
function updateSessionTypeDisplay(sessionType) {
  const typeMap = {
    'work': 'Work Session',
    'break': 'Break Time',
    'longBreak': 'Long Break'
  };
  sessionTypeDisplay.textContent = typeMap[sessionType] || 'Work Session';
}

// Update button states
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

// Start button click
startBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'start' }, (response) => {
    if (response.success) {
      loadTimerState();
    }
  });
});

// Pause/Resume button click
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

// Reset button click
resetBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'reset' }, (response) => {
    if (response.success) {
      loadTimerState();
    }
  });
});

// Save settings button click
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

  // Validate YouTube URLs if provided
  if (youtubeUrlFocus && !isValidYouTubeUrl(youtubeUrlFocus)) {
    showStatusMessage('Please enter a valid YouTube URL for focus time', 'error');
    return;
  }

  if (youtubeUrlBreak && !isValidYouTubeUrl(youtubeUrlBreak)) {
    showStatusMessage('Please enter a valid YouTube URL for break time', 'error');
    return;
  }

  if (dayStartEnabled && youtubeUrlDayStart && !isValidYouTubeUrl(youtubeUrlDayStart)) {
    showStatusMessage('Please enter a valid YouTube URL for day start', 'error');
    return;
  }

  // Validate durations
  if (workDuration < 1 || breakDuration < 1 || longBreakDuration < 1) {
    showStatusMessage('Durations must be at least 1 minute', 'error');
    return;
  }

  if (dayStartEnabled && dayStartDuration < 1) {
    showStatusMessage('Day start duration must be at least 1 minute', 'error');
    return;
  }

  if (dayStartEnabled && !youtubeUrlDayStart) {
    showStatusMessage('Please enter a YouTube URL for day start session', 'error');
    return;
  }

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

    // Reset timer if not running
    chrome.storage.local.get(['isRunning'], (state) => {
      if (!state.isRunning) {
        chrome.runtime.sendMessage({ action: 'reset' });
      }
    });
  });
});

// Validate YouTube URL
function isValidYouTubeUrl(url) {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/(www\.)?youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/
  ];
  return patterns.some(pattern => pattern.test(url));
}

// Show status message
function showStatusMessage(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;

  setTimeout(() => {
    statusMessage.style.display = 'none';
    statusMessage.className = 'status-message';
  }, 3000);
}

// Listen for timer updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'timerUpdate') {
    updateTimerDisplay(message.timeLeft);
    updateSessionTypeDisplay(message.sessionType);
    updateButtonStates(message.isRunning, message.isPaused);
  }
});

// Update timer display every second when popup is open
setInterval(() => {
  chrome.storage.local.get(['isRunning', 'isPaused'], (state) => {
    if (state.isRunning && !state.isPaused) {
      loadTimerState();
    }
  });
}, 1000);

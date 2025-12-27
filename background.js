// Timer state
let timerInterval = null;

// Initialize state on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    isRunning: false,
    isPaused: false,
    timeLeft: 25 * 60,
    sessionType: 'work',
    sessionsCompleted: 0
  });

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

  // Initialize day start alarm if enabled
  chrome.storage.sync.get(['dayStartEnabled', 'dayStartTime'], (settings) => {
    if (settings.dayStartEnabled) {
      setupDayStartAlarm(settings.dayStartTime);
    }
  });
});

// Listen for messages from popup
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
  return true;
});

// Start timer
async function startTimer() {
  const state = await chrome.storage.local.get(['isRunning', 'timeLeft', 'sessionType']);

  if (state.isRunning) return;

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

// Pause timer
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

// Resume timer
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

// Reset timer
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

// Run timer
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
  }, 1000);
}

// Handle session complete
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

    // Show notification
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

    // Show notification
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

// Open YouTube music in background tab
async function openYouTubeMusic(url) {
  // Add autoplay parameter to the URL
  let playUrl = url;

  // Check if URL already has parameters
  if (url.includes('?')) {
    // URL already has parameters, append with &
    playUrl = url + '&autoplay=1';
  } else {
    // No parameters yet, add with ?
    playUrl = url + '?autoplay=1';
  }

  // Extract the base video/playlist identifier to match existing tabs
  // This will match tabs with the same video ID regardless of other parameters
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
    // This will restart the video from the beginning
    await chrome.tabs.update(existingTab.id, {
      url: playUrl,
      active: false  // Keep it in background, don't switch focus
    });
  } else {
    // No existing tab found, create a new one in the background
    // The autoplay=1 parameter tells YouTube to start playing immediately
    // The tab will play audio in the background without stealing focus
    //
    // Note: Chrome's autoplay policy may still block autoplay on first use
    // If blocked, user needs to manually play once, then future autoplay will work
    chrome.tabs.create({ url: playUrl, active: false });
  }
}

// Pause YouTube music in existing tab
async function pauseYouTubeMusic(url) {
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

  for (const tab of tabs) {
    if (tab.url && tab.url.includes('youtube.com')) {
      // Check if this tab matches our video or playlist
      const matchesVideo = videoId && tab.url.includes(`v=${videoId}`);
      const matchesList = listId && tab.url.includes(`list=${listId}`);

      if (matchesVideo || matchesList) {
        // Inject script to pause the video
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Find the YouTube video player and pause it
              const video = document.querySelector('video');
              if (video && !video.paused) {
                video.pause();
              }
            }
          });
          // Successfully found and paused the tab, exit the loop
          return;
        } catch (error) {
          console.log('Could not pause video:', error);
        }
      }
    }
  }
}

// Resume YouTube music in existing tab
async function resumeYouTubeMusic(url) {
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

  for (const tab of tabs) {
    if (tab.url && tab.url.includes('youtube.com')) {
      // Check if this tab matches our video or playlist
      const matchesVideo = videoId && tab.url.includes(`v=${videoId}`);
      const matchesList = listId && tab.url.includes(`list=${listId}`);

      if (matchesVideo || matchesList) {
        // Inject script to resume the video
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // Find the YouTube video player and play it
              const video = document.querySelector('video');
              if (video && video.paused) {
                video.play().catch(err => console.log('Play failed:', err));
              }
            }
          });
          // Successfully found and resumed the tab, exit the loop
          return;
        } catch (error) {
          console.log('Could not resume video:', error);
        }
      }
    }
  }
}

// Show notification
function showNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });
}

// Notify popup of updates
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

// Setup day start alarm
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
      periodInMinutes: 24 * 60 // Repeat every 24 hours
    });
    console.log('Day start alarm set for:', scheduledTime.toLocaleString());
  });
}

// Handle day start session
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
  }, settings.dayStartDuration * 60 * 1000);
}

// Keep service worker alive
chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'keepAlive') {
    // Just to keep service worker active
  } else if (alarm.name === 'dayStart') {
    // Trigger day start session
    handleDayStart();
  }
});

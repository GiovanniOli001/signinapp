// ============================================
// SIGN IN APP - KIOSK APPLICATION
// VitalHub Ipswich Visitor Kiosk
// ============================================

// ============================================
// STATE
// ============================================

let currentVisitors = [];
let hosts = [];
let settings = {
  logoUrl: '',
  backgroundUrl: '',
  privacyPolicyEnabled: '',
  privacyPolicyText: ''
};
let countdownTimer = null;
let selectedVisitorForSignOut = null;
let deferredInstallPrompt = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  // Load settings (branding)
  await loadSettings();

  // Load hosts for dropdown
  await loadHosts();

  // Set up form handlers
  setupFormHandlers();

  // Load signed-in visitors for sign-out screen
  await loadSignedInVisitors();

  // Register service worker for PWA
  registerServiceWorker();
}

async function loadSettings() {
  try {
    const response = await settingsApi.get();
    settings = response.settings || {};
    applyBranding();
  } catch (error) {
    console.error('Failed to load settings:', error);
    applyBranding();
  }
}

function applyBranding() {
  // Apply logo
  const logoImg = document.getElementById('logoImage');
  const logoUrl = settings.logoUrl;

  if (logoUrl) {
    logoImg.src = logoUrl;
    logoImg.style.display = 'block';
    logoImg.onerror = () => {
      console.error('Failed to load logo:', logoUrl);
      logoImg.style.display = 'none';
    };
  } else {
    logoImg.style.display = 'none';
  }

  // Apply background image
  const bgContainer = document.getElementById('backgroundImage');
  const bgUrl = settings.backgroundUrl;

  if (bgUrl) {
    bgContainer.style.backgroundImage = `url(${bgUrl})`;
  } else {
    bgContainer.style.backgroundImage = 'none';
  }

  // Apply privacy policy visibility
  applyPrivacyPolicy();
}

function applyPrivacyPolicy() {
  const privacyLink = document.getElementById('privacyPolicyLink');
  if (privacyLink) {
    const isEnabled = settings.privacyPolicyEnabled === 'true';
    privacyLink.style.display = isEnabled ? 'block' : 'none';
  }
}

function showPrivacyPolicy() {
  const modal = document.getElementById('privacyPolicyModal');
  const content = document.getElementById('privacyPolicyContent');

  if (content) {
    // Convert plain text to HTML paragraphs for better readability
    const text = settings.privacyPolicyText || 'No privacy policy has been set.';
    content.innerHTML = text.split('\n').map(p => p.trim() ? `<p>${escapeHtml(p)}</p>` : '').join('');
  }

  if (modal) {
    modal.style.display = 'flex';
  }
}

function closePrivacyPolicy() {
  const modal = document.getElementById('privacyPolicyModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

async function loadHosts() {
  try {
    const response = await hostsApi.getAll();
    hosts = response.hosts || [];
    populateHostDropdown();
  } catch (error) {
    console.error('Failed to load hosts:', error);
    hosts = [];
    populateHostDropdown();
  }
}

function populateHostDropdown() {
  const select = document.getElementById('hostSelect');
  if (!select) return;

  select.innerHTML = '<option value="">Select...</option>';

  // Add hosts from database
  hosts.forEach(host => {
    const option = document.createElement('option');
    option.value = host.name;
    option.textContent = host.name;
    select.appendChild(option);
  });

  // Always add "Unsure" option at the end
  const unsureOption = document.createElement('option');
  unsureOption.value = 'Unsure';
  unsureOption.textContent = 'Unsure';
  select.appendChild(unsureOption);
}

function setupFormHandlers() {
  // Sign in form
  document.getElementById('signInForm').addEventListener('submit', handleSignIn);
}

// ============================================
// SIGN IN
// ============================================

async function handleSignIn(e) {
  e.preventDefault();

  const visitorName = document.getElementById('visitorName').value.trim();
  const visitorPhone = document.getElementById('visitorPhone').value.trim();
  const hostSelect = document.getElementById('hostSelect');
  const hostName = hostSelect.value;

  if (!visitorName || !hostName) {
    showToast('Please fill in all required fields', true);
    return;
  }

  try {
    await visitorApi.signIn({
      name: visitorName,
      phone: visitorPhone || null,
      hostName: hostName
    });

    // Show success screen
    document.getElementById('successTitle').textContent = 'Signed In!';
    document.getElementById('successMessage').textContent = `Welcome, ${visitorName}`;

    showScreen('successScreen');

    // Reset form
    document.getElementById('signInForm').reset();

    // Start countdown to return to welcome
    startCountdown(5, () => {
      showScreen('welcomeScreen');
    });

  } catch (error) {
    showToast('Failed to sign in. Please try again.', true);
  }
}

// ============================================
// SIGN OUT
// ============================================

async function loadSignedInVisitors() {
  const list = document.getElementById('signOutList');
  if (!list) return;

  list.innerHTML = '<div class="loading-state">Loading...</div>';

  try {
    const response = await visitorApi.getSignedIn();
    currentVisitors = response.visitors || [];

    renderSignOutList(currentVisitors);
  } catch (error) {
    list.innerHTML = '<div class="empty-state">Failed to load visitors</div>';
  }
}

function renderSignOutList(visitors) {
  const list = document.getElementById('signOutList');

  if (visitors.length === 0) {
    list.innerHTML = '<div class="empty-state">No one is currently signed in</div>';
    return;
  }

  list.innerHTML = visitors.map(visitor => `
    <div class="visitor-item" onclick="selectVisitorForSignOut('${visitor.id}')">
      <div class="visitor-item-name">${escapeHtml(visitor.name)}</div>
      <div class="visitor-item-detail">Signed in at ${formatTime(visitor.signedInAt)}</div>
    </div>
  `).join('');
}

function filterSignOutList() {
  const searchTerm = document.getElementById('signOutSearch').value.toLowerCase().trim();

  if (!searchTerm) {
    renderSignOutList(currentVisitors);
    return;
  }

  const filtered = currentVisitors.filter(v =>
    v.name.toLowerCase().includes(searchTerm)
  );

  renderSignOutList(filtered);
}

function selectVisitorForSignOut(visitorId) {
  const visitor = currentVisitors.find(v => v.id === visitorId);
  if (!visitor) return;

  selectedVisitorForSignOut = visitor;

  // Update confirm modal
  document.getElementById('confirmVisitorName').textContent =
    `Sign out ${visitor.name}?`;

  // Show modal
  document.getElementById('signOutConfirmModal').style.display = 'flex';
}

function closeSignOutConfirm() {
  document.getElementById('signOutConfirmModal').style.display = 'none';
  selectedVisitorForSignOut = null;
}

async function confirmSignOut() {
  if (!selectedVisitorForSignOut) return;

  // Save visitor name before closeSignOutConfirm() clears selectedVisitorForSignOut
  const visitorName = selectedVisitorForSignOut.name;

  try {
    await visitorApi.signOut(selectedVisitorForSignOut.id);

    closeSignOutConfirm();

    // Show success screen
    document.getElementById('successTitle').textContent = 'Signed Out!';
    document.getElementById('successMessage').textContent = `Goodbye, ${visitorName}`;

    showScreen('successScreen');

    // Clear search
    document.getElementById('signOutSearch').value = '';

    // Reload visitors list
    await loadSignedInVisitors();

    // Start countdown to return to welcome
    startCountdown(5, () => {
      showScreen('welcomeScreen');
    });

  } catch (error) {
    showToast('Failed to sign out. Please try again.', true);
  }
}

// ============================================
// UTILITIES
// ============================================

function showScreen(screenId) {
  // Clear any running countdown
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }

  // Hide all screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });

  // Show target screen
  document.getElementById(screenId).classList.add('active');

  // Refresh data when showing certain screens
  if (screenId === 'signOutScreen') {
    loadSignedInVisitors();
    document.getElementById('signOutSearch').value = '';
  }
}

function startCountdown(seconds, callback) {
  let remaining = seconds;

  countdownTimer = setInterval(() => {
    remaining--;

    if (remaining <= 0) {
      clearInterval(countdownTimer);
      countdownTimer = null;
      callback();
    }
  }, 1000);
}

function showToast(message, isError = false) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'error' : 'success'}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// ============================================
// PWA / SERVICE WORKER / INSTALL
// ============================================

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered'))
      .catch(err => console.log('Service Worker registration failed:', err));
  }
}

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the default mini-infobar
  e.preventDefault();

  // Store the event for later use
  deferredInstallPrompt = e;

  // Check if user has dismissed the banner recently
  const dismissed = localStorage.getItem('installBannerDismissed');
  if (dismissed) {
    const dismissedTime = parseInt(dismissed, 10);
    const hoursSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60);
    // Don't show again for 24 hours after dismissal
    if (hoursSinceDismissed < 24) {
      return;
    }
  }

  // Show the install banner
  showInstallBanner();
});

// Listen for successful install
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  hideInstallBanner();
  deferredInstallPrompt = null;
  // Clear any dismissal tracking
  localStorage.removeItem('installBannerDismissed');
});

function showInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) {
    banner.style.display = 'flex';
  }
}

function hideInstallBanner() {
  const banner = document.getElementById('installBanner');
  if (banner) {
    banner.style.display = 'none';
  }
}

function dismissInstallBanner() {
  hideInstallBanner();
  // Remember dismissal for 24 hours
  localStorage.setItem('installBannerDismissed', Date.now().toString());
}

async function installApp() {
  if (!deferredInstallPrompt) {
    console.log('No install prompt available');
    return;
  }

  // Show the install prompt
  deferredInstallPrompt.prompt();

  // Wait for the user to respond to the prompt
  const { outcome } = await deferredInstallPrompt.userChoice;
  console.log(`User response to install prompt: ${outcome}`);

  // Clear the deferred prompt
  deferredInstallPrompt = null;

  // Hide the banner
  hideInstallBanner();
}

// Check if running as installed PWA
function isRunningAsPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true;
}

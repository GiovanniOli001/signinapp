// ============================================
// SIGN IN APP - MAIN APPLICATION
// VitalHub Ipswich Visitor Kiosk
// ============================================

// ============================================
// STATE
// ============================================

let currentVisitors = [];
let hosts = [];
let settings = {
  logoUrl: '',
  backgroundUrl: ''
};
let settingsTapCount = 0;
let settingsTapTimer = null;
let countdownTimer = null;
let selectedVisitorForSignOut = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  // Load settings (branding)
  await loadSettings();

  // Load hosts for autocomplete
  await loadHosts();

  // Set up form handlers
  setupFormHandlers();

  // Set up settings trigger (discrete corner tap)
  setupSettingsTrigger();

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
    // Use defaults
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

  // Update settings form previews if elements exist
  updateBrandingPreviews();
}

function updateBrandingPreviews() {
  // Logo preview
  const logoPreview = document.getElementById('logoPreview');
  const logoPlaceholder = document.getElementById('logoPlaceholder');
  const logoUrlInput = document.getElementById('logoUrl');

  if (logoPreview && logoPlaceholder) {
    if (settings.logoUrl) {
      logoPreview.src = settings.logoUrl;
      logoPreview.style.display = 'block';
      logoPlaceholder.style.display = 'none';
      logoPreview.onerror = () => {
        logoPreview.style.display = 'none';
        logoPlaceholder.style.display = 'flex';
        logoPlaceholder.textContent = 'Failed to load image';
      };
    } else {
      logoPreview.style.display = 'none';
      logoPlaceholder.style.display = 'flex';
      logoPlaceholder.textContent = 'No logo set';
    }
  }

  if (logoUrlInput && !settings.logoUrl?.startsWith('data:')) {
    logoUrlInput.value = settings.logoUrl || '';
  }

  // Background preview
  const bgPreview = document.getElementById('backgroundPreview');
  const bgPlaceholder = document.getElementById('backgroundPlaceholder');
  const bgUrlInput = document.getElementById('backgroundUrl');

  if (bgPreview && bgPlaceholder) {
    if (settings.backgroundUrl) {
      bgPreview.style.backgroundImage = `url(${settings.backgroundUrl})`;
      bgPreview.style.display = 'block';
      bgPlaceholder.style.display = 'none';
    } else {
      bgPreview.style.display = 'none';
      bgPlaceholder.style.display = 'flex';
      bgPlaceholder.textContent = 'No background set';
    }
  }

  if (bgUrlInput && !settings.backgroundUrl?.startsWith('data:')) {
    bgUrlInput.value = settings.backgroundUrl || '';
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

  // Settings login form
  document.getElementById('settingsLoginForm').addEventListener('submit', handleSettingsLogin);

  // Change password form
  document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
}

function setupSettingsTrigger() {
  const trigger = document.getElementById('settingsTrigger');

  trigger.addEventListener('click', () => {
    settingsTapCount++;

    if (settingsTapTimer) clearTimeout(settingsTapTimer);

    // Require 5 taps within 2 seconds
    if (settingsTapCount >= 5) {
      settingsTapCount = 0;
      showScreen('settingsLoginScreen');
    } else {
      settingsTapTimer = setTimeout(() => {
        settingsTapCount = 0;
      }, 2000);
    }
  });
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

  try {
    await visitorApi.signOut(selectedVisitorForSignOut.id);

    closeSignOutConfirm();

    // Show success screen
    document.getElementById('successTitle').textContent = 'Signed Out!';
    document.getElementById('successMessage').textContent = `Goodbye, ${selectedVisitorForSignOut.name}`;

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
// SETTINGS - LOGIN
// ============================================

async function handleSettingsLogin(e) {
  e.preventDefault();

  const password = document.getElementById('settingsPassword').value;

  try {
    const response = await authApi.login(password);
    localStorage.setItem('adminToken', response.token);

    document.getElementById('settingsPassword').value = '';
    showSettingsScreen();

  } catch (error) {
    showToast('Invalid password', true);
  }
}

function showSettingsScreen() {
  showScreen('settingsScreen');
  loadEvacuationList();
  loadHostsSettings();
  updateBrandingPreviews();
}

function logoutSettings() {
  showScreen('welcomeScreen');
}

// ============================================
// SETTINGS - TABS
// ============================================

function switchSettingsTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.settings-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.settings-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });

  // Load data for specific tabs
  if (tabName === 'evacuation') {
    loadEvacuationList();
  } else if (tabName === 'hosts') {
    loadHostsSettings();
  } else if (tabName === 'branding') {
    updateBrandingPreviews();
  }
}

// ============================================
// SETTINGS - EVACUATION LIST
// ============================================

async function loadEvacuationList() {
  const list = document.getElementById('evacuationList');
  const countEl = document.getElementById('evacuationCount');

  list.innerHTML = '<div class="loading-state">Loading...</div>';

  try {
    const response = await visitorApi.getSignedIn();
    const visitors = response.visitors || [];

    countEl.textContent = `${visitors.length} visitor${visitors.length !== 1 ? 's' : ''}`;

    if (visitors.length === 0) {
      list.innerHTML = '<div class="empty-state">No visitors currently signed in</div>';
      return;
    }

    list.innerHTML = visitors.map(visitor => `
      <div class="evacuation-item">
        <div class="evacuation-name">${escapeHtml(visitor.name)}</div>
        <div class="evacuation-detail">
          ${visitor.hostName ? `Visiting: ${escapeHtml(visitor.hostName)}` : ''}
          ${visitor.phone ? ` | ${escapeHtml(visitor.phone)}` : ''}
        </div>
      </div>
    `).join('');

  } catch (error) {
    list.innerHTML = '<div class="empty-state">Failed to load evacuation list</div>';
    countEl.textContent = 'Error';
  }
}

// ============================================
// SETTINGS - BRANDING (Upload + URL)
// ============================================

async function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Check file size (max 500KB for base64 storage)
  if (file.size > 500 * 1024) {
    showToast('Image too large. Max 500KB.', true);
    return;
  }

  try {
    const base64 = await fileToBase64(file);
    await saveBrandingSetting('logoUrl', base64);
    showToast('Logo uploaded');
  } catch (error) {
    showToast('Failed to upload logo', true);
  }

  // Reset file input
  event.target.value = '';
}

async function handleBackgroundUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Check file size (max 2MB for base64 storage)
  if (file.size > 2 * 1024 * 1024) {
    showToast('Image too large. Max 2MB.', true);
    return;
  }

  try {
    const base64 = await fileToBase64(file);
    await saveBrandingSetting('backgroundUrl', base64);
    showToast('Background uploaded');
  } catch (error) {
    showToast('Failed to upload background', true);
  }

  // Reset file input
  event.target.value = '';
}

async function saveLogoUrl() {
  const url = document.getElementById('logoUrl').value.trim();

  if (!url) {
    showToast('Enter a URL', true);
    return;
  }

  try {
    await saveBrandingSetting('logoUrl', url);
    showToast('Logo URL saved');
  } catch (error) {
    showToast('Failed to save logo URL', true);
  }
}

async function saveBackgroundUrl() {
  const url = document.getElementById('backgroundUrl').value.trim();

  if (!url) {
    showToast('Enter a URL', true);
    return;
  }

  try {
    await saveBrandingSetting('backgroundUrl', url);
    showToast('Background URL saved');
  } catch (error) {
    showToast('Failed to save background URL', true);
  }
}

async function clearLogo() {
  try {
    await saveBrandingSetting('logoUrl', '');
    document.getElementById('logoUrl').value = '';
    showToast('Logo cleared');
  } catch (error) {
    showToast('Failed to clear logo', true);
  }
}

async function clearBackground() {
  try {
    await saveBrandingSetting('backgroundUrl', '');
    document.getElementById('backgroundUrl').value = '';
    showToast('Background cleared');
  } catch (error) {
    showToast('Failed to clear background', true);
  }
}

async function saveBrandingSetting(key, value) {
  const data = {};
  data[key] = value;

  await settingsApi.save(data);

  settings[key] = value;
  applyBranding();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================
// SETTINGS - HOSTS
// ============================================

async function loadHostsSettings() {
  const list = document.getElementById('hostsList');

  try {
    const response = await hostsApi.getAll();
    hosts = response.hosts || [];

    if (hosts.length === 0) {
      list.innerHTML = '<div class="empty-state">No hosts configured</div>';
      return;
    }

    list.innerHTML = hosts.map(host => `
      <div class="host-item">
        <span>${escapeHtml(host.name)}</span>
        <button type="button" class="btn-delete" onclick="deleteHost('${host.id}')" title="Delete">X</button>
      </div>
    `).join('');

  } catch (error) {
    list.innerHTML = '<div class="empty-state">Failed to load hosts</div>';
  }
}

async function addHost() {
  const input = document.getElementById('newHostInput');
  const name = input.value.trim();

  if (!name) {
    showToast('Enter a host name', true);
    return;
  }

  try {
    await hostsApi.create(name);
    input.value = '';
    await loadHostsSettings();
    await loadHosts(); // Refresh main hosts list and dropdown
    showToast('Host added');
  } catch (error) {
    showToast('Failed to add host', true);
  }
}

async function deleteHost(id) {
  try {
    await hostsApi.delete(id);
    await loadHostsSettings();
    await loadHosts(); // Refresh main hosts list and dropdown
    showToast('Host deleted');
  } catch (error) {
    showToast('Failed to delete host', true);
  }
}

// ============================================
// SETTINGS - PASSWORD
// ============================================

async function handleChangePassword(e) {
  e.preventDefault();

  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;

  if (newPassword.length < 4) {
    showToast('Password must be at least 4 characters', true);
    return;
  }

  try {
    await authApi.changePassword(currentPassword, newPassword);
    document.getElementById('changePasswordForm').reset();
    showToast('Password changed successfully');
  } catch (error) {
    showToast('Failed to change password. Check current password.', true);
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

function formatDateTime(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// ============================================
// PWA / SERVICE WORKER
// ============================================

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('Service Worker registered'))
      .catch(err => console.log('Service Worker registration failed:', err));
  }
}

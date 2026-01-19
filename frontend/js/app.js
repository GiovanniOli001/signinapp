// ============================================
// SIGN IN APP - MAIN APPLICATION
// VitalHub Ipswich Visitor Kiosk
// ============================================

// ============================================
// STATE
// ============================================

let currentVisitors = [];
let allVisitors = [];
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
  if (settings.logoUrl) {
    logoImg.src = settings.logoUrl;
    logoImg.style.display = 'block';
    logoImg.onerror = () => {
      logoImg.style.display = 'none';
    };
  } else {
    logoImg.style.display = 'none';
  }

  // Apply background image
  const bgContainer = document.getElementById('backgroundImage');
  if (settings.backgroundUrl) {
    bgContainer.style.backgroundImage = `url(${settings.backgroundUrl})`;
  } else {
    bgContainer.style.backgroundImage = 'none';
  }

  // Update settings form fields if on settings screen
  const logoInput = document.getElementById('logoUrl');
  const bgInput = document.getElementById('backgroundUrl');
  if (logoInput) logoInput.value = settings.logoUrl || '';
  if (bgInput) bgInput.value = settings.backgroundUrl || '';
}

async function loadHosts() {
  try {
    const response = await hostsApi.getAll();
    hosts = response.hosts || [];
  } catch (error) {
    console.error('Failed to load hosts:', error);
    hosts = [];
  }
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
  const hostName = document.getElementById('hostName').value.trim();

  if (!visitorName || !hostName) {
    showToast('Please fill in required fields', true);
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
  applyBranding(); // Refresh branding inputs
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
// SETTINGS - BRANDING
// ============================================

async function saveBranding() {
  const logoUrl = document.getElementById('logoUrl').value.trim();
  const backgroundUrl = document.getElementById('backgroundUrl').value.trim();

  try {
    await settingsApi.save({
      logoUrl,
      backgroundUrl
    });

    settings.logoUrl = logoUrl;
    settings.backgroundUrl = backgroundUrl;

    applyBranding();
    showToast('Branding saved');

  } catch (error) {
    showToast('Failed to save branding', true);
  }
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
    await loadHosts(); // Refresh main hosts list
    showToast('Host added');
  } catch (error) {
    showToast('Failed to add host', true);
  }
}

async function deleteHost(id) {
  try {
    await hostsApi.delete(id);
    await loadHostsSettings();
    await loadHosts(); // Refresh main hosts list
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
// ADMIN DASHBOARD
// ============================================

function showAdminDashboard() {
  showScreen('adminScreen');

  // Set default date range to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('adminDateFrom').value = today;
  document.getElementById('adminDateTo').value = today;

  loadAdminData();
}

function logoutAdmin() {
  localStorage.removeItem('adminToken');
  showScreen('welcomeScreen');
}

async function loadAdminData() {
  const tbody = document.getElementById('adminTableBody');
  const fromDate = document.getElementById('adminDateFrom').value;
  const toDate = document.getElementById('adminDateTo').value;

  if (!fromDate || !toDate) {
    showToast('Please select date range', true);
    return;
  }

  tbody.innerHTML = '<tr><td colspan="6" class="loading-state">Loading...</td></tr>';

  try {
    const response = await visitorApi.getByDateRange(fromDate, toDate);
    allVisitors = response.visitors || [];

    if (allVisitors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No visitors found</td></tr>';
      return;
    }

    tbody.innerHTML = allVisitors.map(visitor => `
      <tr>
        <td>${formatDateTime(visitor.signedInAt)}</td>
        <td>${escapeHtml(visitor.name)}</td>
        <td>${visitor.phone ? escapeHtml(visitor.phone) : '-'}</td>
        <td>${visitor.hostName ? escapeHtml(visitor.hostName) : '-'}</td>
        <td>
          <span class="status-badge ${visitor.signedOutAt ? 'status-out' : 'status-in'}">
            ${visitor.signedOutAt ? 'Signed Out' : 'Signed In'}
          </span>
        </td>
        <td>${visitor.signedOutAt ? formatDateTime(visitor.signedOutAt) : '-'}</td>
      </tr>
    `).join('');

  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Failed to load data</td></tr>';
  }
}

function exportToCSV() {
  if (!allVisitors || allVisitors.length === 0) {
    showToast('No data to export', true);
    return;
  }

  // Build CSV
  const headers = ['Date/Time In', 'Visitor Name', 'Phone', 'Host', 'Status', 'Date/Time Out'];
  const rows = allVisitors.map(v => [
    formatDateTime(v.signedInAt),
    v.name,
    v.phone || '',
    v.hostName || '',
    v.signedOutAt ? 'Signed Out' : 'Signed In',
    v.signedOutAt ? formatDateTime(v.signedOutAt) : ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visitor-log-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Report exported');
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

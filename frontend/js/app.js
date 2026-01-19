// ============================================
// SIGN IN APP - MAIN APPLICATION
// ============================================

// ============================================
// STATE
// ============================================

let visitReasons = [];
let currentVisitors = [];
let adminTapCount = 0;
let adminTapTimer = null;
let countdownTimer = null;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  init();
});

async function init() {
  // Load visit reasons
  await loadVisitReasons();

  // Set up form handlers
  setupFormHandlers();

  // Check if admin is logged in
  checkAdminSession();

  // Register service worker for PWA
  registerServiceWorker();
}

async function loadVisitReasons() {
  try {
    const response = await reasonsApi.getAll();
    visitReasons = response.reasons || [];
    populateReasonDropdown();
  } catch (error) {
    console.error('Failed to load visit reasons:', error);
    // Use defaults if API fails
    visitReasons = [
      { id: '1', name: 'Appointment' },
      { id: '2', name: 'Walk-in' },
      { id: '3', name: 'Follow-up' },
      { id: '4', name: 'Other' }
    ];
    populateReasonDropdown();
  }
}

function populateReasonDropdown() {
  const select = document.getElementById('visitReason');
  select.innerHTML = '<option value="">Select a reason...</option>';

  visitReasons.forEach(reason => {
    const option = document.createElement('option');
    option.value = reason.id;
    option.textContent = reason.name;
    select.appendChild(option);
  });
}

function setupFormHandlers() {
  // Sign in form
  document.getElementById('signInForm').addEventListener('submit', handleSignIn);

  // Admin login form
  document.getElementById('adminLoginForm').addEventListener('submit', handleAdminLogin);

  // Change password form
  document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);
}

// ============================================
// SIGN IN / SIGN OUT
// ============================================

async function handleSignIn(e) {
  e.preventDefault();

  const firstName = document.getElementById('firstName').value.trim();
  const lastName = document.getElementById('lastName').value.trim();
  const reasonId = document.getElementById('visitReason').value;

  if (!firstName || !lastName || !reasonId) {
    showToast('Please fill in all fields', true);
    return;
  }

  const reason = visitReasons.find(r => r.id === reasonId);

  try {
    await visitorApi.signIn({
      firstName,
      lastName,
      reasonId,
      reasonName: reason?.name || 'Unknown'
    });

    // Show success screen
    document.getElementById('successMessage').textContent =
      `Thanks ${firstName}! You're now signed in.`;

    showScreen('successScreen');

    // Start countdown to return to kiosk
    startCountdown('countdown', 5, () => {
      showScreen('kioskScreen');
      document.getElementById('signInForm').reset();
    });

  } catch (error) {
    showToast('Failed to sign in. Please try again.', true);
  }
}

function showSignOutModal() {
  loadSignedInVisitors();
  document.getElementById('signOutModal').style.display = 'flex';
}

function closeSignOutModal() {
  document.getElementById('signOutModal').style.display = 'none';
}

async function loadSignedInVisitors() {
  const list = document.getElementById('signOutList');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const response = await visitorApi.getSignedIn();
    currentVisitors = response.visitors || [];

    if (currentVisitors.length === 0) {
      list.innerHTML = '<div class="empty-state">No one is currently signed in</div>';
      return;
    }

    list.innerHTML = currentVisitors.map(visitor => `
      <div class="signout-item" onclick="signOutVisitor('${visitor.id}')">
        <div class="signout-item-info">
          <h3>${escapeHtml(visitor.firstName)} ${escapeHtml(visitor.lastName)}</h3>
          <p>${escapeHtml(visitor.reasonName)} - ${formatTime(visitor.signedInAt)}</p>
        </div>
        <span>→</span>
      </div>
    `).join('');

  } catch (error) {
    list.innerHTML = '<div class="empty-state">Failed to load visitors</div>';
  }
}

async function signOutVisitor(visitorId) {
  try {
    await visitorApi.signOut(visitorId);

    closeSignOutModal();
    showScreen('signOutSuccessScreen');

    // Start countdown to return to kiosk
    startCountdown('signoutCountdown', 5, () => {
      showScreen('kioskScreen');
    });

  } catch (error) {
    showToast('Failed to sign out. Please try again.', true);
  }
}

// ============================================
// ADMIN
// ============================================

function handleAdminTrigger() {
  adminTapCount++;

  if (adminTapTimer) clearTimeout(adminTapTimer);

  // Require 5 taps within 2 seconds
  if (adminTapCount >= 5) {
    adminTapCount = 0;
    showScreen('adminLoginScreen');
  } else {
    adminTapTimer = setTimeout(() => {
      adminTapCount = 0;
    }, 2000);
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();

  const password = document.getElementById('adminPassword').value;

  try {
    const response = await authApi.login(password);
    localStorage.setItem('adminToken', response.token);

    document.getElementById('adminPassword').value = '';
    showAdminDashboard();

  } catch (error) {
    showToast('Invalid password', true);
  }
}

function checkAdminSession() {
  const token = localStorage.getItem('adminToken');
  if (token) {
    // Verify token is still valid
    authApi.verify().catch(() => {
      localStorage.removeItem('adminToken');
    });
  }
}

async function showAdminDashboard() {
  showScreen('adminScreen');
  await loadTodayVisitors();
  loadReasonsSettings();
}

function logout() {
  localStorage.removeItem('adminToken');
  showScreen('kioskScreen');
}

function showKiosk() {
  showScreen('kioskScreen');
}

// ============================================
// ADMIN TABS
// ============================================

function switchAdminTab(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });

  // Load data for the tab
  if (tabName === 'today') {
    loadTodayVisitors();
  } else if (tabName === 'settings') {
    loadReasonsSettings();
  }
}

// ============================================
// TODAY'S VISITORS
// ============================================

async function loadTodayVisitors() {
  const list = document.getElementById('visitorList');
  list.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const [visitorsResponse, statsResponse] = await Promise.all([
      visitorApi.getSignedIn(),
      visitorApi.getTodayStats()
    ]);

    currentVisitors = visitorsResponse.visitors || [];
    const stats = statsResponse;

    // Update stats
    document.getElementById('statSignedIn').textContent = stats.signedIn || 0;
    document.getElementById('statTotal').textContent = stats.total || 0;

    // Render visitor list
    if (currentVisitors.length === 0) {
      list.innerHTML = '<div class="empty-state">No one is currently signed in</div>';
      return;
    }

    list.innerHTML = currentVisitors.map(visitor => `
      <div class="visitor-card">
        <div class="visitor-info">
          <h3>${escapeHtml(visitor.firstName)} ${escapeHtml(visitor.lastName)}</h3>
          <p>${escapeHtml(visitor.reasonName)}</p>
        </div>
        <div class="visitor-actions">
          <span class="visitor-time">${formatTime(visitor.signedInAt)}</span>
          <button class="btn btn-small btn-secondary" onclick="adminSignOut('${visitor.id}')">
            Sign Out
          </button>
        </div>
      </div>
    `).join('');

  } catch (error) {
    list.innerHTML = '<div class="empty-state">Failed to load visitors</div>';
  }
}

function refreshVisitors() {
  loadTodayVisitors();
}

async function adminSignOut(visitorId) {
  try {
    await visitorApi.signOut(visitorId);
    showToast('Visitor signed out');
    loadTodayVisitors();
  } catch (error) {
    showToast('Failed to sign out visitor', true);
  }
}

// ============================================
// REPORTS
// ============================================

async function generateReport() {
  const fromDate = document.getElementById('reportDateFrom').value;
  const toDate = document.getElementById('reportDateTo').value;

  if (!fromDate || !toDate) {
    showToast('Please select date range', true);
    return;
  }

  const results = document.getElementById('reportResults');
  results.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

  try {
    const response = await visitorApi.getByDateRange(fromDate, toDate);
    const visitors = response.visitors || [];

    if (visitors.length === 0) {
      results.innerHTML = '<div class="empty-state">No visitors found for this date range</div>';
      return;
    }

    results.innerHTML = `
      <p>${visitors.length} visitors found</p>
      <table class="report-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>Reason</th>
            <th>Signed In</th>
            <th>Signed Out</th>
            <th>Duration</th>
          </tr>
        </thead>
        <tbody>
          ${visitors.map(v => `
            <tr>
              <td>${formatDate(v.signedInAt)}</td>
              <td>${escapeHtml(v.firstName)} ${escapeHtml(v.lastName)}</td>
              <td>${escapeHtml(v.reasonName)}</td>
              <td>${formatTime(v.signedInAt)}</td>
              <td>${v.signedOutAt ? formatTime(v.signedOutAt) : '-'}</td>
              <td>${v.signedOutAt ? calculateDuration(v.signedInAt, v.signedOutAt) : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    // Store for export
    window.lastReportData = visitors;

  } catch (error) {
    results.innerHTML = '<div class="empty-state">Failed to generate report</div>';
  }
}

function exportReport() {
  const visitors = window.lastReportData;

  if (!visitors || visitors.length === 0) {
    showToast('Generate a report first', true);
    return;
  }

  // Build CSV
  const headers = ['Date', 'First Name', 'Last Name', 'Reason', 'Signed In', 'Signed Out', 'Duration'];
  const rows = visitors.map(v => [
    formatDate(v.signedInAt),
    v.firstName,
    v.lastName,
    v.reasonName,
    formatTime(v.signedInAt),
    v.signedOutAt ? formatTime(v.signedOutAt) : '',
    v.signedOutAt ? calculateDuration(v.signedInAt, v.signedOutAt) : ''
  ]);

  const csv = [
    headers.join(','),
    ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
  ].join('\n');

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `visitor-report-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Report exported');
}

// ============================================
// SETTINGS - REASONS
// ============================================

async function loadReasonsSettings() {
  const list = document.getElementById('reasonsList');

  try {
    const response = await reasonsApi.getAll();
    visitReasons = response.reasons || [];

    if (visitReasons.length === 0) {
      list.innerHTML = '<div class="empty-state">No reasons configured</div>';
      return;
    }

    list.innerHTML = visitReasons.map(reason => `
      <div class="reason-item">
        <span>${escapeHtml(reason.name)}</span>
        <button onclick="deleteReason('${reason.id}')" title="Delete">×</button>
      </div>
    `).join('');

  } catch (error) {
    list.innerHTML = '<div class="empty-state">Failed to load reasons</div>';
  }
}

async function addReason() {
  const input = document.getElementById('newReasonInput');
  const name = input.value.trim();

  if (!name) {
    showToast('Enter a reason name', true);
    return;
  }

  try {
    await reasonsApi.create(name);
    input.value = '';
    await loadReasonsSettings();
    await loadVisitReasons(); // Refresh kiosk dropdown
    showToast('Reason added');
  } catch (error) {
    showToast('Failed to add reason', true);
  }
}

async function deleteReason(id) {
  if (!confirm('Delete this reason?')) return;

  try {
    await reasonsApi.delete(id);
    await loadReasonsSettings();
    await loadVisitReasons(); // Refresh kiosk dropdown
    showToast('Reason deleted');
  } catch (error) {
    showToast('Failed to delete reason', true);
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

  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

function startCountdown(elementId, seconds, callback) {
  const el = document.getElementById(elementId);
  let remaining = seconds;
  el.textContent = remaining;

  countdownTimer = setInterval(() => {
    remaining--;
    el.textContent = remaining;

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

function formatDate(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function calculateDuration(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate - startDate;
  const diffMins = Math.round(diffMs / 60000);

  if (diffMins < 60) {
    return `${diffMins}m`;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return `${hours}h ${mins}m`;
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

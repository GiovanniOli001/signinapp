// ============================================
// SIGN IN APP - ADMIN DASHBOARD
// Desktop Application
// ============================================

let allVisitors = [];

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  init();
});

function init() {
  // Set up form handlers
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // Set default date range to today
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('dateFrom').value = today;
  document.getElementById('dateTo').value = today;

  // Check if already logged in
  const token = localStorage.getItem('adminToken');
  if (token) {
    verifyAndShowDashboard();
  }
}

async function verifyAndShowDashboard() {
  try {
    await authApi.verify();
    showDashboard();
  } catch (error) {
    localStorage.removeItem('adminToken');
    showScreen('loginScreen');
  }
}

// ============================================
// AUTH
// ============================================

async function handleLogin(e) {
  e.preventDefault();

  const password = document.getElementById('password').value;

  try {
    const response = await authApi.login(password);
    localStorage.setItem('adminToken', response.token);
    document.getElementById('password').value = '';
    showDashboard();
  } catch (error) {
    showToast('Invalid password', true);
  }
}

function logout() {
  localStorage.removeItem('adminToken');
  showScreen('loginScreen');
}

// ============================================
// DASHBOARD
// ============================================

async function showDashboard() {
  showScreen('dashboardScreen');
  await loadStats();
  await loadVisitors();
}

async function loadStats() {
  try {
    const stats = await visitorApi.getTodayStats();
    document.getElementById('statSignedIn').textContent = stats.signedIn || 0;
    document.getElementById('statToday').textContent = stats.total || 0;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

async function loadVisitors() {
  const tbody = document.getElementById('visitorsTableBody');
  const fromDate = document.getElementById('dateFrom').value;
  const toDate = document.getElementById('dateTo').value;
  const statusFilter = document.getElementById('statusFilter').value;

  if (!fromDate || !toDate) {
    showToast('Please select date range', true);
    return;
  }

  tbody.innerHTML = '<tr><td colspan="7" class="loading">Loading...</td></tr>';

  try {
    const response = await visitorApi.getByDateRange(fromDate, toDate);
    allVisitors = response.visitors || [];

    // Apply status filter
    let filtered = allVisitors;
    if (statusFilter === 'signed-in') {
      filtered = allVisitors.filter(v => !v.signedOutAt);
    } else if (statusFilter === 'signed-out') {
      filtered = allVisitors.filter(v => v.signedOutAt);
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">No visitors found</td></tr>';
      return;
    }

    tbody.innerHTML = filtered.map(visitor => `
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
        <td>
          ${!visitor.signedOutAt ? `<button class="btn-action" onclick="signOutVisitor('${visitor.id}')">Sign Out</button>` : ''}
        </td>
      </tr>
    `).join('');

  } catch (error) {
    tbody.innerHTML = '<tr><td colspan="7" class="error">Failed to load visitors</td></tr>';
  }
}

async function signOutVisitor(visitorId) {
  try {
    await visitorApi.signOut(visitorId);
    showToast('Visitor signed out');
    await loadStats();
    await loadVisitors();
  } catch (error) {
    showToast('Failed to sign out visitor', true);
  }
}

function exportToCSV() {
  const statusFilter = document.getElementById('statusFilter').value;

  // Apply same filter as display
  let filtered = allVisitors;
  if (statusFilter === 'signed-in') {
    filtered = allVisitors.filter(v => !v.signedOutAt);
  } else if (statusFilter === 'signed-out') {
    filtered = allVisitors.filter(v => v.signedOutAt);
  }

  if (filtered.length === 0) {
    showToast('No data to export', true);
    return;
  }

  // Build CSV
  const headers = ['Date/Time In', 'Visitor Name', 'Phone', 'Host', 'Status', 'Date/Time Out'];
  const rows = filtered.map(v => [
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
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
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

// ============================================
// SIGN IN APP - ADMIN DASHBOARD
// Desktop Application
// ============================================

let allVisitors = [];
let hosts = [];
let settings = {
  logoUrl: '',
  backgroundUrl: ''
};
let visitorChart = null;
let chartRange = 7;

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  init();
});

function init() {
  // Set up form handlers
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('changePasswordForm').addEventListener('submit', handleChangePassword);

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
  await loadChartData(chartRange);
  await loadAnalytics();
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
// CHART & ANALYTICS
// ============================================

async function loadChartData(days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days + 1);

  try {
    const response = await visitorApi.getByDateRange(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const visitors = response.visitors || [];

    // Group by date
    const dailyCounts = {};
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      dailyCounts[dateStr] = 0;
    }

    visitors.forEach(v => {
      const date = v.signedInAt.split('T')[0];
      if (dailyCounts[date] !== undefined) {
        dailyCounts[date]++;
      }
    });

    const labels = Object.keys(dailyCounts).map(date => {
      const d = new Date(date);
      return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric' });
    });
    const data = Object.values(dailyCounts);

    renderChart(labels, data);
  } catch (error) {
    console.error('Failed to load chart data:', error);
  }
}

function renderChart(labels, data) {
  const ctx = document.getElementById('visitorChart').getContext('2d');

  if (visitorChart) {
    visitorChart.destroy();
  }

  visitorChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Visitors',
        data: data,
        borderColor: '#1e3a5f',
        backgroundColor: 'rgba(30, 58, 95, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#1e3a5f',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#1e3a5f',
          titleFont: { size: 14 },
          bodyFont: { size: 13 },
          padding: 12,
          cornerRadius: 8
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: '#6b7280'
          },
          grid: {
            color: 'rgba(0,0,0,0.05)'
          }
        },
        x: {
          ticks: {
            color: '#6b7280'
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

function updateChartRange(days) {
  chartRange = days;

  // Update button states
  document.querySelectorAll('.chart-range-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.range) === days);
  });

  loadChartData(days);
  loadAnalytics();
}

async function loadAnalytics() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - chartRange + 1);

  try {
    const response = await visitorApi.getByDateRange(
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    );

    const visitors = response.visitors || [];

    // Calculate peak sign-in hour
    const hourCounts = {};
    visitors.forEach(v => {
      const hour = new Date(v.signedInAt).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    let peakHour = null;
    let peakCount = 0;
    for (const [hour, count] of Object.entries(hourCounts)) {
      if (count > peakCount) {
        peakCount = count;
        peakHour = parseInt(hour);
      }
    }

    if (peakHour !== null) {
      const startHour = peakHour;
      const endHour = (peakHour + 1) % 24;
      document.getElementById('peakTime').textContent =
        `${formatHour(startHour)} - ${formatHour(endHour)}`;
      document.getElementById('peakTimeLabel').textContent =
        `${peakCount} sign-ins in last ${chartRange} days`;
    } else {
      document.getElementById('peakTime').textContent = '-';
      document.getElementById('peakTimeLabel').textContent = 'No data';
    }

    // Calculate top host
    const hostCounts = {};
    visitors.forEach(v => {
      if (v.hostName) {
        hostCounts[v.hostName] = (hostCounts[v.hostName] || 0) + 1;
      }
    });

    let topHostName = null;
    let topHostCount = 0;
    for (const [host, count] of Object.entries(hostCounts)) {
      if (count > topHostCount) {
        topHostCount = count;
        topHostName = host;
      }
    }

    if (topHostName) {
      document.getElementById('topHost').textContent = topHostName;
      document.getElementById('topHostLabel').textContent =
        `${topHostCount} visitors`;
    } else {
      document.getElementById('topHost').textContent = '-';
      document.getElementById('topHostLabel').textContent = 'No data';
    }

    // Calculate daily average
    const uniqueDays = new Set(visitors.map(v => v.signedInAt.split('T')[0]));
    const avgPerDay = uniqueDays.size > 0
      ? (visitors.length / uniqueDays.size).toFixed(1)
      : 0;

    document.getElementById('dailyAvg').textContent = avgPerDay;
    document.getElementById('dailyAvgLabel').textContent =
      `visitors per day (${uniqueDays.size} active days)`;

  } catch (error) {
    console.error('Failed to load analytics:', error);
  }
}

function formatHour(hour) {
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h = hour % 12 || 12;
  return `${h}:00 ${ampm}`;
}

// ============================================
// TAB SWITCHING
// ============================================

function switchAdminTab(tabName) {
  // Update nav tabs
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  // Update tab content
  document.querySelectorAll('.admin-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });

  // Load data for settings tab
  if (tabName === 'settings') {
    loadSettingsData();
  }
}

async function loadSettingsData() {
  await loadBrandingSettings();
  await loadHostsSettings();
}

// ============================================
// SETTINGS - BRANDING
// ============================================

async function loadBrandingSettings() {
  try {
    const response = await settingsApi.get();
    settings = response.settings || {};
    updateBrandingPreviews();
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
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

async function handleLogoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

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

  event.target.value = '';
}

async function handleBackgroundUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

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
  updateBrandingPreviews();
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
    showToast('Host added');
  } catch (error) {
    showToast('Failed to add host', true);
  }
}

async function deleteHost(id) {
  try {
    await hostsApi.delete(id);
    await loadHostsSettings();
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

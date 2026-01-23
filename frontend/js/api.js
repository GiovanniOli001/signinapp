// ============================================
// SIGN IN APP - API CLIENT
// VitalHub Ipswich Visitor Kiosk
// ============================================

const API_BASE = 'https://signin-api.oliveri-john001.workers.dev';

/**
 * Make an API request
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;

  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  // Add auth token if logged in
  const token = localStorage.getItem('adminToken');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// ============================================
// VISITOR API
// ============================================

const visitorApi = {
  /**
   * Sign in a visitor
   */
  async signIn(data) {
    return apiRequest('/api/visitors/signin', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * Sign out a visitor (no survey)
   */
  async signOut(visitorId) {
    return apiRequest(`/api/visitors/${visitorId}/signout`, {
      method: 'POST'
    });
  },

  /**
   * Sign out a visitor with survey (participants)
   */
  async signOutWithSurvey(visitorId, surveyData) {
    return apiRequest(`/api/visitors/${visitorId}/signout-with-survey`, {
      method: 'POST',
      body: JSON.stringify(surveyData)
    });
  },

  /**
   * Get currently signed in visitors
   */
  async getSignedIn() {
    return apiRequest('/api/visitors/signed-in');
  },

  /**
   * Get visitors by date range
   */
  async getByDateRange(fromDate, toDate) {
    return apiRequest(`/api/visitors?from=${fromDate}&to=${toDate}`);
  },

  /**
   * Get today's stats
   */
  async getTodayStats() {
    return apiRequest('/api/visitors/stats/today');
  },

  /**
   * Get survey responses (admin)
   */
  async getSurveys(fromDate, toDate, ratingFilter = 'all') {
    let url = `/api/visitors/surveys`;
    const params = [];
    if (fromDate) params.push(`from=${fromDate}`);
    if (toDate) params.push(`to=${toDate}`);
    if (ratingFilter && ratingFilter !== 'all') params.push(`rating=${ratingFilter}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    return apiRequest(url);
  }
};

// ============================================
// HOSTS API
// ============================================

const hostsApi = {
  /**
   * Get all hosts
   */
  async getAll() {
    return apiRequest('/api/hosts');
  },

  /**
   * Create a host
   */
  async create(name) {
    return apiRequest('/api/hosts', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  /**
   * Delete a host
   */
  async delete(id) {
    return apiRequest(`/api/hosts/${id}`, {
      method: 'DELETE'
    });
  }
};

// ============================================
// SETTINGS API
// ============================================

const settingsApi = {
  /**
   * Get settings (branding)
   */
  async get() {
    return apiRequest('/api/settings');
  },

  /**
   * Save settings (branding)
   */
  async save(data) {
    return apiRequest('/api/settings', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};

// ============================================
// AUTH API
// ============================================

const authApi = {
  /**
   * Login with password
   */
  async login(password) {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  },

  /**
   * Change password
   */
  async changePassword(currentPassword, newPassword) {
    return apiRequest('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    });
  },

  /**
   * Verify token is valid
   */
  async verify() {
    return apiRequest('/api/auth/verify');
  }
};

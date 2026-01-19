// ============================================
// SIGN IN APP - API CLIENT
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
   * Sign out a visitor
   */
  async signOut(visitorId) {
    return apiRequest(`/api/visitors/${visitorId}/signout`, {
      method: 'POST'
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
  }
};

// ============================================
// REASONS API
// ============================================

const reasonsApi = {
  /**
   * Get all visit reasons
   */
  async getAll() {
    return apiRequest('/api/reasons');
  },

  /**
   * Create a visit reason
   */
  async create(name) {
    return apiRequest('/api/reasons', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
  },

  /**
   * Delete a visit reason
   */
  async delete(id) {
    return apiRequest(`/api/reasons/${id}`, {
      method: 'DELETE'
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

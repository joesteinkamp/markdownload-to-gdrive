// Google Drive OAuth Authentication Module
// Handles authentication flow, token management, and connection status

/**
 * Authenticate user with Google Drive using Chrome Identity API
 * @returns {Promise<string>} Access token
 */
async function authenticateGoogleDrive() {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!token) {
        reject(new Error('No token received'));
        return;
      }
      resolve(token);
    });
  });
}

/**
 * Get cached access token (non-interactive)
 * @returns {Promise<string|null>} Access token or null if not authenticated
 */
async function getAccessToken() {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) {
        resolve(null);
        return;
      }
      resolve(token);
    });
  });
}

/**
 * Revoke access and remove cached token
 * @returns {Promise<void>}
 */
async function revokeAccess() {
  const token = await getAccessToken();
  if (!token) {
    return;
  }

  return new Promise((resolve, reject) => {
    // Revoke token on Google's servers
    fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`)
      .then(() => {
        // Remove cached token from Chrome
        chrome.identity.removeCachedAuthToken({ token }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve();
        });
      })
      .catch(reject);
  });
}

/**
 * Check if user is currently connected to Google Drive
 * @returns {Promise<boolean>} True if connected and token is valid
 */
async function checkConnection() {
  const token = await getAccessToken();
  if (!token) {
    return false;
  }

  // Verify token is still valid by making a simple API call
  try {
    const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.ok;
  } catch (error) {
    console.error('Connection check failed:', error);
    return false;
  }
}

/**
 * Refresh access token by removing cached token and getting a new one
 * @returns {Promise<string>} New access token
 */
async function refreshAccessToken() {
  const oldToken = await getAccessToken();
  if (oldToken) {
    // Remove old token from cache
    await new Promise((resolve) => {
      chrome.identity.removeCachedAuthToken({ token: oldToken }, resolve);
    });
  }

  // Get fresh token (interactive if needed)
  return authenticateGoogleDrive();
}

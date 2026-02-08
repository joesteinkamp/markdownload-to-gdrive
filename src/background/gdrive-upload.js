// Google Drive Upload Module
// Handles file uploads, folder management, and API interactions

/**
 * Main entry point for uploading markdown to Google Drive
 * @param {string} markdown - The markdown content to upload
 * @param {string} title - The title/filename (without extension)
 * @param {string} mdClipsFolder - The folder path template
 * @param {object} options - Extension options
 * @returns {Promise<void>}
 */
async function uploadToGoogleDrive(markdown, title, mdClipsFolder, options) {
  // Get access token
  const token = await getAccessToken();
  if (!token) {
    throw new Error('Not authenticated with Google Drive. Please connect in options.');
  }

  // Parse and validate folder ID
  const folderId = parseFolderId(options.gdriveFolderId);
  if (!folderId) {
    throw new Error('Invalid Google Drive folder ID. Please check your settings.');
  }

  // Create folder structure if mdClipsFolder is specified
  let targetFolderId = folderId;
  if (mdClipsFolder) {
    // Remove trailing slash
    const folderPath = mdClipsFolder.endsWith('/')
      ? mdClipsFolder.slice(0, -1)
      : mdClipsFolder;

    if (folderPath) {
      try {
        targetFolderId = await createFolderPath(token, folderPath, folderId);
      } catch (error) {
        console.error('Failed to create folder path:', error);
        // Continue with root folder if folder creation fails
        targetFolderId = folderId;
      }
    }
  }

  // Upload the markdown file
  const fileName = title + '.md';
  await uploadFile(token, fileName, markdown, 'text/markdown', targetFolderId);
}

/**
 * Parse folder ID from either a full URL or just the ID
 * @param {string} input - Folder URL or ID
 * @returns {string|null} Folder ID or null if invalid
 */
function parseFolderId(input) {
  if (!input || !input.trim()) {
    return null;
  }

  const trimmed = input.trim();

  // Check if it's a URL
  if (trimmed.includes('drive.google.com')) {
    // Extract ID from URL: https://drive.google.com/drive/folders/FOLDER_ID
    const match = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  // Assume it's just the ID
  return trimmed;
}

/**
 * Upload a file to Google Drive
 * @param {string} token - Access token
 * @param {string} fileName - Name of the file
 * @param {string} content - File content
 * @param {string} mimeType - MIME type
 * @param {string} folderId - Parent folder ID
 * @returns {Promise<object>} Upload response
 */
async function uploadFile(token, fileName, content, mimeType, folderId) {
  const metadata = {
    name: fileName,
    mimeType: mimeType,
    parents: [folderId]
  };

  const boundary = '-------314159265358979323846';
  const delimiter = "\r\n--" + boundary + "\r\n";
  const closeDelimiter = "\r\n--" + boundary + "--";

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: ' + mimeType + '\r\n\r\n' +
    content +
    closeDelimiter;

  const response = await fetchWithRetry(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'multipart/related; boundary=' + boundary
      },
      body: multipartRequestBody
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Upload failed' } }));
    throw new Error(error.error?.message || `Upload failed with status ${response.status}`);
  }

  return response.json();
}

/**
 * Create nested folder structure in Google Drive
 * @param {string} token - Access token
 * @param {string} path - Folder path (e.g., "2024/January/Articles")
 * @param {string} rootFolderId - Root folder ID to start from
 * @returns {Promise<string>} ID of the final folder in the path
 */
async function createFolderPath(token, path, rootFolderId) {
  const folderNames = path.split('/').filter(name => name.trim());
  let currentFolderId = rootFolderId;

  for (const folderName of folderNames) {
    // Check if folder already exists
    const existingFolderId = await findFolder(token, folderName, currentFolderId);

    if (existingFolderId) {
      currentFolderId = existingFolderId;
    } else {
      // Create new folder
      currentFolderId = await createFolder(token, folderName, currentFolderId);
    }
  }

  return currentFolderId;
}

/**
 * Find a folder by name within a parent folder
 * @param {string} token - Access token
 * @param {string} folderName - Name of folder to find
 * @param {string} parentId - Parent folder ID
 * @returns {Promise<string|null>} Folder ID if found, null otherwise
 */
async function findFolder(token, folderName, parentId) {
  const query = `name='${folderName.replace(/'/g, "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;

  const response = await fetchWithRetry(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`,
    {
      headers: {
        'Authorization': 'Bearer ' + token
      }
    }
  );

  if (!response.ok) {
    console.error('Failed to search for folder:', await response.text());
    return null;
  }

  const data = await response.json();
  return data.files && data.files.length > 0 ? data.files[0].id : null;
}

/**
 * Create a new folder in Google Drive
 * @param {string} token - Access token
 * @param {string} folderName - Name of folder to create
 * @param {string} parentId - Parent folder ID
 * @returns {Promise<string>} ID of created folder
 */
async function createFolder(token, folderName, parentId) {
  const metadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId]
  };

  const response = await fetchWithRetry(
    'https://www.googleapis.com/drive/v3/files',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(metadata)
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Failed to create folder' } }));
    throw new Error(error.error?.message || 'Failed to create folder');
  }

  const data = await response.json();
  return data.id;
}

/**
 * Validate that we have access to a folder
 * @param {string} token - Access token
 * @param {string} folderId - Folder ID to validate
 * @returns {Promise<boolean>} True if folder is accessible
 */
async function validateFolderAccess(token, folderId) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name`,
      {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      }
    );
    return response.ok;
  } catch (error) {
    console.error('Folder validation error:', error);
    return false;
  }
}

/**
 * Fetch with exponential backoff retry logic
 * @param {string} url - URL to fetch
 * @param {object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      // If rate limited, wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, i) * 1000;
        console.log(`Rate limited. Waiting ${waitTime}ms before retry ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      // If auth error, try to refresh token
      if (response.status === 401 && i === 0) {
        console.log('Auth token expired, attempting refresh...');
        const newToken = await refreshAccessToken();
        // Update authorization header
        options.headers['Authorization'] = 'Bearer ' + newToken;
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 1000;
        console.log(`Network error. Waiting ${waitTime}ms before retry ${i + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Show a browser notification
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 */
function showNotification(title, message) {
  if (browser.notifications) {
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/appicon-128x128.png'),
      title: title,
      message: message
    });
  }
}

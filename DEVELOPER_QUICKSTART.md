# Developer Quick Start - Google Drive Integration

This guide will get you up and running with the Google Drive integration feature in development mode.

## Prerequisites

- Chrome, Edge, or Brave browser
- Google account
- Basic familiarity with browser extensions
- 15-20 minutes for setup

## Quick Setup (5 Steps)

### Step 1: Google Cloud Console Setup (5 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project: "MarkDownload Dev"
3. Enable "Google Drive API" from APIs & Services
4. Configure OAuth consent screen:
   - User Type: External
   - App name: MarkDownload Dev
   - Scopes: `https://www.googleapis.com/auth/drive.file`
5. Create OAuth 2.0 Client ID:
   - Type: Chrome extension
   - Get extension ID from next step first!

### Step 2: Load Extension (1 minute)

1. Open `chrome://extensions/`
2. Enable "Developer mode" (toggle top-right)
3. Click "Load unpacked"
4. Select the `/src` folder
5. **Copy the Extension ID** (looks like: `abcdefghijklmnopqrstuvwxyz`)

### Step 3: Complete OAuth Setup (2 minutes)

1. Go back to Google Cloud Console
2. In OAuth Client ID creation, paste your Extension ID
3. Click "Create"
4. **Copy the Client ID** (ends with `.apps.googleusercontent.com`)

### Step 4: Update manifest.json (1 minute)

Open `/src/manifest.json` and update:

```json
"oauth2": {
  "client_id": "PASTE_YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
},
"key": "LEAVE_THIS_FOR_NOW"
```

**Note**: The `key` field can be left as is for initial testing. Only needed for publishing.

### Step 5: Reload and Configure (2 minutes)

1. Go to `chrome://extensions/`
2. Click "Reload" on MarkDownload
3. Right-click extension icon → Options
4. Scroll to "Google Drive Integration"
5. Check "Enable Google Drive Upload"
6. Click "Connect to Google Drive"
7. Authorize in popup
8. Get folder ID from Google Drive:
   - Go to [drive.google.com](https://drive.google.com)
   - Create or open a folder
   - Copy ID from URL: `drive.google.com/drive/folders/FOLDER_ID`
9. Paste folder ID in options
10. Check "Fallback to local download" (recommended for testing)
11. Save

## Test It Out (1 minute)

1. Go to any article page (e.g., Wikipedia, Medium, blog)
2. Click MarkDownload extension icon
3. Click "Download" button
4. Check Google Drive folder for the uploaded file
5. You should see a success notification

## Troubleshooting

### "Not authenticated" Error
- Make sure Client ID in manifest.json is correct
- Click "Reload" on extension after editing manifest
- Try clicking "Connect to Google Drive" again

### OAuth Popup Doesn't Appear
- Check that Extension ID in Google Cloud Console matches actual ID
- Verify Client ID is correct in manifest.json
- Check browser console for errors (F12)

### "Invalid folder ID" Error
- Make sure you copied just the ID part from the URL
- Or paste the full URL - it will extract the ID
- Verify you have access to the folder

### Upload Fails
- Check internet connection
- Verify folder still exists in Google Drive
- Look at browser console (F12) for detailed error
- Try disconnecting and reconnecting

## Development Tips

### Browser Console

Always keep browser console open during development:
- Right-click extension icon → "Inspect popup" (for popup debugging)
- F12 on any page (for content script debugging)
- `chrome://extensions/` → "Service Worker" under MarkDownload (for background script debugging)

### Useful Console Commands

```javascript
// In background service worker console:

// Check if authenticated
chrome.identity.getAuthToken({interactive: false}, token => console.log(token));

// Get current options
browser.storage.sync.get(null, console.log);

// Test upload function (after clipping)
uploadToGoogleDrive("# Test\n\nHello", "test-file", "", options);
```

### File Locations

- **Authentication**: `/src/background/gdrive-auth.js`
- **Upload logic**: `/src/background/gdrive-upload.js`
- **Download integration**: `/src/background/background.js` (line ~432)
- **Options UI**: `/src/options/options.html` & `options.js`
- **Settings**: `/src/shared/default-options.js`

### Making Changes

After editing files:
1. Save your changes
2. Go to `chrome://extensions/`
3. Click "Reload" on MarkDownload
4. Refresh any open options pages
5. Test the changes

### Common Modifications

**Change upload retry count**:
Edit `fetchWithRetry()` in `/src/background/gdrive-upload.js`:
```javascript
async function fetchWithRetry(url, options, maxRetries = 3) // Change 3 to desired count
```

**Change retry delay**:
Edit the exponential backoff calculation:
```javascript
const waitTime = Math.pow(2, i) * 1000; // Currently: 1s, 2s, 4s
```

**Add logging**:
Add `console.log()` statements anywhere:
```javascript
console.log('Uploading file:', fileName);
console.log('Using folder ID:', folderId);
```

## Testing Checklist

Before committing changes, test:

- [ ] Authentication (connect/disconnect)
- [ ] Upload to root folder
- [ ] Upload with subfolder (set mdClipsFolder)
- [ ] Upload with network disconnected (should fallback)
- [ ] Upload with invalid folder ID (should show error)
- [ ] Disable Google Drive (should use normal download)

## Next Steps

### For Feature Development

1. Read the implementation plan: See `IMPLEMENTATION_SUMMARY.md`
2. Review the full test plan: See `TESTING.md`
3. Check existing code structure in background.js
4. Follow existing patterns and conventions

### For Publishing

1. Generate extension key (see `GOOGLE_DRIVE_SETUP.md`)
2. Update manifest.json with key
3. Update version number
4. Run full test suite (see `TESTING.md`)
5. Package extension
6. Submit to Chrome Web Store / Edge Add-ons

### For Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request
5. Reference issue if applicable

## Helpful Resources

- [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
- [Chrome Identity API](https://developer.chrome.com/docs/extensions/reference/identity/)
- [Google Drive API v3](https://developers.google.com/drive/api/v3/reference)
- [OAuth 2.0 for Chrome Extensions](https://developer.chrome.com/docs/extensions/mv3/tut_oauth/)

## Need Help?

1. Check `GOOGLE_DRIVE_SETUP.md` for detailed setup
2. Check `TESTING.md` for comprehensive tests
3. Check browser console for error messages
4. Search existing GitHub issues
5. File new issue with:
   - Browser version
   - Extension version
   - Steps to reproduce
   - Console errors
   - Expected vs actual behavior

## Key Concepts

### OAuth Flow
1. User clicks "Connect to Google Drive"
2. Extension calls `chrome.identity.getAuthToken({interactive: true})`
3. Browser shows Google OAuth popup
4. User authorizes
5. Token cached by Chrome
6. Extension uses token for API calls

### Upload Flow
1. User clips article
2. `downloadMarkdown()` checks if Google Drive enabled
3. Calls `uploadToGoogleDrive()` if enabled
4. Gets cached token
5. Creates folder structure if needed
6. Uploads file via multipart request
7. Shows notification
8. Falls back to download on error (if enabled)

### Folder Structure
- User sets root folder ID in options
- mdClipsFolder can add subfolders (e.g., "2024/January")
- Extension creates missing folders automatically
- Reuses existing folders

## Common Pitfalls

1. **Forgetting to reload extension**: Always reload after manifest changes
2. **Wrong extension ID**: Must match between Cloud Console and actual ID
3. **Client ID typo**: Double-check the full client ID including domain
4. **Missing API enable**: Google Drive API must be enabled in Cloud Console
5. **Scope issues**: Verify `drive.file` scope in both manifest and Cloud Console

## Performance Tips

- Token is cached by Chrome (no repeated auth)
- Folders are searched before creating (no duplicates)
- Retry logic handles transient failures
- Exponential backoff prevents API flooding

## Security Notes

- Token never stored by extension (managed by Chrome)
- Only `drive.file` scope (minimal permissions)
- Extension can't access existing Drive files
- User can revoke access anytime
- All API calls use HTTPS
- No analytics or tracking

---

**Happy coding!** 🚀

For more details, see:
- `GOOGLE_DRIVE_SETUP.md` - Full setup guide
- `IMPLEMENTATION_SUMMARY.md` - Architecture details
- `TESTING.md` - Complete test plan

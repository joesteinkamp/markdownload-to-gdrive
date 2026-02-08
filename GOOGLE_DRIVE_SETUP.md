# Google Drive Integration Setup Guide

This guide will walk you through setting up Google Drive auto-upload for MarkDownload.

## Prerequisites

- A Google account
- Chrome/Edge/Brave browser (Google Drive integration uses Chrome Identity API)
- MarkDownload extension installed

## Part 1: Google Cloud Console Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" at the top
3. Click "NEW PROJECT"
4. Name it "MarkDownload Extension" (or any name you prefer)
5. Click "CREATE"

### Step 2: Enable Google Drive API

1. In your new project, go to "APIs & Services" > "Library"
2. Search for "Google Drive API"
3. Click on it and click "ENABLE"

### Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Select "External" as the User Type
3. Click "CREATE"
4. Fill in the required fields:
   - **App name**: MarkDownload
   - **User support email**: Your email
   - **Developer contact information**: Your email
5. Click "SAVE AND CONTINUE"
6. On the Scopes page, click "ADD OR REMOVE SCOPES"
7. Filter for "Google Drive API" and select:
   - `https://www.googleapis.com/auth/drive.file` (See, edit, create, and delete only the specific Google Drive files you use with this app)
8. Click "UPDATE" then "SAVE AND CONTINUE"
9. On Test users page (if in Testing mode), click "SAVE AND CONTINUE"

### Step 4: Create OAuth 2.0 Client ID

1. Go to "APIs & Services" > "Credentials"
2. Click "CREATE CREDENTIALS" > "OAuth client ID"
3. Select "Chrome app" as the Application type
4. **Important**: You need your extension's ID:
   - Go to `chrome://extensions/` (or `edge://extensions/`)
   - Enable "Developer mode" (toggle in top right)
   - Find MarkDownload and copy the "ID" field
5. Enter the extension ID in the Application ID field
6. Click "CREATE"
7. Copy the Client ID (it looks like: `xxxxxxxxxxxxx.apps.googleusercontent.com`)

### Step 5: Generate Extension Key (for stable Extension ID)

**Important**: If you're developing or testing, you need a stable extension ID for OAuth to work.

1. In `chrome://extensions/`, make sure "Developer mode" is enabled
2. Click "Pack extension"
3. Browse to your extension's source folder (`src/`)
4. Leave "Private key file" blank for the first time
5. Click "Pack Extension"
6. Two files will be created:
   - `src.crx` - the packed extension
   - `src.pem` - your private key (KEEP THIS SAFE!)
7. Open the `.crx` file in a text editor or use this command to extract the key:
   ```bash
   # On Linux/Mac:
   openssl rsa -in src.pem -pubout -outform DER | openssl base64 -A
   ```
8. Copy this key value

### Step 6: Update manifest.json

1. Open `src/manifest.json` in your extension folder
2. Find the `oauth2` section and replace `YOUR_CLIENT_ID.apps.googleusercontent.com` with your actual Client ID from Step 4
3. Replace `YOUR_EXTENSION_KEY_HERE` with the key from Step 5 (if applicable)
4. Save the file

Example:
```json
"oauth2": {
  "client_id": "123456789-abcdefghijklmnop.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/drive.file"
  ]
},
"key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..."
```

## Part 2: Extension Setup

### Step 1: Install/Reload Extension

1. Go to `chrome://extensions/`
2. If already installed, click "Reload" on the MarkDownload extension
3. If not installed, click "Load unpacked" and select the `src/` folder

### Step 2: Configure MarkDownload Options

1. Right-click the MarkDownload icon and select "Options" (or go to extension options)
2. Scroll to the "Google Drive Integration" section
3. Check "Enable Google Drive Upload"
4. Click "Connect to Google Drive"
5. Authorize the extension in the popup window
6. After authorization, you should see "Connection Status: Connected"

### Step 3: Set Target Folder

1. Go to [Google Drive](https://drive.google.com/)
2. Create or navigate to the folder where you want markdown files saved
3. Copy the folder ID from the URL:
   - URL format: `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j`
   - Folder ID: `1a2b3c4d5e6f7g8h9i0j`
4. Paste the folder ID (or the full URL) into the "Google Drive Folder ID or URL" field in MarkDownload options
5. Check "Fallback to local download if upload fails" if you want automatic fallback
6. Click "Save" (or options will auto-save)

## Part 3: Daily Usage

1. Browse to any article or webpage
2. Click the MarkDownload icon
3. Review/edit the markdown if needed
4. Click "Download" button
5. The file will upload directly to your Google Drive folder
6. You'll see a success notification

## Troubleshooting

### "Not authenticated with Google Drive"
- Make sure you've clicked "Connect to Google Drive" in options
- Check that your Client ID in manifest.json is correct
- Try disconnecting and reconnecting

### "Invalid Google Drive folder ID"
- Verify the folder ID is correct
- Make sure you have access to the folder
- Try using the full URL instead of just the ID

### OAuth popup doesn't appear
- Check that your extension ID in Google Cloud Console matches the actual extension ID
- Make sure the extension key in manifest.json is correct
- Verify the OAuth consent screen is configured

### "Upload failed"
- Check your internet connection
- Verify you still have permission to access the folder
- Check Google Drive storage quota
- Look at browser console for detailed error messages

### Files not appearing in subfolders
- The "Folder inside Downloads/" setting creates subfolders in Google Drive
- Example: Setting "2024/Articles" will create that structure in your target folder

## Security Notes

- Only the `drive.file` scope is used (minimal permissions)
- Extension can only access files it creates, not your entire Drive
- Access token is managed securely by Chrome's identity API
- You can revoke access anytime by clicking "Disconnect"

## Support

For issues, please report at: [GitHub Issues](https://github.com/deathau/markdownload/issues)

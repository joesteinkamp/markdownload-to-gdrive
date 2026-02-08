# Google Drive Integration Testing Guide

This document outlines the testing procedures for the Google Drive auto-upload feature.

## Pre-Testing Setup

1. Complete Google Cloud Console setup (see GOOGLE_DRIVE_SETUP.md)
2. Load the extension in developer mode
3. Have a test Google Drive folder ready
4. Open browser console for debugging

## Test Categories

### 1. Authentication Tests

#### Test 1.1: Initial Connection
- **Steps**:
  1. Open MarkDownload options
  2. Enable Google Drive Upload
  3. Click "Connect to Google Drive"
- **Expected**: OAuth popup appears, after authorization shows "Connected"
- **Status**: [ ]

#### Test 1.2: Connection Persistence
- **Steps**:
  1. Connect to Google Drive
  2. Close and reopen options page
- **Expected**: Status still shows "Connected"
- **Status**: [ ]

#### Test 1.3: Disconnect
- **Steps**:
  1. Click "Disconnect" button
- **Expected**: Status changes to "Not connected", folder ID cleared
- **Status**: [ ]

#### Test 1.4: Invalid OAuth Configuration
- **Steps**:
  1. Use invalid Client ID in manifest.json
  2. Try to connect
- **Expected**: Clear error message displayed
- **Status**: [ ]

### 2. Folder Configuration Tests

#### Test 2.1: Folder ID Input
- **Steps**:
  1. Paste just the folder ID (e.g., "1a2b3c4d5e6f")
  2. Save options
- **Expected**: Settings saved successfully
- **Status**: [ ]

#### Test 2.2: Folder URL Input
- **Steps**:
  1. Paste full URL: `https://drive.google.com/drive/folders/1a2b3c4d5e6f`
  2. Save options
- **Expected**: ID extracted and saved correctly
- **Status**: [ ]

#### Test 2.3: Invalid Folder ID
- **Steps**:
  1. Enter invalid folder ID
  2. Try to upload a file
- **Expected**: Error message about invalid folder
- **Status**: [ ]

#### Test 2.4: No Access to Folder
- **Steps**:
  1. Use folder ID you don't have access to
  2. Try to upload
- **Expected**: Permission error displayed
- **Status**: [ ]

### 3. Upload Functionality Tests

#### Test 3.1: Basic Upload
- **Steps**:
  1. Configure Google Drive properly
  2. Clip any article
  3. Click Download
- **Expected**: File appears in Google Drive folder, success notification shown
- **Status**: [ ]

#### Test 3.2: Upload with Special Characters in Title
- **Steps**:
  1. Clip article with title: "Test / Title: With * Special | Chars"
  2. Click Download
- **Expected**: File uploaded with sanitized name
- **Status**: [ ]

#### Test 3.3: Upload with Very Long Title (>100 chars)
- **Steps**:
  1. Clip article with very long title
  2. Click Download
- **Expected**: File uploaded with truncated/valid name
- **Status**: [ ]

#### Test 3.4: Upload Empty Content
- **Steps**:
  1. Create markdown with empty content
  2. Try to upload
- **Expected**: File uploaded (even if empty) or appropriate error
- **Status**: [ ]

#### Test 3.5: Multiple Rapid Uploads
- **Steps**:
  1. Clip and upload 5 articles quickly
- **Expected**: All files upload successfully without conflicts
- **Status**: [ ]

### 4. Folder Structure Tests

#### Test 4.1: Root Folder Upload (No mdClipsFolder)
- **Steps**:
  1. Clear "Folder inside Downloads/" setting
  2. Upload file
- **Expected**: File appears in root of target folder
- **Status**: [ ]

#### Test 4.2: Single Subfolder
- **Steps**:
  1. Set mdClipsFolder to "Articles"
  2. Upload file
- **Expected**: "Articles" folder created, file inside it
- **Status**: [ ]

#### Test 4.3: Nested Subfolders
- **Steps**:
  1. Set mdClipsFolder to "2024/January/Articles"
  2. Upload file
- **Expected**: Full path created, file in deepest folder
- **Status**: [ ]

#### Test 4.4: Existing Folder Reuse
- **Steps**:
  1. Upload with mdClipsFolder "Test"
  2. Upload another file with same mdClipsFolder
- **Expected**: Second file uses existing "Test" folder
- **Status**: [ ]

#### Test 4.5: Dynamic Folder with Template
- **Steps**:
  1. Set mdClipsFolder to "{date:YYYY}/{date:MMMM}"
  2. Upload file
- **Expected**: Folders created like "2024/February"
- **Status**: [ ]

### 5. Fallback Behavior Tests

#### Test 5.1: Fallback Enabled - Network Error
- **Steps**:
  1. Enable "Fallback to local download"
  2. Disconnect internet
  3. Try to upload
- **Expected**: Falls back to local download with notification
- **Status**: [ ]

#### Test 5.2: Fallback Disabled - Network Error
- **Steps**:
  1. Disable "Fallback to local download"
  2. Disconnect internet
  3. Try to upload
- **Expected**: Error notification, no download
- **Status**: [ ]

#### Test 5.3: Fallback on Auth Error
- **Steps**:
  1. Revoke token manually (disconnect and reconnect)
  2. Try to upload with old cached state
- **Expected**: Token refresh or fallback
- **Status**: [ ]

### 6. Integration with Existing Features

#### Test 6.1: Google Drive Disabled - Normal Download
- **Steps**:
  1. Disable Google Drive upload
  2. Clip and download
- **Expected**: Normal download behavior unchanged
- **Status**: [ ]

#### Test 6.2: Download Mode: Downloads API
- **Steps**:
  1. Set Download Mode to "Downloads API"
  2. Enable Google Drive
  3. Upload file
- **Expected**: Uploads to Drive (not local)
- **Status**: [ ]

#### Test 6.3: Download Mode: Content Link
- **Steps**:
  1. Set Download Mode to "Content Link"
  2. Enable Google Drive
  3. Upload file
- **Expected**: Uploads to Drive (not local)
- **Status**: [ ]

#### Test 6.4: With Image Download Disabled
- **Steps**:
  1. Disable "Download images"
  2. Upload article with images
- **Expected**: Markdown uploaded with base64 or original URLs
- **Status**: [ ]

#### Test 6.5: With Front Matter
- **Steps**:
  1. Configure front matter template
  2. Enable "Append front/back template"
  3. Upload file
- **Expected**: Uploaded markdown includes front matter
- **Status**: [ ]

#### Test 6.6: Context Menu Download
- **Steps**:
  1. Right-click page
  2. Select "Download page as Markdown"
- **Expected**: Uploads to Google Drive if enabled
- **Status**: [ ]

### 7. Error Handling Tests

#### Test 7.1: Rate Limit (429)
- **Steps**:
  1. Upload many files rapidly to trigger rate limit
- **Expected**: Automatic retry with backoff, eventual success
- **Status**: [ ]

#### Test 7.2: Token Expiry (401)
- **Steps**:
  1. Wait for token expiry (or manually expire)
  2. Try to upload
- **Expected**: Automatic token refresh, upload succeeds
- **Status**: [ ]

#### Test 7.3: Network Timeout
- **Steps**:
  1. Simulate slow/unstable network
  2. Try to upload
- **Expected**: Retry logic works, eventual success or clear error
- **Status**: [ ]

#### Test 7.4: Google Drive Storage Full
- **Steps**:
  1. Use account with full storage
  2. Try to upload
- **Expected**: Clear error about storage quota
- **Status**: [ ]

#### Test 7.5: Invalid Response from API
- **Steps**:
  1. Mock API to return malformed response
- **Expected**: Graceful error handling, no crash
- **Status**: [ ]

### 8. UI/UX Tests

#### Test 8.1: Settings Visibility Toggle
- **Steps**:
  1. Uncheck "Enable Google Drive Upload"
- **Expected**: All Google Drive settings hidden
- **Status**: [ ]

#### Test 8.2: Button State Management
- **Steps**:
  1. Observe Connect/Disconnect button states
- **Expected**: Only one button visible at a time
- **Status**: [ ]

#### Test 8.3: Status Indicator Accuracy
- **Steps**:
  1. Connect and verify status shows "Connected" in green
  2. Disconnect and verify status shows "Not connected" in red
- **Expected**: Colors and text update correctly
- **Status**: [ ]

#### Test 8.4: Success Notification
- **Steps**:
  1. Upload file successfully
- **Expected**: Browser notification appears with success message
- **Status**: [ ]

#### Test 8.5: Error Notification
- **Steps**:
  1. Cause upload error
- **Expected**: Browser notification appears with error details
- **Status**: [ ]

### 9. Backward Compatibility Tests

#### Test 9.1: Fresh Install
- **Steps**:
  1. Install extension for first time
  2. Open options
- **Expected**: All defaults work, no errors
- **Status**: [ ]

#### Test 9.2: Upgrade from Previous Version
- **Steps**:
  1. Install old version
  2. Configure settings
  3. Upgrade to version with Google Drive
- **Expected**: Old settings preserved, new settings added with defaults
- **Status**: [ ]

#### Test 9.3: Export/Import Options
- **Steps**:
  1. Configure Google Drive settings
  2. Export options
  3. Import on fresh install
- **Expected**: All settings including Google Drive restored
- **Status**: [ ]

### 10. Browser Compatibility Tests

#### Test 10.1: Chrome
- **Expected**: Full functionality works
- **Status**: [ ]

#### Test 10.2: Edge
- **Expected**: Full functionality works (uses Chrome APIs)
- **Status**: [ ]

#### Test 10.3: Brave
- **Expected**: Full functionality works (Chromium-based)
- **Status**: [ ]

#### Test 10.4: Firefox
- **Expected**: Feature gracefully disabled (Firefox doesn't support chrome.identity)
- **Status**: [ ]

## Edge Cases

### Edge Case 1: Duplicate File Names
- **Scenario**: Upload file with same name twice
- **Expected**: Second file created (Google Drive allows duplicates by default)
- **Status**: [ ]

### Edge Case 2: Folder Name with Special Characters
- **Scenario**: mdClipsFolder contains `/`, `\`, etc.
- **Expected**: Characters handled appropriately (split on `/` for paths)
- **Status**: [ ]

### Edge Case 3: Very Large Markdown File (>10MB)
- **Scenario**: Upload very large article
- **Expected**: Upload succeeds or clear size limit error
- **Status**: [ ]

### Edge Case 4: Connection Lost Mid-Upload
- **Scenario**: Network disconnects during upload
- **Expected**: Retry or fallback with notification
- **Status**: [ ]

## Performance Tests

### Performance 1: Upload Speed
- **Test**: Time to upload 1KB, 100KB, 1MB markdown files
- **Expected**: < 2 seconds for 100KB
- **Status**: [ ]

### Performance 2: Folder Creation Speed
- **Test**: Time to create nested 5-level folder structure
- **Expected**: < 5 seconds
- **Status**: [ ]

### Performance 3: Multiple Concurrent Uploads
- **Test**: Upload 10 files simultaneously
- **Expected**: All succeed without race conditions
- **Status**: [ ]

## Security Tests

### Security 1: Token Storage
- **Verify**: Token not stored in extension storage or logs
- **Status**: [ ]

### Security 2: API Scope
- **Verify**: Only `drive.file` scope requested (minimal permissions)
- **Status**: [ ]

### Security 3: HTTPS Only
- **Verify**: All API calls use HTTPS
- **Status**: [ ]

## Testing Checklist Summary

- [ ] All authentication tests passed
- [ ] All folder configuration tests passed
- [ ] All upload functionality tests passed
- [ ] All folder structure tests passed
- [ ] All fallback behavior tests passed
- [ ] All integration tests passed
- [ ] All error handling tests passed
- [ ] All UI/UX tests passed
- [ ] All backward compatibility tests passed
- [ ] All browser compatibility tests passed
- [ ] All edge cases handled
- [ ] All performance benchmarks met
- [ ] All security verifications passed

## Automated Testing Notes

Consider implementing:
- Unit tests for folder ID parsing
- Unit tests for folder path creation logic
- Mock API tests for upload retry logic
- Integration tests with mock Google Drive API

## Bug Reporting Template

When reporting issues:
```
**Browser**: Chrome 120 / Edge 119 / etc.
**Extension Version**: X.X.X
**Steps to Reproduce**:
1.
2.
3.

**Expected Behavior**:

**Actual Behavior**:

**Console Errors** (if any):

**Screenshots** (if applicable):
```

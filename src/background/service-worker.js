// Manifest V3 Service Worker
// This file loads all the background scripts in the correct order

// Import all background scripts using importScripts()
// This maintains compatibility with the existing codebase structure
// turndown.js, turndown-plugin-gfm.js, Readability.js are loaded in offscreen.html instead
// (service worker has no DOM, so DOM-dependent processing happens in offscreen document)
importScripts(
  '../browser-polyfill.min.js',
  'apache-mime-types.js',
  'moment.min.js',
  '../shared/context-menus.js',
  '../shared/default-options.js',
  'gdrive-auth.js',
  'gdrive-upload.js',
  'background.js'
);

// Service worker is now ready with all scripts loaded
console.log('MarkDownload service worker initialized');

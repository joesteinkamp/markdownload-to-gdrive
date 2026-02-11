// Manifest V3 script injection helpers
// These call chrome.scripting directly, bypassing browser-polyfill's Proxy
// on browser.tabs which breaks Promise resolution in MV3.
// Wrapped in Promise.resolve() for browser-polyfill compatibility.
function injectFile(tabId, filePath) {
  return Promise.resolve(
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: [filePath]
    })
  );
}

function injectFunc(tabId, func, args) {
  const opts = { target: { tabId: tabId }, func: func };
  if (args) opts.args = args;
  return Promise.resolve(
    chrome.scripting.executeScript(opts)
  ).then(results => results ? results.map(r => r.result) : []);
}

// Manifest V3: Offscreen document management for DOM parsing
let offscreenDocumentCreated = false;

async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) return;

  try {
    await chrome.offscreen.createDocument({
      url: 'background/offscreen.html',
      reasons: ['DOM_PARSER'],
      justification: 'Parse HTML content using DOMParser API'
    });
    offscreenDocumentCreated = true;
  } catch (error) {
    // Document may already exist, or API not available
    if (!error.message.includes('Only a single offscreen')) {
      console.error('Failed to create offscreen document:', error);
    }
    offscreenDocumentCreated = true; // Assume it exists
  }
}

// log some info
browser.runtime.getPlatformInfo().then(async platformInfo => {
  const browserInfo = browser.runtime.getBrowserInfo ? await browser.runtime.getBrowserInfo() : "Can't get browser info"
  console.info(platformInfo, browserInfo);
});

// add notification listener for foreground page messages
browser.runtime.onMessage.addListener(notify);
// create context menus
createMenus()

// Functions moved to offscreen.js: turndown, cleanAttribute, validateUri, getImageFilename, getArticleFromDom

// function to replace placeholder strings with article info
function textReplace(string, article, disallowedChars = null) {
  for (const key in article) {
    if (article.hasOwnProperty(key) && key != "content") {
      let s = (article[key] || '') + '';
      if (s && disallowedChars) s = generateValidFileName(s, disallowedChars);

      string = string.replace(new RegExp('{' + key + '}', 'g'), s)
        .replace(new RegExp('{' + key + ':lower}', 'g'), s.toLowerCase())
        .replace(new RegExp('{' + key + ':upper}', 'g'), s.toUpperCase())
        .replace(new RegExp('{' + key + ':kebab}', 'g'), s.replace(/ /g, '-').toLowerCase())
        .replace(new RegExp('{' + key + ':mixed-kebab}', 'g'), s.replace(/ /g, '-'))
        .replace(new RegExp('{' + key + ':snake}', 'g'), s.replace(/ /g, '_').toLowerCase())
        .replace(new RegExp('{' + key + ':mixed_snake}', 'g'), s.replace(/ /g, '_'))
        // For Obsidian Custom Attachment Location plugin, we need to replace spaces with hyphens, but also remove any double hyphens.
        .replace(new RegExp('{' + key + ':obsidian-cal}', 'g'), s.replace(/ /g, '-').replace(/-{2,}/g, "-"))
        .replace(new RegExp('{' + key + ':camel}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toLowerCase()))
        .replace(new RegExp('{' + key + ':pascal}', 'g'), s.replace(/ ./g, (str) => str.trim().toUpperCase()).replace(/^./, (str) => str.toUpperCase()))
    }
  }

  // replace date formats
  const now = new Date();
  const dateRegex = /{date:(.+?)}/g
  const matches = string.match(dateRegex);
  if (matches && matches.forEach) {
    matches.forEach(match => {
      const format = match.substring(6, match.length - 1);
      const dateString = moment(now).format(format);
      string = string.replaceAll(match, dateString);
    });
  }

  // replace keywords
  const keywordRegex = /{keywords:?(.*)?}/g
  const keywordMatches = string.match(keywordRegex);
  if (keywordMatches && keywordMatches.forEach) {
    keywordMatches.forEach(match => {
      let seperator = match.substring(10, match.length - 1)
      try {
        seperator = JSON.parse(JSON.stringify(seperator).replace(/\\\\/g, '\\'));
      }
      catch { }
      const keywordsString = (article.keywords || []).join(seperator);
      string = string.replace(new RegExp(match.replace(/\\/g, '\\\\'), 'g'), keywordsString);
    })
  }

  // replace anything left in curly braces
  const defaultRegex = /{(.*?)}/g
  string = string.replace(defaultRegex, '')

  return string;
}

// function to convert an article info object into markdown
// Delegates Turndown conversion to offscreen document (needs DOM)
async function convertArticleToMarkdown(article, downloadImages = null) {
  const options = await getOptions();
  if (downloadImages != null) {
    options.downloadImages = downloadImages;
  }

  // substitute front and backmatter templates if necessary
  if (options.includeTemplate) {
    options.frontmatter = textReplace(options.frontmatter, article) + '\n';
    options.backmatter = '\n' + textReplace(options.backmatter, article);
  }
  else {
    options.frontmatter = options.backmatter = '';
  }

  options.imagePrefix = textReplace(options.imagePrefix, article, options.disallowedChars)
    .split('/').map(s=>generateValidFileName(s, options.disallowedChars)).join('/');

  // Delegate turndown to offscreen document (service worker has no DOM)
  await ensureOffscreenDocument();
  const response = await chrome.runtime.sendMessage({
    action: 'convertToMarkdown',
    html: article.content,
    options: options,
    articleInfo: { baseURI: article.baseURI, math: article.math || {} }
  });

  if (!response || !response.success) {
    throw new Error(response?.error || 'Failed to convert to markdown');
  }

  let result = { markdown: response.markdown, imageList: response.imageList };
  if (options.downloadImages && options.downloadMode == 'downloadsApi') {
    // pre-download the images
    result = await preDownloadImages(result.imageList, result.markdown);
  }
  return result;
}

// function to turn the title into a valid file name
function generateValidFileName(title, disallowedChars = null) {
  if (!title) return title;
  else title = title + '';
  // remove < > : " / \ | ? * 
  var illegalRe = /[\/\?<>\\:\*\|":]/g;
  // and non-breaking spaces (thanks @Licat)
  var name = title.replace(illegalRe, "").replace(new RegExp('\u00A0', 'g'), ' ')
      // collapse extra whitespace
      .replace(new RegExp(/\s+/, 'g'), ' ')
      // remove leading/trailing whitespace that can cause issues when using {pageTitle} in a download path
      .trim();

  if (disallowedChars) {
    for (let c of disallowedChars) {
      if (`[\\^$.|?*+()`.includes(c)) c = `\\${c}`;
      name = name.replace(new RegExp(c, 'g'), '');
    }
  }
  
  return name;
}

// Helper function to convert ArrayBuffer to base64 (service worker compatible)
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper function to convert blob to data URL (service worker compatible)
async function blobToDataUrl(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  return `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
}

async function preDownloadImages(imageList, markdown) {
  const options = await getOptions();
  let newImageList = {};
  // originally, I was downloading the markdown file first, then all the images
  // however, in some cases we need to download images *first* so we can get the
  // proper file extension to put into the markdown.
  // so... here we are waiting for all the downloads and replacements to complete
  await Promise.all(Object.entries(imageList).map(async ([src, filename]) => {
    try {
      // Using fetch instead of XMLHttpRequest (Manifest V3 compatible)
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      const blob = await response.blob();

      if (options.imageStyle == 'base64') {
        // Convert blob to data URL
        const dataUrl = await blobToDataUrl(blob);
        markdown = markdown.replaceAll(src, dataUrl);
      }
      else {
        let newFilename = filename;
        if (newFilename.endsWith('.idunno')) {
          // replace any unknown extension with a lookup based on mime type
          newFilename = filename.replace('.idunno', '.' + mimedb[blob.type]);

          // and replace any instances of this in the markdown
          // remember to url encode for replacement if it's not an obsidian link
          if (!options.imageStyle.startsWith("obsidian")) {
            markdown = markdown.replaceAll(filename.split('/').map(s => encodeURI(s)).join('/'), newFilename.split('/').map(s => encodeURI(s)).join('/'))
          }
          else {
            markdown = markdown.replaceAll(filename, newFilename)
          }
        }

        // Convert blob to data URL (service worker compatible)
        const dataUrl = await blobToDataUrl(blob);
        // add this data URL into the new image list
        newImageList[dataUrl] = newFilename;
      }
    } catch (error) {
      // Log the error but continue with other images
      console.error('A network error occurred attempting to download ' + src + ': ' + error.message);
    }
  }));

  return { imageList: newImageList, markdown: markdown };
}

// function to actually download the markdown file
async function downloadMarkdown(markdown, title, tabId, imageList = {}, mdClipsFolder = '') {
  // get the options
  const options = await getOptions();

  // NEW: Check for Google Drive upload
  if (options.gdriveEnabled && options.gdriveConnected) {
    try {
      await uploadToGoogleDrive(markdown, title, mdClipsFolder, options);
      showNotification('Success', 'Uploaded to Google Drive: ' + title + '.md');
      return; // Exit - no local download
    } catch (error) {
      console.error('Google Drive upload failed:', error);
      if (!options.gdriveFallbackToDownload) {
        showNotification('Upload Failed', error.message);
        return; // Fail without fallback
      }
      // Continue to existing download logic as fallback
      showNotification('Upload Failed', 'Falling back to local download. ' + error.message);
    }
  }

  // download via the downloads API
  if (options.downloadMode == 'downloadsApi' && browser.downloads) {
    
    // create the object url with markdown data as a blob
    const url = URL.createObjectURL(new Blob([markdown], {
      type: "text/markdown;charset=utf-8"
    }));
  
    try {

      if(mdClipsFolder && !mdClipsFolder.endsWith('/')) mdClipsFolder += '/';
      // start the download
      const id = await browser.downloads.download({
        url: url,
        filename: mdClipsFolder + title + ".md",
        saveAs: options.saveAs
      });

      // add a listener for the download completion
      browser.downloads.onChanged.addListener(downloadListener(id, url));

      // download images (if enabled)
      if (options.downloadImages) {
        // get the relative path of the markdown file (if any) for image path
        let destPath = mdClipsFolder + title.substring(0, title.lastIndexOf('/'));
        if(destPath && !destPath.endsWith('/')) destPath += '/';
        Object.entries(imageList).forEach(async ([src, filename]) => {
          // start the download of the image
          const imgId = await browser.downloads.download({
            url: src,
            // set a destination path (relative to md file)
            filename: destPath ? destPath + filename : filename,
            saveAs: false
          })
          // add a listener (so we can release the blob url)
          browser.downloads.onChanged.addListener(downloadListener(imgId, src));
        });
      }
    }
    catch (err) {
      console.error("Download failed", err);
    }
  }
  // // download via obsidian://new uri
  // else if (options.downloadMode == 'obsidianUri') {
  //   try {
  //     await ensureScripts(tabId);
  //     let uri = 'obsidian://new?';
  //     uri += `${options.obsidianPathType}=${encodeURIComponent(title)}`;
  //     if (options.obsidianVault) uri += `&vault=${encodeURIComponent(options.obsidianVault)}`;
  //     uri += `&content=${encodeURIComponent(markdown)}`;
  //     let code = `window.location='${uri}'`;
  //     await browser.tabs.executeScript(tabId, {code: code});
  //   }
  //   catch (error) {
  //     // This could happen if the extension is not allowed to run code in
  //     // the page, for example if the tab is a privileged page.
  //     console.error("Failed to execute script: " + error);
  //   };
    
  // }
  // download via content link
  else {
    try {
      await ensureScripts(tabId);
      const filename = mdClipsFolder + generateValidFileName(title, options.disallowedChars) + ".md";
      await injectFunc(tabId, (fn, md) => downloadMarkdown(fn, md), [filename, base64EncodeUnicode(markdown)]);
    }
    catch (error) {
      // This could happen if the extension is not allowed to run code in
      // the page, for example if the tab is a privileged page.
      console.error("Failed to execute script: " + error);
    };
  }
}

function downloadListener(id, url) {
  const self = (delta) => {
    if (delta.id === id && delta.state && delta.state.current == "complete") {
      // detatch this listener
      browser.downloads.onChanged.removeListener(self);
      //release the url for the blob
      URL.revokeObjectURL(url);
    }
  }
  return self;
}

function base64EncodeUnicode(str) {
  // Firstly, escape the string using encodeURIComponent to get the UTF-8 encoding of the characters, 
  // Secondly, we convert the percent encodings into raw bytes, and add it to btoa() function.
  const utf8Bytes = encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (match, p1) {
    return String.fromCharCode('0x' + p1);
  });

  return btoa(utf8Bytes);
}

//function that handles messages from the injected script into the site
function notify(message, sender, sendResponse) {
  // Ignore messages meant for offscreen document
  if (message.action === 'processClip' || message.action === 'parseArticle' || message.action === 'convertToMarkdown') {
    return false;
  }
  
  // Handle async messages with proper sendResponse pattern
  (async () => {
    try {
      const options = await getOptions();
      
      // message for initial clipping of the dom
      if (message.type == "clip") {
        // Delegate DOM parsing + markdown conversion to offscreen document
        await ensureOffscreenDocument();
        const response = await chrome.runtime.sendMessage({
          action: 'processClip',
          domString: message.dom,
          selection: message.selection,
          clipSelection: message.clipSelection,
          options: options
        });

        if (!response || !response.success) {
          console.error('processClip failed:', response?.error);
          return;
        }

        let { article, markdown, imageList } = response;

        // Handle image pre-downloading if needed (stays in background - uses fetch/blobs)
        if (options.downloadImages && options.downloadMode == 'downloadsApi') {
          const result = await preDownloadImages(imageList, markdown);
          markdown = result.markdown;
          imageList = result.imageList;
        }

        // format the title
        article.title = await formatTitle(article);

        // format the mdClipsFolder
        const mdClipsFolder = await formatMdClipsFolder(article);

        // display the data in the popup
        await browser.runtime.sendMessage({ type: "display.md", markdown: markdown, article: article, imageList: imageList, mdClipsFolder: mdClipsFolder});
      }
      // message for triggering download
      else if (message.type == "download") {
        downloadMarkdown(message.markdown, message.title, message.tab.id, message.imageList, message.mdClipsFolder);
      }
      // Google Drive authentication request from options page
      else if (message.action == "gdriveAuthenticate") {
        try {
          const token = await authenticateGoogleDrive();
          sendResponse({ success: true, token: token });
        } catch (error) {
          console.error('Authentication failed:', error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      }
      // Google Drive disconnect/revoke request from options page
      else if (message.action == "gdriveRevoke") {
        try {
          await revokeAccess();
          sendResponse({ success: true });
        } catch (error) {
          console.error('Revoke failed:', error);
          sendResponse({ success: false, error: error.message });
        }
        return;
      }
    } catch (error) {
      console.error('Error in notify handler:', error);
    }
  })();
  
  // Return true for message types that need async response
  if (message.action == "gdriveAuthenticate" || message.action == "gdriveRevoke") {
    return true;
  }
  return false;
}

browser.commands.onCommand.addListener(async function (command) {
  const tabs = await browser.tabs.query({active: true, currentWindow: true});
  const tab = tabs[0];
  if (!tab) return;

  if (command == "download_tab_as_markdown") {
    const info = { menuItemId: "download-markdown-all" };
    downloadMarkdownFromContext(info, tab);
  }
  else if (command == "copy_tab_as_markdown") {
    const info = { menuItemId: "copy-markdown-all" };
    copyMarkdownFromContext(info, tab);
  }
  else if (command == "copy_selection_as_markdown") {
    const info = { menuItemId: "copy-markdown-selection" };
    copyMarkdownFromContext(info, tab);
  }
  else if (command == "copy_tab_as_markdown_link") {
    copyTabAsMarkdownLink(tab);
  }
  else if (command == "copy_selected_tab_as_markdown_link") {
    copySelectedTabAsMarkdownLink(tab);
  }
  else if (command == "copy_selection_to_obsidian") {
    const info = { menuItemId: "copy-markdown-obsidian" };
    copyMarkdownFromContext(info, tab);
  }
  else if (command == "copy_tab_to_obsidian") {
    const info = { menuItemId: "copy-markdown-obsall" };
    copyMarkdownFromContext(info, tab);
  }
});

// click handler for the context menus
browser.contextMenus.onClicked.addListener(function (info, tab) {
  // one of the copy to clipboard commands
  if (info.menuItemId.startsWith("copy-markdown")) {
    copyMarkdownFromContext(info, tab);
  }
  else if (info.menuItemId == "download-markdown-alltabs" || info.menuItemId == "tab-download-markdown-alltabs") {
    downloadMarkdownForAllTabs(info);
  }
  // one of the download commands
  else if (info.menuItemId.startsWith("download-markdown")) {
    downloadMarkdownFromContext(info, tab);
  }
  // copy tab as markdown link
  else if (info.menuItemId.startsWith("copy-tab-as-markdown-link-all")) {
    copyTabAsMarkdownLinkAll(tab);
  }
  // copy only selected tab as markdown link
  else if (info.menuItemId.startsWith("copy-tab-as-markdown-link-selected")) {
    copySelectedTabAsMarkdownLink(tab);
  }
  else if (info.menuItemId.startsWith("copy-tab-as-markdown-link")) {
    copyTabAsMarkdownLink(tab);
  }
  // a settings toggle command
  else if (info.menuItemId.startsWith("toggle-") || info.menuItemId.startsWith("tabtoggle-")) {
    toggleSetting(info.menuItemId.split('-')[1]);
  }
});

// this function toggles the specified option
async function toggleSetting(setting, options = null) {
  // if there's no options object passed in, we need to go get one
  if (options == null) {
      // get the options from storage and toggle the setting
      await toggleSetting(setting, await getOptions());
  }
  else {
    // toggle the option and save back to storage
    options[setting] = !options[setting];
    await browser.storage.sync.set(options);
    if (setting == "includeTemplate") {
      browser.contextMenus.update("toggle-includeTemplate", {
        checked: options.includeTemplate
      }).catch(() => {});
      
      browser.contextMenus.update("tabtoggle-includeTemplate", {
          checked: options.includeTemplate
      }).catch(() => {});
    }
    
    if (setting == "downloadImages") {
      browser.contextMenus.update("toggle-downloadImages", {
        checked: options.downloadImages
      }).catch(() => {});
      
      browser.contextMenus.update("tabtoggle-downloadImages", {
          checked: options.downloadImages
      }).catch(() => {});
    }
  }
}

// this function ensures the content script is loaded (and loads it if it isn't)
async function ensureScripts(tabId) {
  const results = await injectFunc(tabId, () => typeof getSelectionAndDom === 'function');
  // The content script's last expression will be true if the function
  // has been defined. If this is not the case, then we need to run
  // pageScraper.js to define function getSelectionAndDom.
  if (!results || results[0] !== true) {
    await injectFile(tabId, "/contentScript/contentScript.js");
  }
}

// get Readability article info from the content of the tab id passed in
// `selection` is a bool indicating whether we should just get the selected text
// Delegates DOM parsing to offscreen document
async function getArticleFromContent(tabId, selection = false) {
  // run the content script function to get the details
  const results = await injectFunc(tabId, () => getSelectionAndDom());

  // make sure we actually got a valid result
  if (results && results[0] && results[0].dom) {
    await ensureOffscreenDocument();
    const response = await chrome.runtime.sendMessage({
      action: 'parseArticle',
      domString: results[0].dom,
      selection: selection ? results[0].selection : null,
      clipSelection: selection
    });

    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to parse article');
    }

    return response.article;
  }
  else return null;
}

// function to apply the title template
async function formatTitle(article) {
  let options = await getOptions();
  
  let title = textReplace(options.title, article, options.disallowedChars + '/');
  title = title.split('/').map(s=>generateValidFileName(s, options.disallowedChars)).join('/');
  return title;
}

async function formatMdClipsFolder(article) {
  let options = await getOptions();

  let mdClipsFolder = '';
  if (options.mdClipsFolder && options.downloadMode == 'downloadsApi') {
    mdClipsFolder = textReplace(options.mdClipsFolder, article, options.disallowedChars);
    mdClipsFolder = mdClipsFolder.split('/').map(s => generateValidFileName(s, options.disallowedChars)).join('/');
    if (!mdClipsFolder.endsWith('/')) mdClipsFolder += '/';
  }

  return mdClipsFolder;
}

async function formatObsidianFolder(article) {
  let options = await getOptions();

  let obsidianFolder = '';
  if (options.obsidianFolder) {
    obsidianFolder = textReplace(options.obsidianFolder, article, options.disallowedChars);
    obsidianFolder = obsidianFolder.split('/').map(s => generateValidFileName(s, options.disallowedChars)).join('/');
    if (!obsidianFolder.endsWith('/')) obsidianFolder += '/';
  }

  return obsidianFolder;
}

// function to download markdown, triggered by context menu
async function downloadMarkdownFromContext(info, tab) {
  await ensureScripts(tab.id);
  const article = await getArticleFromContent(tab.id, info.menuItemId == "download-markdown-selection");
  const title = await formatTitle(article);
  const { markdown, imageList } = await convertArticleToMarkdown(article);
  // format the mdClipsFolder
  const mdClipsFolder = await formatMdClipsFolder(article);
  await downloadMarkdown(markdown, title, tab.id, imageList, mdClipsFolder); 

}

// function to copy a tab url as a markdown link
async function copyTabAsMarkdownLink(tab) {
  try {
    await ensureScripts(tab.id);
    const article = await getArticleFromContent(tab.id);
    const title = await formatTitle(article);
    await injectFunc(tab.id, (text) => copyToClipboard(text), [`[${title}](${article.baseURI})`]);
    // await navigator.clipboard.writeText(`[${title}](${article.baseURI})`);
  }
  catch (error) {
    // This could happen if the extension is not allowed to run code in
    // the page, for example if the tab is a privileged page.
    console.error("Failed to copy as markdown link: " + error);
  };
}

// function to copy all tabs as markdown links
async function copyTabAsMarkdownLinkAll(tab) {
  try {
    const options = await getOptions();
    options.frontmatter = options.backmatter = '';
    const tabs = await browser.tabs.query({
      currentWindow: true
    });
    
    const links = [];
    for(const tab of tabs) {
      await ensureScripts(tab.id);
      const article = await getArticleFromContent(tab.id);
      const title = await formatTitle(article);
      const link = `${options.bulletListMarker} [${title}](${article.baseURI})`
      links.push(link)
    };
    
    const markdown = links.join(`\n`)
    await injectFunc(tab.id, (text) => copyToClipboard(text), [markdown]);

  }
  catch (error) {
    // This could happen if the extension is not allowed to run code in
    // the page, for example if the tab is a privileged page.
    console.error("Failed to copy as markdown link: " + error);
  };
}

// function to copy only selected tabs as markdown links
async function copySelectedTabAsMarkdownLink(tab) {
  try {
    const options = await getOptions();
    options.frontmatter = options.backmatter = '';
    const tabs = await browser.tabs.query({
      currentWindow: true,
      highlighted: true
    });

    const links = [];
    for (const tab of tabs) {
      await ensureScripts(tab.id);
      const article = await getArticleFromContent(tab.id);
      const title = await formatTitle(article);
      const link = `${options.bulletListMarker} [${title}](${article.baseURI})`
      links.push(link)
    };

    const markdown = links.join(`\n`)
    await injectFunc(tab.id, (text) => copyToClipboard(text), [markdown]);

  }
  catch (error) {
    // This could happen if the extension is not allowed to run code in
    // the page, for example if the tab is a privileged page.
    console.error("Failed to copy as markdown link: " + error);
  };
}

// function to copy markdown to the clipboard, triggered by context menu
async function copyMarkdownFromContext(info, tab) {
  try{
    await ensureScripts(tab.id);

    const platformOS = navigator.platform;
    var folderSeparator = "";
    if(platformOS.indexOf("Win") === 0){
      folderSeparator = "\\";
    }else{
      folderSeparator = "/";
    }

    if (info.menuItemId == "copy-markdown-link") {
      const options = await getOptions();
      options.frontmatter = options.backmatter = '';
      const article = await getArticleFromContent(tab.id, false);
      await ensureOffscreenDocument();
      const response = await chrome.runtime.sendMessage({
        action: 'convertToMarkdown',
        html: `<a href="${info.linkUrl}">${info.linkText || info.selectionText}</a>`,
        options: { ...options, downloadImages: false },
        articleInfo: { baseURI: article.baseURI, math: article.math || {} }
      });
      const markdown = response?.markdown || '';
      await injectFunc(tab.id, (text) => copyToClipboard(text), [markdown]);
    }
    else if (info.menuItemId == "copy-markdown-image") {
      await injectFunc(tab.id, (text) => copyToClipboard(text), [`![](${info.srcUrl})`]);
    }
    else if(info.menuItemId == "copy-markdown-obsidian") {
      const article = await getArticleFromContent(tab.id, info.menuItemId == "copy-markdown-obsidian");
      const title = await formatTitle(article);
      const options = await getOptions();
      const obsidianVault = options.obsidianVault;
      const obsidianFolder = await formatObsidianFolder(article);
      const { markdown } = await convertArticleToMarkdown(article, downloadImages = false);
      await injectFunc(tab.id, (text) => copyToClipboard(text), [markdown]);
      await chrome.tabs.update({url: "obsidian://advanced-uri?vault=" + obsidianVault + "&clipboard=true&mode=new&filepath=" + obsidianFolder + generateValidFileName(title)});
    }
    else if(info.menuItemId == "copy-markdown-obsall") {
      const article = await getArticleFromContent(tab.id, info.menuItemId == "copy-markdown-obsall");
      const title = await formatTitle(article);
      const options = await getOptions();
      const obsidianVault = options.obsidianVault;
      const obsidianFolder = await formatObsidianFolder(article);
      const { markdown } = await convertArticleToMarkdown(article, downloadImages = false);
      await injectFunc(tab.id, (text) => copyToClipboard(text), [markdown]);
      await browser.tabs.update({url: "obsidian://advanced-uri?vault=" + obsidianVault + "&clipboard=true&mode=new&filepath=" + obsidianFolder + generateValidFileName(title)});
    }
    else {
      const article = await getArticleFromContent(tab.id, info.menuItemId == "copy-markdown-selection");
      const { markdown } = await convertArticleToMarkdown(article, downloadImages = false);
      await injectFunc(tab.id, (text) => copyToClipboard(text), [markdown]);
    }
  }
  catch (error) {
    // This could happen if the extension is not allowed to run code in
    // the page, for example if the tab is a privileged page.
    console.error("Failed to copy text: " + error);
  };
}

async function downloadMarkdownForAllTabs(info) {
  const tabs = await browser.tabs.query({
    currentWindow: true
  });
  tabs.forEach(tab => {
    downloadMarkdownFromContext(info, tab);
  });
}

/**
 * String.prototype.replaceAll() polyfill
 * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
 * @author Chris Ferdinandi
 * @license MIT
 */
if (!String.prototype.replaceAll) {
	String.prototype.replaceAll = function(str, newStr){

		// If a regex pattern
		if (Object.prototype.toString.call(str).toLowerCase() === '[object regexp]') {
			return this.replace(str, newStr);
		}

		// If a string
		return this.replace(new RegExp(str, 'g'), newStr);

	};
}

// Manifest V3 compatibility shim for executeScript
console.log('[SHIM] browser exists?', typeof browser);
console.log('[SHIM] chrome exists?', typeof chrome);
console.log('[SHIM] chrome.scripting exists?', typeof chrome?.scripting);
console.log('[SHIM] browser.tabs exists?', typeof browser?.tabs);
console.log('[SHIM] browser.tabs.executeScript exists?', typeof browser.tabs.executeScript);
if (!browser.tabs.executeScript) {
  console.log('[SHIM] Creating executeScript shim');
  browser.tabs.executeScript = function(tabId, details) {
    console.log('[SHIM] executeScript called with:', details);

    // Return a promise explicitly (not async function)
    return new Promise((resolve, reject) => {
      let scriptPromise;

      if (details.code) {
        const code = details.code;
        console.log('[SHIM] Executing code...');
        scriptPromise = chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: function(codeStr) {
            return eval(codeStr);
          },
          args: [code]
        });
      } else if (details.file) {
        console.log('[SHIM] Injecting file:', details.file);
        if (!chrome.scripting) {
          reject(new Error('chrome.scripting is not available!'));
          return;
        }
        console.log('[SHIM] Calling chrome.scripting.executeScript...');
        scriptPromise = chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: [details.file]
        });
      }

      scriptPromise
        .then(results => {
          console.log('[SHIM] chrome.scripting.executeScript returned:', results);
          try {
            // Convert V3 result format [{result: value}] to V2 format [value]
            console.log('[SHIM] Mapping results...');
            const returnValue = results ? results.map(r => r.result) : [];
            console.log('[SHIM] Mapped to:', returnValue);
            console.log('[SHIM] Calling resolve()...');
            resolve(returnValue);
            console.log('[SHIM] resolve() called successfully');
          } catch (error) {
            console.error('[SHIM] Error in .then() handler:', error);
            reject(error);
          }
        })
        .catch(error => {
          console.error('[SHIM] executeScript FAILED:', error);
          reject(error);
        });
    });
  };
} else {
  console.log('[SHIM] browser.tabs.executeScript already exists, NOT creating shim');
}

// default variables
var selectedText = null;
var imageList = null;
var mdClipsFolder = '';

const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
// set up event handlers
const cm = CodeMirror.fromTextArea(document.getElementById("md"), {
    theme: darkMode ? "xq-dark" : "xq-light",
    mode: "markdown",
    lineWrapping: true
});
cm.on("cursorActivity", (cm) => {
    const somethingSelected = cm.somethingSelected();
    var a = document.getElementById("downloadSelection");

    if (somethingSelected) {
        if(a.style.display != "block") a.style.display = "block";
    }
    else {
        if(a.style.display != "none") a.style.display = "none";
    }
});
document.getElementById("download").addEventListener("click", download);
document.getElementById("downloadSelection").addEventListener("click", downloadSelection);

const defaultOptions = {
    includeTemplate: false,
    clipSelection: true,
    downloadImages: false
}

const checkInitialSettings = options => {
    if (options.includeTemplate)
        document.querySelector("#includeTemplate").classList.add("checked");

    if (options.downloadImages)
        document.querySelector("#downloadImages").classList.add("checked");

    if (options.clipSelection)
        document.querySelector("#selected").classList.add("checked");
    else
        document.querySelector("#document").classList.add("checked");
}

const toggleClipSelection = options => {
    options.clipSelection = !options.clipSelection;
    document.querySelector("#selected").classList.toggle("checked");
    document.querySelector("#document").classList.toggle("checked");
    browser.storage.sync.set(options).then(() => clipSite()).catch((error) => {
        console.error(error);
    });
}

const toggleIncludeTemplate = options => {
    options.includeTemplate = !options.includeTemplate;
    document.querySelector("#includeTemplate").classList.toggle("checked");
    browser.storage.sync.set(options).then(() => {
        browser.contextMenus.update("toggle-includeTemplate", {
            checked: options.includeTemplate
        });
        try {
            browser.contextMenus.update("tabtoggle-includeTemplate", {
                checked: options.includeTemplate
            });
        } catch { }
        return clipSite()
    }).catch((error) => {
        console.error(error);
    });
}

const toggleDownloadImages = options => {
    options.downloadImages = !options.downloadImages;
    document.querySelector("#downloadImages").classList.toggle("checked");
    browser.storage.sync.set(options).then(() => {
        browser.contextMenus.update("toggle-downloadImages", {
            checked: options.downloadImages
        });
        try {
            browser.contextMenus.update("tabtoggle-downloadImages", {
                checked: options.downloadImages
            });
        } catch { }
    }).catch((error) => {
        console.error(error);
    });
}
const showOrHideClipOption = selection => {
    if (selection) {
        document.getElementById("clipOption").style.display = "flex";
    }
    else {
        document.getElementById("clipOption").style.display = "none";
    }
}

const clipSite = id => {
    console.log('[POPUP] Starting clipSite for tab:', id);
    return browser.tabs.executeScript(id, { code: "getSelectionAndDom()" })
        .then((result) => {
            console.log('[POPUP] Received result from content script:', result);
            if (result && result[0]) {
                showOrHideClipOption(result[0].selection);
                let message = {
                    type: "clip",
                    dom: result[0].dom,
                    selection: result[0].selection
                }
                console.log('[POPUP] Sending clip message to background');
                return browser.storage.sync.get(defaultOptions).then(options => {
                    console.log('[POPUP] Got options, sending message');
                    browser.runtime.sendMessage({
                        ...message,
                        ...options
                    });
                }).catch(err => {
                    console.error(err);
                    showError(err)
                    return browser.runtime.sendMessage({
                        ...message,
                        ...defaultOptions
                    });
                }).catch(err => {
                    console.error(err);
                    showError(err)
                });
            }
        }).catch(err => {
            console.error(err);
            showError(err)
        });
}

// inject the necessary scripts
console.log('[POPUP] Popup script loading...');
browser.storage.sync.get(defaultOptions).then(options => {
    console.log('[POPUP] Got default options');
    checkInitialSettings(options);

    document.getElementById("selected").addEventListener("click", (e) => {
        e.preventDefault();
        toggleClipSelection(options);
    });
    document.getElementById("document").addEventListener("click", (e) => {
        e.preventDefault();
        toggleClipSelection(options);
    });
    document.getElementById("includeTemplate").addEventListener("click", (e) => {
        e.preventDefault();
        toggleIncludeTemplate(options);
    });
    document.getElementById("downloadImages").addEventListener("click", (e) => {
        e.preventDefault();
        toggleDownloadImages(options);
    });

    console.log('[POPUP] Querying for active tab...');
    return browser.tabs.query({
        currentWindow: true,
        active: true
    });
}).then((tabs) => {
    console.log('[POPUP] Got tabs:', tabs);
    var id = tabs[0].id;
    var url = tabs[0].url;
    console.log('[POPUP] Injecting scripts into tab:', id);
    console.log('[POPUP] browser.tabs.executeScript is:', browser.tabs.executeScript);
    console.log('[POPUP] Is it our shim?', browser.tabs.executeScript.toString().includes('SHIM'));
    const promise1 = browser.tabs.executeScript(id, {
        file: "/browser-polyfill.min.js"
    });
    console.log('[POPUP] executeScript returned:', promise1, 'type:', typeof promise1);
    console.log('[POPUP] Promise constructor:', promise1?.constructor?.name);
    console.log('[POPUP] Has .then?', typeof promise1?.then);
    console.log('[POPUP] Attaching .then() handler...');
    promise1.then((result) => {
        console.log('[POPUP] .then() FIRED! Result:', result);
        console.log('[POPUP] First script injected, result:', result);
        return browser.tabs.executeScript(id, {
            file: "/contentScript/contentScript.js"
        });
    }).then((result) => {
        console.log('[POPUP] Second script injected, result:', result);
        console.info("Successfully injected MarkDownload content script");
        return clipSite(id);
    }).catch( (error) => {
        console.error('[POPUP] Promise chain caught error:', error);
        showError(error);
    });
});

// listen for notifications from the background page
browser.runtime.onMessage.addListener(notify);

//function to send the download message to the background page
function sendDownloadMessage(text) {
    if (text != null) {

        return browser.tabs.query({
            currentWindow: true,
            active: true
        }).then(tabs => {
            var message = {
                type: "download",
                markdown: text,
                title: document.getElementById("title").value,
                tab: tabs[0],
                imageList: imageList,
                mdClipsFolder: mdClipsFolder
            };
            return browser.runtime.sendMessage(message);
        });
    }
}

// event handler for download button
async function download(e) {
    e.preventDefault();
    await sendDownloadMessage(cm.getValue());
    window.close();
}

// event handler for download selected button
async function downloadSelection(e) {
    e.preventDefault();
    if (cm.somethingSelected()) {
        await sendDownloadMessage(cm.getSelection());
    }
}

//function that handles messages from the injected script into the site
function notify(message) {
    // message for displaying markdown
    if (message.type == "display.md") {

        // set the values from the message
        //document.getElementById("md").value = message.markdown;
        cm.setValue(message.markdown);
        document.getElementById("title").value = message.article.title;
        imageList = message.imageList;
        mdClipsFolder = message.mdClipsFolder;
        
        // show the hidden elements
        document.getElementById("container").style.display = 'flex';
        document.getElementById("spinner").style.display = 'none';
         // focus the download button
        document.getElementById("download").focus();
        cm.refresh();
    }
}

function showError(err) {
    // show the hidden elements
    document.getElementById("container").style.display = 'flex';
    document.getElementById("spinner").style.display = 'none';
    cm.setValue(`Error clipping the page\n\n${err}`)
}


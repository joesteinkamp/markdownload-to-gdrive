// Offscreen document script for DOM parsing in Manifest V3
// This provides DOM APIs (DOMParser, document.createElement) that aren't available in service workers

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'parseDOM') {
    try {
      const parser = new DOMParser();
      const dom = parser.parseFromString(message.domString, "text/html");

      // Serialize the DOM back to string (since we can't send DOM objects)
      sendResponse({
        success: true,
        html: dom.documentElement.outerHTML
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
  } else if (message.action === 'createElement') {
    try {
      const element = document.createElement(message.tagName);
      if (message.textContent) {
        element.textContent = message.textContent;
      }
      sendResponse({
        success: true,
        outerHTML: element.outerHTML
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  return false; // Synchronous response
});

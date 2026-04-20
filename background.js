const VERCEL_HEADER_SIGNALS = [
  { header: "x-vercel-id", weight: 100 },
  { header: "x-vercel-cache", weight: 100 },
  { header: "x-vercel-execution-region", weight: 100 },
];

const VERCEL_SERVER_VALUE = "vercel";

const tabState = new Map();
let sessionDismissed = false;

function getOrCreateTabState(tabId) {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, {
      signals: [],
      confidence: "none",
    });
  }
  return tabState.get(tabId);
}

function evaluateConfidence(signals) {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight >= 100) return "confirmed";
  if (totalWeight >= 40) return "likely";
  if (totalWeight > 0) return "possible";
  return "none";
}

function updateIcon(tabId, confidence) {
  const color =
    confidence === "confirmed" || confidence === "likely"
      ? "red"
      : confidence === "possible"
        ? "yellow"
        : "gray";

  const path = {
    16: `icons/icon-${color}-16.png`,
    48: `icons/icon-${color}-48.png`,
    128: `icons/icon-${color}-128.png`,
  };

  chrome.action.setIcon({ tabId, path });

  const titles = {
    confirmed: "⚠️ Vercel-hosted site detected!",
    likely: "⚠️ Likely a Vercel-hosted site",
    possible: "This site may be on Vercel",
    none: "No Vercel signals detected",
  };
  chrome.action.setTitle({ tabId, title: titles[confidence] });
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type !== "main_frame") return;

    const state = getOrCreateTabState(details.tabId);
    state.signals = [];

    const headers = details.responseHeaders || [];

    for (const { name, value } of headers) {
      const lower = name.toLowerCase();

      for (const signal of VERCEL_HEADER_SIGNALS) {
        if (lower === signal.header) {
          state.signals.push({
            type: "header",
            detail: `${name}: ${value}`,
            weight: signal.weight,
          });
        }
      }

      if (lower === "server" && value.toLowerCase().includes(VERCEL_SERVER_VALUE)) {
        state.signals.push({
          type: "header",
          detail: `server: ${value}`,
          weight: 80,
        });
      }
    }

    const url = new URL(details.url);
    if (url.hostname.endsWith(".vercel.app")) {
      state.signals.push({
        type: "domain",
        detail: `Hostname: ${url.hostname}`,
        weight: 100,
      });
    }

    state.confidence = evaluateConfidence(state.signals);
    updateIcon(details.tabId, state.confidence);

    if (
      !sessionDismissed &&
      (state.confidence === "confirmed" || state.confidence === "likely")
    ) {
      chrome.tabs.sendMessage(details.tabId, {
        type: "VERCEL_DETECTED",
        confidence: state.confidence,
        signals: state.signals,
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => {
  tabState.delete(tabId);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_STATE" && sender.tab) {
    const state = getOrCreateTabState(sender.tab.id);
    sendResponse(state);
    return true;
  }

  if (message.type === "GET_STATE_POPUP") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const state = getOrCreateTabState(tabs[0].id);
        sendResponse({ ...state, url: tabs[0].url });
      } else {
        sendResponse({ signals: [], confidence: "none" });
      }
    });
    return true;
  }

  if (message.type === "DISMISSED") {
    sessionDismissed = true;
    return true;
  }

  if (message.type === "CONTENT_SIGNALS" && sender.tab) {
    const state = getOrCreateTabState(sender.tab.id);
    for (const signal of message.signals) {
      const exists = state.signals.some((s) => s.detail === signal.detail);
      if (!exists) {
        state.signals.push(signal);
      }
    }
    state.confidence = evaluateConfidence(state.signals);
    updateIcon(sender.tab.id, state.confidence);

    if (
      !sessionDismissed &&
      (state.confidence === "confirmed" || state.confidence === "likely")
    ) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "VERCEL_DETECTED",
        confidence: state.confidence,
        signals: state.signals,
      });
    }
    return true;
  }
});

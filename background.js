const PLATFORMS = {
  vercel: {
    name: "Vercel",
    headerSignals: [
      { header: "x-vercel-id", weight: 100 },
      { header: "x-vercel-cache", weight: 100 },
      { header: "x-vercel-execution-region", weight: 100 },
    ],
    serverValue: "vercel",
    domains: [".vercel.app"],
    messageType: "PLATFORM_DETECTED",
  },
  lovable: {
    name: "Lovable",
    headerSignals: [],
    serverValue: null,
    domains: [".lovable.app", ".gptengineer.run"],
    messageType: "PLATFORM_DETECTED",
  },
};

const tabState = new Map();
const sessionDismissedPlatforms = new Set();

function getOrCreateTabState(tabId) {
  if (!tabState.has(tabId)) {
    tabState.set(tabId, {
      signals: [],
      confidence: "none",
      platforms: [],
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

function detectPlatforms(signals) {
  const platforms = new Set();
  for (const signal of signals) {
    if (signal.platform) {
      platforms.add(signal.platform);
    }
  }
  return [...platforms];
}

function buildTitleText(confidence, platforms) {
  if (confidence === "none") return "No breach-affected platform detected";
  const names = platforms.length > 0 ? platforms.join(" & ") : "breach-affected platform";
  switch (confidence) {
    case "confirmed": return `⚠️ ${names} site detected!`;
    case "likely": return `⚠️ Likely a ${names} site`;
    case "possible": return `This site may use ${names}`;
    default: return "No breach-affected platform detected";
  }
}

function updateIcon(tabId, confidence, platforms) {
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
  chrome.action.setTitle({ tabId, title: buildTitleText(confidence, platforms) });
}

function shouldWarn(platforms) {
  return platforms.some((p) => !sessionDismissedPlatforms.has(p));
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type !== "main_frame") return;

    const state = getOrCreateTabState(details.tabId);
    state.signals = [];

    const headers = details.responseHeaders || [];

    for (const { name, value } of headers) {
      const lower = name.toLowerCase();

      for (const [, platform] of Object.entries(PLATFORMS)) {
        for (const signal of platform.headerSignals) {
          if (lower === signal.header) {
            state.signals.push({
              type: "header",
              detail: `${name}: ${value}`,
              weight: signal.weight,
              platform: platform.name,
            });
          }
        }

        if (
          platform.serverValue &&
          lower === "server" &&
          value.toLowerCase().includes(platform.serverValue)
        ) {
          state.signals.push({
            type: "header",
            detail: `server: ${value}`,
            weight: 80,
            platform: platform.name,
          });
        }
      }
    }

    const url = new URL(details.url);
    for (const [, platform] of Object.entries(PLATFORMS)) {
      for (const domain of platform.domains) {
        if (url.hostname.endsWith(domain)) {
          state.signals.push({
            type: "domain",
            detail: `Hostname: ${url.hostname}`,
            weight: 100,
            platform: platform.name,
          });
        }
      }
    }

    state.platforms = detectPlatforms(state.signals);
    state.confidence = evaluateConfidence(state.signals);
    updateIcon(details.tabId, state.confidence, state.platforms);

    if (
      shouldWarn(state.platforms) &&
      (state.confidence === "confirmed" || state.confidence === "likely")
    ) {
      chrome.tabs.sendMessage(details.tabId, {
        type: "PLATFORM_DETECTED",
        confidence: state.confidence,
        signals: state.signals,
        platforms: state.platforms,
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
        sendResponse({ signals: [], confidence: "none", platforms: [] });
      }
    });
    return true;
  }

  if (message.type === "DISMISSED") {
    if (message.platforms) {
      for (const p of message.platforms) {
        sessionDismissedPlatforms.add(p);
      }
    }
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
    state.platforms = detectPlatforms(state.signals);
    state.confidence = evaluateConfidence(state.signals);
    updateIcon(sender.tab.id, state.confidence, state.platforms);

    if (
      shouldWarn(state.platforms) &&
      (state.confidence === "confirmed" || state.confidence === "likely")
    ) {
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "PLATFORM_DETECTED",
        confidence: state.confidence,
        signals: state.signals,
        platforms: state.platforms,
      });
    }
    return true;
  }
});

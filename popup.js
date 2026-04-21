function getStatusLabel(confidence, platforms) {
  const names = platforms && platforms.length > 0
    ? platforms.join(" & ")
    : "breach-affected platform";

  switch (confidence) {
    case "confirmed": return `${names} site confirmed`;
    case "likely": return `Likely a ${names} site`;
    case "possible": return `Possibly built with ${names}`;
    default: return "No breach-affected platforms detected";
  }
}

chrome.runtime.sendMessage({ type: "GET_STATE_POPUP" }, (state) => {
  if (!state) return;

  const statusEl = document.getElementById("status");
  const statusText = document.getElementById("status-text");
  const dot = document.getElementById("dot");
  const urlEl = document.getElementById("url");
  const signalsList = document.getElementById("signals-list");

  statusEl.className = `status-bar status-${state.confidence}`;
  dot.className = `dot dot-${state.confidence}`;
  statusText.textContent = getStatusLabel(state.confidence, state.platforms);

  if (state.url) {
    try {
      urlEl.textContent = new URL(state.url).hostname;
    } catch {
      urlEl.textContent = state.url;
    }
  }

  if (state.signals && state.signals.length > 0) {
    signalsList.innerHTML = state.signals
      .map(
        (s) => `
      <div class="signal-item">
        <span class="signal-type">${s.type}</span>
        ${s.platform ? `<span class="signal-platform">${escapeHtml(s.platform)}</span>` : ""}
        <span class="signal-detail" title="${escapeAttr(s.detail)}">${escapeHtml(s.detail)}</span>
      </div>
    `
      )
      .join("");
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

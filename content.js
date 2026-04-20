(() => {
  let overlayShown = false;
  let sessionDismissed = false;
  let overlay = null;

  function scanPageForSignals() {
    const signals = [];

    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
      const src = script.getAttribute("src");
      if (src && src.includes("/_next/")) {
        signals.push({
          type: "asset",
          detail: `Next.js asset: ${src.substring(0, 80)}`,
          weight: 30,
        });
        break;
      }
    }

    const nextDataEl = document.getElementById("__NEXT_DATA__");
    if (nextDataEl) {
      signals.push({
        type: "framework",
        detail: "__NEXT_DATA__ script tag found",
        weight: 30,
      });
    }

    if (signals.length > 0) {
      chrome.runtime.sendMessage({ type: "CONTENT_SIGNALS", signals });
    }
  }

  function createOverlay(confidence, signals) {
    if (overlayShown || sessionDismissed) return;
    overlayShown = true;

    overlay = document.createElement("div");
    overlay.id = "vercel-detector-overlay";

    const signalList = signals
      .map((s) => `<li>${escapeHtml(s.detail)}</li>`)
      .join("");

    const confidenceLabel =
      confidence === "confirmed" ? "Confirmed" : "Likely";
    const confidenceColor =
      confidence === "confirmed" ? "#ef4444" : "#f59e0b";

    overlay.innerHTML = `
      <style>
        #vercel-detector-overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(6px);
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          animation: vd-fadein 0.25s ease-out;
        }
        @keyframes vd-fadein {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .vd-card {
          background: #1a1a2e;
          border: 1px solid ${confidenceColor};
          border-radius: 16px;
          padding: 40px;
          max-width: 480px;
          width: 90vw;
          color: #e0e0e0;
          box-shadow: 0 0 60px ${confidenceColor}40, 0 25px 50px rgba(0,0,0,0.5);
          text-align: center;
        }
        .vd-icon {
          font-size: 56px;
          margin-bottom: 16px;
        }
        .vd-title {
          font-size: 22px;
          font-weight: 700;
          color: #fff;
          margin-bottom: 8px;
        }
        .vd-badge {
          display: inline-block;
          background: ${confidenceColor}20;
          color: ${confidenceColor};
          border: 1px solid ${confidenceColor};
          border-radius: 999px;
          padding: 4px 14px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 16px;
        }
        .vd-desc {
          font-size: 15px;
          line-height: 1.6;
          color: #b0b0c0;
          margin-bottom: 20px;
        }
        .vd-signals {
          text-align: left;
          background: #0d0d1a;
          border-radius: 10px;
          padding: 14px 18px;
          margin-bottom: 24px;
          max-height: 140px;
          overflow-y: auto;
        }
        .vd-signals-title {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #666;
          margin-bottom: 8px;
        }
        .vd-signals ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .vd-signals li {
          font-size: 12px;
          font-family: "SF Mono", "Fira Code", monospace;
          color: ${confidenceColor};
          padding: 3px 0;
          border-bottom: 1px solid #1a1a2e;
        }
        .vd-signals li:last-child {
          border-bottom: none;
        }
        .vd-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .vd-btn {
          padding: 12px 28px;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .vd-btn:hover {
          transform: translateY(-1px);
        }
        .vd-btn:active {
          transform: translateY(0);
        }
        .vd-btn-back {
          background: ${confidenceColor};
          color: #000;
          box-shadow: 0 4px 14px ${confidenceColor}50;
        }
        .vd-btn-proceed {
          background: transparent;
          color: #888;
          border: 1px solid #333;
        }
        .vd-btn-proceed:hover {
          border-color: #555;
          color: #aaa;
        }
      </style>
      <div class="vd-card">
        <div class="vd-icon">&#9888;&#65039;</div>
        <div class="vd-title">Vercel-Hosted Site Detected</div>
        <span class="vd-badge">${confidenceLabel}</span>
        <p class="vd-desc">
          This website appears to be hosted on Vercel. Given the recent security incident,
          proceed with caution &mdash; especially before entering credentials or sensitive data.
        </p>
        <div class="vd-signals">
          <div class="vd-signals-title">Detection signals</div>
          <ul>${signalList}</ul>
        </div>
        <div class="vd-buttons">
          <button class="vd-btn vd-btn-back" id="vd-go-back">Go Back</button>
          <button class="vd-btn vd-btn-proceed" id="vd-proceed">Proceed Anyway</button>
        </div>
      </div>
    `;

    document.documentElement.appendChild(overlay);

    document.getElementById("vd-go-back").addEventListener("click", () => {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.close();
      }
    });

    document.getElementById("vd-proceed").addEventListener("click", () => {
      overlay.remove();
      overlayShown = false;
      sessionDismissed = true;
      chrome.runtime.sendMessage({ type: "DISMISSED" });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "VERCEL_DETECTED") {
      createOverlay(message.confidence, message.signals);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scanPageForSignals);
  } else {
    scanPageForSignals();
  }
})();

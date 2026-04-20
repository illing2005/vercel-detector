# Vercel Site Detector

A Chrome extension that detects if a website is hosted on Vercel and displays a warning before you proceed — built in response to the April 2026 Vercel security incident.

## Background: The Vercel Security Incident

On April 19, 2026, Vercel confirmed a security breach involving unauthorized access to internal systems. The attack group ShinyHunters claimed to be selling internal data, employee information, and various API/GitHub/NPM tokens. The root cause was traced to a compromised third-party AI tool connected via Google Workspace OAuth — a supply-chain / integration compromise rather than a direct infrastructure hack.

**Key facts:**

- Only a **limited subset of customers** was affected according to Vercel's disclosure
- For affected accounts, environment variables (API keys, tokens) and GitHub/deployment integrations may have been exposed
- "Sensitive environment variables" remained protected per Vercel's statement
- There is **no evidence** of mass code tampering or widespread malicious deployments
- The risk is primarily credential exposure at the account level, not a platform-wide compromise

**What you should do if you use Vercel:**

- Rotate API keys and tokens (GitHub, NPM, etc.)
- Review environment variables and recent deployment logs
- Enable the "sensitive environment variables" feature
- Audit connected OAuth apps in Google Workspace

This extension helps you stay aware of which sites you visit are hosted on Vercel so you can make informed decisions about what data you share.

## How It Works

The extension checks multiple signals to determine if a site is hosted on Vercel:

| Signal | Confidence |
|--------|-----------|
| `x-vercel-id` response header | Confirmed |
| `x-vercel-cache` response header | Confirmed |
| `x-vercel-execution-region` response header | Confirmed |
| `server: Vercel` response header | High |
| `*.vercel.app` hostname | Confirmed |
| `__NEXT_DATA__` in page HTML | Weak (Next.js can be self-hosted) |
| `/_next/` asset URLs | Weak (Next.js can be self-hosted) |

Based on these signals, the extension assigns a confidence level:

- **Confirmed** (red icon) — strong Vercel-specific headers or domain detected
- **Likely** (red icon) — multiple moderate signals combined
- **Possible** (yellow icon) — weak signals like Next.js assets only
- **None** (gray icon) — no Vercel indicators found

When a site is confirmed or likely Vercel-hosted, a full-screen warning overlay appears asking if you want to proceed or go back. The warning only appears **once per browser session** — after you dismiss it, you can browse freely until you restart Chrome.

## Installation

1. Download or clone this repository:
   ```bash
   git clone https://github.com/user/vercel-plugin.git
   ```

2. Open Chrome and navigate to:
   ```
   chrome://extensions/
   ```

3. Enable **Developer mode** using the toggle in the top-right corner.

4. Click **Load unpacked**.

5. Select the `vercel-plugin` folder (the one containing `manifest.json`).

6. The extension icon will appear in your toolbar. You're all set.

### Verifying it works

Visit any Vercel-hosted site (e.g., [vercel.com](https://vercel.com)) — you should see the warning overlay and the toolbar icon turn red.

## Files

```
vercel-plugin/
├── manifest.json        # Chrome MV3 extension manifest
├── background.js        # Service worker — inspects response headers
├── content.js           # Content script — page scanning + warning overlay
├── popup.html           # Extension popup UI
├── popup.js             # Popup logic
├── icons/               # Toolbar icons (gray / yellow / red)
└── generate-icons.js    # Build script for generating icon PNGs
```

## Limitations

- Cannot inspect DNS records directly (would require an external service)
- Sites behind a reverse proxy (Cloudflare, Fastly, etc.) may strip Vercel headers, making detection impossible
- Next.js signals alone are weak — Next.js can be self-hosted anywhere, not just Vercel
- The extension requires the `webRequest` permission to read response headers

## Built by

[Maestro Labs](https://maestrolabs.com)

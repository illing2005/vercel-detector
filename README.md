# Breach Detector

A Chrome extension that detects if a website is built with breach-affected platforms (Vercel, Lovable) and displays a warning before you proceed — built in response to the April 2026 security incidents.

## Background: Security Incidents

### Vercel (April 19, 2026)

Vercel confirmed a security breach involving unauthorized access to internal systems. The attack group ShinyHunters claimed to be selling internal data, employee information, and various API/GitHub/NPM tokens. The root cause was traced to a compromised third-party AI tool connected via Google Workspace OAuth — a supply-chain / integration compromise rather than a direct infrastructure hack.

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

### Lovable (April 2026)

Lovable (formerly GPT Engineer) disclosed a security flaw involving a BOLA (Broken Object Level Authorization) vulnerability that allowed unauthorized access to other users' project data, including source code and AI chat histories. Lovable initially categorized the exposure as "intentional behavior" for public projects before updating its policies.

**Key facts:**

- Public projects previously exposed both source code **and** AI chat histories to anyone
- A BOLA vulnerability allowed access to user data beyond intended permissions
- Enterprise customers had public visibility disabled since May 2025; other users were exposed longer
- Lovable-hosted apps may contain hardcoded API keys, Supabase credentials, and other secrets in frontend bundles
- Sites built with Lovable are client-rendered SPAs — secrets embedded in JavaScript are visible to anyone

**What you should do if you use Lovable:**

- Review all projects for exposed environment variables and API keys
- Rotate any Supabase keys, API tokens, or credentials used in Lovable projects
- Set projects to private if they contain sensitive data
- Audit any secrets that may have been visible in chat histories

This extension helps you stay aware of which sites you visit are built with breach-affected platforms so you can make informed decisions about what data you share.

## How It Works

The extension checks multiple signals to determine if a site is built with a breach-affected platform:

### Vercel Signals

| Signal | Confidence |
|--------|-----------|
| `x-vercel-id` response header | Confirmed |
| `x-vercel-cache` response header | Confirmed |
| `x-vercel-execution-region` response header | Confirmed |
| `server: Vercel` response header | High |
| `*.vercel.app` hostname | Confirmed |
| `__NEXT_DATA__` in page HTML | Weak (Next.js can be self-hosted) |
| `/_next/` asset URLs | Weak (Next.js can be self-hosted) |

### Lovable Signals

| Signal | Confidence |
|--------|-----------|
| `*.lovable.app` hostname | Confirmed |
| `*.gptengineer.run` hostname (legacy) | Confirmed |
| Lovable tagger script reference | Confirmed |
| `meta[name="generator"]` containing "lovable" | Confirmed |
| Lovable/GPT Engineer references in page source | Moderate |
| Supabase + Lovable configuration in scripts | Moderate |
| Vite+React SPA shell pattern | Weak (common in other tools too) |

### Confidence Levels

Based on these signals, the extension assigns a confidence level:

- **Confirmed** (red icon) — strong platform-specific headers, domains, or markers detected
- **Likely** (red icon) — multiple moderate signals combined
- **Possible** (yellow icon) — weak signals only
- **None** (gray icon) — no indicators found

When a site is confirmed or likely built with a breach-affected platform, a full-screen warning overlay appears asking if you want to proceed or go back. The warning can be dismissed **per platform per browser session** — after you dismiss it for a given platform, you can browse freely until you restart Chrome.

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

Visit any Vercel-hosted site (e.g., [vercel.com](https://vercel.com)) or a Lovable-hosted site (any `*.lovable.app` URL) — you should see the warning overlay and the toolbar icon turn red.

## Files

```
vercel-plugin/
├── manifest.json        # Chrome MV3 extension manifest
├── background.js        # Service worker — inspects response headers + domains
├── content.js           # Content script — page scanning + warning overlay
├── popup.html           # Extension popup UI
├── popup.js             # Popup logic
├── icons/               # Toolbar icons (gray / yellow / red)
└── generate-icons.js    # Build script for generating icon PNGs
```

## Limitations

- Cannot inspect DNS records directly (would require an external service)
- Sites behind a reverse proxy (Cloudflare, Fastly, etc.) may strip platform-specific headers, making detection harder
- Next.js signals alone are weak — Next.js can be self-hosted anywhere, not just Vercel
- Lovable apps deployed to custom domains via third-party hosts (e.g., Vercel, Netlify) without Lovable-specific markers may not be detected
- The Vite+React SPA shell pattern is common across many tools, not just Lovable
- The extension requires the `webRequest` permission to read response headers

## Built by

[Maestro Labs](https://maestrolabs.com)

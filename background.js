"use strict";

const STATES = ["none", "proxy1", "proxy2"];

const DEFAULT_OPTIONS = {
  currentState: "none",
  proxy1: { type: "socks5", host: "", port: 1080, proxyDNS: true },
  proxy2: { type: "socks5", host: "", port: 1080, proxyDNS: true },
  reload: false
};

// --- SVG path data (Font Awesome icons) ---
const SVG = {
  // fa-times-circle: circle with X
  none: {
    d: "M256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm121.6 313.1c4.7 4.7 4.7 12.3 0 17L338 377.6c-4.7 4.7-12.3 4.7-17 0L256 312l-65.1 65.6c-4.7 4.7-12.3 4.7-17 0L134.4 338c-4.7-4.7-4.7-12.3 0-17l65.6-65-65.6-65.1c-4.7-4.7-4.7-12.3 0-17l39.6-39.6c4.7-4.7 12.3-4.7 17 0l65 65.7 65.1-65.6c4.7-4.7 12.3-4.7 17 0l39.6 39.6c4.7 4.7 4.7 12.3 0 17L312 256l65.6 65.1z",
    w: 512, h: 512
  },
  // fa-desktop: monitor with stand
  manual: {
    d: "M96 64h448v352h64V40c0-22.06-17.94-40-40-40H72C49.94 0 32 17.94 32 40v376h64V64zm528 384H480v-64H288v64H16c-8.84 0-16 7.16-16 16v32c0 8.84 7.16 16 16 16h608c8.84 0 16-7.16 16-16v-32c0-8.84-7.16-16-16-16z",
    w: 640, h: 512
  },
  // fa-exclamation-triangle: warning
  error: {
    d: "M569.517 440.013C587.975 472.007 564.806 512 527.94 512H48.054c-36.937 0-59.999-40.055-41.577-71.987L246.423 23.985c18.467-32.009 64.72-31.951 83.154 0l239.94 416.028zM288 354c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.981 12.654z",
    w: 576, h: 512
  }
};

// --- Icon rendering ---
let iconColor = "black";

function drawSvgPath(ctx, svg, x, y, maxW, maxH, color) {
  const scale = Math.min(maxW / svg.w, maxH / svg.h);
  const w = svg.w * scale;
  const h = svg.h * scale;
  ctx.save();
  ctx.translate(x + (maxW - w) / 2, y + (maxH - h) / 2);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(svg.d));
  ctx.restore();
}

function renderIcon(state, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (state === "none") {
    // Original proportions: 512x512 in 640x640 space (~80%, 10% padding)
    const pad = size * 0.1;
    const inner = size - pad * 2;
    drawSvgPath(ctx, SVG.none, pad, pad, inner, inner, iconColor);
  } else {
    // Full-size monitor (640x512 fills width, vertically centered)
    drawSvgPath(ctx, SVG.manual, 0, 0, size, size, iconColor);

    // Number badge: bottom-right with transparent halo
    const num = state === "proxy1" ? "1" : "2";
    const badgeX = size * 0.77;
    const badgeY = size * 0.77;
    const haloR = size * 0.4;

    // Punch a transparent hole so the number doesn't merge with the icon
    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, haloR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Draw the number on the cleared area
    ctx.fillStyle = iconColor;
    ctx.font = `normal ${Math.round(size * 0.55)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, badgeX, badgeY);
  }

  return ctx.getImageData(0, 0, size, size);
}

function renderErrorIcon(color, size) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  drawSvgPath(ctx, SVG.error, 0, 0, size, size, color);
  return ctx.getImageData(0, 0, size, size);
}

function setIcon(renderFn) {
  browser.browserAction.setIcon({
    imageData: {
      16: renderFn(16),
      32: renderFn(32),
      64: renderFn(64)
    }
  });
}

// --- Proxy settings ---
function buildProxyValue(config) {
  const hostPort = `${config.host}:${config.port}`;
  const base = { proxyType: "manual", passthrough: "" };

  switch (config.type) {
    case "http":
      return { ...base, http: hostPort, httpProxyAll: true };
    case "https":
      return { ...base, ssl: hostPort };
    case "socks4":
      return { ...base, socks: hostPort, socksVersion: 4, proxyDNS: config.proxyDNS };
    case "socks5":
      return { ...base, socks: hostPort, socksVersion: 5, proxyDNS: config.proxyDNS };
    default:
      return { proxyType: "none" };
  }
}

function formatTitle(state, options) {
  if (state === "none") {
    return "Proxy: off";
  }
  const label = state === "proxy1" ? "Proxy 1" : "Proxy 2";
  const config = options[state];
  if (!config || !config.host) {
    return `${label}: not configured`;
  }
  return `${label}: ${config.type}://${config.host}:${config.port}`;
}

async function applyState(state, options) {
  let proxyValue;
  if (state === "none") {
    proxyValue = { proxyType: "none" };
  } else {
    const config = options[state];
    if (!config || !config.host) {
      return false;
    }
    proxyValue = buildProxyValue(config);
  }

  try {
    await browser.proxy.settings.set({ value: proxyValue });
    browser.browserAction.setPopup({ popup: null });
    return true;
  } catch (err) {
    console.error("[Toggle Proxy]", err);
    setIcon(size => renderErrorIcon("FireBrick", size));
    browser.browserAction.setTitle({
      title: "Toggle Proxy failed, click for details"
    });
    browser.browserAction.setPopup({
      popup: `error.html?data=${btoa(err.message)}`
    });
    return false;
  }
}

function updateButton(state, options) {
  setIcon(size => renderIcon(state, size));
  browser.browserAction.setTitle({ title: formatTitle(state, options) });
}

// --- State cycling ---
function nextState(current, options) {
  const idx = STATES.indexOf(current);
  for (let i = 1; i <= STATES.length; i++) {
    const candidate = STATES[(idx + i) % STATES.length];
    if (candidate === "none") return candidate;
    if (options[candidate] && options[candidate].host) return candidate;
  }
  return "none";
}

// --- Init ---
async function init() {
  const options = await browser.storage.local.get();

  if (!Object.keys(options).length) {
    console.debug("[Toggle Proxy] First run, saving defaults");
    await browser.storage.local.set(DEFAULT_OPTIONS);
    updateButton("none", DEFAULT_OPTIONS);
    return;
  }

  if (typeof options.proxy1 === "string") {
    console.debug("[Toggle Proxy] Migrating from old format");
    await browser.storage.local.clear();
    await browser.storage.local.set(DEFAULT_OPTIONS);
    updateButton("none", DEFAULT_OPTIONS);
    return;
  }

  const state = options.currentState || "none";
  const ok = await applyState(state, options);
  if (ok) {
    updateButton(state, options);
  }
}

// --- Theme handling ---
function updateIconColor(theme) {
  if (theme.colors && theme.colors.icons) {
    iconColor = theme.colors.icons;
  } else {
    iconColor = matchMedia("(prefers-color-scheme: dark)").matches
      ? "white"
      : "black";
  }
}

async function handleThemeChange(theme) {
  updateIconColor(theme);

  const allowed = await browser.extension.isAllowedIncognitoAccess();
  if (!allowed) {
    setIcon(size => renderErrorIcon("Gold", size));
    browser.browserAction.setTitle({
      title: "Allow extension to run in private windows"
    });
    browser.browserAction.setPopup({ popup: "1526299.html" });
    return;
  }

  await init();
}

browser.theme.onUpdated.addListener(({ theme }) => handleThemeChange(theme));
browser.theme.getCurrent().then(theme => handleThemeChange(theme));

// --- Storage change -> re-apply ---
browser.storage.onChanged.addListener(() => init());

// --- Click handler ---
browser.browserAction.onClicked.addListener(async () => {
  const options = await browser.storage.local.get();
  const current = options.currentState || "none";
  const next = nextState(current, options);

  const ok = await applyState(next, options);
  if (ok) {
    await browser.storage.local.set({ currentState: next });
    updateButton(next, options);
    if (options.reload) {
      browser.tabs.reload({ bypassCache: true });
    }
  }
});

// --- Port messaging (error/bug popup pages) ---
browser.runtime.onConnect.addListener(port => {
  port.onMessage.addListener(msg => {
    if (msg.id === "bug") {
      browser.tabs.create({
        url: "https://bugzilla.mozilla.org/show_bug.cgi?id=1526299"
      });
    } else if (msg.id === "options") {
      browser.runtime.openOptionsPage();
    }
  });

  port.onDisconnect.addListener(p => {
    if (p.name === "error") {
      init();
    }
  });
});

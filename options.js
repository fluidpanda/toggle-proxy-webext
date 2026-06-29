"use strict";

const SLOTS = ["proxy1", "proxy2"];

const FIELD_IDS = {
  proxy1: { type: "p1-type", host: "p1-host", port: "p1-port", proxyDNS: "p1-proxydns" },
  proxy2: { type: "p2-type", host: "p2-host", port: "p2-port", proxyDNS: "p2-proxydns" }
};

function el(id) {
  return document.getElementById(id);
}

// --- Load / read slot ---

function loadSlot(slot, config) {
  if (!config) return;
  const f = FIELD_IDS[slot];
  el(f.type).value = config.type || "socks5";
  el(f.host).value = config.host || "";
  el(f.port).value = config.port || "";
  el(f.proxyDNS).checked = config.proxyDNS !== false;
  updateProxyDNSVisibility(slot);
}

function readSlot(slot) {
  const f = FIELD_IDS[slot];
  return {
    type: el(f.type).value,
    host: el(f.host).value.trim(),
    port: parseInt(el(f.port).value, 10) || 0,
    proxyDNS: el(f.proxyDNS).checked
  };
}

// --- Proxy DNS visibility ---
function updateProxyDNSVisibility(slot) {
  const f = FIELD_IDS[slot];
  const type = el(f.type).value;
  const isSocks = type === "socks4" || type === "socks5";
  const fieldset = el(f.type).closest(".proxy-slot");
  const socksRow = fieldset.querySelector(".socks-only");
  socksRow.hidden = !isSocks;
}

// --- Save with debounce for text inputs ---
const saveTimers = {};

function saveSlot(slot, immediate) {
  clearTimeout(saveTimers[slot]);
  const doSave = () => {
    const data = {};
    data[slot] = readSlot(slot);
    console.debug("[Toggle Proxy] Saving", slot, data[slot]);
    browser.storage.local.set(data);
  };

  if (immediate) {
    doSave();
  } else {
    saveTimers[slot] = setTimeout(doSave, 400);
  }
}

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  // Incognito check
  const allowed = await browser.extension.isAllowedIncognitoAccess();
  if (!allowed) {
    el("incognito-warning").hidden = false;
    document.querySelector(".container").classList.add("disabled");
  }

  // Load saved options
  const options = await browser.storage.local.get();
  for (const slot of SLOTS) {
    loadSlot(slot, options[slot]);
  }
  el("reload").checked = options.reload || false;

  // Type select -> update proxyDNS visibility + immediate save
  for (const slot of SLOTS) {
    el(FIELD_IDS[slot].type).addEventListener("change", () => {
      updateProxyDNSVisibility(slot);
      saveSlot(slot, true);
    });
  }

  // All inputs -> auto-save
  document.querySelectorAll(".proxy-slot input, .proxy-slot select").forEach(input => {
    if (input.tagName === "SELECT") return; // already handled above
    const slot = input.closest("[data-slot]").dataset.slot;
    const isImmediate = input.type === "checkbox";
    const event = isImmediate ? "change" : "input";
    input.addEventListener(event, () => saveSlot(slot, isImmediate));
  });

  // Global options
  el("reload").addEventListener("change", () => {
    browser.storage.local.set({ reload: el("reload").checked });
  });
});

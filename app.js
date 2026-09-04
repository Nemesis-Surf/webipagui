// ipagui — everything runs client-side. Nothing is sent anywhere except the
// direct fetch() of each repo JSON file (and, optionally, through a CORS
// proxy you choose yourself in the Repos panel).

(() => {
  "use strict";

  // ------------------------------------------------------------------
  // Install-scheme config
  //
  // "verified" schemes have been confirmed against current documentation.
  // "unverified" ones are the commonly-used convention for that app but can
  // change between app versions — if a button doesn't do anything on your
  // device, open the app itself, check its docs/changelog for the current
  // URL scheme, and edit DEFAULT_INSTALL_TARGETS below (or add a custom one
  // from the Repos panel, no code editing required).
  // ------------------------------------------------------------------
  const DEFAULT_INSTALL_TARGETS = [
    {
      id: "altstore",
      label: "AltStore",
      color: "#0f7aff",
      template: "altstore://install?url={URL}",
      verified: true,
    },
    {
      id: "sidestore",
      label: "SideStore",
      color: "#32d74b",
      template: "sidestore://install?url={URL}",
      verified: true,
    },
    {
      id: "feather",
      label: "Feather",
      color: "#ff9f0a",
      template: "feather://install?url={URL}",
      verified: false,
    },
    {
      id: "scarlet",
      label: "Scarlet",
      color: "#ff375f",
      template: "scarlet://install?url={URL}",
      verified: false,
    },
    {
      id: "esign",
      label: "eSign",
      color: "#bf5af2",
      template: "esign://install?url={URL}",
      verified: false,
    },
    {
      id: "kravasigner",
      label: "KravaSigner",
      color: "#ffd60a",
      template: "kravasigner://addRepo={URL}",
      verified: true,
    },
  ];

  // ------------------------------------------------------------------
  // Curated data
  //
  // Repos: pulled from the community-maintained awesome-altstore list
  // (github.com/victordedomenico/awesome-altstore), trimmed to sources
  // that are official/open-source rather than tweaked-app aggregators.
  // Tools: well-known sideloading apps and signers. `lowConfidence: true`
  // means the link/scheme moves around more than most — verify before
  // trusting it with an Apple ID or certificate.
  // ------------------------------------------------------------------
  const RECOMMENDED_REPOS = [
    {
      name: "AltStore PAL Marketplace",
      url: "https://marketplace.altstore.io",
      desc: "Official AltStore PAL marketplace for discovering apps.",
    },
    {
      name: "SideStore Community Store",
      url: "https://community-apps.sidestore.io/sidecommunity.json",
      desc: "Official SideStore source — Delta, PPSSPP, Mini vMac, unc0ver and more.",
    },
    {
      name: "UTM",
      url: "https://alt.getutm.app",
      desc: "Full-featured virtual machine host for iOS.",
    },
    {
      name: "UTM (PAL)",
      url: "https://pal.getutm.app/config.json",
      desc: "UTM source compatible with AltStore PAL.",
    },
    {
      name: "DolphiniOS",
      url: "https://altstore.oatmealdome.me",
      desc: "Official GameCube/Wii emulator for iOS, no jailbreak required.",
    },
    {
      name: "PokeMMO",
      url: "https://pokemmo.com/altstore/",
      desc: "Official free-to-play Pokémon MMORPG for iOS.",
    },
    {
      name: "Provenance EMU",
      url: "https://provenance-emu.com/apps.json",
      desc: "Official multi-emulator front-end (Atari, NES, SNES, PS1 and more).",
    },
    {
      name: "Flycast",
      url: "https://flyinghead.github.io/flycast-builds/altstore.json",
      desc: "Sega Dreamcast / Naomi / Atomiswave emulator builds.",
    },
    {
      name: "iTorrent",
      url: "https://xitrix.github.io/iTorrent/AltStoreEU.json",
      desc: "Native, open-source BitTorrent client for iOS.",
    },
    {
      name: "NineAnimator",
      url: "https://altstore.9ani.app",
      desc: "Official nightly builds of the open-source anime app.",
    },
    {
      name: "Epic Games Store",
      url: "https://content-download-egs.distro.on.epicgames.com/iOS/altstore/source.json",
      desc: "Official Epic Games iOS source.",
    },
    {
      name: "iSH",
      url: "https://ish.app/altstore.json",
      desc: "Native Linux shell environment for iOS.",
    },
    {
      name: "Apollo",
      url: "https://raw.githubusercontent.com/Balackburn/Apollo/refs/heads/main/apps.json",
      desc: "Third-party Reddit client, kept alive after the official app's API changes.",
    },
    {
      name: "StikDebug",
      url: "https://stikdebug.xyz/apps.json",
      desc: "Network debugging / HTTP inspection tool for iOS.",
    },
  ];

  const TOOLS = {
    installers: [
      {
        name: "AltStore",
        url: "https://altstore.io",
        desc: "Resigns apps with your Apple ID via a desktop companion app, AltServer.",
      },
      {
        name: "SideStore",
        url: "https://sidestore.io",
        desc: "AltStore-based installer that works without a computer after initial setup.",
      },
      {
        name: "Feather",
        url: "https://github.com/khcrysalis/Feather",
        desc: "Open-source, on-device signer and app manager. Reads AltStore-format repos directly.",
      },
      {
        name: "TrollStore",
        url: "https://github.com/opa334/TrollStore",
        desc: "Certificate-free, non-expiring installs on supported iOS versions — check device/iOS compatibility first.",
      },
      {
        name: "Sideloadly",
        url: "https://sideloadly.io",
        desc: "Desktop tool (Windows/macOS) for signing and installing IPAs over USB.",
      },
      {
        name: "Scarlet",
        url: "https://github.com/ScarletApp/Install-Scarlet-iOS",
        desc: "Sideloader with built-in signing and repo support.",
        lowConfidence: true,
      },
    ],
    signers: [
      {
        name: "eSign",
        url: "https://github.com/iOS17/Esign",
        desc: "On-device IPA signer, mirrored by several community repos.",
        lowConfidence: true,
      },
      {
        name: "KravaSigner",
        url: "https://sign.kravasign.com",
        desc: "Web-based IPA signer used alongside Feather/eSign.",
        lowConfidence: true,
      },
    ],
  };

  const LS_KEYS = {
    repos: "ipagui.repos",
    proxy: "ipagui.corsProxy",
    customTargets: "ipagui.customInstallTargets",
  };

  // ------------------------------------------------------------------
  // State
  // ------------------------------------------------------------------
  const state = {
    repos: [], // { id, url, name, status: 'loading'|'ok'|'error'|'cors', error, rawApps, count }
    combinedApps: [],
    search: "",
    activeRepo: null, // repo id to filter by, or null = show all
    corsProxy: "",
    customTargets: [],
  };

  // ------------------------------------------------------------------
  // Elements
  // ------------------------------------------------------------------
  const el = {
    repobar: document.getElementById("repobar"),
    statusLine: document.getElementById("statusLine"),
    gridContainer: document.getElementById("gridContainer"),
    searchInput: document.getElementById("searchInput"),
    openRepoModalBtn: document.getElementById("openRepoModalBtn"),
    closeRepoModalBtn: document.getElementById("closeRepoModalBtn"),
    doneRepoModalBtn: document.getElementById("doneRepoModalBtn"),
    repoModalBackdrop: document.getElementById("repoModalBackdrop"),
    addRepoForm: document.getElementById("addRepoForm"),
    repoUrlInput: document.getElementById("repoUrlInput"),
    repolist: document.getElementById("repolist"),
    clearReposBtn: document.getElementById("clearReposBtn"),
    corsProxyInput: document.getElementById("corsProxyInput"),
    saveProxyBtn: document.getElementById("saveProxyBtn"),
    toast: document.getElementById("toast"),
    toastText: document.getElementById("toastText"),
    bulkRepoText: document.getElementById("bulkRepoText"),
    importRepoListBtn: document.getElementById("importRepoListBtn"),
    exportRepoListBtn: document.getElementById("exportRepoListBtn"),
    recommendedRepoList: document.getElementById("recommendedRepoList"),
    openToolsModalBtn: document.getElementById("openToolsModalBtn"),
    closeToolsModalBtn: document.getElementById("closeToolsModalBtn"),
    closeToolsModalBtn2: document.getElementById("closeToolsModalBtn2"),
    toolsModalBackdrop: document.getElementById("toolsModalBackdrop"),
    toolsInstallerList: document.getElementById("toolsInstallerList"),
    toolsSignerList: document.getElementById("toolsSignerList"),
  };

  // ------------------------------------------------------------------
  // Utilities
  // ------------------------------------------------------------------
  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function escapeHtml(str) {
    return String(str ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function hostOf(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  function formatBytes(bytes) {
    if (bytes === null || bytes === undefined || isNaN(bytes)) return "";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let n = Number(bytes);
    while (n >= 1024 && i < units.length - 1) {
      n /= 1024;
      i++;
    }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }

  function formatDate(d) {
    if (!d) return "";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function compareVersionsDesc(a, b) {
    const pa = String(a || "")
      .split(/[.\-]/)
      .map((x) => parseInt(x, 10));
    const pb = String(b || "")
      .split(/[.\-]/)
      .map((x) => parseInt(x, 10));
    const len = Math.max(pa.length, pb.length);
    for (let i = 0; i < len; i++) {
      const na = isNaN(pa[i]) ? 0 : pa[i];
      const nb = isNaN(pb[i]) ? 0 : pb[i];
      if (na !== nb) return nb - na;
    }
    return String(b || "").localeCompare(String(a || ""));
  }

  function toast(msg) {
    el.toastText.textContent = msg;
    el.toast.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.toast.classList.remove("is-visible"), 2200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch {
        return false;
      }
    }
  }

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------
  function loadPersisted() {
    try {
      const urls = JSON.parse(localStorage.getItem(LS_KEYS.repos) || "[]");
      state.repos = urls.map((url) => ({
        id: uid(),
        url,
        name: hostOf(url),
        status: "loading",
        error: "",
        rawApps: [],
        count: 0,
      }));
    } catch {
      state.repos = [];
    }
    state.corsProxy = localStorage.getItem(LS_KEYS.proxy) || "";
    el.corsProxyInput.value = state.corsProxy;
    try {
      state.customTargets = JSON.parse(
        localStorage.getItem(LS_KEYS.customTargets) || "[]",
      );
    } catch {
      state.customTargets = [];
    }
  }

  function persistRepos() {
    localStorage.setItem(
      LS_KEYS.repos,
      JSON.stringify(state.repos.map((r) => r.url)),
    );
  }

  function persistProxy() {
    localStorage.setItem(LS_KEYS.proxy, state.corsProxy);
  }

  function installTargets() {
    return [...DEFAULT_INSTALL_TARGETS, ...state.customTargets];
  }

  // ------------------------------------------------------------------
  // Repo fetching + normalizing
  // ------------------------------------------------------------------
  function extractRawApps(json) {
    if (Array.isArray(json)) return json;
    if (Array.isArray(json.apps)) return json.apps;
    if (Array.isArray(json.sources)) {
      const out = [];
      json.sources.forEach((s) => {
        if (Array.isArray(s.apps)) out.push(...s.apps);
      });
      return out;
    }
    return [];
  }

  async function fetchRepo(repo) {
    repo.status = "loading";
    repo.error = "";
    renderRepobar();

    const fetchUrl = state.corsProxy
      ? state.corsProxy + encodeURIComponent(repo.url)
      : repo.url;

    try {
      const res = await fetch(fetchUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const rawApps = extractRawApps(json);
      repo.rawApps = rawApps;
      repo.count = rawApps.length;
      repo.name = json.name || hostOf(repo.url);
      repo.status = "ok";
    } catch (err) {
      repo.rawApps = [];
      repo.count = 0;
      if (err instanceof TypeError) {
        // TypeError from fetch() means either CORS-blocked or the host is
        // completely unreachable. We can narrow it down: if a CORS proxy is
        // NOT in use, the browser never reveals which one it is — but CORS is
        // by far the most common reason a valid-looking URL fails here.
        // If a proxy IS in use and it still throws TypeError, the host is
        // genuinely unreachable.
        if (state.corsProxy) {
          repo.status = "error";
          repo.error = "Unreachable even through the CORS proxy";
        } else {
          repo.status = "cors";
          repo.error =
            "CORS blocked — the repo server doesn't allow browser fetches. Try adding a CORS proxy in the Repos panel.";
        }
      } else {
        repo.status = "error";
        repo.error = err.message || "Failed to load";
      }
    }
    renderRepobar();
    rebuildCombinedApps();
    renderAll();
  }

  function loadAllRepos() {
    state.repos.forEach((r) => fetchRepo(r));
  }

  function normalizeVersion(v, parent) {
    return {
      version: v.version || parent.version || "unknown",
      date: v.date || parent.date || null,
      size: v.size ?? parent.size ?? null,
      minOSVersion: v.minOSVersion || parent.minOSVersion || "",
      downloadURL:
        v.downloadURL ||
        v.downloadUrl ||
        parent.downloadURL ||
        parent.downloadUrl,
      localizedDescription: v.localizedDescription || "",
    };
  }

  function rebuildCombinedApps() {
    const grouped = new Map();

    state.repos
      .filter((r) => r.status === "ok")
      .forEach((repo) => {
        repo.rawApps.forEach((raw) => {
          const bundleId =
            raw.bundleIdentifier || raw.bundleID || raw.bundleId || "";
          const key = (
            bundleId ||
            `${raw.name}-${raw.developerName || raw.developer || ""}`
          )
            .toLowerCase()
            .trim();
          if (!key) return;

          let versions = [];
          if (Array.isArray(raw.versions) && raw.versions.length) {
            versions = raw.versions.map((v) => normalizeVersion(v, raw));
          } else if (raw.downloadURL || raw.downloadUrl) {
            versions = [normalizeVersion(raw, raw)];
          }
          versions = versions.filter((v) => v.downloadURL);
          if (!versions.length) return;

          if (!grouped.has(key)) {
            grouped.set(key, {
              key,
              bundleIdentifier: bundleId,
              name: raw.name || "Unknown app",
              developerName: raw.developerName || raw.developer || "",
              subtitle: raw.subtitle || "",
              localizedDescription:
                raw.localizedDescription || raw.description || "",
              iconURL: raw.iconURL || raw.iconUrl || raw.icon || "",
              versions: [],
              repoNames: new Set(),
            });
          }
          const entry = grouped.get(key);
          entry.repoNames.add(repo.name);
          if (!entry.localizedDescription && raw.localizedDescription) {
            entry.localizedDescription = raw.localizedDescription;
          }
          if (!entry.iconURL && (raw.iconURL || raw.iconUrl)) {
            entry.iconURL = raw.iconURL || raw.iconUrl;
          }
          versions.forEach((v) => {
            const dup = entry.versions.some(
              (ev) =>
                ev.downloadURL === v.downloadURL && ev.version === v.version,
            );
            if (!dup) entry.versions.push(v);
          });
        });
      });

    grouped.forEach((entry) => {
      entry.versions.sort((a, b) => {
        if (a.date && b.date) return new Date(b.date) - new Date(a.date);
        return compareVersionsDesc(a.version, b.version);
      });
      entry.repoNames = Array.from(entry.repoNames);
    });

    state.combinedApps = Array.from(grouped.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  // ------------------------------------------------------------------
  // Rendering: repo bar
  // ------------------------------------------------------------------

  // Sort order: ok → error (unreachable) → cors → loading
  const REPO_STATUS_ORDER = { ok: 0, error: 1, cors: 2, loading: 3 };

  function sortedRepos() {
    return [...state.repos].sort(
      (a, b) =>
        (REPO_STATUS_ORDER[a.status] ?? 9) - (REPO_STATUS_ORDER[b.status] ?? 9),
    );
  }

  function renderRepobar() {
    if (!state.repos.length) {
      el.repobar.innerHTML = "";
      el.statusLine.textContent = "";
      renderRepoListInModal();
      return;
    }

    el.repobar.innerHTML = sortedRepos()
      .map((r) => {
        const isActive = state.activeRepo === r.id;
        const statusCls =
          r.status === "ok"
            ? "ok"
            : r.status === "cors"
              ? "cors"
              : r.status === "error"
                ? "error"
                : "loading";
        const count =
          r.status === "ok"
            ? `<span class="chip__count">${r.count}</span>`
            : "";
        const titleExtra = r.error ? ` — ${r.error}` : "";
        return `
          <button class="chip chip--${statusCls}${isActive ? " chip--active" : ""}"
                  data-repo-filter="${r.id}"
                  title="${escapeHtml(r.url)}${escapeHtml(titleExtra)}">
            <span class="chip__dot"></span>
            <span class="chip__label">${escapeHtml(r.name)}</span>
            ${count}
          </button>`;
      })
      .join("");

    // Bind click handlers for filter toggling
    el.repobar.querySelectorAll("[data-repo-filter]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.repoFilter;
        const repo = state.repos.find((r) => r.id === id);
        // Only allow filtering on repos that actually have apps
        if (!repo || repo.status !== "ok") return;
        state.activeRepo = state.activeRepo === id ? null : id;
        renderRepobar();
        renderGrid();
      });
    });

    const ok = state.repos.filter((r) => r.status === "ok").length;
    const errored = state.repos.filter((r) => r.status === "error").length;
    const cors = state.repos.filter((r) => r.status === "cors").length;
    const loading = state.repos.filter((r) => r.status === "loading").length;
    const parts = [];
    if (ok)
      parts.push(`<strong>${ok}</strong> repo${ok === 1 ? "" : "s"} loaded`);
    if (loading) parts.push(`${loading} loading…`);
    if (errored) parts.push(`${errored} unreachable`);
    if (cors) parts.push(`${cors} CORS blocked`);
    if (state.activeRepo) {
      const active = state.repos.find((r) => r.id === state.activeRepo);
      if (active)
        parts.push(
          `<strong>filtering: ${escapeHtml(active.name)}</strong> <button class="status-line__clear" id="clearRepoFilter">show all</button>`,
        );
    }
    el.statusLine.innerHTML = parts.join(" · ");

    // Bind the "show all" inline button if present
    const clearBtn = document.getElementById("clearRepoFilter");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        state.activeRepo = null;
        renderRepobar();
        renderGrid();
      });
    }

    renderRepoListInModal();
  }

  function renderRepoListInModal() {
    renderRecommendedRepos();
    if (!state.repos.length) {
      el.repolist.innerHTML = `<div class="modal__sub" style="margin:0;">No repos added yet.</div>`;
      return;
    }
    el.repolist.innerHTML = sortedRepos()
      .map((r) => {
        const cls =
          r.status === "ok"
            ? "ok"
            : r.status === "cors"
              ? "cors"
              : r.status === "error"
                ? "error"
                : "loading";
        const sub =
          r.status === "ok"
            ? `${r.count} listing${r.count === 1 ? "" : "s"}`
            : r.status === "cors"
              ? r.error
              : r.status === "error"
                ? r.error
                : "loading…";
        return `
          <div class="repolist__row">
            <span class="chip__dot chip--${cls} chip__dot"></span>
            <div style="min-width:0; flex:1;">
              <div class="repolist__url">${escapeHtml(r.url)}</div>
              <div style="color:var(--text-tertiary); font-size:11.5px;">${escapeHtml(sub)}</div>
            </div>
            <button class="btn btn--sm btn--ghost" data-retry="${r.id}" title="Retry">↻</button>
            <button class="btn btn--sm btn--ghost btn--danger" data-remove="${r.id}" title="Remove">✕</button>
          </div>`;
      })
      .join("");

    el.repolist.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => removeRepo(btn.dataset.remove));
    });
    el.repolist.querySelectorAll("[data-retry]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const repo = state.repos.find((r) => r.id === btn.dataset.retry);
        if (repo) fetchRepo(repo);
      });
    });
  }

  // ------------------------------------------------------------------
  // Rendering: grid
  // ------------------------------------------------------------------
  function filteredApps() {
    let apps = state.combinedApps;

    // Repo filter — only show apps that come from the selected repo
    if (state.activeRepo) {
      const repo = state.repos.find((r) => r.id === state.activeRepo);
      if (repo) {
        apps = apps.filter((a) => a.repoNames.includes(repo.name));
      }
    }

    // Search filter
    const q = state.search.trim().toLowerCase();
    if (!q) return apps;
    return apps.filter((a) => {
      return (
        a.name.toLowerCase().includes(q) ||
        (a.developerName || "").toLowerCase().includes(q) ||
        (a.bundleIdentifier || "").toLowerCase().includes(q) ||
        (a.subtitle || "").toLowerCase().includes(q)
      );
    });
  }

  function initials(name) {
    return (name || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  function suggestFilename(app, version) {
    try {
      const u = new URL(version.downloadURL);
      const last = u.pathname.split("/").pop();
      if (last && last.toLowerCase().endsWith(".ipa")) return last;
    } catch {
      /* ignore */
    }
    const safe = (app.name || "app").replace(/[^a-z0-9\-_. ]/gi, "").trim();
    return `${safe || "app"}-${version.version || "latest"}.ipa`;
  }

  function cardTemplate(app) {
    const activeVersion = app.versions[0];
    const iconHtml = app.iconURL
      ? `<img class="card__icon" src="${escapeHtml(app.iconURL)}" alt="" loading="lazy" onerror="this.outerHTML=window.__ipaguiFallbackIcon('${escapeHtml(app.name).replace(/'/g, "\\'")}')" />`
      : window.__ipaguiFallbackIcon(app.name);

    const versionOptions = app.versions
      .map(
        (v, i) =>
          `<option value="${i}">${escapeHtml(v.version)}${v.size ? " · " + formatBytes(v.size) : ""}</option>`,
      )
      .join("");

    const targets = installTargets();
    const installBtns = targets
      .map(
        (t) => `
        <button class="installbtn" data-install="${t.id}" data-key="${app.key}" title="${t.verified === false ? "Scheme not fully verified — edit in app.js / Repos panel if it doesn't work" : "Open in " + escapeHtml(t.label)}">
          <span class="installbtn__dot" style="background:${t.color}"></span>
          ${escapeHtml(t.label)}
        </button>`,
      )
      .join("");

    const desc = app.localizedDescription || app.subtitle || "";
    const meta = [];
    if (activeVersion.minOSVersion)
      meta.push(`iOS ${escapeHtml(activeVersion.minOSVersion)}+`);
    if (activeVersion.date)
      meta.push(escapeHtml(formatDate(activeVersion.date)));

    return `
      <article class="card" data-key="${app.key}">
        <div class="card__top">
          ${iconHtml}
          <div class="card__title-block">
            <h3 class="card__name">${escapeHtml(app.name)}</h3>
            <div class="card__dev">${escapeHtml(app.developerName || "Unknown developer")}</div>
          </div>
        </div>

        ${desc ? `<p class="card__desc">${escapeHtml(desc)}</p>` : ""}

        <div class="card__meta">
          ${
            app.versions.length > 1
              ? `<select class="select" data-version-select="${app.key}">${versionOptions}</select>`
              : `<span class="tag">v${escapeHtml(activeVersion.version)}</span>`
          }
          ${activeVersion.size ? `<span class="tag" data-size="${app.key}">${formatBytes(activeVersion.size)}</span>` : ""}
          ${meta.length ? `<span class="tag" data-meta="${app.key}">${meta.join(" · ")}</span>` : ""}
        </div>

        <div class="card__actions">
          <button class="btn btn--primary" data-download="${app.key}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>
            Download
          </button>
          <button class="btn" data-copy="${app.key}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy link
          </button>
        </div>

        <div class="card__install">
          ${installBtns}
        </div>

        <div class="card__footer">
          <span class="truncate" title="${escapeHtml(app.bundleIdentifier)}">${escapeHtml(app.bundleIdentifier || "")}</span>
          <span class="truncate">${escapeHtml(app.repoNames.join(", "))}</span>
        </div>
      </article>`;
  }

  window.__ipaguiFallbackIcon = function (name) {
    return `<div class="card__icon card__icon--fallback">${escapeHtml(initials(name))}</div>`;
  };

  function renderGrid() {
    const apps = filteredApps();

    if (!state.repos.length) {
      el.gridContainer.innerHTML = `
        <div class="empty-state">
          <h2>No repos loaded yet</h2>
          <p>Add an AltStore-format source URL — the same kind of link you'd paste into AltStore, SideStore, Feather, or eSign — and its apps will show up here.</p>
          <button class="btn btn--primary" id="emptyStateAddBtn">Add your first repo</button>
        </div>`;
      const b = document.getElementById("emptyStateAddBtn");
      if (b) b.addEventListener("click", openRepoModal);
      return;
    }

    if (!apps.length) {
      el.gridContainer.innerHTML = `
        <div class="empty-state">
          <h2>${state.combinedApps.length ? "No matches" : "No apps found yet"}</h2>
          <p>${
            state.combinedApps.length
              ? "Nothing matches your search across the loaded repos."
              : "Repos are still loading, or none of them returned any app listings."
          }</p>
        </div>`;
      return;
    }

    el.gridContainer.innerHTML = `<div class="grid">${apps.map(cardTemplate).join("")}</div>`;
    bindCardEvents();
  }

  function bindCardEvents() {
    el.gridContainer
      .querySelectorAll("[data-version-select]")
      .forEach((sel) => {
        sel.addEventListener("change", () => {
          const key = sel.dataset.versionSelect;
          const app = state.combinedApps.find((a) => a.key === key);
          if (!app) return;
          const v = app.versions[Number(sel.value)];
          const card = sel.closest(".card");
          const sizeTag = card.querySelector(
            `[data-size="${CSS.escape(key)}"]`,
          );
          if (sizeTag) sizeTag.textContent = formatBytes(v.size);
          card.dataset.activeVersion = sel.value;
        });
      });

    el.gridContainer.querySelectorAll("[data-download]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { app, version } = resolveActive(btn.dataset.download);
        if (!version) return;
        const a = document.createElement("a");
        a.href = version.downloadURL;
        a.download = suggestFilename(app, version);
        a.rel = "noopener";
        a.target = "_blank";
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast(`Downloading ${app.name} ${version.version}`);
      });
    });

    el.gridContainer.querySelectorAll("[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const { version } = resolveActive(btn.dataset.copy);
        if (!version) return;
        const ok = await copyText(version.downloadURL);
        toast(
          ok ? "Link copied" : "Couldn't copy — copy manually from the address",
        );
      });
    });

    el.gridContainer.querySelectorAll("[data-install]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const { app, version } = resolveActive(btn.dataset.key);
        if (!version) return;
        const target = installTargets().find(
          (t) => t.id === btn.dataset.install,
        );
        if (!target) return;
        const schemeUrl = target.template.replace(
          "{URL}",
          encodeURIComponent(version.downloadURL),
        );
        window.location.href = schemeUrl;
        toast(`Opening ${target.label}…`);
      });
    });
  }

  function resolveActive(key) {
    const app = state.combinedApps.find((a) => a.key === key);
    if (!app) return {};
    const card = el.gridContainer.querySelector(
      `.card[data-key="${CSS.escape(key)}"]`,
    );
    const idx =
      card && card.dataset.activeVersion
        ? Number(card.dataset.activeVersion)
        : 0;
    return { app, version: app.versions[idx] || app.versions[0] };
  }

  function renderAll() {
    renderGrid();
  }

  // ------------------------------------------------------------------
  // Recommended repos + tools panels (static content, rendered once)
  // ------------------------------------------------------------------
  function renderRecommendedRepos() {
    el.recommendedRepoList.innerHTML = RECOMMENDED_REPOS.map((r) => {
      const already = state.repos.some((repo) => repo.url === r.url);
      return `
        <div class="repolist__row">
          <div style="min-width:0; flex:1;">
            <div style="color:var(--text-primary); font-weight:500; font-size:13px;">${escapeHtml(r.name)}</div>
            <div style="color:var(--text-tertiary); font-size:11.5px; margin-top:2px;">${escapeHtml(r.desc)}</div>
          </div>
          <button class="btn btn--sm ${already ? "" : "btn--primary"}" data-add-recommended="${escapeHtml(r.url)}" ${already ? "disabled" : ""}>
            ${already ? "Added" : "Add"}
          </button>
        </div>`;
    }).join("");

    el.recommendedRepoList
      .querySelectorAll("[data-add-recommended]")
      .forEach((btn) => {
        btn.addEventListener("click", () => {
          addRepo(btn.dataset.addRecommended);
          renderRecommendedRepos();
        });
      });
  }

  function toolRow(tool) {
    return `
      <div class="repolist__row">
        <div style="min-width:0; flex:1;">
          <div style="color:var(--text-primary); font-weight:500; font-size:13px; display:flex; align-items:center; gap:6px;">
            ${escapeHtml(tool.name)}
            ${tool.lowConfidence ? '<span class="tag" style="font-size:10px;">verify before use</span>' : ""}
          </div>
          <div style="color:var(--text-tertiary); font-size:11.5px; margin-top:2px;">${escapeHtml(tool.desc)}</div>
        </div>
        <a class="btn btn--sm" href="${escapeHtml(tool.url)}" target="_blank" rel="noopener">Open</a>
      </div>`;
  }

  function renderTools() {
    el.toolsInstallerList.innerHTML = TOOLS.installers.map(toolRow).join("");
    el.toolsSignerList.innerHTML = TOOLS.signers.map(toolRow).join("");
  }

  function openToolsModal() {
    el.toolsModalBackdrop.hidden = false;
  }
  function closeToolsModal() {
    el.toolsModalBackdrop.hidden = true;
  }

  // ------------------------------------------------------------------
  // Bulk import / export
  // ------------------------------------------------------------------
  function importBulkRepos(text) {
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    let added = 0;
    let skipped = 0;
    lines.forEach((url) => {
      if (!/^https?:\/\//i.test(url)) {
        skipped++;
        return;
      }
      if (state.repos.some((r) => r.url === url)) {
        skipped++;
        return;
      }
      addRepo(url);
      added++;
    });
    toast(
      added
        ? `Imported ${added} repo${added === 1 ? "" : "s"}${skipped ? ` · skipped ${skipped}` : ""}`
        : "Nothing new to import",
    );
  }

  async function exportRepoList() {
    if (!state.repos.length) {
      toast("No repos to export yet");
      return;
    }
    const text = state.repos.map((r) => r.url).join("\n");
    const ok = await copyText(text);
    toast(ok ? "Repo list copied" : "Couldn't copy — select the text manually");
  }

  // ------------------------------------------------------------------
  // Repo modal
  // ------------------------------------------------------------------
  function openRepoModal() {
    el.repoModalBackdrop.hidden = false;
    el.repoUrlInput.focus();
  }
  function closeRepoModal() {
    el.repoModalBackdrop.hidden = true;
  }

  function addRepo(url) {
    url = url.trim();
    if (!url) return;
    if (state.repos.some((r) => r.url === url)) {
      toast("That repo is already added");
      return;
    }
    const repo = {
      id: uid(),
      url,
      name: hostOf(url),
      status: "loading",
      error: "",
      rawApps: [],
      count: 0,
    };
    state.repos.push(repo);
    persistRepos();
    renderRepobar();
    fetchRepo(repo);
  }

  function removeRepo(id) {
    if (state.activeRepo === id) state.activeRepo = null;
    state.repos = state.repos.filter((r) => r.id !== id);
    persistRepos();
    rebuildCombinedApps();
    renderRepobar();
    renderAll();
  }

  function clearRepos() {
    if (!state.repos.length) return;
    if (!confirm("Remove all repos?")) return;
    state.repos = [];
    state.activeRepo = null;
    persistRepos();
    rebuildCombinedApps();
    renderRepobar();
    renderAll();
  }

  // ------------------------------------------------------------------
  // Wiring
  // ------------------------------------------------------------------
  function bindGlobalEvents() {
    el.openRepoModalBtn.addEventListener("click", openRepoModal);
    el.closeRepoModalBtn.addEventListener("click", closeRepoModal);
    el.doneRepoModalBtn.addEventListener("click", closeRepoModal);
    el.repoModalBackdrop.addEventListener("click", (e) => {
      if (e.target === el.repoModalBackdrop) closeRepoModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (!el.repoModalBackdrop.hidden) closeRepoModal();
      if (!el.toolsModalBackdrop.hidden) closeToolsModal();
    });

    el.addRepoForm.addEventListener("submit", (e) => {
      e.preventDefault();
      addRepo(el.repoUrlInput.value);
      el.repoUrlInput.value = "";
    });

    el.clearReposBtn.addEventListener("click", clearRepos);

    el.importRepoListBtn.addEventListener("click", () => {
      importBulkRepos(el.bulkRepoText.value);
      el.bulkRepoText.value = "";
    });
    el.exportRepoListBtn.addEventListener("click", exportRepoList);

    el.openToolsModalBtn.addEventListener("click", openToolsModal);
    el.closeToolsModalBtn.addEventListener("click", closeToolsModal);
    el.closeToolsModalBtn2.addEventListener("click", closeToolsModal);
    el.toolsModalBackdrop.addEventListener("click", (e) => {
      if (e.target === el.toolsModalBackdrop) closeToolsModal();
    });

    el.saveProxyBtn.addEventListener("click", () => {
      state.corsProxy = el.corsProxyInput.value.trim();
      persistProxy();
      toast("Proxy saved — reload repos to apply");
    });

    el.searchInput.addEventListener(
      "input",
      debounce(() => {
        state.search = el.searchInput.value;
        renderGrid();
      }, 120),
    );
  }

  // ------------------------------------------------------------------
  // PWA install prompt
  // ------------------------------------------------------------------

  // Key used to remember that the user dismissed the banner so we don't
  // keep nagging them on every visit.
  const PWA_DISMISSED_KEY = "pwa-install-dismissed";

  // Holds the deferred BeforeInstallPromptEvent (Chrome / Android).
  let deferredInstallPrompt = null;

  function isRunningAsPwa() {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  function isSafariBrowser() {
    // Safari on iOS — not Chrome or Firefox on iOS (which can't install PWAs)
    return (
      /safari/i.test(navigator.userAgent) &&
      !/crios|fxios/i.test(navigator.userAgent)
    );
  }

  function showInstallBanner() {
    const banner = document.getElementById("installBanner");
    if (!banner) return;
    banner.hidden = false;
    banner.classList.add("install-banner--visible");
  }

  function hideInstallBanner() {
    const banner = document.getElementById("installBanner");
    if (!banner) return;
    banner.classList.remove("install-banner--visible");
    // Wait for the slide-out transition before hiding from DOM flow
    banner.addEventListener(
      "transitionend",
      () => {
        banner.hidden = true;
      },
      { once: true },
    );
  }

  function showIosTip() {
    const tip = document.getElementById("iosInstallTip");
    if (!tip) return;
    tip.hidden = false;
    // Slight delay so the display:block kicks in before the opacity transition
    requestAnimationFrame(() => tip.classList.add("ios-install-tip--visible"));
  }

  function hideIosTip() {
    const tip = document.getElementById("iosInstallTip");
    if (!tip) return;
    tip.classList.remove("ios-install-tip--visible");
    tip.addEventListener(
      "transitionend",
      () => {
        tip.hidden = true;
      },
      { once: true },
    );
  }

  function initPwaInstall() {
    // Don't show anything if already running as a PWA
    if (isRunningAsPwa()) return;

    // Don't show if the user has already dismissed
    if (localStorage.getItem(PWA_DISMISSED_KEY)) return;

    const installBtn = document.getElementById("installBannerBtn");
    const dismissBtn = document.getElementById("installBannerDismiss");
    const iosTipClose = document.getElementById("iosInstallTipClose");
    const bannerSub = document.getElementById("installBannerSub");

    // --- Android / Chrome: native prompt ---
    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      if (bannerSub)
        bannerSub.textContent =
          "Install this app for quick access from your home screen.";
      showInstallBanner();
    });

    if (installBtn) {
      installBtn.addEventListener("click", async () => {
        if (deferredInstallPrompt) {
          // Native Android/Chrome install
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          deferredInstallPrompt = null;
          hideInstallBanner();
          if (outcome === "accepted")
            localStorage.setItem(PWA_DISMISSED_KEY, "1");
        } else if (isIos()) {
          // iOS: can't trigger natively — show the manual instructions tooltip
          hideInstallBanner();
          showIosTip();
        }
      });
    }

    if (dismissBtn) {
      dismissBtn.addEventListener("click", () => {
        localStorage.setItem(PWA_DISMISSED_KEY, "1");
        hideInstallBanner();
      });
    }

    if (iosTipClose) {
      iosTipClose.addEventListener("click", () => {
        localStorage.setItem(PWA_DISMISSED_KEY, "1");
        hideIosTip();
      });
    }

    // --- iOS Safari: show banner manually (no beforeinstallprompt support) ---
    if (isIos() && isSafariBrowser()) {
      if (bannerSub)
        bannerSub.textContent =
          "Add this app to your Home Screen for quick access.";
      // Short delay so the page has painted before we slide the banner in
      setTimeout(showInstallBanner, 1200);
    }

    // Hide the banner once the app is actually installed
    window.addEventListener("appinstalled", () => {
      localStorage.setItem(PWA_DISMISSED_KEY, "1");
      hideInstallBanner();
    });
  }

  // ------------------------------------------------------------------
  // Init
  // ------------------------------------------------------------------
  function init() {
    loadPersisted();
    bindGlobalEvents();
    renderTools();
    renderRepobar();
    renderAll();
    if (state.repos.length) loadAllRepos();
    initPwaInstall();
  }

  document.addEventListener("DOMContentLoaded", init);
})();

(() => {
  'use strict';

  // Build marker (for cache-busting verification)
  const WHEATCAMPAIGN_BUILD = "2026-01-07.2";
  console.info("[WheatCampaign] dashboard.js loaded", WHEATCAMPAIGN_BUILD);

  const REDUCE_MOTION = !!window.__REDUCE_MOTION__;
  function chartAnimation(){
    return REDUCE_MOTION ? false : { duration: 1500, easing: "easeOutBounce" };
  }


  // ---------------------------------------------------------------------------
  // Minimal Chart.js fallback
  // Many static deployments fail to load CDN dependencies. The dashboard mainly
  // needs doughnut/pie charts; this lightweight renderer keeps those sections
  // functional without external scripts.
  (function ensureMiniChart(){
    if (typeof window.Chart !== 'undefined') return;

    function parseCutout(v) {
      if (v == null) return 0.0;
      if (typeof v === 'string' && v.trim().endsWith('%')) {
        const n = parseFloat(v);
        return Number.isFinite(n) ? Math.max(0, Math.min(0.95, n / 100)) : 0.0;
      }
      const n = Number(v);
      if (!Number.isFinite(n)) return 0.0;
      // Chart.js treats numeric as pixels; we interpret as ratio when 0..1
      if (n > 0 && n < 1) return Math.max(0, Math.min(0.95, n));
      return 0.0;
    }


    function mutedColor(fallback = '#9aa4b2') {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue('--muted2');
        const s = (v || '').trim();
        return s || fallback;
      } catch (_e) {
        return fallback;
      }
    }

    function getCanvasAndCtx(target) {
      if (!target) return { canvas: null, ctx: null };
      if (target.getContext) {
        const ctx = target.getContext('2d');
        return { canvas: target, ctx };
      }
      if (target.canvas && target.clearRect) {
        return { canvas: target.canvas, ctx: target };
      }
      return { canvas: null, ctx: null };
    }

    class MiniChart {
      constructor(target, config) {
        const { canvas, ctx } = getCanvasAndCtx(target);
        this.canvas = canvas;
        this.ctx = ctx;
        this.config = config || {};
        this._ro = null;
        this._render();
        const responsive = this.config?.options?.responsive;
        if (responsive !== false && this.canvas) this._bindResize();
      }

      _bindResize() {
        try {
          const parent = this.canvas.parentElement;
          if (!parent || typeof ResizeObserver === 'undefined') return;
          this._ro = new ResizeObserver(() => this._render());
          this._ro.observe(parent);
        } catch (_e) {}
      }

      _size() {
        const c = this.canvas;
        const ctx = this.ctx;
        if (!c || !ctx) return null;
        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const w = Math.max(1, c.clientWidth || c.width || 300);
        const h = Math.max(1, c.clientHeight || c.height || 150);
        if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
          c.width = Math.round(w * dpr);
          c.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { w, h };
      }

      _clear(w, h) {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, w, h);
      }

      _render() {
        const { canvas, ctx } = this;
        if (!canvas || !ctx) return;
        const size = this._size();
        if (!size) return;
        const { w, h } = size;
        this._clear(w, h);

        const type = String(this.config?.type || '').toLowerCase();
        const data = this.config?.data || {};
        const ds0 = (data.datasets && data.datasets[0]) ? data.datasets[0] : {};
        const values = (ds0.data || []).map(v => Number(v) || 0);
        const colors = Array.isArray(ds0.backgroundColor) ? ds0.backgroundColor : [];

        if (type === 'doughnut' || type === 'pie') {
          const total = values.reduce((a,b) => a + (Number(b) || 0), 0);
          if (!total) {
            ctx.font = '13px system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif';
            ctx.fillStyle = mutedColor();
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('No data', w / 2, h / 2);
            return;
          }

          const cx = w / 2;
          const cy = h / 2;
          const r = Math.min(w, h) * 0.42;
          const cut = type === 'doughnut' ? parseCutout(this.config?.options?.cutout) : 0;
          const rInner = r * cut;

          let start = -Math.PI / 2;
          for (let i = 0; i < values.length; i++) {
            const v = values[i];
            const ang = (v / total) * Math.PI * 2;
            if (!ang) continue;
            const end = start + ang;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, r, start, end);
            ctx.closePath();
            ctx.fillStyle = colors[i] || `hsl(${(i * 360) / Math.max(1, values.length)} 70% 55%)`;
            ctx.fill();
            start = end;
          }

          if (rInner > 0) {
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(cx, cy, rInner, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalCompositeOperation = 'source-over';
          }

          return;
        }

        // Unsupported chart type: show a small message so sections aren't blank
        ctx.font = '13px system-ui, -apple-system, Segoe UI, Roboto, Inter, sans-serif';
        ctx.fillStyle = mutedColor();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Chart', w / 2, h / 2);
      }

      update() { this._render(); }

      destroy() {
        try { this._ro?.disconnect(); } catch (_e) {}
        this._ro = null;
        if (this.canvas && this.ctx) {
          const w = this.canvas.clientWidth || this.canvas.width;
          const h = this.canvas.clientHeight || this.canvas.height;
          try { this._clear(w, h); } catch (_e) {}
        }
      }
    }

    window.Chart = MiniChart;
  })();
// Surface runtime errors in the UI (helps diagnose GitHub Pages issues)
  window.addEventListener("error", (e) => {
    try {
      const box = document.getElementById("statusBox");
      if (box) box.textContent = `Runtime error: ${e.message || e.error || "Unknown error"}`;
    } catch (_) {}
  });

  window.addEventListener("unhandledrejection", (e) => {
    try {
      const box = document.getElementById("statusBox");
      const reason = (e && e.reason) ? (e.reason.message || String(e.reason)) : "Unknown rejection";
      if (box) box.textContent = `Promise rejection: ${reason}`;
    } catch (_) {}
  });

  // Helper to fetch JSON files with retry and timeout support.
  // This version improves resilience to network issues by retrying failed requests
  // a limited number of times and aborting long-running requests. If all attempts
  // fail, it will call setStatus() with an error message and rethrow the error.

  // ---------- DOM helpers ----------
  const $$ = (sel, root = document) => root.querySelector(sel);
  const $$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => {
    const d = document.createElement('div');
    d.textContent = String(s ?? '');
    return d.innerHTML;
  };


  // Normalize place names for consistent display (capitalization + common typos)
  const prettyPlaceName = (v) => {
    const raw = String(v ?? '').trim();
    if (!raw) return '';
    let s = raw.replace(/\s+/g, ' ');

    const map = {
      'karor lal esan': 'Karor Lal Esan',
      'bassti maachi buchi wala': 'Basti Maachi Buchi Wala',
      'daud khail kacha': 'Daud Khail Kacha',
      'toba take singh': 'Toba Tek Singh',
    };

    const low = s.toLowerCase();
    if (map[low]) s = map[low];

    // Token-level corrections
    s = s.replace(/\bbassti\b/ig, "Basti").replace(/\bkhai[lL]\b/ig, "Khail");

    // Smart title-case: preserve ALL-CAPS and tokens with digits (e.g., 262-GB)
    s = s
      .split(' ')
      .map((w) => {
        if (!w) return w;
        if (/[0-9]/.test(w)) return w.toUpperCase();
        if (w === w.toUpperCase() && /[A-Z]/.test(w)) return w;
        return w.length === 1 ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');

    return s;
  };

  // ---------- URL helpers ----------
  const BASE = new URL('.', window.location.href);
  const url = (p) => new URL(p, BASE).toString();

  function qs() {
    return new URLSearchParams(window.location.search);
  }

  function activeTabFromHash() {
    const h = (window.location.hash || '#summary').replace('#', '').trim();
    if (!h) return 'summary';
    // Support deep-links like #session-<id>
    if (h.startsWith('session-')) return 'sessions';
    if (['summary','media','map','sessions','feedback','reports'].includes(h)) return h; // Added reports
    return 'summary';
  }

  
  // ---------- Theme helpers ----------
  function getTheme() {
    return (document.documentElement.getAttribute('data-theme') || 'dark').trim();
  }
  function cssVar(name, fallback = '') {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name);
      const s = (v || '').trim();
      return s || fallback;
    } catch (_e) {
      return fallback;
    }
  }
  function tooltipBgForTheme(t) {
    return (t === 'light') ? 'rgba(255,255,255,0.96)' : 'rgba(12,18,35,0.92)';
  }
  function registerChart(chart) {
    try {
      if (!chart) return chart;
      if (!state._charts) state._charts = new Set();
      state._charts.add(chart);
    } catch (_e) { /* ignore */ }
    return chart;
  }

  function unregisterChart(chart) {
    try {
      if (state._charts && chart) state._charts.delete(chart);
    } catch (_e) { /* ignore */ }
  }

  function applyChartTheme(chart) {
    try {
      if (!chart) return;

      const t = getTheme();
      const text = cssVar('--text', '#f0f4ff');
      const stroke = cssVar('--stroke', 'rgba(255,255,255,.12)');
      const chartBorder = cssVar('--chartBorder', 'rgba(255,255,255,.10)');

      // Chart.js: chart.options exists. MiniChart fallback also has options.
      if (chart.options) {
        chart.options.color = text;

        chart.options.plugins = chart.options.plugins || {};

        // Tooltip
        chart.options.plugins.tooltip = chart.options.plugins.tooltip || {};
        Object.assign(chart.options.plugins.tooltip, {
          backgroundColor: tooltipBgForTheme(t),
          titleColor: text,
          bodyColor: text,
          borderColor: stroke,
          borderWidth: 1
        });

        // Legend
        chart.options.plugins.legend = chart.options.plugins.legend || {};
        chart.options.plugins.legend.labels = chart.options.plugins.legend.labels || {};
        chart.options.plugins.legend.labels.color = text;

        // Title (if used)
        if (chart.options.plugins.title) {
          chart.options.plugins.title.color = text;
        }
      }

      // Dataset borders (doughnut/pie readability on both themes)
      if (chart.data && Array.isArray(chart.data.datasets)) {
        chart.data.datasets.forEach((ds) => {
          if (ds && typeof ds === 'object') {
            // Only apply if border props exist or if the dataset is a doughnut-like chart.
            if (ds.borderWidth == null) ds.borderWidth = 1;
            if (ds.borderColor == null) ds.borderColor = chartBorder;
          }
        });
      }

      // MiniChart fallback supports update(); Chart.js supports update('none')
      if (typeof chart.update === 'function') {
        try { chart.update('none'); } catch (_e) { chart.update(); }
      }
    } catch (_e) { /* ignore */ }
  }

  function applyAllChartThemes() {
    try {
      if (state._charts && typeof state._charts.forEach === 'function') {
        state._charts.forEach(applyChartTheme);
      }
      // Backward compatibility in case a chart wasn't registered.
      applyAllChartThemes();
    } catch (_e) { /* ignore */ }
  }
// ---------- Data / state ----------
  const state = {
    campaigns: [],
    campaignId: null,
    campaign: null,

    sessions: [],
    sessionsById: new Map(),
    sheetsIndex: null,

    filteredSessions: [],
    dateMin: null,
    dateMax: null,
    dateFrom: null,
    dateTo: null,

    map: null,
    markerLayer: null,
    baseLayer: null,
    markersBySessionId: new Map(),
    // Filters for host (farmer) name and city
    nameFilter: '',
    cityFilter: '',

    // Region filter (REG). This corresponds to the RGN codes (e.g. SKR, RYK)
    // derived from the Initial sheet mapping of territories/districts to regions.
    regionFilter: '',

    // Additional filters for district and score range. These are optional
    // inputs that refine the sessions list based on geography or
    // performance. When null/empty they do not constrain results.
    districtFilter: '',
    scoreMin: null,
    scoreMax: null,

    // Media tab controls
    mediaType: 'all',
    mediaSearch: '',
    mediaSort: 'newest',
    mediaLimit: 24,
    _mediaBound: false,
  };

  // ---------- Parsing / formatting ----------
  function parseDateSafe(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = String(v).trim();
    // Prefer YYYY-MM-DD
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // Fallback Date.parse
    const t = Date.parse(s);
    if (Number.isFinite(t)) return new Date(t);
    return null;
  }

  function formatDateInput(d) {
    const dt = parseDateSafe(d);
    if (!dt || Number.isNaN(dt.getTime())) return '';
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const dd = String(dt.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function fmtInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toLocaleString();
  }

  function fmt1(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '—';
    return x.toFixed(1);
  }

  function num(v) {
    return (typeof v === 'number' && Number.isFinite(v)) ? v : NaN;
  }

  // ---------- Media path resolution ----------
  const existsCache = new Map(); // url -> boolean

  function normalizeMediaPath(p) {
    const raw = String(p ?? '').trim();
    if (!raw) return '';
    if (/^(https?:|data:|blob:)/i.test(raw)) return raw;

    let x = raw.replace(/^\.?\//, '').replace(/^\//, '');

    // Already rooted correctly
    if (x.startsWith('assets/')) return x;

    // Common patterns from sessions.json
    if (x.startsWith('gallery/')) return 'assets/' + x;

    // Common filename
    if (!x.includes('/')) return 'assets/gallery/' + x;

    // Default: relative as-is
    return x;
  }

  function candidatePaths(p) {
    const norm = normalizeMediaPath(p);
    if (!norm || /^(https?:|data:|blob:)/i.test(norm)) return norm ? [norm] : [];

    const base = norm.replace(/\.(jpeg|jpg|png|webp|mp4|webm)$/i, '');
    const ext = (norm.split('.').pop() || '').toLowerCase();

    // Only try the most likely variants to reduce 404 noise:
    // 1) original
    // 2) gallery root fallback
    // 3) common "a" suffix variants (e.g., 17a, 17_a, 17-a)
    const cands = [norm];

    const file = norm.split('/').pop();
    if (file && !/assets\/gallery\//i.test(norm)) {
      cands.push('assets/gallery/' + file);
    }

    if (ext) {
      cands.push(base + '.jpg');
      cands.push(base + '.jpeg');
      cands.push(base + '.mp4');
      if (file.endsWith('a')) {
        cands.push('assets/gallery/' + file.replace(/a$/, ''));
        cands.push('assets/gallery/' + file.replace(/a$/, '_a'));
        cands.push('assets/gallery/' + file.replace(/a$/, '-a'));
      }
    }

    return [...new Set(cands)];
  }

  async function mediaExists(p) {
    if (existsCache.has(p)) return existsCache.get(p);
    try {
      const res = await fetch(p, { method: 'HEAD', cache: 'no-cache' });
      const ok = res.ok && res.status === 200;
      existsCache.set(p, ok);
      return ok;
    } catch (_e) {
      existsCache.set(p, false);
      return false;
    }
  }

  async function resolveMediaPath(p) {
    const cands = candidatePaths(p);
    for (const c of cands) {
      if (await mediaExists(c)) return c;
    }
    return '';
  }

  // ---------- Status UI ----------
  function setStatus(t, cls = '') {
    const box = $$('#statusBox');
    if (box) {
      box.textContent = t;
      box.className = cls;
    }
  }

  // ---------- Campaigns registry ----------
  async function loadCampaignRegistry() {
    const reg = await fetchJson('campaigns.json', 'campaign registry');
    state.campaigns = reg.campaigns || [];
    if (!state.campaigns.length) throw new Error('No campaigns defined.');
  }

  // ---------- Tab navigation ----------
  function syncTabFromHash() {
    const tab = activeTabFromHash();
    $$$('.tabBtn').forEach(el => el.classList.toggle('tabBtn--active', el.dataset.tab === tab));
    $$$('.tabPanel').forEach(el => el.classList.toggle('hidden', el.dataset.tab !== tab));
    document.dispatchEvent(new CustomEvent('tabchange', { detail: { tab } }));
  }

  function bindTabEvents() {
    window.addEventListener('hashchange', syncTabFromHash);
    document.addEventListener('tabchange', (e) => {
      const tab = e.detail?.tab;
      if (tab === 'map') {
        // Give Leaflet time to render after display
        setTimeout(ensureMapReady, 50);
        setTimeout(() => state.map?.invalidateSize(), 200);
      }
    });
  }

  // ---------- Drawer ----------
  function bindDrawer() {
    $$('#drawerOverlay')?.addEventListener('click', closeDrawer);
    $$('#drawerClose')?.addEventListener('click', closeDrawer);
  }

  function closeDrawer() {
    $$('#drawerOverlay')?.classList.add('hidden');
    $$('#sessionDrawer')?.classList.add('hidden');
  }

  function openDrawer(sid) {
    const s = state.sessionsById.get(Number(sid));
    if (!s) return;
    $$('#drawerTitle').textContent = s.host || 'Session';
    $$('#drawerSub').textContent = s.date || '—';
    $$('#dFarmers').textContent = s.farmers || '—';
    $$('#dAcres').textContent = s.acres || '—';
    $$('#dScore').textContent = s.score || '—';
    $$('#drawerOverlay')?.classList.remove('hidden');
    $$('#sessionDrawer')?.classList.remove('hidden');
  }

  // ---------- Lightbox ----------
  function bindLightbox() {
    $$('#lbClose')?.addEventListener('click', closeLightbox);
  }

  function closeLightbox() {
    $$('#lightbox').classList.add('hidden');
  }

  function openLightbox(media) {
    const body = $$('#lbBody');
    body.innerHTML = `<img src="${media.url}" alt="${media.caption}">`;
    $$('#lightbox').classList.remove('hidden');

    // Added share functionality from review
    $$('#shareTwitter')?.addEventListener('click', () => {
      const url = encodeURIComponent(media.url);
      window.open(`https://twitter.com/intent/tweet?url=${url}&text=Bayer Wheat Campaign Media`, '_blank');
    });
    $$('#shareLinkedIn')?.addEventListener('click', () => {
      const url = encodeURIComponent(media.url);
      window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
    });
    $$('#generateQr')?.addEventListener('click', () => {
      const qrDiv = $$('#qrContainer');
      new QRCode(qrDiv, { text: media.url, width: 128, height: 128, colorDark: cssVar('--brand') });
    });
  }

  // ---------- Feedback ----------
  function bindFeedback() {
    const phoneInput = $$('#fbPhone');
    const emailInput = $$('#fbEmail');
    const msgInput = $$('#fbMessage');
    const waBtn = $$('#fbSendWhatsApp');
    const mailBtn = $$('#fbSendEmail');
    const statusLabel = $$('#fbFeedbackMsg');

    function displayStatus(t, ok = true) {
      if (!statusLabel) return;
      statusLabel.textContent = t;
      statusLabel.style.color = ok ? '' : 'var(--danger)';
    }
    waBtn?.addEventListener('click', () => {
      const phoneRaw = phoneInput?.value?.trim() || '';
      const msg = msgInput?.value?.trim() || '';
      // Remove non-digit characters; WhatsApp expects international numbers
      const phone = phoneRaw.replace(/[^0-9]/g, '');
      if (!phone) {
        displayStatus('Please enter a valid phone number.', false);
        return;
      }
      const encoded = encodeURIComponent(msg);
      const waUrl = `https://wa.me/${phone}?text=${encoded}`;
      // Open in a new tab to avoid leaving the dashboard entirely
      window.open(waUrl, '_blank');
      displayStatus('Opening WhatsApp…');
    });
    mailBtn?.addEventListener('click', () => {
      const email = emailInput?.value?.trim() || '';
      const msg = msgInput?.value?.trim() || '';
      if (!email) {
        displayStatus('Please enter a valid email address.', false);
        return;
      }
      const subject = encodeURIComponent('Feedback on Harvest Horizons Dashboard');
      const body = encodeURIComponent(msg);
      const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
      // Navigate away; mailto links open in the default mail client
      window.location.href = mailto;
      displayStatus('Opening email draft…');
    });
  }

  // ---------- Campaign selection ----------
  function renderCampaignSelect() {
    const sel = $$('#campaignSelect');
    if (!sel) return;

    sel.innerHTML = state.campaigns.map(c => {
      const id = esc(c.id);
      const name = esc(c.name || c.id);
      return `<option value="${id}">${name}</option>`;
    }).join('');

    sel.value = state.campaignId || (state.campaigns[0]?.id ?? '');
    sel.onchange = () => {
      const id = sel.value;
      window.location.href = `index.html?campaign=${encodeURIComponent(id)}#summary`;
    };
  }

  async function loadCampaign(id) {
    state.campaignId = id;
    state.campaign = state.campaigns.find(c => c.id === id) || state.campaigns[0] || null;
    if (!state.campaign) throw new Error('No campaigns configured.');

    setStatus('Loading sessions…');

    const sessionsPath = state.campaign.sessionsUrl || `data/${id}/sessions.json`;
    const mediaPath = state.campaign.mediaUrl || `data/${id}/media.json`;
    const sheetsIndexPath = state.campaign.sheetsIndexUrl || `data/${id}/sheets_index.json`;

    // Sessions
    const sj = await fetchJson(sessionsPath, 'sessions');
    const sessions = Array.isArray(sj.sessions) ? sj.sessions : Array.isArray(sj) ? sj : [];
    // Assign derived region codes to each session. We map districts/territories
    // to region codes (RGN) based on the Initial sheet. If no match is found
    // the region remains blank. Matching ignores case and spaces for flexibility.
    (function assignRegions() {
      const regionMap = {
        // Sukkur region (SKR)
        'dadu': 'SKR',
        'daharki': 'SKR',
        'dharki': 'SKR',
        'ghotki': 'SKR',
        'jafferabad': 'SKR',
        'jaferabad': 'SKR',
        'jafarabad': 'SKR',
        'jaferabad': 'SKR',
        'mehrabpur': 'SKR',
        'ranipur': 'SKR',
        'sukkur': 'SKR',
        'ubaro': 'SKR',
        'ubauro': 'SKR',
        // Rahim Yar Khan region (RYK)
        'rahim yarkhan': 'RYK',
        'rahim yar khan': 'RYK',
        'rajan pur': 'RYK',
        'rajanpur': 'RYK',
        // Dera Ghazi Khan region (DGK)
        'bhakkar': 'DGK',
        'karor lal esan': 'DGK',
        'kot adu': 'DGK',
        'mianwali': 'DGK',
        'muzaffar garh': 'DGK',
        'muzaffargarh': 'DGK',
        // Faisalabad region (FSD)
        'chakwal': 'FSD',
        'sargodha': 'FSD',
        'toba tek singh': 'FSD',
        // Gujranwala region (GUJ)
        'phalia': 'GUJ'
      };
      for (const s of sessions) {
        const district = String(s.district || '').toLowerCase().replace(/\s+/g, '');
        let matchedRegion = '';
        // Attempt direct match on district (no spaces)
        for (const [key, reg] of Object.entries(regionMap)) {
          const normKey = key.toLowerCase().replace(/\s+/g, '');
          if (district === normKey) { matchedRegion = reg; break; }
        }
        // Assign region code
        s.region = matchedRegion;
      }
    })();

    state.sessions = sessions;
    state.sessionsById = new Map(sessions.map(s => [Number(s.id), s]));

    // Optional sheets index
    try {
      state.sheetsIndex = await fetchJson(sheetsIndexPath, 'sheets index');
    } catch (_e) {
      state.sheetsIndex = null;
    }

    // Optional media config
    try {
      state.mediaCfg = await fetchJson(mediaPath, 'media config');
    } catch (_e) {
      state.mediaCfg = null;
    }

    // Campaign date range
    // Prefer explicit campaign start/end if provided; otherwise derive from sessions.
    const dates = sessions.map(s => parseDateSafe(s.date)).filter(Boolean);
    if (!dates.length) throw new Error('No session dates found.');
    dates.sort((a,b) => a - b);

    const cfgStart = parseDateSafe(state.campaign.startDate);
    const cfgEnd = parseDateSafe(state.campaign.endDate);

    state.dateMin = cfgStart || dates[0];
    state.dateMax = cfgEnd || dates[dates.length - 1];

    // If config dates are outside actual data, clamp range to data to avoid empty view by default.
    if (state.dateMin < dates[0]) state.dateMin = dates[0];
    if (state.dateMax > dates[dates.length - 1]) state.dateMax = dates[dates.length - 1];

    state.dateFrom = state.dateMin;
    state.dateTo = state.dateMax;

    // Setup date inputs min/max and defaults
    const fromEl = $$('#dateFrom');
    const toEl = $$('#dateTo');
    if (fromEl && toEl) {
      fromEl.min = formatDateInput(state.dateMin);
      fromEl.max = formatDateInput(state.dateMax);
      toEl.min = formatDateInput(state.dateMin);
      toEl.max = formatDateInput(state.dateMax);
      fromEl.value = formatDateInput(state.dateMin);
      toEl.value = formatDateInput(state.dateMax);
    }
    setRangeHint();

    filterSessions();
    renderAll();
    setStatus('Loaded.', 'ok');
  }

  // ---------- Events ----------
  function bindTopControls() {
    $$('#applyBtn')?.addEventListener('click', applyDateInputs);
    $$('#resetBtn')?.addEventListener('click', resetDateInputs);
    $$('#exportBtn')?.addEventListener('click', exportCsv);

    // Apply on Enter in date inputs
    $$('#dateFrom')?.addEventListener('change', applyDateInputs);
    $$('#dateTo')?.addEventListener('change', applyDateInputs);

    // Apply automatically when name or city filters change
    $$('#nameFilter')?.addEventListener('input', applyDateInputs);
    $$('#cityFilter')?.addEventListener('input', applyDateInputs);

    // Apply automatically when region filter changes. This allows users to
    // filter sessions by region code (REG) such as SKR, RYK, DGK. See
    // index.html for the #regionFilter input.
    $$('#regionMulti')?.addEventListener('change', applyDateInputs); // Updated to multi-select

    // Apply automatically when district or score filters change
    $$('#districtFilter')?.addEventListener('input', applyDateInputs);
    $$('#scoreMin')?.addEventListener('input', applyDateInputs);
    $$('#scoreMax')?.addEventListener('input', applyDateInputs);

    $$('#semanticSearch')?.addEventListener('input', applyDateInputs); // Added smart search

    // Export button for priority table
    $$('#priorityExportBtn')?.addEventListener('click', exportPriorityCsv);

    // Added PDF button
    $$('#generatePdfBtn')?.addEventListener('click', generatePdfReport);
  }

  function exportCsv() {
    const rows = [];
    rows.push(['id','sheetRef','date','district','village','score'].join(','));
    for (const s of state.filteredSessions) {
      const row = [
        s.id,
        s.sheetRef,
        s.date,
        (s.district || '').replaceAll(',', ' '),
        (s.village || s.spot || '').replaceAll(',', ' '),
        s.score ?? ''
      ];
      rows.push(row.map(x => String(x ?? '').replaceAll('\n',' ').replaceAll('\r',' ')).join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.campaignId || 'campaign'}_sessions.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Export the priority districts table as CSV. Collects the district rows
  // currently rendered in the table, including the recommended action,
  // and triggers a download via a Blob. The filename incorporates the
  // campaign identifier for clarity.
  function exportPriorityCsv() {
    const table = document.getElementById('priorityDistrictsTable');
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const header = ['District','Sessions','Farmers','Acres','Awareness','Definite','Avg score','Action'];
    const csvRows = [header.join(',')];
    rows.forEach(tr => {
      const cells = Array.from(tr.children).map(td => td.textContent.trim().replace(/\n/g,' ').replace(/,/g,' '));
      csvRows.push(cells.join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type:'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${state.campaignId || 'campaign'}_priority.csv`;
    a.click();

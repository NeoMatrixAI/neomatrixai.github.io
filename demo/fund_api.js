/* fund_api.js — PUBLIC DEMO build.
 *
 * This is the real livesys/compositor fund dashboard's shared data/chart layer
 * (services/dashboard/fund_api.js), ported for the public site. The three
 * layer pages (fund.html / fund_portfolio.html / fund_alpha.html) are copied
 * over UNCHANGED — same markup, same rendering code, same FundAPI.* call
 * surface. Only the inside of this file is different: every function that
 * used to call the real rquery/pyfolio/livesys routes now returns synthetic,
 * deterministic sample data with the exact same JSON shape instead. No real
 * account, key, fill or balance is involved anywhere in this file.
 *
 * A visitor never has to sign in — a demo user key is pre-seeded below, so
 * the pages "just load" the way the rest of this site promises ("Sample
 * data, no signup").
 */
(function (global) {
  'use strict';

  const RQUERY = '';
  const PYFOLIO = '';
  const LS_KEY = 'fund_dashboard_cfg';
  const DEMO_KEY = 'demo0000000000000000000000000001';
  // fund_market.html doesn't go through bindConfigForm (it uses a separate
  // "data API key" of its own) — pre-seed it too, so no page on this demo
  // ever needs the visitor to type anything in.
  try { if (!localStorage.getItem('fund_market_data_apikey')) localStorage.setItem('fund_market_data_apikey', DEMO_KEY); } catch (e) { /* private mode */ }

  const PALETTE = ['#7aa2f7', '#9ece6a', '#e0af68', '#f7768e', '#bb9af7', '#7dcfff', '#ff9e64', '#73daca', '#c0caf5', '#ff007c'];
  const DASHES = [[], [6, 4], [2, 3], [10, 4, 2, 4]];
  const POSITIONS_MODE = 'symbol';

  // ── config — pre-seeded so the demo needs no signup ──
  function loadCfg() {
    try {
      const c = JSON.parse(localStorage.getItem(LS_KEY));
      if (c && c.key) return c;
    } catch (e) { /* private mode */ }
    return { key: DEMO_KEY, env: 'live', fund: 'neo-fund-01' };
  }
  function saveCfg(c) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch (e) { /* quota / private mode */ }
  }

  function fmtRange(hours) {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600 * 1000);
    const f = (d) => {
      const p = (n) => String(n).padStart(2, '0');
      const k = new Date(d.getTime() + 9 * 3600 * 1000);
      return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
    };
    return { start: f(start), end: f(end) };
  }
  const qs = (o) => new URLSearchParams(o).toString();

  // ── range control (same as the real dashboard) ──
  const RANGE_KEY = 'fund_range';
  const RANGE_PRESETS = [['1h', 1], ['6h', 6], ['24h', 24], ['7d', 168], ['30d', 720], ['90d', 2160], ['All', 8760]];
  const _kstStr = (ms) => {
    const p = (n) => String(n).padStart(2, '0');
    const k = new Date(ms + 9 * 3600 * 1000);
    return `${k.getUTCFullYear()}-${p(k.getUTCMonth() + 1)}-${p(k.getUTCDate())} ${p(k.getUTCHours())}:${p(k.getUTCMinutes())}`;
  };
  const _localToMs = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(s || '');
    if (!m) return NaN;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - tzOffsetMin() * 60000;
  };
  const _msToLocal = (ms) => {
    const p = (n) => String(n).padStart(2, '0');
    const d = new Date(ms + tzOffsetMin() * 60000);
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
  };
  function loadRange() {
    const u = new URLSearchParams(location.search);
    if (u.get('from') && u.get('to')) return { from: u.get('from'), to: u.get('to') };
    if (u.get('range')) return { preset: u.get('range') };
    try { const s = JSON.parse(localStorage.getItem(RANGE_KEY)); if (s && (s.preset || (s.from && s.to))) return s; } catch (e) { /* no storage */ }
    return { preset: '24h' };
  }
  function saveRange(rg) {
    try { localStorage.setItem(RANGE_KEY, JSON.stringify(rg)); } catch (e) { /* private mode */ }
    const u = new URLSearchParams(location.search);
    u.delete('range'); u.delete('from'); u.delete('to');
    if (rg.preset) u.set('range', rg.preset); else { u.set('from', rg.from); u.set('to', rg.to); }
    try { history.replaceState(null, '', location.pathname + '?' + u.toString()); } catch (e) { /* file:// etc */ }
  }
  function currentRange() {
    const rg = loadRange();
    const now = Date.now();
    if (rg.preset) {
      const hit = RANGE_PRESETS.find(([k]) => k === rg.preset) || RANGE_PRESETS[2];
      const h = hit[1];
      return { start: _kstStr(now - h * 3600e3), end: _kstStr(now), hours: h, label: hit[0], preset: hit[0] };
    }
    let a = _localToMs(rg.from), b = _localToMs(rg.to);
    if (!(a < b)) { const h = 24; return { start: _kstStr(now - h * 3600e3), end: _kstStr(now), hours: h, label: '24h', preset: '24h' }; }
    return { start: _kstStr(a), end: _kstStr(b), hours: Math.max(1, (b - a) / 3600e3), label: `${rg.from.replace('T', ' ')} - ${rg.to.replace('T', ' ')}`, preset: null, from: rg.from, to: rg.to };
  }
  function rangeQuery() { const rg = loadRange(); return rg.preset ? { range: rg.preset } : { from: rg.from, to: rg.to }; }
  function withRange(url) { const q = qs(rangeQuery()); return q ? url + (url.includes('?') ? '&' : '?') + q : url; }
  function ensureRangeUI(onChange) {
    const host = document.getElementById('rangeCtl');
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    host.className = 'range-ctl';
    const render = () => {
      const cur = currentRange();
      host.innerHTML =
        '<span class="range-presets">' + RANGE_PRESETS.map(([k]) =>
          `<button type="button" class="pill-btn${cur.preset === k ? ' active' : ''}" data-r="${k}">${k}</button>`).join('') + '</span>' +
        '<span class="range-custom">' +
          `<input type="datetime-local" id="rangeFrom" value="${cur.from || _msToLocal(_localToMs(cur.from) || (Date.now() - cur.hours * 3600e3))}">` +
          '<span class="sep">-</span>' +
          `<input type="datetime-local" id="rangeTo" value="${cur.to || _msToLocal(Date.now())}">` +
          `<button type="button" class="pill-btn${cur.preset ? '' : ' active'}" id="rangeApply">Apply</button>` +
        '</span>';
      host.querySelectorAll('button[data-r]').forEach((b) => b.addEventListener('click', () => {
        saveRange({ preset: b.dataset.r }); render(); renderCfgSummary(); if (onChange) onChange();
      }));
      host.querySelector('#rangeApply').addEventListener('click', () => {
        const from = host.querySelector('#rangeFrom').value, to = host.querySelector('#rangeTo').value;
        if (!(_localToMs(from) < _localToMs(to))) { host.querySelector('#rangeTo').focus(); return; }
        saveRange({ from, to }); render(); renderCfgSummary(); if (onChange) onChange();
      });
    };
    render();
  }

  // ── timezone (same as the real dashboard) ──
  const TZ_KEY = 'fund_tz';
  const getTz = () => localStorage.getItem(TZ_KEY) || 'local';
  const setTz = (tz) => { localStorage.setItem(TZ_KEY, tz); renderCfgSummary(); };
  function tzOffsetMin(tz) {
    tz = tz || getTz();
    if (tz === 'local') return -new Date().getTimezoneOffset();
    const m = /^UTC([+-]\d{1,2})(?::?(\d{2}))?$/.exec(tz);
    if (!m) return 0;
    const mm = m[2] ? parseInt(m[2], 10) : 0;
    return parseInt(m[1], 10) * 60 + (m[1][0] === '-' ? -mm : mm);
  }
  function tzLabel(tz) {
    tz = tz || getTz();
    if (tz !== 'local') return tz;
    const o = -new Date().getTimezoneOffset(), s = o >= 0 ? '+' : '-', a = Math.abs(o);
    return `Local (UTC${s}${Math.floor(a / 60)}${a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''})`;
  }
  const _p2 = (n) => String(n).padStart(2, '0');
  const _shift = (d, tz) => new Date((d instanceof Date ? d.getTime() : d * 1000) + tzOffsetMin(tz) * 60000);
  const fmtClock = (d, tz) => { const x = _shift(d || new Date(), tz); return `${_p2(x.getUTCHours())}:${_p2(x.getUTCMinutes())}:${_p2(x.getUTCSeconds())}`; };
  const _MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtAxis = (epochSec, withDate, tz) => { const x = _shift(epochSec, tz); return withDate ? `${_MON[x.getUTCMonth()]} ${x.getUTCDate()}` : `${_p2(x.getUTCHours())}:${_p2(x.getUTCMinutes())}`; };
  const TZ_OPTIONS = ['local', 'UTC'].concat(Array.from({ length: 27 }, (_, i) => 'UTC' + (i - 12 >= 0 ? '+' + (i - 12) : (i - 12))));
  function bindTzSelect(el, onChange) {
    if (!el) return;
    el.innerHTML = TZ_OPTIONS.map(t => `<option value="${t}"${t === getTz() ? ' selected' : ''}>${t === 'local' ? tzLabel('local') : t}</option>`).join('');
    el.value = getTz();
    el.addEventListener('change', () => { setTz(el.value); if (onChange) onChange(el.value); });
  }

  // jget is unused in the demo build (nothing here calls a real network route),
  // kept only because it's part of the exported surface some pages reference.
  async function jget() { throw new Error('demo build: no network routes'); }

  const bucketFor = (hours) => {
    const m = hours * 60;
    if (m <= 2000) return 0;
    for (const lvl of [15, 60, 1440]) if (m / lvl <= 3000) return lvl;
    return 1440;
  };

  // ════════════════════════════════════════════════════════════════════════
  // ── Synthetic demo data engine ──
  // Deterministic (seeded), so the numbers don't jump around on every reload,
  // but they do respond to the on-screen range control like the real thing.
  // ════════════════════════════════════════════════════════════════════════

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedFrom(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return (h >>> 0) || 1;
  }
  function kstToMs(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(s || '');
    if (!m) return Date.now();
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 9 * 3600 * 1000;
  }
  // A smooth, deterministic-per-range walk. Same (key,start,end) always
  // reproduces the same curve; different windows regenerate their own.
  function genSeries(key, startMs, endMs, opts) {
    opts = opts || {};
    const n = Math.max(2, Math.min(260, Math.round((endMs - startMs) / 60000 / Math.max(1, opts.stepMin || Math.max(1, (endMs - startMs) / 60000 / 200)))));
    const rnd = mulberry32(seedFrom(key + '|' + startMs + '|' + endMs));
    const drift = opts.drift != null ? opts.drift : 0.00003;
    const vol = opts.vol != null ? opts.vol : 0.004;
    let v = opts.base != null ? opts.base : 1;
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = startMs + (endMs - startMs) * i / (n - 1);
      if (i > 0) v *= (1 + drift + (rnd() - 0.5) * 2 * vol);
      out.push({ t: _kstStr(t), v });
    }
    return out;
  }

  const DEMO_FUND = { fundId: 'neo-fund-01', name: 'NeoMatrix Fund I', exchange: 'bitget', status: 'active' };
  const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'LINKUSDT', 'AVAXUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'TONUSDT', 'BNBUSDT'];
  const PRICES = { BTCUSDT: 68000, ETHUSDT: 3500, SOLUSDT: 150, LINKUSDT: 18, AVAXUSDT: 35, XRPUSDT: 0.55, ADAUSDT: 0.45, DOGEUSDT: 0.16, TONUSDT: 6.5, BNBUSDT: 600 };
  const ALPHAS = [
    { id: 'mom', label: 'Momentum', alpha: 0.0011, beta: 0.55, idio: 0.013, tradesPerDay: 10 },
    { id: 'mr', label: 'MeanReversion', alpha: 0.0007, beta: 0.20, idio: 0.010, tradesPerDay: 26 },
    { id: 'carry', label: 'FundingCarry', alpha: 0.0005, beta: 0.10, idio: 0.006, tradesPerDay: 3 },
    { id: 'btct', label: 'BTCTrend', alpha: 0.0009, beta: 0.75, idio: 0.015, tradesPerDay: 6 },
    { id: 'volb', label: 'VolBreakout', alpha: 0.0008, beta: 0.40, idio: 0.014, tradesPerDay: 14 },
  ];
  const ALPHA_BY_ID = Object.fromEntries(ALPHAS.map(a => [a.id, a]));
  const PORTFOLIOS = [
    { id: 'core-momentum', alphas: { mom: 0.35, btct: 0.35, volb: 0.30 }, status: 'active', mddStopThreshold: 0.25, allocationDryRun: false, allocationIntervalHours: 4, allocNow: 0.45 },
    { id: 'defensive-carry', alphas: { carry: 0.5, mr: 0.3, mom: 0.2 }, status: 'active', mddStopThreshold: 0.15, allocationDryRun: false, allocationIntervalHours: 24, allocNow: 0.28 },
    { id: 'tail-hedge', alphas: { volb: 0.55, btct: 0.45 }, status: 'active', mddStopThreshold: null, allocationDryRun: false, allocationIntervalHours: 8, allocNow: 0.20 },
  ];
  const PF_BY_ID = Object.fromEntries(PORTFOLIOS.map(p => [p.id, p]));
  const CAPITAL = 250000;

  function instancePairs(filterPid, filterAid) {
    const out = [];
    PORTFOLIOS.forEach(p => {
      if (filterPid && filterPid.indexOf(p.id) < 0) return;
      Object.keys(p.alphas).forEach(aid => {
        if (filterAid && filterAid.indexOf(aid) < 0) return;
        out.push({ pid: p.id, aid, w: p.alphas[aid] });
      });
    });
    return out;
  }
  function instCapital(pid, w) { return CAPITAL * (PF_BY_ID[pid].allocNow) * w; }

  // ── fetch* replacements ──

  function fetchFundList() { return Promise.resolve({ data: [DEMO_FUND] }); }

  function fetchAccount(cfg) {
    const rnd = mulberry32(seedFrom('account|' + (cfg.fund || '')));
    const equity = CAPITAL + rnd() * 6000 - 2000;
    const positions = SYMBOLS.slice(0, 5).map((sym, i) => {
      const side = rnd() > 0.4 ? 'long' : 'short';
      const qty = (0.4 + rnd() * 2.2) * (side === 'short' ? -1 : 1);
      const entry = PRICES[sym] * (1 + (rnd() - 0.5) * 0.03);
      const mark = entry * (1 + (rnd() - 0.5) * 0.02);
      const notional = Math.abs(qty) * mark;
      const lev = [3, 5, 10][i % 3];
      const upnl = (mark - entry) * qty;
      return {
        symbol: sym, side, qty, entryPrice: entry, markPrice: mark, notional,
        margin: notional / lev, leverage: lev, unrealizedPL: upnl,
        liquidationPrice: side === 'long' ? entry * 0.82 : entry * 1.18,
      };
    });
    const marginUsed = positions.reduce((a, p) => a + p.margin, 0);
    return Promise.resolve({
      data: {
        exchange: 'bitget', tradeEnv: cfg.env || 'live',
        asOf: new Date().toISOString().slice(0, 19),
        account: {
          equity, available: equity - marginUsed, freeMargin: equity - marginUsed * 1.15,
          marginUsed, unrealizedPL: positions.reduce((a, p) => a + p.unrealizedPL, 0), marginCoin: 'USDT',
        },
        positions,
      },
    });
  }

  function fetchComposition() {
    return Promise.resolve({
      data: {
        tradeType: 'futures', measuredAvailable: true,
        portfolios: PORTFOLIOS.map(p => ({
          portfolioId: p.id, status: p.status, mddStopThreshold: p.mddStopThreshold,
          allocationDryRun: p.allocationDryRun, allocationIntervalHours: p.allocationIntervalHours,
          alphas: Object.keys(p.alphas).map(aid => ({ alphaId: aid, alloc: p.alphas[aid], status: 'active', mddStopThreshold: 0.3 })),
        })),
        alphaTable: ALPHAS.map(a => ({ alphaId: a.id })),
      },
    });
  }

  function fetchAllocations(cfg, layer) {
    const TIMELINE = [
      { day: 0, reason: 'Fund launch: Core Momentum only, cash held for later portfolios', pf: { 'core-momentum': 0.55 }, sl: { 'core-momentum': { mom: 0.45, btct: 0.55 } } },
      { day: 12, reason: 'Vol Breakout added to Core Momentum', pf: { 'core-momentum': 0.55 }, sl: { 'core-momentum': { mom: 0.40, btct: 0.35, volb: 0.25 } } },
      { day: 20, reason: 'Defensive Carry portfolio added from cash', pf: { 'core-momentum': 0.55, 'defensive-carry': 0.30 }, sl: { 'defensive-carry': { carry: 0.60, mr: 0.40 } } },
      { day: 40, reason: 'Tail Hedge portfolio added from cash', pf: { 'core-momentum': 0.55, 'defensive-carry': 0.30, 'tail-hedge': 0.10 }, sl: { 'tail-hedge': { volb: 0.60, btct: 0.40 } } },
      { day: 65, reason: 'Q2 risk review: trim core momentum, extend tail hedge', pf: { 'core-momentum': 0.45, 'defensive-carry': 0.28, 'tail-hedge': 0.20 }, sl: { 'core-momentum': { mom: 0.35, btct: 0.35, volb: 0.30 } } },
    ];
    const now = Date.now();
    const ts = (day) => new Date(now - (90 - day) * 86400000).toISOString().slice(0, 16).replace('T', ' ');
    const batches = TIMELINE.map((e, i) => ({
      batchId: 'batch-' + i, createdAt: ts(e.day), reason: e.reason,
      allocations: layer === 'portfolio'
        ? Object.entries(e.pf).map(([pid, a]) => ({ portfolioId: pid, allocation: a }))
        : Object.entries(e.sl).flatMap(([pid, w]) => Object.entries(w).map(([aid, a]) => ({ portfolioId: pid, alphaId: aid, allocation: a }))),
    })).filter(b => b.allocations.length);
    return Promise.resolve({ data: { batches } });
  }

  function fetchSleeveAggregated(cfg, r, extra) {
    extra = extra || {};
    const startMs = kstToMs(r.start), endMs = kstToMs(r.end);
    const isOrigin = extra.track === 'intended';
    const pairs = instancePairs(null, extra.alphaId ? [extra.alphaId] : null);
    const per_strategy_pv = {}, sumByT = {};
    pairs.forEach(({ pid, aid, w }) => {
      const alpha = ALPHA_BY_ID[aid];
      const cap = instCapital(pid, w);
      const key = pid + '/' + aid;
      const series = genSeries(key + (isOrigin ? '|origin' : '|exec'), startMs, endMs,
        { base: cap, drift: alpha.alpha * (isOrigin ? 1 : 0.985), vol: alpha.idio });
      per_strategy_pv[key] = series;
      series.forEach(pt => { sumByT[pt.t] = (sumByT[pt.t] || 0) + pt.v; });
    });
    const ts = Object.keys(sumByT).sort();
    const aggregated_pv = ts.map(t => ({ t, v: sumByT[t] }));
    const finalPv = aggregated_pv.length ? aggregated_pv[aggregated_pv.length - 1].v : 0;
    const firstPv = aggregated_pv.length ? aggregated_pv[0].v : 1;
    const mrnd = mulberry32(seedFrom('metrics|' + JSON.stringify(extra) + '|' + r.start));
    return Promise.resolve({
      aggregated_pv, per_strategy_pv,
      metrics: {
        final_pv: finalPv, active_strategies: pairs.length, total_strategies: pairs.length,
        roe_pct: firstPv ? (finalPv / firstPv - 1) * 100 : 0,
        sharpe_daily_annualized: 0.8 + mrnd() * 0.9,
        max_drawdown_pct: -(2.5 + mrnd() * 9),
      },
      truncated: false, returned_instances: pairs.length, total_instances: pairs.length,
    });
  }

  function fetchMeasured(cfg, r) {
    const startMs = kstToMs(r.start), endMs = kstToMs(r.end);
    const series = genSeries('measured', startMs, endMs, { base: CAPITAL, drift: 0.00028, vol: 0.003 });
    return Promise.resolve({ aggregated_pv: series, metrics: { final_pv: series[series.length - 1].v } });
  }

  function fetchPortfolioVirtual(cfg, r, columns) {
    const startMs = kstToMs(r.start), endMs = kstToMs(r.end);
    const rows = [];
    PORTFOLIOS.forEach(p => {
      const cap = CAPITAL * p.allocNow;
      (columns || ['current_pv']).forEach(col => {
        const isOrigin = col === 'intended_current_pv';
        const series = genSeries(p.id + '|' + col, startMs, endMs, { base: cap, drift: isOrigin ? 0.0004 : 0.00037, vol: 0.006 });
        series.forEach(pt => rows.push({ portfolioId: p.id, column_nm: col, datetime: pt.t, value: pt.v }));
      });
    });
    return Promise.resolve({ data: rows });
  }

  function fetchSleeveResult(cfg, r, columns, extra) {
    extra = extra || {};
    const startMs = kstToMs(r.start), endMs = kstToMs(r.end);
    const pairs = instancePairs(extra.portfolioId, extra.alphaId);
    const rows = [];
    pairs.forEach(({ pid, aid, w }) => {
      const alpha = ALPHA_BY_ID[aid];
      const cap = instCapital(pid, w);
      if (extra.latest) {
        const rnd = mulberry32(seedFrom(pid + '/' + aid + '|snap|' + r.end));
        columns.forEach(col => {
          let val = null;
          if (col === 'current_pv' || col === 'intended_current_pv') {
            const isOrigin = col.charAt(0) === 'i';
            const s = genSeries(pid + '/' + aid + (isOrigin ? '|origin' : '|exec'), startMs, endMs, { base: cap, drift: alpha.alpha * (isOrigin ? 1 : 0.985), vol: alpha.idio });
            val = s[s.length - 1].v;
          } else if (col === 'position_value') val = cap * (0.75 + rnd() * 0.4);
          else if (col === 'gross_exposure' || col === 'intended_gross_exposure') val = cap * (0.9 + rnd() * 0.6);
          else if (col === 'unrealized_pnl') val = cap * (rnd() - 0.45) * 0.05;
          else if (col === 'netprofit' || col === 'intended_netprofit') val = cap * (rnd() - 0.4) * 0.03;
          rows.push({ portfolioId: pid, alphaId: aid, column_nm: col, value: val });
        });
      } else {
        // agg=sum: one row per day in range so D/W/M activity buckets have real shape
        const days = Math.max(1, Math.round((endMs - startMs) / 86400000));
        for (let d = 0; d < days; d++) {
          const dayMs = startMs + d * 86400000;
          const rnd = mulberry32(seedFrom(pid + '/' + aid + '|day' + d + '|' + r.start));
          columns.forEach(col => {
            const val = col === 'trade_count'
              ? Math.max(1, Math.round(alpha.tradesPerDay * (0.6 + rnd() * 0.8)))
              : cap * 0.02 * (0.5 + rnd());
            rows.push({ portfolioId: pid, alphaId: aid, datetime: _kstStr(dayMs), column_nm: col, value: val });
          });
        }
      }
    });
    return Promise.resolve({ data: rows });
  }

  function fetchVirtualFills(cfg, r, extra) {
    extra = extra || {};
    const pairs = instancePairs(null, extra.alphaId);
    const limit = extra.limit || 30;
    const rnd = mulberry32(seedFrom('fills|' + (extra.alphaId || '') + '|' + r.end));
    const rows = [];
    const now = Date.now();
    for (let i = 0; i < limit; i++) {
      const p0 = pairs[Math.floor(rnd() * pairs.length)];
      if (!p0) break;
      const sym = SYMBOLS[Math.floor(rnd() * SYMBOLS.length)];
      const cap = instCapital(p0.pid, p0.w);
      const value = cap * (0.01 + rnd() * 0.05);
      rows.push({
        eventTime: new Date(now - i * 3600000 * (1 + rnd() * 3)).toISOString().slice(0, 16).replace('T', ' '),
        portfolioId: p0.pid, alphaId: p0.aid, symbol: sym,
        allocatedFill: value, allocatedFee: value * 0.0006, allocatedFunding: value * (rnd() - 0.5) * 0.0008,
      });
    }
    return Promise.resolve({ data: rows });
  }

  function fetchSessions(cfg) {
    return Promise.resolve({
      sessions: [{
        session_id: 'sess-' + (cfg.fund || 'neo-fund-01'), trade_type: 'futures', trade_env: cfg.env || 'live',
        state: 'running', next_rebalancing_time: new Date(Date.now() + 3 * 3600000).toISOString().slice(0, 19),
        created_at: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 19), strategy_name: 'compositor-v3',
      }],
    });
  }

  const IND_COL = s => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  function fetchIndicators(cfg, r, dim) {
    const isOrigin = dim && dim.track === 'intended';
    const key = 'ind|' + JSON.stringify(dim) + '|' + r.end;
    const rnd = mulberry32(seedFrom(key));
    const sharpe = (isOrigin ? 1.0 : 0.85) + rnd() * 0.8;
    const mdd = -(0.02 + rnd() * 0.06) * (isOrigin ? 0.85 : 1);
    const vol = 0.15 + rnd() * 0.25;
    return Promise.resolve({
      data: [{
        datetime: r.end,
        [IND_COL('sharpe_ratio')]: sharpe, [IND_COL('max_drawdown')]: mdd, [IND_COL('volatility')]: vol,
      }],
    });
  }
  function pctAbs(v) { const n = Math.abs(Number(v)); return n > 1.5 ? n : n * 100; }

  function hasAggData(body) {
    if (!body || !(body.aggregated_pv || []).length) return false;
    const n = Number((body.metrics || {}).total_strategies);
    return Number.isFinite(n) ? n > 0 : true;
  }

  function resetCards(ids, note, noteIds) {
    (ids || []).forEach(id => { const e = document.getElementById(id); if (e) { e.textContent = '-'; e.className = 'v'; } });
    (noteIds || []).forEach(id => { const e = document.getElementById(id); if (e) e.textContent = note || ''; });
  }
  function failedOf(pairs) { return pairs.filter(([, r]) => !r || r.status !== 'fulfilled').map(([n]) => n); }
  function latestIndicators(body, indicators) {
    const rows = (body && body.data) || [];
    const out = {};
    (indicators || ['sharpe_ratio', 'max_drawdown', 'volatility']).forEach(name => {
      const col = IND_COL(name);
      out[name] = null;
      for (let i = rows.length - 1; i >= 0; i--) {
        const v = rows[i] && rows[i][col];
        if (v !== null && v !== undefined) { out[name] = Number(v); break; }
      }
    });
    return out;
  }

  function fetchOHLCV(cfg, symbol, tf, tradeType, limit) {
    limit = limit || 200;
    const rnd = mulberry32(seedFrom('ohlcv|' + symbol + '|' + (tf || '15m')));
    const base = PRICES[symbol] || 100;
    let p = base;
    const now = Math.floor(Date.now() / 1000);
    const step = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '1d': 86400 }[tf] || 900;
    const data = [];
    for (let i = limit - 1; i >= 0; i--) {
      const o = p;
      p *= (1 + (rnd() - 0.5) * 0.01);
      const c = p;
      const h = Math.max(o, c) * (1 + rnd() * 0.003);
      const l = Math.min(o, c) * (1 - rnd() * 0.003);
      data.push({ time: now - i * step, open: o, high: h, low: l, close: c, volume: rnd() * 500 + 50 });
    }
    return Promise.resolve({ data, symbol, tradeType: tradeType || 'futures', frequency: tf || '15m' });
  }

  async function fetchAlphaPositions(cfg, r, alphaIds) {
    const aid = (alphaIds || [])[0];
    const pairs = instancePairs(null, aid ? [aid] : null);
    const rnd = mulberry32(seedFrom('pos|' + (aid || '') + '|' + r.end));
    const out = [];
    pairs.forEach(({ pid, aid: a }) => {
      const symbols = SYMBOLS.slice(0, 2 + Math.floor(rnd() * 2));
      symbols.forEach(sym => {
        const side = rnd() > 0.4 ? 'long' : 'short';
        const qty = (0.2 + rnd() * 1.5) * (side === 'short' ? -1 : 1);
        const entry = PRICES[sym] * (1 + (rnd() - 0.5) * 0.02);
        out.push({ scope: 'symbol', portfolioId: pid, symbol: sym, side, qty, weight: null, notional: Math.abs(qty) * entry, mark: null, upnl: null });
      });
    });
    return out;
  }
  async function fetchAlphaPositionsInstance() { return []; }
  async function fetchAlphaPositionsSymbol(cfg, r, alphaIds) { return fetchAlphaPositions(cfg, r, alphaIds); }
  function fetchBooks() { return Promise.resolve({ books: [] }); }

  const dailyReturns = (pv) => { const o = []; for (let i = 1; i < pv.length; i++) { const a = pv[i - 1], b = pv[i]; o.push(a ? b / a - 1 : 0); } return o; };
  const drawdown = (pv) => { let pk = -Infinity; return pv.map(v => { pk = Math.max(pk, v); return pk ? (v / pk - 1) * 100 : 0; }); };
  function stats(s) { const m = s.reduce((a, b) => a + b, 0) / (s.length || 1); const sd = Math.sqrt(s.reduce((a, b) => a + (b - m) ** 2, 0) / (s.length || 1)) || 1e-9; return { m, sd }; }
  const sharpe = (ret) => { const { m, sd } = stats(ret); return (m / sd) * Math.sqrt(365); };
  const annVol = (ret) => stats(ret).sd * Math.sqrt(365) * 100;
  const pctFrom = (pv) => { const b = pv.find(v => v != null); return pv.map(v => v == null || !b ? null : (v / b - 1) * 100); };
  function seriesFromRows(rows, colName) {
    const byT = {};
    for (const r of rows) { if (colName && r.column_nm !== colName) continue; byT[r.datetime] = r.value; }
    return Object.keys(byT).sort().map(t => ({ t, v: byT[t] }));
  }

  const AXIS_C = '#7b8496', GRID_C = '#232936', TXT_C = '#d8dce3';
  function baseOpts(pct, extra) {
    return Object.assign({
      animation: false, maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      plugins: { legend: { labels: { color: TXT_C, boxWidth: 16, font: { size: 11 } } } },
      scales: {
        x: { type: 'category', ticks: { color: AXIS_C, maxTicksLimit: 9 }, grid: { color: GRID_C } },
        y: { ticks: { color: AXIS_C, callback: v => pct ? v.toFixed(1) + '%' : v }, grid: { color: GRID_C } },
      },
    }, extra || {});
  }
  function lineChart(ctx, datasets, opts) {
    if (chartMissing(ctx)) return null;
    return new global.Chart(ctx, { type: 'line', data: { datasets }, options: baseOpts(false, opts) });
  }
  function chartMissing(ctx) {
    if (global.Chart) return false;
    const host = ctx && ctx.parentElement;
    if (host && !host.querySelector('.chart-missing')) {
      const m = document.createElement('div');
      m.className = 'panel-body muted chart-missing';
      m.textContent = 'Chart library did not load (cdn.jsdelivr.net blocked?) — the figures on this page are unaffected';
      host.appendChild(m);
    }
    return true;
  }

  const fmt = (v, d = 0) => (v == null || isNaN(v)) ? '-' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const sgn = (v) => (v >= 0 ? '+' : '');
  const alphaColor = (idx) => PALETTE[idx % PALETTE.length];

  const SETTING_IDS = ['cfgKey', 'cfgEnv', 'cfgTz'];
  function hoursLabel(h) { const n = Number(h) || 24; return (n >= 24 && n % 24 === 0) ? (n / 24) + 'd' : n + 'h'; }

  function renderCfgSummary() {
    const el = document.getElementById('cfgSummary');
    if (!el) return;
    const c = loadCfg();
    el.innerHTML =
      '<span class="chip">Fund <b>' + String(c.key).slice(0, 8) + '...</b></span>' +
      '<span class="chip"><b>' + (c.env || 'live') + '</b></span>' +
      '<span class="chip">Range <b>' + currentRange().label + '</b></span>' +
      '<span class="chip">' + tzLabel(getTz()) + '</span>';
  }

  const NAV_TOOLS = [
    { id: 'events', label: 'Events', href: 'fund_events.html' },
    { id: 'te', label: 'Tracking Error', href: 'fund_tracking_error.html' },
    { id: 'market', label: 'Market', href: 'fund_market.html' },
    { id: 'logs', label: 'Logs', href: 'fund_logs.html' },
  ];

  function navQuery(params) {
    const clean = {};
    Object.keys(params || {}).forEach((k) => { if (params[k] !== undefined && params[k] !== null && params[k] !== '') clean[k] = params[k]; });
    const s = qs(clean);
    return s ? '?' + s : '';
  }
  function renderNav(o) {
    const opt = o || {};
    const mount = document.getElementById(opt.mount || 'nav');
    if (!mount) return;
    const pfId = opt.portfolioId || '', aId = opt.alphaId || '', level = opt.level || 'fund';
    const atFundRoot = level === 'fund' && !opt.tool && !opt.grid;
    const crumbs = [];
    crumbs.push(atFundRoot ? '<span class="crumb here">Fund</span>' : '<a class="crumb" href="' + withRange('fund.html') + '">Fund</a>');
    if (pfId) {
      crumbs.push(level === 'portfolio' ? '<span class="crumb here">' + esc(pfId) + '</span>'
        : '<a class="crumb" href="' + withRange('fund_portfolio.html' + navQuery({ p: pfId })) + '">' + esc(pfId) + '</a>');
    }
    if (aId) crumbs.push('<span class="crumb here">' + esc(aId) + '</span>');
    // Events and Tracking Error carry the current fund/portfolio/alpha context
    // along (so the tool opens already scoped to what you were looking at);
    // Market and Logs have a single target, so there's no context to carry.
    const CTX_TOOLS = { te: 1, events: 1 };
    const tools = NAV_TOOLS.map((t) => {
      const q = CTX_TOOLS[t.id] ? navQuery({ p: pfId, a: aId }) : '';
      const cur = opt.tool === t.id ? ' here' : '';
      return '<a class="tool' + cur + '" href="' + withRange(t.href + q) + '">' + t.label + '</a>';
    }).join('');
    mount.innerHTML = '<span class="crumbs">' + crumbs.join('<span class="sep">/</span>') + '</span><span class="tools">' + tools + '</span>';
  }

  function ensureSettingsUI(onSave) {
    const row = document.querySelector('.cfg-row');
    if (!row || row.dataset.settingsReady) return;
    row.dataset.settingsReady = '1';
    const back = document.createElement('div');
    back.className = 'modal-back';
    back.id = 'cfgModal';
    back.innerHTML = '<div class="modal"><h3>Settings</h3><p class="hint">Sample-data demo &mdash; this is here for parity with the real dashboard. There is nothing you need to enter.</p><div class="fields" id="cfgFields"></div><p class="note">No real account, key or balance is involved on this page.</p><div class="actions"><button class="btn-ghost" id="cfgCancel">Cancel</button><button class="btn-primary" id="cfgSave">Save</button></div></div>';
    document.body.appendChild(back);
    const fields = back.querySelector('#cfgFields');
    SETTING_IDS.forEach(function (id) { const el = document.getElementById(id); if (el) fields.appendChild(el.closest('label') || el); });
    const summary = document.createElement('span');
    summary.className = 'cfg-summary'; summary.id = 'cfgSummary';
    row.insertBefore(summary, row.firstChild);
    const gear = document.createElement('button');
    gear.className = 'btn-gear'; gear.id = 'btnSettings'; gear.innerHTML = '⚙ Settings';
    const loadBtn = document.getElementById('btnLoad');
    row.insertBefore(gear, loadBtn || null);
    if (loadBtn) loadBtn.textContent = 'Refresh';
    const open = function () { back.classList.add('open'); };
    const close = function () { back.classList.remove('open'); };
    gear.addEventListener('click', open);
    back.querySelector('#cfgCancel').addEventListener('click', close);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    back.querySelector('#cfgSave').addEventListener('click', function () { close(); onSave(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
    renderCfgSummary();
  }

  function renderFundPicker(funds, picked) {
    const bar = document.querySelector('.topbar');
    if (!bar || !picked) return;
    let right = bar.querySelector('.right');
    if (!right) { right = document.createElement('span'); right.className = 'right'; bar.appendChild(right); }
    right.innerHTML = `<span class="chip"><b>${esc(picked.fundId)}</b> ${esc(picked.name || '')} <span class="muted">${esc(picked.exchange || '')} · ${esc(picked.status || '')}</span></span>`;
  }

  function bindConfigForm(onLoad) {
    const $ = (id) => document.getElementById(id);
    const saved = loadCfg();
    if (saved.key && $('cfgKey')) $('cfgKey').value = saved.key;
    if (saved.env && $('cfgEnv')) $('cfgEnv').value = saved.env;
    function collect() {
      return {
        key: ($('cfgKey') || {}).value?.trim() || saved.key,
        env: ($('cfgEnv') || {}).value || saved.env || 'live',
        hours: currentRange().hours,
        fund: loadCfg().fund || 'neo-fund-01',
      };
    }
    async function run() {
      const c = collect();
      const st = $('loadState');
      saveCfg(c);
      renderCfgSummary();
      const r = await fetchFundList(c);
      const funds = r.data;
      const picked = funds[0];
      c.fund = picked.fundId;
      saveCfg(c);
      renderFundPicker(funds, picked);
      if (st) { st.textContent = ''; }
      onLoad(c);
    }
    ensureSettingsUI(run);
    ensureRangeUI(run);
    if ($('btnLoad')) $('btnLoad').addEventListener('click', run);
    run();
    return collect;
  }

  function fetchTrackingError(cfg, scope) {
    const rows = [];
    const push = (row) => rows.push(row);
    const rnd = mulberry32(seedFrom('te|' + (cfg.fund || '')));
    const tierOf = (bp) => Math.abs(bp) >= 400 ? 'CRITICAL' : Math.abs(bp) >= 200 ? 'WARN' : 'INFO';
    if (!scope || scope === '' || scope === 'fund') {
      ['virtual', 'measured'].forEach(basis => {
        const bp = (rnd() - 0.5) * 180;
        push({ scope: 'fund', basis, teBps: bp, status: 'ok', tier: tierOf(bp), runId: 'run-' + Math.floor(Date.now() / 3600000), bars: 1440 });
      });
    }
    if (!scope || scope === 'portfolio') {
      PORTFOLIOS.forEach(p => {
        const bp = (rnd() - 0.45) * 260;
        push({ scope: 'portfolio', portfolioId: p.id, basis: 'virtual', teBps: bp, status: 'ok', tier: tierOf(bp), runId: 'run-' + Math.floor(Date.now() / 3600000), bars: 720 });
      });
    }
    if (!scope || scope === 'alpha') {
      instancePairs().forEach(({ pid, aid }) => {
        const bp = (rnd() - 0.45) * 340;
        push({ scope: 'alpha', portfolioId: pid, alphaId: aid, basis: 'virtual', teBps: bp, status: 'ok', tier: tierOf(bp), runId: 'run-' + Math.floor(Date.now() / 3600000), bars: 600 + Math.floor(rnd() * 400) });
      });
    }
    return Promise.resolve({ data: rows });
  }
  function fetchTrackingErrorCurve(cfg, row) {
    const startMs = Date.now() - 14 * 86400000, endMs = Date.now();
    const live = genSeries('te-live|' + row.alphaId + row.portfolioId, startMs, endMs, { drift: 0.0006, vol: 0.006 });
    const bt = genSeries('te-bt|' + row.alphaId + row.portfolioId, startMs, endMs, { drift: 0.00065, vol: 0.005 });
    const pts = live.map((p, i) => ({ datetime: p.t, liveCum: p.v - 1, btCum: (bt[i] ? bt[i].v : p.v) - 1 }));
    return Promise.resolve({ data: pts });
  }
  async function openBacktestReport() {
    const html = '<!doctype html><meta charset="utf-8"><title>Backtest report (sample)</title>' +
      '<body style="font:14px system-ui;padding:40px;background:#0f1115;color:#d8dce3">' +
      '<h1>Sample backtest report</h1><p>This demo does not run a real backtest engine &mdash; ' +
      'on the live dashboard this button opens the actual latent-replay report for the strategy.</p></body>';
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    global.open(url, '_blank');
  }

  // Different call sites read this differently (fund.html unwraps `.data`,
  // fund_alpha.html reads `.data` as a plain array, fund_events.html reads the
  // top level `.events`) — so the response carries the same rows both ways.
  function fetchEvents(cfg, opts) {
    opts = opts || {};
    const pool = 60;
    const rnd = mulberry32(seedFrom('events-pool'));
    const CAUSES = [
      'order_skipped_min_notional', 'order_skipped_min_notional_sleeve', 'margin_precheck_hold',
      'order_rejected_insufficient_balance', 'order_floor_shortfall', 'alpha_failed_carry',
      'recon_l1_gross_breach', 'recon_l1_symbol_breach', 'gross_scale_clamped',
    ];
    const pairs = instancePairs();
    const now = Date.now();
    let events = [];
    for (let i = 0; i < pool; i++) {
      const p0 = pairs[Math.floor(rnd() * pairs.length)];
      const type = CAUSES[Math.floor(rnd() * CAUSES.length)];
      const sym = SYMBOLS[Math.floor(rnd() * SYMBOLS.length)];
      const amt = instCapital(p0.pid, p0.w) * (0.002 + rnd() * 0.01);
      const detail = type === 'alpha_failed_carry' ? { reason: 'signal computation raised' }
        : type.indexOf('breach') >= 0 ? { scaledVirtualGross: amt * 1.02, exchangeGross: amt, residual: amt * 0.02, tolerancePct: 1.5, symbol: sym, virtual: 0.42, exchange: 0.41 }
        : type === 'gross_scale_clamped' ? { applied: 2.4, requested: 3.1 }
        : { symbols: { [sym]: amt }, count: 1, notionalUsdt: amt, topSymbols: { [sym]: amt } };
      events.push({
        eventType: type, portfolioId: p0.pid, alphaId: p0.aid,
        cycleId: p0.pid + '_' + p0.aid + '_' + i,
        createdAt: new Date(now - i * 3 * 3600000).toISOString().slice(0, 16).replace('T', ' '),
        detail,
      });
    }
    if (opts.eventType) events = events.filter(e => e.eventType === opts.eventType);
    if (opts.portfolioId) events = events.filter(e => e.portfolioId === opts.portfolioId);
    if (opts.alphaId) events = events.filter(e => e.alphaId === opts.alphaId);
    events = events.slice(0, opts.limit || 100);
    return Promise.resolve({ data: events, events });
  }
  function fetchAlertChannels() {
    return Promise.resolve({ channels: [{ channel: 'email', target: 'ops@neomatrix.ai', enabled: true }] });
  }
  function fetchAlertRules() {
    return Promise.resolve({
      rules: [
        { scopeType: 'fund', scopeId: 'neo-fund-01', metric: 'reconGapBp', op: '>', threshold: 150, cooldownMinutes: 60, lastFiredAt: null, enabled: true },
        { scopeType: 'alpha', scopeId: 'volb', metric: 'mddPct', op: '>', threshold: 20, cooldownMinutes: 120, lastFiredAt: null, enabled: true },
      ],
    });
  }

  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function fmtBps(v) {
    if (v === null || v === undefined) return '-';
    const n = Number(v);
    return `${n > 0 ? '+' : ''}${n.toFixed(1)} bp`;
  }
  function tierClass(tier) { return tier === 'CRITICAL' ? 'neg' : (tier === 'WARN' ? 'te-warn' : (tier === 'INFO' ? 'pos' : 'muted')); }
  function teLabelText(row) {
    if (row.scope === 'fund') return 'Fund';
    if (row.scope === 'portfolio') return String(row.portfolioId || '');
    return `${row.alphaId} @ ${row.portfolioId}`;
  }
  function teLabel(row) { return esc(teLabelText(row)); }

  function urlParam(name) { return new URLSearchParams(location.search).get(name); }

  const HELP_KEY = 'fundHelpOpen';
  function initHelpToggle() {
    const bars = Array.prototype.slice.call(document.querySelectorAll('.virtual-banner'));
    if (!bars.length) return;
    const host = document.querySelector('.topbar .title') || document.querySelector('.topbar');
    if (!host) return;
    let open = false;
    try { open = localStorage.getItem(HELP_KEY) === '1'; } catch (err) { open = false; }
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'help-btn'; btn.textContent = '?'; btn.title = 'What this page shows';
    function apply() {
      bars.forEach(function (b) { b.style.display = open ? '' : 'none'; });
      btn.className = 'help-btn' + (open ? ' on' : '');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }
    btn.addEventListener('click', function () {
      open = !open;
      try { localStorage.setItem(HELP_KEY, open ? '1' : '0'); } catch (err) { /* private mode */ }
      apply();
    });
    host.appendChild(btn);
    apply();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initHelpToggle);
  else initHelpToggle();

  global.FundAPI = {
    RQUERY, PYFOLIO, PALETTE, DASHES, POSITIONS_MODE,
    loadCfg, saveCfg, fmtRange, qs, jget, bucketFor,
    currentRange, rangeQuery, withRange, ensureRangeUI, RANGE_PRESETS,
    getTz, setTz, tzOffsetMin, tzLabel, fmtClock, fmtAxis, bindTzSelect,
    fetchComposition, fetchFundList, fetchAllocations, fetchSleeveAggregated, fetchMeasured,
    fetchPortfolioVirtual, fetchSleeveResult, fetchVirtualFills, fetchIndicators, fetchOHLCV,
    fetchAccount, fetchSessions,
    latestIndicators, pctAbs, hasAggData, resetCards, failedOf,
    fetchAlphaPositions, fetchAlphaPositionsInstance, fetchAlphaPositionsSymbol, fetchBooks,
    fetchTrackingError, fetchTrackingErrorCurve, openBacktestReport, fetchEvents,
    fetchAlertChannels, fetchAlertRules,
    fmtBps, tierClass, teLabel, teLabelText, esc,
    dailyReturns, drawdown, sharpe, annVol, pctFrom, seriesFromRows,
    lineChart, chartMissing, baseOpts, fmt, sgn, alphaColor, bindConfigForm, urlParam,
    renderCfgSummary, hoursLabel, ensureSettingsUI, renderFundPicker,
    renderNav, NAV_TOOLS,
  };
})(window);

// nm_data.js — synthetic, deterministic sample data for the Neomanifold demo pages.
//
// 100% fabricated. No real accounts, keys, sessions, fills or traders are involved.
// Same convention as ../demo_data.js: a seeded PRNG (mulberry32) keeps every number
// stable across reloads so the showcase looks identical on every visit.
//
// Where a real fixture exists in the product's mock layer (mock.ts), it is seeded
// VERBATIM and marked; everything else is invented in the same shape.

const NM_DATA = (function () {
  'use strict';

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ── OHLCV candles ────────────────────────────────────────────────────────
  // Row shape is the real OhlcvRow: { datetime, open, high, low, close, volume }.
  // BTC ~118k is a plausible 2026 level; the walk is mean-reverting enough that
  // 240 one-minute candles stay in a believable intraday range (no moonshots).
  const FREQ_MS = { '1m': 60e3, '5m': 300e3, '15m': 900e3, '1h': 3600e3, '4h': 14400e3, '1d': 86400e3 };
  const START = Date.UTC(2026, 5, 13, 0, 0, 0); // 2026-06-13T00:00:00Z

  function candles(symbol, freq, n) {
    const step = FREQ_MS[freq] || FREQ_MS['1m'];
    // Seed off the symbol so BTCUSDT and ETHUSDT differ but each is stable.
    let h = 7;
    for (let i = 0; i < symbol.length; i++) h = Math.imul(h ^ symbol.charCodeAt(i), 16777619);
    const rnd = mulberry32(h >>> 0);
    const base = symbol.toUpperCase().startsWith('ETH') ? 3500 : 118000;
    const vol = base * 0.0006; // per-candle sigma

    const out = [];
    let price = base * (0.995 + rnd() * 0.01);
    for (let i = 0; i < n; i++) {
      const o = price;
      // slight pull toward base keeps a long window from drifting off-screen
      const drift = (base - o) * 0.0008;
      const c = o + drift + (rnd() - 0.5) * 2 * vol;
      const hi = Math.max(o, c) + rnd() * vol * 0.8;
      const lo = Math.min(o, c) - rnd() * vol * 0.8;
      out.push({
        datetime: new Date(START + i * step).toISOString(),
        open: o, high: hi, low: lo, close: c,
        volume: 0.2 + rnd() * 1.6,
      });
      price = c;
    }
    return out;
  }

  // /funding and /mcap: the real per-row columns are NOT defined anywhere in the
  // repo (they arrive from the upstream Crypto Data API straight into a DataFrame),
  // so these columns are invented — see the banner note on data.html.
  function funding(symbols, days) {
    const rows = [];
    symbols.forEach((sym, si) => {
      const rnd = mulberry32(4200 + si * 17);
      for (let d = 0; d < days; d++) {
        rows.push({
          datetime: new Date(START - (days - d) * 86400e3).toISOString().substring(0, 10),
          symbol: sym,
          funding_rate: (rnd() - 0.45) * 0.0004,
          mark_price: (sym.startsWith('ETH') ? 3500 : 118000) * (0.97 + rnd() * 0.06),
        });
      }
    });
    return rows;
  }

  function mcap(symbols, days) {
    const rows = [];
    symbols.forEach((sym, si) => {
      const rnd = mulberry32(8800 + si * 23);
      const cap = sym.startsWith('ETH') ? 4.2e11 : 2.33e12;
      for (let d = 0; d < days; d++) {
        rows.push({
          datetime: new Date(START - (days - d) * 86400e3).toISOString().substring(0, 10),
          symbol: sym,
          rank: sym.startsWith('ETH') ? 2 : 1,
          market_cap: cap * (0.92 + rnd() * 0.16),
        });
      }
    });
    return rows;
  }

  // ── Session log stream (format mirrors mock.ts:400-404, minus the '(mock)'
  //    prefix, which is mock-mode noise rather than product output) ──────────
  const LOG_LINES = [
    '2026-06-13 07:00:00 | INFO  | Strategy     | dev-user | spot | Starting portfolio strategy',
    '2026-06-13 07:00:01 | DEBUG | DataLoader   | dev-user | spot | Fetched ohlcv window=240 freq=1m',
    '2026-06-13 07:00:02 | INFO  | Strategy     | dev-user | spot | Target weights: BTCUSDT 0.5, ETHUSDT 0.5',
    '2026-06-13 07:00:03 | WARN  | Execution    | dev-user | spot | Partial fill, retrying remainder',
    '2026-06-13 07:00:05 | ERROR | Execution    | dev-user | spot | Order rejected: insufficient margin (retry 1/3)',
    '2026-06-13 07:00:06 | INFO  | Execution    | dev-user | spot | Rebalance complete',
    '2026-06-13 07:00:08 | DEBUG | Scheduler    | dev-user | spot | Next rebalancing scheduled 2026-06-13 15:00',
    '2026-06-13 07:00:11 | INFO  | Monitor      | dev-user | spot | PV recorded: 30012.44 USDT',
  ];

  // ── Community fixtures ───────────────────────────────────────────────────
  // Posts 1-2 are the REAL mock fixtures (mock.ts:473-484), verbatim.
  // The rest are invented in the same shape, with a mix of codeShared and at
  // least one negative pnlPct so the red number + red sparkline stroke render.
  const POSTS = [
    { id: 1, title: 'BTC Momentum Strategy', author: 'TopTrader', tradeType: 'spot', sharpe: 2.1, pnlPct: 34.5, mddPct: -8.2, likesCount: 12, copiesCount: 4, commentsCount: 3, createdAt: '2026-06-10', codeShared: true, liked: false },
    { id: 2, title: 'ETH Mean Reversion', author: 'AlphaHunter', tradeType: 'spot', sharpe: 1.8, pnlPct: 22.1, mddPct: -12.5, likesCount: 5, copiesCount: 2, commentsCount: 1, createdAt: '2026-06-08', codeShared: false, liked: false },
    { id: 3, title: 'Funding Carry (delta-neutral)', author: 'QuietTrader', tradeType: 'futures', sharpe: 2.4, pnlPct: 18.9, mddPct: -3.1, likesCount: 21, copiesCount: 9, commentsCount: 6, createdAt: '2026-06-12', codeShared: true, liked: false },
    { id: 4, title: 'Vol Breakout — 15m', author: 'CryptoKing', tradeType: 'futures', sharpe: 1.3, pnlPct: 41.2, mddPct: -19.7, likesCount: 17, copiesCount: 3, commentsCount: 8, createdAt: '2026-06-11', codeShared: false, liked: false },
    { id: 5, title: 'Marketcap Top-10 Rebalance', author: 'IndexGuy', tradeType: 'spot', sharpe: 1.1, pnlPct: 9.4, mddPct: -11.0, likesCount: 8, copiesCount: 6, commentsCount: 2, createdAt: '2026-06-09', codeShared: true, liked: false },
    { id: 6, title: 'RSI Dip Buyer', author: 'MeanRevKid', tradeType: 'spot', sharpe: -0.4, pnlPct: -6.8, mddPct: -22.3, likesCount: 2, copiesCount: 0, commentsCount: 4, createdAt: '2026-06-07', codeShared: true, liked: false },
    { id: 7, title: 'Keltner Trend Rider', author: 'TrendFollower', tradeType: 'futures', sharpe: 1.6, pnlPct: 27.3, mddPct: -14.1, likesCount: 11, copiesCount: 5, commentsCount: 0, createdAt: '2026-06-06', codeShared: false, liked: false },
    { id: 8, title: 'MACD Cross + Volume Filter', author: 'SignalSmith', tradeType: 'spot', sharpe: 0.9, pnlPct: 5.2, mddPct: -9.9, likesCount: 3, copiesCount: 1, commentsCount: 1, createdAt: '2026-06-05', codeShared: true, liked: false },
    { id: 9, title: 'Stochastic Scalper (1m)', author: 'FastHands', tradeType: 'futures', sharpe: 0.6, pnlPct: -2.1, mddPct: -16.4, likesCount: 1, copiesCount: 0, commentsCount: 2, createdAt: '2026-06-04', codeShared: false, liked: false },
  ];

  // Equity curves: emitted as { date, value } — MiniEquityCurve reads d.value.
  // (The real mock emits {t,v}, so its sparkline silently renders nothing. That
  // is a mock-layer bug, not a design; do not reproduce it.)
  function withCurves() {
    return POSTS.map((p, i) => {
      const rnd = mulberry32(1000 + i * 31);
      const n = 30, pts = [];
      let v = 100;
      // land the curve's end near the post's advertised pnlPct so the sparkline
      // agrees with the number printed next to it
      const target = 100 * (1 + p.pnlPct / 100);
      for (let k = 0; k < n; k++) {
        const pull = (target - v) * (1 / (n - k));
        v = v + pull + (rnd() - 0.5) * 2.4;
        pts.push({ date: new Date(START - (n - k) * 86400e3).toISOString().substring(0, 10), value: v });
      }
      return Object.assign({}, p, { equityCurve: pts });
    });
  }

  // Leaderboard rows 1-3 are the REAL mock fixtures (mock.ts:529-533), verbatim.
  const LEADERBOARD = [
    { trader: 'TraderAlpha', strategy: 'BTC Trend',    pnlPct: 55.2, sharpe: 2.8, mddPct: -4.1 },
    { trader: 'CryptoKing',  strategy: 'Multi-Asset',  pnlPct: 41.0, sharpe: 2.1, mddPct: -9.3 },
    { trader: 'QuietTrader', strategy: 'Mean Rev ETH', pnlPct: 28.5, sharpe: 1.6, mddPct: -6.7 },
    { trader: 'TopTrader',   strategy: 'BTC Momentum', pnlPct: 24.9, sharpe: 2.0, mddPct: -8.2 },
    { trader: 'IndexGuy',    strategy: 'Top-10 Index', pnlPct: 16.3, sharpe: 1.2, mddPct: -11.0 },
    { trader: 'SignalSmith', strategy: 'MACD Cross',   pnlPct: 11.7, sharpe: 0.9, mddPct: -9.9 },
    { trader: 'FastHands',   strategy: 'Scalper 1m',   pnlPct: 4.4,  sharpe: 0.5, mddPct: -16.4 },
    { trader: 'MeanRevKid',  strategy: 'RSI Dip',      pnlPct: -6.8, sharpe: -0.4, mddPct: -22.3 },
  ];

  return { candles, funding, mcap, logLines: () => LOG_LINES.slice(), posts: withCurves, leaderboard: () => LEADERBOARD.slice() };
})();

// demo_data.js — Synthetic, deterministic sample data for the NeoMatrix demo dashboards.
//
// 100% fabricated. No real accounts, keys, fills or balances are involved.
// A seeded PRNG (mulberry32) keeps every number stable across reloads so the
// showcase looks the same every visit. Shared by portfolio.html / grid.html / strategy.html.
//
// Realism notes (so the numbers look like a real crypto book, not a scam):
//   - Strategies share a common market factor (beta) → they are correlated, so the
//     aggregate Sharpe does not inflate the way independent random walks would.
//   - Targets (met): portfolio Sharpe ~1.6, annualized vol ~42%, MDD ~ -16%,
//     ROE over the 90-day window ~ +18%. Benchmarks (BTC/TOP5) are weaker.
//   - 30d-rolling Sharpe is warmed up (null until the window fills) and clamped to
//     ±5 (the plausible extreme for a real book) so it never shows a fake spike.
//   - Symbol prices use realistic 2026 levels (BTC ~68k, ADA ~$0.45, etc.).

const DEMO = (function () {
    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const N_DAYS = 90;
    const END = new Date(Date.UTC(2026, 4, 31)); // fixed "today" = 2026-05-31

    function dateLabels(n) {
        const out = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(END.getTime() - i * 86400000);
            out.push(d.toISOString().substring(0, 10));
        }
        return out;
    }

    // ── Shared market factor (the "crypto beta" every strategy partially rides) ──
    // Demeaned to an exact target drift so the realized return is controllable
    // (a raw random walk's realized mean drifts away from intent over only 90 samples).
    const MARKET_DRIFT = 0.0006;
    const MARKET = (function () {
        const rnd = mulberry32(12345);
        const raw = [];
        for (let i = 0; i < N_DAYS; i++) raw.push((rnd() - 0.5) * 2 * 0.050);
        const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
        return raw.map(x => x - mean + MARKET_DRIFT);
    })();

    // Strategy roster — shared identity across all three pages.
    // alpha = idiosyncratic daily drift, beta = market exposure, idio = idiosyncratic daily vol.
    const ROSTER = [
        { id: 'ex-a', label: 'Example Alpha A', type: 'futures', env: 'demo', exch: 'bitget', seed: 101, alpha: 0.0009, beta: 0.55, idio: 0.014, leverage: 3 },
        { id: 'ex-b', label: 'Example Alpha B', type: 'futures', env: 'demo', exch: 'bitget', seed: 202, alpha: 0.0006, beta: 0.35, idio: 0.012, leverage: 2 },
        { id: 'ex-c', label: 'Example Alpha C', type: 'spot',    env: 'demo', exch: 'bitget', seed: 303, alpha: 0.0004, beta: 0.15, idio: 0.008, leverage: 1 },
        { id: 'ex-d', label: 'Example Alpha D', type: 'futures', env: 'demo', exch: 'bitget', seed: 404, alpha: 0.0010, beta: 0.70, idio: 0.016, leverage: 4 },
        { id: 'ex-e', label: 'Example Alpha E', type: 'spot',    env: 'demo', exch: 'bitget', seed: 505, alpha: 0.0007, beta: 0.45, idio: 0.013, leverage: 1 },
    ];

    const START_EQUITY = { 'ex-a': 1050, 'ex-b': 1000, 'ex-c': 950, 'ex-d': 1020, 'ex-e': 980 };

    // Realistic 2026 symbol prices.
    const PRICES = {
        BTCUSDT: 68000, ETHUSDT: 3500, SOLUSDT: 150, BNBUSDT: 600, XRPUSDT: 0.55,
        ADAUSDT: 0.45, AVAXUSDT: 35, LINKUSDT: 18, DOGEUSDT: 0.16, TONUSDT: 6.5,
    };
    const UNIVERSE = Object.keys(PRICES);

    function equityCurve(strat, n, start) {
        const rnd = mulberry32(strat.seed);
        const pv = [];
        let v = start;
        for (let i = 0; i < n; i++) {
            const idio = (rnd() - 0.5) * 2 * strat.idio;
            const ret = strat.alpha + strat.beta * MARKET[i] + idio;
            v = v * (1 + ret);
            pv.push(v);
        }
        return pv;
    }

    const drawdownSeries = pv => { let pk = -Infinity; return pv.map(v => { pk = Math.max(pk, v); return (v / pk - 1) * 100; }); };
    const dailyReturns = pv => { const r = []; for (let i = 1; i < pv.length; i++) r.push(pv[i] / pv[i - 1] - 1); return r; };

    function _stats(s) {
        const mean = s.reduce((a, b) => a + b, 0) / s.length;
        const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length) || 1e-9;
        return { mean, sd };
    }
    const annSharpe = ret => { const { mean, sd } = _stats(ret); return (mean / sd) * Math.sqrt(365); };
    const annVol = ret => _stats(ret).sd * Math.sqrt(365) * 100;
    // A 30d rolling metric is only defined once the window is full — before that the
    // window has 1-2 points and sd≈0, which makes mean/sd explode (the old 1e8 spike).
    // Return null during warm-up (Chart.js renders it as a clean gap) and clamp the
    // Sharpe to a realistic band so a rare low-vol window can't produce a fake extreme.
    function rollingSharpe(ret, win) {
        return ret.map((_, i) => {
            if (i < win - 1) return null;
            const { mean, sd } = _stats(ret.slice(i - win + 1, i + 1));
            return Math.max(-5, Math.min(5, (mean / sd) * Math.sqrt(365)));
        });
    }
    function rollingVol(ret, win) {
        return ret.map((_, i) => {
            if (i < win - 1) return null;
            return _stats(ret.slice(i - win + 1, i + 1)).sd * Math.sqrt(365) * 100;
        });
    }

    function buildStrategy(strat) {
        const n = N_DAYS;
        const start = START_EQUITY[strat.id];
        const pv = equityCurve(strat, n, start);
        const ret = dailyReturns(pv);
        const dd = drawdownSeries(pv);
        const equity = pv[pv.length - 1];
        const rnd = mulberry32(strat.seed + 7);
        const margin = strat.type === 'spot' ? equity * (0.55 + rnd() * 0.25) : equity * (0.30 + rnd() * 0.30);
        const pnl = (rnd() - 0.40) * equity * 0.05;
        return {
            ...strat, pv, ret, dd, equity, margin, pnl,
            available: equity - margin, deposits: start,
            roe: (equity / start - 1) * 100,
            sharpe: annSharpe(ret), vol: annVol(ret), mdd: Math.min(...dd),
            since: dateLabels(n)[0],
        };
    }

    let _cache = null;
    const build = () => (_cache || (_cache = ROSTER.map(buildStrategy)));

    // Benchmark curves — weaker than the portfolio (lower Sharpe, deeper drawdowns).
    function benchCurve(seed, betaToMarket, idioVol, n, start) {
        const rnd = mulberry32(seed);
        const pv = [start];
        for (let i = 1; i < n; i++) pv.push(pv[i - 1] * (1 + 0.0002 + betaToMarket * MARKET[i] + (rnd() - 0.5) * 2 * idioVol));
        return pv;
    }

    function portfolio() {
        const S = build();
        const dates = dateLabels(N_DAYS);
        const aggPV = dates.map((_, i) => S.reduce((a, s) => a + s.pv[i], 0));
        const aggRet = dailyReturns(aggPV);
        const aggDD = drawdownSeries(aggPV);

        const btcPV = benchCurve(9001, 1.0, 0.012, N_DAYS, 30000);
        const top5PV = benchCurve(9002, 0.9, 0.010, N_DAYS, 30000);
        const btcRet = dailyReturns(btcPV), top5Ret = dailyReturns(top5PV);

        const totalDeposits = S.reduce((a, s) => a + s.deposits, 0);
        const finalPV = aggPV[aggPV.length - 1];

        // Cumulative-return % vs benchmarks (real panel: "Portfolio Return vs Benchmark (%)").
        const cumRet = pv => pv.map(v => (v / pv[0] - 1) * 100);
        // Aggregate gross-exposure ratio % (real panel: "Gross Exposure Ratio (%)") — a
        // single line for a leveraged multi-strategy book, oscillating ~85-135%.
        const expRatio = aggPV.map((_, i) => 110 + Math.sin(i / 8) * 18 + (mulberry32(7777 + i)() - 0.5) * 14);

        return {
            strategies: S.map(s => ({ id: s.id, label: s.label, type: s.type, env: s.env, exch: s.exch, equity: s.equity, margin: s.margin, pnl: s.pnl, sharpe: s.sharpe, vol: s.vol, mdd: s.mdd, since: s.since })),
            dates,
            pv: aggPV.map(v => Math.round(v)),
            returnPct: { port: cumRet(aggPV), btc: cumRet(btcPV), top5: cumRet(top5PV) },
            dd: { port: aggDD, btc: drawdownSeries(btcPV), top5: drawdownSeries(top5PV) },
            exposureRatio: expRatio,
            perStrategyPV: S.map(s => ({ label: s.label, pv: s.pv.map(v => Math.round(v)) })),
            sharpe: { port: rollingSharpe(aggRet, 30), btc: rollingSharpe(btcRet, 30), top5: rollingSharpe(top5Ret, 30) },
            vol: { port: rollingVol(aggRet, 30), btc: rollingVol(btcRet, 30), top5: rollingVol(top5Ret, 30) },
            metrics: {
                pv: finalPV,
                pnl: S.reduce((a, s) => a + s.pnl, 0),
                margin: S.reduce((a, s) => a + s.margin, 0),
                avail: S.reduce((a, s) => a + s.available, 0),
                deposits: totalDeposits,
                roe: (finalPV / totalDeposits - 1) * 100,
                sharpe: annSharpe(aggRet), vol: annVol(aggRet), mdd: Math.min(...aggDD),
                bmSharpeBTC: annSharpe(btcRet), bmSharpeTOP5: annSharpe(top5Ret),
                bmVolBTC: annVol(btcRet), bmVolTOP5: annVol(top5Ret),
                bmMddBTC: Math.min(...drawdownSeries(btcPV)), bmMddTOP5: Math.min(...drawdownSeries(top5PV)),
            },
        };
    }

    function grid() {
        const S = build();
        // Benchmark (BTC) cumulative-return % over the same window — the real grid shows
        // each strategy as "Portfolio Return vs Benchmark (%)".
        const btcPV = benchCurve(9001, 1.0, 0.012, N_DAYS, 30000);
        const top5PV = benchCurve(9002, 0.9, 0.010, N_DAYS, 30000);
        const btcRet = btcPV.map(v => (v / btcPV[0] - 1) * 100);
        const top5Ret = top5PV.map(v => (v / top5PV[0] - 1) * 100);
        return {
            dates: dateLabels(N_DAYS),
            benchmarkReturn: btcRet,
            top5Return: top5Ret,
            strategies: S.map(s => ({
                id: s.id, label: s.label, type: s.type, env: s.env,
                pv: s.pv, roe: s.roe, sharpe: s.sharpe, mdd: s.mdd, equity: s.equity, pnl: s.pnl, since: s.since,
                returnPct: s.pv.map(v => (v / s.pv[0] - 1) * 100),
            })),
        };
    }

    function _fmtDt(ms) { return new Date(ms).toISOString().substring(0, 16).replace('T', ' '); }

    function strategy(id) {
        const S = build();
        const s = S.find(x => x.id === id) || S[0];
        const dates = dateLabels(N_DAYS);
        const rnd = mulberry32(s.seed + 33);

        // ── Open positions ──
        const nPos = 4 + Math.floor(rnd() * 4);
        const positions = [];
        const used = new Set();
        for (let i = 0; i < nPos; i++) {
            let sym; do { sym = UNIVERSE[Math.floor(rnd() * UNIVERSE.length)]; } while (used.has(sym));
            used.add(sym);
            const side = s.type === 'spot' ? 'long' : (rnd() > 0.5 ? 'long' : 'short');
            const notional = s.equity * (0.06 + rnd() * 0.20);
            const lev = s.type === 'spot' ? 1 : s.leverage;
            const pnl = (rnd() - 0.40) * notional * 0.07;
            const mark = PRICES[sym] * (1 + (rnd() - 0.5) * 0.06);
            positions.push({ symbol: sym, side, notional, margin: notional / lev, leverage: lev, markPrice: mark, qty: notional / mark, pnl, roe: pnl / (notional / lev) * 100 });
        }
        const grossExposure = positions.reduce((a, p) => a + p.notional, 0);
        const usedMargin = positions.reduce((a, p) => a + p.margin, 0);
        const unrealized = positions.reduce((a, p) => a + p.pnl, 0);
        const exposureRatio = grossExposure / s.equity * 100;

        // ── Symbol weight distributions (for the piecharts) ──
        const wAll = positions.map(p => ({ symbol: p.symbol, weight: p.notional / grossExposure * 100 }));
        const wLong = positions.filter(p => p.side === 'long').map(p => ({ symbol: p.symbol, weight: p.notional }));
        const wShort = positions.filter(p => p.side === 'short').map(p => ({ symbol: p.symbol, weight: p.notional }));

        // ── Rebalancing schedule (synthetic) ──
        const intervalH = s.type === 'spot' ? 8 : [4, 6, 8][Math.floor(rnd() * 3)];
        const lastReb = END.getTime() - (rnd() * intervalH * 0.5) * 3600000;
        const nextReb = lastReb + intervalH * 3600000;
        const firstReb = new Date(s.since + 'T00:00:00Z').getTime();
        const sessionId = s.since.replace(/-/g, '').substring(2) + '0900';

        // ── Time series (mirror the 8 timeseries panels) ──
        const benchPV = benchCurve(9001, 1.0, 0.012, N_DAYS, 30000);
        const top5PV = benchCurve(9002, 0.9, 0.010, N_DAYS, 30000);
        const benchRet = benchPV.map(v => (v / benchPV[0] - 1) * 100);
        const top5Ret = top5PV.map(v => (v / top5PV[0] - 1) * 100);
        const benchDR = dailyReturns(benchPV), top5DR = dailyReturns(top5PV);
        const cumReturn = s.pv.map(v => (v / s.pv[0] - 1) * 100);
        const grossExpRatioTs = s.pv.map((_, i) => exposureRatio + Math.sin(i / 6) * 6 + (mulberry32(s.seed + i)() - 0.5) * 8);
        const netProfitPerMin = s.ret.map(r => r * s.equity); // approximate per-cycle profit
        const sharpeTs = rollingSharpe(s.ret, 30);
        const volTs = rollingVol(s.ret, 30);

        // ── Historical positions & transactions (limit 20) ──
        const histPositions = [];
        for (let i = 0; i < 18; i++) {
            const p = positions[Math.floor(rnd() * positions.length)];
            const open = END.getTime() - (i + 1) * intervalH * 3600000 - rnd() * 3600000;
            const close = open + (1 + rnd() * 5) * 3600000;
            const realized = (rnd() - 0.42) * p.notional * 0.09;
            histPositions.push({ symbol: p.symbol, side: p.side, openTime: _fmtDt(open), closeTime: _fmtDt(close), pnl: realized, roe: realized / p.margin * 100 });
        }
        const transactions = [];
        for (let i = 0; i < 20; i++) {
            const p = positions[Math.floor(rnd() * positions.length)];
            const side = rnd() > 0.5 ? 'buy' : 'sell';
            const price = PRICES[p.symbol] * (1 + (rnd() - 0.5) * 0.05);
            const value = s.equity * (0.02 + rnd() * 0.10);
            const t = END.getTime() - i * 3600000 * (1 + Math.floor(rnd() * 4));
            transactions.push({ time: _fmtDt(t), symbol: p.symbol, side, price, qty: value / price, value });
        }
        transactions.sort((a, b) => (a.time < b.time ? 1 : -1));

        return {
            meta: {
                id: s.id, label: s.label, type: s.type, env: s.env, since: s.since, leverage: s.leverage,
                strategyName: s.id.replace(/-/g, '_'), sessionId,
                startTime: s.since + ' 09:00', endDate: dateLabels(1)[0] + ' 00:00',
                interval: intervalH + 'h',
                firstReb: _fmtDt(firstReb), lastReb: _fmtDt(lastReb), nextReb: _fmtDt(nextReb),
            },
            account: { equity: s.equity, available: s.available, usedMargin, unrealized, grossExposure, exposureRatio, deposits: s.deposits },
            dates,
            pv: s.pv.map(v => Math.round(v)), dd: s.dd,
            ddBench: { btc: drawdownSeries(benchPV), top5: drawdownSeries(top5PV) },
            ts: {
                benchRet, top5Ret, cumReturn, grossExpRatio: grossExpRatioTs, netProfitPerMin,
                sharpe: sharpeTs, benchSharpe: rollingSharpe(benchDR, 30), top5Sharpe: rollingSharpe(top5DR, 30),
                vol: volTs, benchVol: rollingVol(benchDR, 30), top5Vol: rollingVol(top5DR, 30),
            },
            metrics: { equity: s.equity, pnl: unrealized, margin: usedMargin, available: s.available, roe: s.roe, sharpe: s.sharpe, vol: s.vol, mdd: s.mdd, deposits: s.deposits },
            positions, symbolWeights: { all: wAll, long: wLong, short: wShort },
            histPositions, transactions,
        };
    }

    // ── Synthetic OHLC candles for the Candlestick tab (per strategy, BTCUSDT 1m-ish) ──
    function candles(id) {
        const s = ROSTER.find(x => x.id === id) || ROSTER[0];
        const rnd = mulberry32(s.seed + 71);
        const out = [];
        let price = PRICES.BTCUSDT * (0.96 + rnd() * 0.08);
        const n = 120;
        for (let i = 0; i < n; i++) {
            const o = price;
            const drift = (rnd() - 0.48) * 0.004;
            const c = o * (1 + drift);
            const hi = Math.max(o, c) * (1 + rnd() * 0.0025);
            const lo = Math.min(o, c) * (1 - rnd() * 0.0025);
            const v = 20 + rnd() * 180;
            out.push({ i, o, h: hi, l: lo, c, v });
            price = c;
        }
        return out;
    }

    // ── Synthetic structured logs, grouped by component (mirrors the 5 log panels:
    //    Strategy Execution / CrashGuard / Finwatcher / Scheduler / API). ──
    const LOG_MSGS = {
        Strategy: ['Rebalancing cycle started', 'Strategy executed: {n} target weights computed',
            'order_queue: {n} orders inserted', 'Phase 1 complete: {n}/{n} orders filled',
            'Phase 2 complete: SL/TP set on {n} symbols', 'state=strategy_done'],
        CrashGuard: ['CrashGuard check: no action', 'snapshot_positions: {n} positions',
            'scale=1.0 (no breach)', 'crashNextTime advanced', 'user crashguard() returned None'],
        Finwatcher: ['Finwatcher cycle: PV recorded', 'futures result_1min: {n} rows inserted',
            'portfolio_result_1min upserted', 'indicator_result computed', 'elapsed {n}.2s'],
        Scheduler: ['get_due_users: {n} due', 'Strategy-Main Job created', 'advisory lock acquired',
            'next rebalancing scheduled', 'standby (lock held by another instance)'],
        API: ['POST /run-system 200', 'session UPSERT ok', 'snapshot created',
            'GET /session-check 200', 'config validated (7 steps)'],
    };
    function logs(id) {
        const s = ROSTER.find(x => x.id === id) || ROSTER[0];
        const out = {};
        Object.keys(LOG_MSGS).forEach((comp, ci) => {
            const rnd = mulberry32(s.seed + 91 + ci * 13);
            const lines = [];
            let t = END.getTime();
            const n = comp === 'Strategy' ? 16 : (comp === 'API' ? 8 : 12);
            for (let i = 0; i < n; i++) {
                t -= (60 + rnd() * 600) * 1000;
                const lvl = rnd() > 0.9 ? 'WARN' : 'INFO';
                const msg = LOG_MSGS[comp][Math.floor(rnd() * LOG_MSGS[comp].length)].replace(/\{n\}/g, () => 1 + Math.floor(rnd() * 8));
                lines.push({ time: new Date(t).toISOString().substring(0, 19).replace('T', ' '), level: lvl, component: comp, strategy: s.id, type: s.type, msg });
            }
            out[comp] = lines;
        });
        return out;
    }

    return { portfolio, grid, strategy, candles, logs, roster: () => ROSTER.map(r => ({ id: r.id, label: r.label })) };
})();

// compositor_data.js — Synthetic, deterministic sample data for the v3 compositor
// (Fund > Portfolio > Alpha) preview dashboards.
//
// 100% fabricated. No real accounts, keys, fills or balances are involved.
// Same conventions as demo_data.js: a seeded PRNG (mulberry32) keeps every number
// stable across reloads. Shared by fund.html / fund_portfolio_grid.html /
// fund_portfolio.html / fund_alpha_grid.html / fund_alpha.html.
//
// The whole point of the compositor preview is that the numbers ADD UP, so this
// module enforces the v3 accounting identities exactly, by construction:
//   1. sum(instance PV)                    == portfolio virtual PV      (per portfolio)
//   2. sum(portfolio virtual PV) + cash    == fund virtual PV
//   3. fund virtual PV + operating cost    == measured (real) PV        (recon: L-P)
//   4. same alpha, any portfolio           == same %-return curve
// Identity 4 is a v3 model fact: the signal (weights) is computed once per UNIQUE
// alpha (union-cycle dedup, alpha-level forward state), and every instance fills
// the same weights at the same prices — so instances of one alpha differ only in
// SCALE (allocated capital, absolute PnL/turnover, allocation history), never in
// shape. That is why the alpha dashboard is keyed by unique alpha, with instances
// as a table inside it.
//
// Reallocation is virtual (no real transfers): on the reallocation day the fund
// total is re-sliced to the new weights — instance PV steps, the fund line doesn't.
// Risk metrics (Sharpe / vol / MDD) are computed on FLOW-ADJUSTED return streams,
// so the reallocation capital step never reads as a fake gain or drawdown.
// Turnover is reported as % of average allocated capital (cumulative over the window).

const COMP = (function () {
    function mulberry32(seed) {
        return function () {
            seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    const N_DAYS = 90;
    const END = new Date(Date.UTC(2026, 4, 31)); // fixed "today" = 2026-05-31 (same as demo_data.js)
    const FUND_CAPITAL = 250000;                  // USDT — one real account
    const REALLOC_DAY = 45;                       // the one mid-window virtual reallocation

    function dateLabels(n) {
        const out = [];
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(END.getTime() - i * 86400000);
            out.push(d.toISOString().substring(0, 10));
        }
        return out;
    }
    const DATES = dateLabels(N_DAYS);
    const fmtDt = ms => new Date(ms).toISOString().substring(0, 16).replace('T', ' ');

    // ── Shared market factor (demeaned to a controlled drift) ──
    const MARKET_DRIFT = 0.0006;
    const MARKET = (function () {
        const rnd = mulberry32(24601);
        const raw = [];
        for (let i = 0; i < N_DAYS; i++) raw.push((rnd() - 0.5) * 2 * 0.045);
        const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
        return raw.map(x => x - mean + MARKET_DRIFT);
    })();

    // ── Alpha Pool — unique alphas (one entry per strategy NAME, v3 rule) ──
    const ALPHAS = [
        { id: 'mom',   label: 'Momentum',       color: '#4e79a7', seed: 11, alpha: 0.0011, beta: 0.55, idio: 0.013, tradesPerDay: 10, freq: '15m / 4h rebal', cycleH: 4 },
        { id: 'mr',    label: 'Mean Reversion', color: '#f28e2b', seed: 22, alpha: 0.0007, beta: 0.20, idio: 0.010, tradesPerDay: 26, freq: '1m / 1h rebal',  cycleH: 1 },
        { id: 'carry', label: 'Funding Carry',  color: '#59a14f', seed: 33, alpha: 0.0005, beta: 0.10, idio: 0.006, tradesPerDay: 3,  freq: '1d rebal',       cycleH: 24 },
        { id: 'btct',  label: 'BTC Trend',      color: '#e15759', seed: 44, alpha: 0.0009, beta: 0.75, idio: 0.015, tradesPerDay: 6,  freq: '1h / 8h rebal',  cycleH: 8 },
        { id: 'volb',  label: 'Vol Breakout',   color: '#b07aa1', seed: 55, alpha: 0.0008, beta: 0.40, idio: 0.014, tradesPerDay: 14, freq: '5m / 2h rebal',  cycleH: 2 },
    ];
    const ALPHA_BY_ID = Object.fromEntries(ALPHAS.map(a => [a.id, a]));

    // Characteristic books per alpha (realistic 2026 price levels, same as demo_data.js).
    const PRICES = {
        BTCUSDT: 68000, ETHUSDT: 3500, SOLUSDT: 150, BNBUSDT: 600, XRPUSDT: 0.55,
        ADAUSDT: 0.45, AVAXUSDT: 35, LINKUSDT: 18, DOGEUSDT: 0.16, TONUSDT: 6.5,
    };
    const ALPHA_SYMBOLS = {
        mom:   ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'LINKUSDT', 'AVAXUSDT'],
        mr:    ['ETHUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'TONUSDT'],
        carry: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
        btct:  ['BTCUSDT'],
        volb:  ['SOLUSDT', 'AVAXUSDT', 'DOGEUSDT', 'LINKUSDT'],
    };

    // One shared daily-return stream per unique alpha. Identity 4: every instance
    // of an alpha rides EXACTLY this stream — no per-portfolio noise, because the
    // signal is computed once per unique alpha and virtual fills share price & time.
    const ALPHA_RET = (function () {
        const out = {};
        ALPHAS.forEach(a => {
            const rnd = mulberry32(a.seed * 1000 + 7);
            out[a.id] = MARKET.map(mkt => a.alpha + a.beta * mkt + (rnd() - 0.5) * 2 * a.idio);
        });
        return out;
    })();

    // ── Portfolios (2nd-layer allocation targets) + instances (1st layer) ──
    // w0 = weight before the reallocation, w1 = after. Unallocated residue = virtual cash.
    const PORTFOLIOS = [
        {
            id: 'pf-core', label: 'Core Momentum', alloc0: 0.45, alloc1: 0.38,
            instances: [
                { alpha: 'mom',  w0: 0.40, w1: 0.35 },
                { alpha: 'btct', w0: 0.35, w1: 0.35 },
                { alpha: 'volb', w0: 0.25, w1: 0.30 },
            ],
        },
        {
            id: 'pf-carry', label: 'Defensive Carry', alloc0: 0.35, alloc1: 0.33,
            instances: [
                { alpha: 'carry', w0: 0.50, w1: 0.50 },
                { alpha: 'mr',    w0: 0.30, w1: 0.30 },
                { alpha: 'mom',   w0: 0.20, w1: 0.20 },   // same alpha as pf-core → same curve, different scale
            ],
        },
        {
            id: 'pf-tail', label: 'Tail Hedge', alloc0: 0.15, alloc1: 0.22,
            instances: [
                { alpha: 'volb', w0: 0.60, w1: 0.55 },    // same alpha as pf-core
                { alpha: 'btct', w0: 0.40, w1: 0.45 },    // same alpha as pf-core
            ],
        },
    ];
    const CASH_W0 = 0.05, CASH_W1 = 0.07; // §"nothing hidden": the unallocated slice is a visible virtual-cash row

    let _cache = null;
    function build() {
        if (_cache) return _cache;

        // Instance state: current virtual capital (PV), plus per-day series.
        const inst = [];
        PORTFOLIOS.forEach((pf, pi) => {
            pf.instances.forEach(it => {
                inst.push({
                    pfId: pf.id, pfLabel: pf.label, pfIdx: pi,
                    alphaId: it.alpha, alpha: ALPHA_BY_ID[it.alpha],
                    w0: it.w0, w1: it.w1,
                    pv: [], trades: [], turnover: [],
                    cur: FUND_CAPITAL * pf.alloc0 * it.w0,
                    cumPnl: 0,
                });
            });
        });

        let cash = FUND_CAPITAL * CASH_W0;
        const cashPV = [];
        const pfPV = PORTFOLIOS.map(() => []);
        const pfRet = PORTFOLIOS.map(() => []);   // flow-adjusted daily returns per portfolio
        const pfCap = PORTFOLIOS.map(() => []);   // allocated-capital reference line (steps at realloc)
        let pfCapNow = PORTFOLIOS.map(pf => FUND_CAPITAL * pf.alloc0);
        const virtualPV = [], measuredPV = [], cumOpCostArr = [];
        let cumOpCost = 0;
        const tradeRnd = mulberry32(31415);

        for (let i = 0; i < N_DAYS; i++) {
            // Virtual reallocation (F20): re-slice the fund total to the new weights.
            // No real transfer happens — the fund line stays continuous, instances step.
            if (i === REALLOC_DAY) {
                const total = inst.reduce((a, s) => a + s.cur, 0) + cash;
                cash = total * CASH_W1;
                inst.forEach(s => {
                    const pf = PORTFOLIOS[s.pfIdx];
                    s.cur = total * pf.alloc1 * s.w1;
                });
                pfCapNow = PORTFOLIOS.map(pf => total * pf.alloc1);
            }

            const pfPrev = PORTFOLIOS.map((_, pi) => inst.filter(s => s.pfIdx === pi).reduce((a, s) => a + s.cur, 0));
            const pfPnlDay = PORTFOLIOS.map(() => 0);

            let dayTurnover = 0;
            inst.forEach(s => {
                const r = ALPHA_RET[s.alphaId][i];       // Identity 4: the shared alpha stream, exactly
                const prev = s.cur;
                s.cur = prev * (1 + r);
                const pnlDay = s.cur - prev;
                s.cumPnl += pnlDay;
                pfPnlDay[s.pfIdx] += pnlDay;
                s.pv.push(s.cur);
                // Trade activity: count scales with the alpha's cadence, turnover with capital.
                const n = Math.max(1, Math.round(s.alpha.tradesPerDay * (0.6 + tradeRnd() * 0.8)));
                const to = s.cur * (0.05 + tradeRnd() * 0.25) * (n / s.alpha.tradesPerDay);
                s.trades.push(n);
                s.turnover.push(to);
                dayTurnover += to;
            });

            PORTFOLIOS.forEach((pf, pi) => {
                pfPV[pi].push(inst.filter(s => s.pfIdx === pi).reduce((a, s) => a + s.cur, 0));
                pfRet[pi].push(pfPnlDay[pi] / pfPrev[pi]);   // flow-free (pfPrev is post-realloc)
                pfCap[pi].push(pfCapNow[pi]);
            });
            cashPV.push(cash);

            const v = inst.reduce((a, s) => a + s.cur, 0) + cash;
            virtualPV.push(v);

            // Operating cost (fees + slippage + funding timing) — proportional to turnover.
            // Identity 3: measured == virtual + cumOpCost (opCost < 0). Nothing hidden.
            cumOpCost += -dayTurnover * 0.00045;
            cumOpCostArr.push(cumOpCost);
            measuredPV.push(v + cumOpCost);
        }

        _cache = { inst, cash, cashPV, pfPV, pfRet, pfCap, virtualPV, measuredPV, cumOpCostArr };
        return _cache;
    }

    // ── Metrics helpers (same math as demo_data.js) ──
    const dailyReturns = pv => { const r = []; for (let i = 1; i < pv.length; i++) r.push(pv[i] / pv[i - 1] - 1); return r; };
    const drawdownSeries = pv => { let pk = -Infinity; return pv.map(v => { pk = Math.max(pk, v); return (v / pk - 1) * 100; }); };
    function _stats(s) {
        const mean = s.reduce((a, b) => a + b, 0) / s.length;
        const sd = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / s.length) || 1e-9;
        return { mean, sd };
    }
    const annSharpe = ret => { const { mean, sd } = _stats(ret); return (mean / sd) * Math.sqrt(365); };
    const annVol = ret => _stats(ret).sd * Math.sqrt(365) * 100;
    // Cumulative % return since inception, robust to the virtual-reallocation capital
    // step: chain daily returns instead of dividing PV by PV[0].
    const chainPct = ret => { const out = []; let c = 1; ret.forEach(r => { c *= (1 + r); out.push((c - 1) * 100); }); return out; };
    const chainIndex = ret => { const out = []; let c = 1; ret.forEach(r => { c *= (1 + r); out.push(c); }); return out; };
    // Flow-adjusted MDD: drawdown of the chained return index, not of the raw PV
    // (a reallocation capital step must never read as a gain or a drawdown).
    const chainMdd = ret => Math.min(...drawdownSeries(chainIndex(ret)));
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

    // ── Allocation history (append-only batches, 2 layers — mirrors the real fund.html view ④) ──
    const d = i => DATES[i];
    const ALLOC_PORTFOLIO = [
        {
            ts: d(0) + ' 00:00', layer: 'portfolio', reason: 'Initial allocation — fund launch',
            rows: [
                { target: 'Core Momentum', before: null, after: 45 },
                { target: 'Defensive Carry', before: null, after: 35 },
                { target: 'Tail Hedge', before: null, after: 15 },
                { target: 'Virtual Cash (unallocated)', before: null, after: 5 },
            ],
        },
        {
            ts: d(REALLOC_DAY) + ' 00:05', layer: 'portfolio', reason: 'Q2 risk review — trim core momentum, extend tail hedge into the summer chop',
            rows: [
                { target: 'Core Momentum', before: 45, after: 38 },
                { target: 'Defensive Carry', before: 35, after: 33 },
                { target: 'Tail Hedge', before: 15, after: 22 },
                { target: 'Virtual Cash (unallocated)', before: 5, after: 7 },
            ],
        },
    ];
    const ALLOC_SLEEVE = [
        {
            ts: d(0) + ' 00:00', layer: 'alpha', portfolio: 'Core Momentum', reason: 'Initial allocation',
            rows: [
                { target: 'Momentum', before: null, after: 40 },
                { target: 'BTC Trend', before: null, after: 35 },
                { target: 'Vol Breakout', before: null, after: 25 },
            ],
        },
        {
            ts: d(0) + ' 00:00', layer: 'alpha', portfolio: 'Defensive Carry', reason: 'Initial allocation',
            rows: [
                { target: 'Funding Carry', before: null, after: 50 },
                { target: 'Mean Reversion', before: null, after: 30 },
                { target: 'Momentum', before: null, after: 20 },
            ],
        },
        {
            ts: d(0) + ' 00:00', layer: 'alpha', portfolio: 'Tail Hedge', reason: 'Initial allocation',
            rows: [
                { target: 'Vol Breakout', before: null, after: 60 },
                { target: 'BTC Trend', before: null, after: 40 },
            ],
        },
        {
            ts: d(REALLOC_DAY) + ' 00:05', layer: 'alpha', portfolio: 'Core Momentum', reason: 'Momentum decay on the 30d window — rotate toward breakout',
            rows: [
                { target: 'Momentum', before: 40, after: 35 },
                { target: 'BTC Trend', before: 35, after: 35 },
                { target: 'Vol Breakout', before: 25, after: 30 },
            ],
        },
        {
            ts: d(REALLOC_DAY) + ' 00:05', layer: 'alpha', portfolio: 'Tail Hedge', reason: 'Rebalance hedge legs after the tail sleeve grew',
            rows: [
                { target: 'Vol Breakout', before: 60, after: 55 },
                { target: 'BTC Trend', before: 40, after: 45 },
            ],
        },
    ];

    // ── Shared shaping ──
    function shapeInstance(s, pf) {
        const ret = ALPHA_RET[s.alphaId];
        return {
            key: pf.id + '/' + s.alphaId,
            alphaId: s.alphaId, alphaLabel: s.alpha.label, color: s.alpha.color, freq: s.alpha.freq,
            pfId: pf.id, pfLabel: pf.label,
            w0: s.w0, w1: s.w1,
            pv: s.pv.map(v => Math.round(v)),
            retPct: chainPct(ret),
            trades: s.trades, turnover: s.turnover.map(v => Math.round(v)),
            equity: s.pv[s.pv.length - 1],
            cumPnl: Math.round(s.cumPnl),
            roe: chainPct(ret)[N_DAYS - 1],
            sharpe: annSharpe(ret), vol: annVol(ret), mdd: chainMdd(ret),
            tradesTotal: s.trades.reduce((a, b) => a + b, 0),
            turnoverTotal: Math.round(s.turnover.reduce((a, b) => a + b, 0)),
            // Turnover as % of average allocated capital (cumulative over the window)
            turnoverPct: s.turnover.reduce((a, b) => a + b, 0) / mean(s.pv) * 100,
        };
    }

    // ── Public shape: fund overview ──
    function fund() {
        const B = build();
        const mRet = dailyReturns(B.measuredPV);
        const vRet = dailyReturns(B.virtualPV);
        const mDD = drawdownSeries(B.measuredPV);

        const portfolios = PORTFOLIOS.map((pf, pi) => {
            const pv = B.pfPV[pi];
            const ret = B.pfRet[pi];   // flow-adjusted
            const own = B.inst.filter(s => s.pfIdx === pi);
            return {
                id: pf.id, label: pf.label, alloc0: pf.alloc0, alloc1: pf.alloc1,
                pv: pv.map(v => Math.round(v)),
                cap: B.pfCap[pi].map(v => Math.round(v)),
                retPct: chainPct(ret),
                cumPnl: Math.round(own.reduce((a, s) => a + s.cumPnl, 0)),
                sharpe: annSharpe(ret), vol: annVol(ret), mdd: chainMdd(ret),
                turnoverPct: own.reduce((a, s) => a + s.turnover.reduce((x, y) => x + y, 0), 0) / mean(pv) * 100,
                instances: own.map(s => shapeInstance(s, pf)),
            };
        });

        // Unique-alpha rollup (the Alpha Pool view): one curve per alpha, capital summed
        // across its instances.
        const alphas = ALPHAS.map(a => {
            const own = B.inst.filter(s => s.alphaId === a.id);
            const pvAgg = DATES.map((_, i) => own.reduce((x, s) => x + s.pv[i], 0));
            return {
                id: a.id, label: a.label, color: a.color, freq: a.freq,
                retPct: chainPct(ALPHA_RET[a.id]),
                equity: pvAgg[N_DAYS - 1],
                nInstances: own.length,
                byPortfolio: own.map(s => ({ pfId: s.pfId, pfLabel: s.pfLabel, equity: Math.round(s.cur) })),
            };
        });

        const finalV = B.virtualPV[N_DAYS - 1], finalM = B.measuredPV[N_DAYS - 1];
        return {
            dates: DATES, capital: FUND_CAPITAL, reallocDay: REALLOC_DAY,
            fundLabel: 'NeoMatrix Fund I', account: 'one real futures account · bitget',
            virtualPV: B.virtualPV.map(v => Math.round(v)),
            measuredPV: B.measuredPV.map(v => Math.round(v)),
            virtualRetPct: B.virtualPV.map(v => (v / FUND_CAPITAL - 1) * 100),
            cashPV: B.cashPV.map(v => Math.round(v)),
            cumOpCost: B.cumOpCostArr.map(v => Math.round(v)),
            latentPnl: B.virtualPV.map(v => Math.round(v - FUND_CAPITAL)),
            actualPnl: B.measuredPV.map(v => Math.round(v - FUND_CAPITAL)),
            dd: mDD,
            portfolios, alphas,
            allocPortfolio: ALLOC_PORTFOLIO,
            allocSleeve: ALLOC_SLEEVE,
            metrics: {
                virtual: finalV, measured: finalM,
                opCost: B.cumOpCostArr[N_DAYS - 1],
                reconBp: (finalM - finalV) / finalV * 10000,
                roe: (finalM / FUND_CAPITAL - 1) * 100,
                sharpe: annSharpe(mRet), vol: annVol(mRet), mdd: Math.min(...mDD),
                vSharpe: annSharpe(vRet),
                cash: B.cash,
            },
        };
    }

    // ── Public shape: one portfolio (fund_portfolio.html) ──
    function portfolioDetail(id) {
        const F = fund();
        const p = F.portfolios.find(x => x.id === id) || F.portfolios[0];
        return {
            dates: DATES, reallocDay: REALLOC_DAY, fundLabel: F.fundLabel,
            meta: { id: p.id, label: p.label, alloc0: p.alloc0, alloc1: p.alloc1 },
            pv: p.pv, cap: p.cap, retPct: p.retPct,
            fundVirtualRetPct: F.virtualRetPct,
            kpi: {
                pv: p.pv[N_DAYS - 1], cap: p.cap[N_DAYS - 1],
                allocNow: p.alloc1 * 100, cumPnl: p.cumPnl,
                sharpe: p.sharpe, vol: p.vol, mdd: p.mdd,
                instances: p.instances.length,
                tradesTotal: p.instances.reduce((a, s) => a + s.tradesTotal, 0),
                turnoverPct: p.turnoverPct,
            },
            instances: p.instances,
            batches: ALLOC_SLEEVE.filter(b => b.portfolio === p.label),
            portfolios: F.portfolios.map(x => ({ id: x.id, label: x.label })), // for the switcher
        };
    }

    // ── Public shape: one UNIQUE alpha (fund_alpha.html) ──
    // Keyed by alphaId — the signal, curve and risk numbers exist once per alpha;
    // the portfolio dimension appears as an instances table (scale, not shape).
    function alphaDetail(alphaId) {
        const F = fund();
        const a = ALPHA_BY_ID[alphaId] ? ALPHA_BY_ID[alphaId] : ALPHAS[0];
        const B = build();
        const own = B.inst.filter(s => s.alphaId === a.id);
        const ownShaped = F.portfolios.flatMap(p => p.instances).filter(s => s.alphaId === a.id);
        const ret = ALPHA_RET[a.id];
        const retPct = chainPct(ret);
        const pvAgg = DATES.map((_, i) => own.reduce((x, s) => x + s.pv[i], 0));
        const trades = DATES.map((_, i) => own.reduce((x, s) => x + s.trades[i], 0));
        const turnover = DATES.map((_, i) => own.reduce((x, s) => x + s.turnover[i], 0));
        const turnoverTotal = turnover.reduce((x, y) => x + y, 0);
        const seed = a.id.split('').reduce((h, c) => (h * 131 + c.charCodeAt(0)) | 0, 7);
        const rnd = mulberry32(seed);

        // Current signal book: target weights (this cycle) vs achieved weights —
        // identical for every instance of this alpha, so it is shown once.
        const symbols = ALPHA_SYMBOLS[a.id];
        const raw = symbols.map(() => 0.4 + rnd());
        const gross = raw.reduce((x, y) => x + y, 0);
        const totalEquity = pvAgg[N_DAYS - 1];
        const positions = symbols.map((sym, i) => {
            const w = raw[i] / gross;                                  // achieved |weight|
            const target = Math.max(0.02, w + (rnd() - 0.5) * 0.06);   // cycle target, slightly off
            const side = a.id === 'carry' ? 'long' : (rnd() > 0.42 ? 'long' : 'short');
            const notional = totalEquity * w;
            const mark = PRICES[sym] * (1 + (rnd() - 0.5) * 0.05);
            const upnl = (rnd() - 0.44) * notional * 0.05;
            return { symbol: sym, side, weight: w * 100, targetWeight: target * 100,
                     notional, qty: notional / mark, mark, upnl };
        });

        // Virtual fills (sleeve_virtual_fills mock): last ~20 signal fills, stepping
        // back one cycle each (amounts shown at whole-alpha scale).
        const fills = [];
        let t = END.getTime() - rnd() * a.cycleH * 0.5 * 3600000;
        for (let i = 0; i < 20; i++) {
            const p0 = positions[Math.floor(rnd() * positions.length)];
            const side = rnd() > 0.5 ? 'buy' : 'sell';
            const price = PRICES[p0.symbol] * (1 + (rnd() - 0.5) * 0.04);
            const value = totalEquity * (0.01 + rnd() * 0.06);
            const cyc = new Date(t).toISOString().substring(0, 13).replace('T', '-') + 'h';
            fills.push({ time: fmtDt(t), cycle: cyc, symbol: p0.symbol, side, price, qty: value / price, value });
            t -= a.cycleH * 3600000 * (1 + Math.floor(rnd() * 2));
        }

        const lastCycle = END.getTime() - rnd() * a.cycleH * 0.5 * 3600000;
        const allocEvents = ALLOC_SLEEVE
            .flatMap(b => {
                const row = b.rows.find(r => r.target === a.label);
                return row ? [{ ts: b.ts, portfolio: b.portfolio, reason: b.reason, before: row.before, after: row.after }] : [];
            });

        return {
            dates: DATES, reallocDay: REALLOC_DAY, fundLabel: F.fundLabel,
            meta: { id: a.id, label: a.label, color: a.color, freq: a.freq, cycleH: a.cycleH,
                    nInstances: own.length,
                    lastCycle: fmtDt(lastCycle), nextCycle: fmtDt(lastCycle + a.cycleH * 3600000) },
            kpi: {
                equity: totalEquity,
                cumPnl: Math.round(own.reduce((x, s) => x + s.cumPnl, 0)),
                roe: retPct[N_DAYS - 1],                    // since inception, chained
                sharpe: annSharpe(ret), vol: annVol(ret), mdd: chainMdd(ret),
                tradesTotal: trades.reduce((x, y) => x + y, 0),
                turnoverPct: turnoverTotal / mean(pvAgg) * 100,
            },
            pv: pvAgg.map(v => Math.round(v)), retPct, trades, turnover: turnover.map(v => Math.round(v)),
            instances: ownShaped,                            // the scale dimension, as a table
            otherAlphas: F.alphas.filter(x => x.id !== a.id),
            positions, fills, allocEvents,
            roster: ALPHAS.map(x => ({ id: x.id, label: x.label })),
        };
    }

    return { fund, portfolioDetail, alphaDetail };
})();

// Allow the identity checks to run under Node (`node -e "require(...)"`); browsers ignore this.
if (typeof module !== 'undefined' && module.exports) module.exports = { COMP };

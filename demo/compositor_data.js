// compositor_data.js — Synthetic, deterministic sample data for the v3 compositor
// (Fund > Portfolio > Alpha) preview dashboard.
//
// 100% fabricated. No real accounts, keys, fills or balances are involved.
// Same conventions as demo_data.js: a seeded PRNG (mulberry32) keeps every number
// stable across reloads. Used by fund.html only.
//
// The whole point of the compositor preview is that the numbers ADD UP, so this
// module enforces the v3 accounting identities exactly, by construction:
//   1. sum(instance PV)                    == portfolio virtual PV      (per portfolio)
//   2. sum(portfolio virtual PV) + cash    == fund virtual PV
//   3. fund virtual PV + operating cost    == measured (real) PV        (recon: L-P)
// Reallocation is virtual (no real transfers): on the reallocation day the fund
// total is re-sliced to the new weights — instance PV steps, the fund line doesn't.
//
// Realism notes: alphas share a common market factor (beta) so they are correlated;
// the same alpha running in two portfolios shares one return stream plus a small
// per-portfolio timing noise (different rebalancing clocks → slightly different fills).

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
    // color: one color per alpha — instances of the same alpha share it (dash = portfolio).
    const ALPHAS = [
        { id: 'mom',   label: 'Momentum',       color: '#4e79a7', seed: 11, alpha: 0.0011, beta: 0.55, idio: 0.013, tradesPerDay: 10, freq: '15m / 4h rebal' },
        { id: 'mr',    label: 'Mean Reversion', color: '#f28e2b', seed: 22, alpha: 0.0007, beta: 0.20, idio: 0.010, tradesPerDay: 26, freq: '1m / 1h rebal' },
        { id: 'carry', label: 'Funding Carry',  color: '#59a14f', seed: 33, alpha: 0.0005, beta: 0.10, idio: 0.006, tradesPerDay: 3,  freq: '1d rebal' },
        { id: 'btct',  label: 'BTC Trend',      color: '#e15759', seed: 44, alpha: 0.0009, beta: 0.75, idio: 0.015, tradesPerDay: 6,  freq: '1h / 8h rebal' },
        { id: 'volb',  label: 'Vol Breakout',   color: '#b07aa1', seed: 55, alpha: 0.0008, beta: 0.40, idio: 0.014, tradesPerDay: 14, freq: '5m / 2h rebal' },
    ];
    const ALPHA_BY_ID = Object.fromEntries(ALPHAS.map(a => [a.id, a]));

    // One shared daily-return stream per unique alpha (instances ride the same stream).
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
                { alpha: 'mom',   w0: 0.20, w1: 0.20 },   // same alpha as pf-core → comparison view
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

    // Per-instance timing noise (same alpha, different portfolio → slightly different path).
    function timingNoise(pfIdx, instIdx) {
        const rnd = mulberry32(9000 + pfIdx * 100 + instIdx * 17);
        return () => (rnd() - 0.5) * 2 * 0.0012;
    }

    let _cache = null;
    function build() {
        if (_cache) return _cache;

        // Instance state: current virtual capital (PV), plus per-day series.
        const inst = [];
        PORTFOLIOS.forEach((pf, pi) => {
            pf.instances.forEach((it, ii) => {
                inst.push({
                    pfId: pf.id, pfLabel: pf.label, pfIdx: pi,
                    alphaId: it.alpha, alpha: ALPHA_BY_ID[it.alpha],
                    w0: it.w0, w1: it.w1,
                    noise: timingNoise(pi, ii),
                    pv: [], ret: [], trades: [], turnover: [],
                    cur: FUND_CAPITAL * pf.alloc0 * it.w0,
                });
            });
        });

        let cash = FUND_CAPITAL * CASH_W0;
        const cashPV = [];
        const pfPV = PORTFOLIOS.map(() => []);
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
            }

            let dayTurnover = 0;
            inst.forEach(s => {
                const r = ALPHA_RET[s.alphaId][i] + s.noise();
                s.cur = s.cur * (1 + r);
                s.pv.push(s.cur);
                s.ret.push(r);
                // Trade activity: count scales with the alpha's cadence, turnover with capital.
                const n = Math.max(1, Math.round(s.alpha.tradesPerDay * (0.6 + tradeRnd() * 0.8)));
                const to = s.cur * (0.05 + tradeRnd() * 0.25) * (n / s.alpha.tradesPerDay);
                s.trades.push(n);
                s.turnover.push(to);
                dayTurnover += to;
            });

            PORTFOLIOS.forEach((pf, pi) => {
                pfPV[pi].push(inst.filter(s => s.pfIdx === pi).reduce((a, s) => a + s.cur, 0));
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

        _cache = { inst, cash, cashPV, pfPV, virtualPV, measuredPV, cumOpCostArr };
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
    // Cumulative % return, robust to the virtual-reallocation capital step:
    // chain daily returns instead of dividing PV by PV[0].
    const chainPct = ret => { const out = []; let c = 1; ret.forEach(r => { c *= (1 + r); out.push((c - 1) * 100); }); return out; };

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

    // ── Public shape ──
    function fund() {
        const B = build();
        const mRet = dailyReturns(B.measuredPV);
        const vRet = dailyReturns(B.virtualPV);
        const mDD = drawdownSeries(B.measuredPV);

        const portfolios = PORTFOLIOS.map((pf, pi) => {
            const pv = B.pfPV[pi];
            const ret = dailyReturns(pv);
            return {
                id: pf.id, label: pf.label, alloc0: pf.alloc0, alloc1: pf.alloc1,
                pv: pv.map(v => Math.round(v)),
                sharpe: annSharpe(ret), vol: annVol(ret), mdd: Math.min(...drawdownSeries(pv)),
                instances: B.inst.filter(s => s.pfIdx === pi).map(s => ({
                    key: pf.id + '/' + s.alphaId,
                    alphaId: s.alphaId, alphaLabel: s.alpha.label, color: s.alpha.color, freq: s.alpha.freq,
                    pfId: pf.id, pfLabel: pf.label,
                    w0: s.w0, w1: s.w1,
                    pv: s.pv.map(v => Math.round(v)),
                    retPct: chainPct(s.ret),
                    trades: s.trades, turnover: s.turnover.map(v => Math.round(v)),
                    equity: s.pv[s.pv.length - 1],
                    sharpe: annSharpe(s.ret), mdd: Math.min(...drawdownSeries(s.pv)),
                    tradesTotal: s.trades.reduce((a, b) => a + b, 0),
                    turnoverTotal: Math.round(s.turnover.reduce((a, b) => a + b, 0)),
                })),
            };
        });

        const finalV = B.virtualPV[N_DAYS - 1], finalM = B.measuredPV[N_DAYS - 1];
        return {
            dates: DATES, capital: FUND_CAPITAL, reallocDay: REALLOC_DAY,
            fundLabel: 'NeoMatrix Fund I', account: 'one real futures account · bitget',
            virtualPV: B.virtualPV.map(v => Math.round(v)),
            measuredPV: B.measuredPV.map(v => Math.round(v)),
            cashPV: B.cashPV.map(v => Math.round(v)),
            cumOpCost: B.cumOpCostArr.map(v => Math.round(v)),
            latentPnl: B.virtualPV.map(v => Math.round(v - FUND_CAPITAL)),
            actualPnl: B.measuredPV.map(v => Math.round(v - FUND_CAPITAL)),
            dd: mDD,
            portfolios,
            alphas: ALPHAS.map(a => ({ id: a.id, label: a.label, color: a.color, freq: a.freq })),
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

    return { fund };
})();

// Allow the identity checks to run under Node (`node -e "require(...)"`); browsers ignore this.
if (typeof module !== 'undefined' && module.exports) module.exports = { COMP };

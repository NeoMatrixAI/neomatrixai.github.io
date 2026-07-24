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
//   1. sum(instance PV)                    == portfolio virtual PV      (per portfolio, while it exists)
//   2. sum(portfolio virtual PV) + cash    == fund virtual PV
//   3. fund virtual PV + operating cost    == measured (real) PV        (recon: L-P)
//   4. same alpha, any portfolio           == same daily-return WAVEFORM over any
//      common window — but NOT the same cumulative curve. Portfolios launch at
//      different times (a v3 fact: users add portfolios / register alphas whenever
//      they want), so each instance compounds from its own start date. The split
//      "alpha made X% in A, Y% in B" is exact because every instance keeps its own
//      forward book from its own inception — it is never reverse-engineered from
//      the netted account.
//
// Timeline in this sample: Core Momentum launches day 0, Defensive Carry is added
// day 20, Tail Hedge day 40, and one fund-level virtual reallocation happens day 65.
// Reallocation is virtual (no real transfers): the fund total is re-sliced on paper,
// instance PV steps, the fund line doesn't. Risk metrics (Sharpe / vol / MDD) are
// computed on FLOW-ADJUSTED return streams over each book's own lifetime.
// Turnover is reported as % of average allocated capital (cumulative over lifetime).

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

    // One shared daily-return stream per unique alpha (the signal). Identity 4:
    // every instance of an alpha rides EXACTLY this waveform over common windows.
    const ALPHA_RET = (function () {
        const out = {};
        ALPHAS.forEach(a => {
            const rnd = mulberry32(a.seed * 1000 + 7);
            out[a.id] = MARKET.map(mkt => a.alpha + a.beta * mkt + (rnd() - 0.5) * 2 * a.idio);
        });
        return out;
    })();

    // BTC benchmark — the alpha-level reference line (v2 convention: "does this
    // signal beat just holding the market"). The fund itself is NOT used as an
    // alpha benchmark: it contains the alpha (self-inclusion) and mixes risk levels.
    const BTC_RET_PCT = (function () {
        const rnd = mulberry32(9001);
        const pv = [1];
        for (let i = 1; i < N_DAYS; i++) pv.push(pv[i - 1] * (1 + 0.0002 + 1.0 * MARKET[i] + (rnd() - 0.5) * 2 * 0.012));
        return pv.map(v => (v / pv[0] - 1) * 100);
    })();

    // ── Portfolio & allocation timeline ──
    // TWO independent kinds of events, because that is how v3 actually behaves:
    //   - a PORTFOLIO is added whenever the user wants (2nd-layer allocation), and
    //   - an ALPHA is added to (or re-weighted inside) a portfolio whenever the
    //     user wants (1st-layer allocation) — mid-life, not only at launch.
    // So an instance's inception = the day THAT portfolio started running THAT
    // alpha. Alphas inside one portfolio can have different inceptions, and the
    // same alpha in two portfolios almost never shares one.
    // Every event carries the FULL allocation snapshot (Σ alloc + cash == 1);
    // `weights` only lists portfolios whose internal split changes that day.
    const PF_META = [
        { id: 'pf-core',  label: 'Core Momentum',   startDay: 0 },
        { id: 'pf-carry', label: 'Defensive Carry', startDay: 20 },
        { id: 'pf-tail',  label: 'Tail Hedge',      startDay: 40 },
    ];
    const PF_BY_ID = Object.fromEntries(PF_META.map(p => [p.id, p]));
    const EVENTS = [
        { day: 0,  cash: 0.45, alloc: { 'pf-core': 0.55 },
          weights: { 'pf-core': { mom: 0.45, btct: 0.55 } },
          reason: 'Fund launch — Core Momentum only, cash held for later portfolios' },
        { day: 12, cash: 0.45, alloc: { 'pf-core': 0.55 },
          weights: { 'pf-core': { mom: 0.40, btct: 0.35, volb: 0.25 } },
          reason: 'Vol Breakout alpha added to Core Momentum' },
        { day: 20, cash: 0.15, alloc: { 'pf-core': 0.55, 'pf-carry': 0.30 },
          weights: { 'pf-carry': { carry: 0.60, mr: 0.40 } },
          reason: 'Defensive Carry portfolio added from cash' },
        { day: 40, cash: 0.05, alloc: { 'pf-core': 0.55, 'pf-carry': 0.30, 'pf-tail': 0.10 },
          weights: { 'pf-tail': { volb: 0.60, btct: 0.40 } },
          reason: 'Tail Hedge portfolio added from cash' },
        { day: 52, cash: 0.05, alloc: { 'pf-core': 0.55, 'pf-carry': 0.30, 'pf-tail': 0.10 },
          weights: { 'pf-carry': { carry: 0.50, mr: 0.30, mom: 0.20 } },
          reason: 'Momentum alpha added to Defensive Carry' },
        { day: 65, cash: 0.07, alloc: { 'pf-core': 0.45, 'pf-carry': 0.28, 'pf-tail': 0.20 },
          weights: { 'pf-core': { mom: 0.35, btct: 0.35, volb: 0.30 },
                     'pf-tail': { volb: 0.55, btct: 0.45 } },
          reason: 'Q2 risk review — trim core momentum, extend tail hedge into the summer chop' },
    ];
    const REALLOC_DAY = 65;

    let _cache = null;
    function build() {
        if (_cache) return _cache;

        const instMap = {};          // key: pfId/alphaId → instance state
        const inst = [];
        let cashVal = FUND_CAPITAL;  // everything starts as cash until the launch batch
        let curAlloc = {}, curW = {}, curCashW = 1;
        const pfCapNow = {};

        const cashPV = [];
        const pfPV = {}, pfRet = {}, pfCap = {};
        PF_META.forEach(p => { pfPV[p.id] = []; pfRet[p.id] = []; pfCap[p.id] = []; });
        const virtualPV = [], measuredPV = [], cumOpCostArr = [];
        let cumOpCost = 0;
        const tradeRnd = mulberry32(31415);

        for (let i = 0; i < N_DAYS; i++) {
            const ev = EVENTS.find(e => e.day === i);
            if (ev) {
                curCashW = ev.cash;
                curAlloc = { ...ev.alloc };
                Object.entries(ev.weights).forEach(([pfId, w]) => { curW[pfId] = { ...w }; });
                // Virtual re-slice (F20): no real transfer, the fund total is re-cut.
                const total = inst.reduce((a, s) => a + s.cur, 0) + cashVal;
                cashVal = total * curCashW;
                Object.entries(curAlloc).forEach(([pfId, alloc]) => {
                    pfCapNow[pfId] = total * alloc;
                    Object.entries(curW[pfId]).forEach(([alphaId, w]) => {
                        const key = pfId + '/' + alphaId;
                        if (!instMap[key]) {
                            instMap[key] = {
                                key, pfId, pfLabel: PF_BY_ID[pfId].label, alphaId,
                                alpha: ALPHA_BY_ID[alphaId], startDay: i, w0: w, wNow: w,
                                pv: Array(i).fill(null), ret: Array(i).fill(null),
                                trades: Array(i).fill(0), turnover: Array(i).fill(0),
                                cur: 0, cumPnl: 0,
                            };
                            inst.push(instMap[key]);
                        }
                        instMap[key].wNow = w;
                        instMap[key].cur = total * alloc * w;
                    });
                });
            }

            const pfPrev = {};
            PF_META.forEach(p => { pfPrev[p.id] = inst.filter(s => s.pfId === p.id).reduce((a, s) => a + s.cur, 0); });
            const pfPnlDay = {};
            PF_META.forEach(p => { pfPnlDay[p.id] = 0; });

            let dayTurnover = 0;
            inst.forEach(s => {
                // A newly opened book starts FLAT: PV(t0) = allocated capital, return 0
                // (same as the real seeding semantics). Its first return accrues from t0+1.
                const r = s.startDay === i ? 0 : ALPHA_RET[s.alphaId][i];   // the shared alpha waveform, exactly
                const prev = s.cur;
                s.cur = prev * (1 + r);
                const pnlDay = s.cur - prev;
                s.cumPnl += pnlDay;
                pfPnlDay[s.pfId] += pnlDay;
                s.pv.push(s.cur);
                s.ret.push(r);
                // Trade activity: count scales with the alpha's cadence, turnover with capital.
                const n = Math.max(1, Math.round(s.alpha.tradesPerDay * (0.6 + tradeRnd() * 0.8)));
                const to = s.cur * (0.05 + tradeRnd() * 0.25) * (n / s.alpha.tradesPerDay);
                s.trades.push(n);
                s.turnover.push(to);
                dayTurnover += to;
            });

            PF_META.forEach(p => {
                if (i >= p.startDay) {
                    pfPV[p.id].push(inst.filter(s => s.pfId === p.id).reduce((a, s) => a + s.cur, 0));
                    pfRet[p.id].push(pfPrev[p.id] > 0 ? pfPnlDay[p.id] / pfPrev[p.id] : 0);
                    pfCap[p.id].push(pfCapNow[p.id]);
                } else {
                    pfPV[p.id].push(null);
                    pfRet[p.id].push(null);
                    pfCap[p.id].push(null);
                }
            });
            cashPV.push(cashVal);

            const v = inst.reduce((a, s) => a + s.cur, 0) + cashVal;
            virtualPV.push(v);

            // Operating cost (fees + slippage + funding timing) — proportional to turnover.
            // Identity 3: measured == virtual + cumOpCost (opCost < 0). Nothing hidden.
            cumOpCost += -dayTurnover * 0.00045;
            cumOpCostArr.push(cumOpCost);
            measuredPV.push(v + cumOpCost);
        }

        _cache = { inst, cashVal, cashPV, pfPV, pfRet, pfCap, virtualPV, measuredPV, cumOpCostArr };
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
    const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    // Cumulative % return chained from a start day; null before it (Chart.js gap).
    // The inception day is a 0% ANCHOR (the book opens flat at PV = capital);
    // returns accrue from startDay+1. Chaining daily returns keeps it exact
    // across virtual-reallocation capital steps.
    function chainPctFrom(ret, startDay) {
        const out = []; let c = 1;
        for (let i = 0; i < N_DAYS; i++) {
            if (i < startDay) { out.push(null); continue; }
            if (i > startDay && ret[i] !== null && ret[i] !== undefined) c *= (1 + ret[i]);
            out.push((c - 1) * 100);
        }
        return out;
    }
    // Flow-adjusted MDD over a lifetime slice: drawdown of the chained return index
    // (anchored at 1.0 on the inception day).
    function chainMddFrom(ret, startDay) {
        const idx = [1]; let c = 1;
        for (let i = startDay + 1; i < N_DAYS; i++) { c *= (1 + ret[i]); idx.push(c); }
        return Math.min(...drawdownSeries(idx));
    }
    const lifeSlice = (arr, startDay) => arr.slice(startDay).filter(v => v !== null);

    // ── Allocation history (append-only batches, 2 layers — derived from the SAME
    //    timeline the engine runs, so the tables and the curves can never disagree) ──
    const d = i => DATES[i];
    const CASH_LABEL = 'Virtual Cash (unallocated)';
    const ALLOC_PORTFOLIO = (function () {
        let prev = null;
        const batches = [];
        EVENTS.forEach(ev => {
            // Alpha-only events (weights change, 2nd-layer split unchanged) do not
            // produce a portfolio-layer batch.
            const changed = !prev || prev.cash !== ev.cash ||
                PF_META.some(p => (prev.alloc[p.id] || 0) !== (ev.alloc[p.id] || 0));
            if (changed) {
                const rows = [];
                PF_META.forEach(p => {
                    const after = ev.alloc[p.id];
                    if (after === undefined) return;
                    const before = prev && prev.alloc[p.id] !== undefined ? Math.round(prev.alloc[p.id] * 100) : null;
                    rows.push({ target: p.label, before, after: Math.round(after * 100) });
                });
                rows.push({ target: CASH_LABEL, before: prev ? Math.round(prev.cash * 100) : null, after: Math.round(ev.cash * 100) });
                batches.push({ ts: d(ev.day) + (ev.day === REALLOC_DAY ? ' 00:05' : ' 00:00'), layer: 'portfolio', reason: ev.reason, rows });
            }
            prev = ev;
        });
        return batches;
    })();
    const ALLOC_SLEEVE = (function () {
        const prevW = {};
        const batches = [];
        EVENTS.forEach(ev => {
            Object.entries(ev.weights).forEach(([pfId, w]) => {
                const rows = Object.entries(w).map(([alphaId, after]) => ({
                    target: ALPHA_BY_ID[alphaId].label,
                    before: prevW[pfId] && prevW[pfId][alphaId] !== undefined ? Math.round(prevW[pfId][alphaId] * 100) : null,
                    after: Math.round(after * 100),
                }));
                batches.push({
                    ts: d(ev.day) + (ev.day === REALLOC_DAY ? ' 00:05' : ' 00:00'),
                    layer: 'alpha', portfolio: PF_BY_ID[pfId].label,
                    reason: prevW[pfId] ? ev.reason : 'Initial allocation',
                    rows,
                });
                prevW[pfId] = { ...w };
            });
        });
        return batches;
    })();

    // ── Shared shaping ──
    function shapeInstance(s) {
        const ret = ALPHA_RET[s.alphaId];
        const retPct = chainPctFrom(ret, s.startDay);
        const lifeRet = ret.slice(s.startDay + 1);   // first return accrues the day after inception
        const lifePv = lifeSlice(s.pv, s.startDay);
        return {
            key: s.key, alphaId: s.alphaId, alphaLabel: s.alpha.label, color: s.alpha.color, freq: s.alpha.freq,
            pfId: s.pfId, pfLabel: s.pfLabel,
            startDay: s.startDay, since: DATES[s.startDay],
            w0: s.w0, wNow: s.wNow,
            pv: s.pv.map(v => v === null ? null : Math.round(v)),
            retPct,
            trades: s.trades, turnover: s.turnover.map(v => Math.round(v)),
            equity: s.cur,
            cumPnl: Math.round(s.cumPnl),
            roe: retPct[N_DAYS - 1],                        // since ITS inception — differs per instance
            sharpe: annSharpe(lifeRet), vol: annVol(lifeRet), mdd: chainMddFrom(ret, s.startDay),
            tradesTotal: s.trades.reduce((a, b) => a + b, 0),
            turnoverTotal: Math.round(s.turnover.reduce((a, b) => a + b, 0)),
            turnoverPct: s.turnover.reduce((a, b) => a + b, 0) / mean(lifePv) * 100,
        };
    }

    // ── Public shape: fund overview ──
    function fund() {
        const B = build();
        const mRet = dailyReturns(B.measuredPV);
        const vRet = dailyReturns(B.virtualPV);
        const mDD = drawdownSeries(B.measuredPV);
        const lastEv = EVENTS[EVENTS.length - 1];

        const portfolios = PF_META.map(p => {
            const own = B.inst.filter(s => s.pfId === p.id);
            const ret = B.pfRet[p.id];
            const lifeRet = lifeSlice(ret, p.startDay).slice(1);   // launch day is the flat anchor
            const lifePv = lifeSlice(B.pfPV[p.id], p.startDay);
            return {
                id: p.id, label: p.label, startDay: p.startDay, since: DATES[p.startDay],
                allocNow: lastEv.alloc[p.id],
                pv: B.pfPV[p.id].map(v => v === null ? null : Math.round(v)),
                cap: B.pfCap[p.id].map(v => v === null ? null : Math.round(v)),
                retPct: chainPctFrom(ret.map(r => r === null ? 0 : r), p.startDay),
                cumPnl: Math.round(own.reduce((a, s) => a + s.cumPnl, 0)),
                sharpe: annSharpe(lifeRet), vol: annVol(lifeRet),
                mdd: chainMddFrom(ret.map(r => r === null ? 0 : r), p.startDay),
                turnoverPct: own.reduce((a, s) => a + s.turnover.reduce((x, y) => x + y, 0), 0) / mean(lifePv) * 100,
                instances: own.map(shapeInstance),
            };
        });

        // Unique-alpha rollup (the Alpha Pool view): the master curve starts at the
        // alpha's EARLIEST instance (its live track record), capital summed across
        // instances.
        const alphas = ALPHAS.map(a => {
            const own = B.inst.filter(s => s.alphaId === a.id);
            if (!own.length) return null;
            const earliest = Math.min(...own.map(s => s.startDay));
            return {
                id: a.id, label: a.label, color: a.color, freq: a.freq,
                startDay: earliest, since: DATES[earliest],
                retPct: chainPctFrom(ALPHA_RET[a.id], earliest),
                equity: own.reduce((x, s) => x + s.cur, 0),
                nInstances: own.length,
                byPortfolio: own.map(s => ({ pfId: s.pfId, pfLabel: s.pfLabel, equity: Math.round(s.cur), since: DATES[s.startDay] })),
            };
        }).filter(Boolean);

        const finalV = B.virtualPV[N_DAYS - 1], finalM = B.measuredPV[N_DAYS - 1];
        return {
            dates: DATES, capital: FUND_CAPITAL, reallocDay: REALLOC_DAY,
            fundLabel: 'NeoMatrix Fund I', account: 'one real futures account · bitget',
            virtualPV: B.virtualPV.map(v => Math.round(v)),
            measuredPV: B.measuredPV.map(v => Math.round(v)),
            virtualRetPct: B.virtualPV.map(v => (v / FUND_CAPITAL - 1) * 100),
            btcRetPct: BTC_RET_PCT,
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
                cash: B.cashVal,
            },
        };
    }

    // ── Public shape: one portfolio (fund_portfolio.html) ──
    function portfolioDetail(id) {
        const F = fund();
        const p = F.portfolios.find(x => x.id === id) || F.portfolios[0];
        return {
            dates: DATES, reallocDay: REALLOC_DAY, fundLabel: F.fundLabel,
            meta: { id: p.id, label: p.label, since: p.since, allocNow: p.allocNow },
            pv: p.pv, cap: p.cap, retPct: p.retPct,
            fundVirtualRetPct: F.virtualRetPct,
            kpi: {
                pv: p.pv[N_DAYS - 1], cap: p.cap[N_DAYS - 1],
                allocNow: p.allocNow * 100, cumPnl: p.cumPnl,
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
    // Keyed by alphaId — the signal and its master track record exist once per
    // alpha. The portfolio dimension appears as an instances table + per-instance
    // "return since its own start" curves (scale AND inception differ; shape doesn't).
    function alphaDetail(alphaId) {
        const F = fund();
        const a = ALPHA_BY_ID[alphaId] ? ALPHA_BY_ID[alphaId] : ALPHAS[0];
        const B = build();
        const own = B.inst.filter(s => s.alphaId === a.id);
        const ownShaped = own.map(shapeInstance);
        const earliest = Math.min(...own.map(s => s.startDay));
        const ret = ALPHA_RET[a.id];
        const retPct = chainPctFrom(ret, earliest);
        const pvAgg = DATES.map((_, i) => {
            const alive = own.filter(s => s.pv[i] !== null);
            return alive.length ? alive.reduce((x, s) => x + s.pv[i], 0) : null;
        });
        const trades = DATES.map((_, i) => own.reduce((x, s) => x + s.trades[i], 0));
        const turnover = DATES.map((_, i) => own.reduce((x, s) => x + s.turnover[i], 0));
        const lifeRet = ret.slice(earliest + 1);
        const seed = a.id.split('').reduce((h, c) => (h * 131 + c.charCodeAt(0)) | 0, 7);
        const rnd = mulberry32(seed);

        // Current signal book: target weights (this cycle) vs achieved weights —
        // identical for every instance of this alpha, so it is shown once.
        const symbols = ALPHA_SYMBOLS[a.id];
        const raw = symbols.map(() => 0.4 + rnd());
        const gross = raw.reduce((x, y) => x + y, 0);
        const totalEquity = own.reduce((x, s) => x + s.cur, 0);
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
                    nInstances: own.length, since: DATES[earliest],
                    lastCycle: fmtDt(lastCycle), nextCycle: fmtDt(lastCycle + a.cycleH * 3600000) },
            kpi: {
                equity: totalEquity,
                cumPnl: Math.round(own.reduce((x, s) => x + s.cumPnl, 0)),
                roe: retPct[N_DAYS - 1],                    // master track record, since first run
                sharpe: annSharpe(lifeRet), vol: annVol(lifeRet), mdd: chainMddFrom(ret, earliest),
                tradesTotal: trades.reduce((x, y) => x + y, 0),
                turnoverPct: turnover.reduce((x, y) => x + y, 0) / mean(lifeSlice(pvAgg, earliest)) * 100,
            },
            pv: pvAgg.map(v => v === null ? null : Math.round(v)),
            retPct, trades, turnover: turnover.map(v => Math.round(v)),
            btcRetPct: BTC_RET_PCT,
            instances: ownShaped,                            // scale + inception, per portfolio
            otherAlphas: F.alphas.filter(x => x.id !== a.id),
            positions, fills, allocEvents,
            roster: F.alphas.map(x => ({ id: x.id, label: x.label })),
        };
    }

    return { fund, portfolioDetail, alphaDetail };
})();

// Allow the identity checks to run under Node (`node -e "require(...)"`); browsers ignore this.
if (typeof module !== 'undefined' && module.exports) module.exports = { COMP };

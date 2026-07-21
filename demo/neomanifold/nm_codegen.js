// nm_codegen.js — a faithful JS port of the real Neomanifold code generator.
//
// Ported 1:1 from the production sources so the Builder demo emits the SAME
// Python a real user would get. Nothing here is improvised:
//   indicator_library.py  → INDICATORS (16 entries, verbatim names/params/limits)
//   strategy_codegen.py   → _funcSource (the 16 helper bodies, verbatim)
//                           _toposortFuncs / _indicatorCallLine
//                           _compileSignalRule / generate*Snippet
//                           _INDICATOR_CONFIG_HINT
// Locale is pinned to 'en' — the real _c(locale, ko, en) picks Korean by default.
//
// Deliberately preserved quirks (they are the real output, do NOT "fix"):
//   - Multi-indicator generation joins per-indicator snippets with '\n', and each
//     snippet embeds its OWN helper defs → RSI+MACD really does repeat the header
//     comment and both def blocks.
//   - crosses_above/below do NOT append .iloc[-1] to the RIGHT operand, while the
//     plain comparators do.

const NM_CODEGEN = (function () {
  'use strict';

  // ── indicator_library.py:17-125 ───────────────────────────────────────────
  const INDICATORS = {
    sma:  { name: 'SMA', category: 'trend', description: 'Simple Moving Average',
            params: [{ name: 'period', type: 'int', default: 20, min: 2, max: 500 }] },
    ema:  { name: 'EMA', category: 'trend', description: 'Exponential Moving Average',
            params: [{ name: 'period', type: 'int', default: 20, min: 2, max: 500 }] },
    wma:  { name: 'WMA', category: 'trend', description: 'Weighted Moving Average',
            params: [{ name: 'period', type: 'int', default: 20, min: 2, max: 500 }] },
    dema: { name: 'DEMA', category: 'trend', description: 'Double Exponential Moving Average',
            params: [{ name: 'period', type: 'int', default: 20, min: 2, max: 500 }] },
    rsi:  { name: 'RSI', category: 'momentum', description: 'Relative Strength Index',
            params: [{ name: 'period', type: 'int', default: 14, min: 2, max: 200 }] },
    macd: { name: 'MACD', category: 'momentum', description: 'Moving Average Convergence Divergence',
            params: [{ name: 'fast', type: 'int', default: 12, min: 2, max: 100 },
                     { name: 'slow', type: 'int', default: 26, min: 2, max: 200 },
                     { name: 'signal', type: 'int', default: 9, min: 2, max: 50 }] },
    stochastic: { name: 'Stochastic', category: 'momentum', description: 'Stochastic Oscillator (%K)',
            params: [{ name: 'k_period', type: 'int', default: 14, min: 2, max: 200 },
                     { name: 'd_period', type: 'int', default: 3, min: 1, max: 50 }] },
    roc:  { name: 'ROC', category: 'momentum', description: 'Rate of Change',
            params: [{ name: 'period', type: 'int', default: 12, min: 1, max: 200 }] },
    bollinger: { name: 'Bollinger Bands', category: 'volatility', description: 'Bollinger Bands (upper, middle, lower)',
            params: [{ name: 'period', type: 'int', default: 20, min: 2, max: 200 },
                     { name: 'std_dev', type: 'float', default: 2.0, min: 0.5, max: 5.0 }] },
    atr:  { name: 'ATR', category: 'volatility', description: 'Average True Range',
            params: [{ name: 'period', type: 'int', default: 14, min: 2, max: 200 }] },
    keltner: { name: 'Keltner Channel', category: 'volatility', description: 'Keltner Channel (upper, middle, lower)',
            params: [{ name: 'ema_period', type: 'int', default: 20, min: 2, max: 200 },
                     { name: 'atr_period', type: 'int', default: 10, min: 2, max: 200 },
                     { name: 'multiplier', type: 'float', default: 1.5, min: 0.5, max: 5.0 }] },
    obv:  { name: 'OBV', category: 'volume', description: 'On-Balance Volume', params: [] },
    vwap: { name: 'VWAP', category: 'volume', description: 'Volume Weighted Average Price', params: [] },
    volume_sma: { name: 'Volume SMA', category: 'volume', description: 'Volume Simple Moving Average',
            params: [{ name: 'period', type: 'int', default: 20, min: 2, max: 200 }] },
    funding_rate_filter: { name: 'Funding Rate Filter', category: 'crypto',
            description: 'Filter assets by funding rate threshold',
            params: [{ name: 'threshold', type: 'float', default: 0.01, min: -0.1, max: 0.1 }] },
    marketcap_weight: { name: 'Marketcap Weight', category: 'crypto',
            description: 'Weight assets by market capitalization', params: [] },
  };

  // ── strategy_codegen.py:332-413 — the 16 helper bodies, VERBATIM ──────────
  const SOURCES = {
    sma: `def _sma(s, period=20):
    return s.rolling(window=period, min_periods=period).mean()`,
    ema: `def _ema(s, period=20):
    return s.ewm(span=period, adjust=False).mean()`,
    wma: `def _wma(s, period=20):
    w = np.arange(1, period + 1, dtype=float)
    return s.rolling(window=period, min_periods=period).apply(
        lambda x: np.dot(x, w) / w.sum(), raw=True)`,
    dema: `def _dema(s, period=20):
    e1 = _ema(s, period)
    e2 = _ema(e1, period)
    return 2 * e1 - e2`,
    rsi: `def _rsi(s, period=14):
    delta = s.diff()
    gain = delta.clip(lower=0)
    loss = (-delta).clip(lower=0)
    avg_gain = gain.ewm(alpha=1.0/period, min_periods=period, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1.0/period, min_periods=period, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100.0 - (100.0 / (1.0 + rs))`,
    macd: `def _macd(s, fast=12, slow=26, signal=9):
    ema_f = _ema(s, fast)
    ema_s = _ema(s, slow)
    macd_line = ema_f - ema_s
    signal_line = _ema(macd_line, signal)
    hist = macd_line - signal_line
    return macd_line, signal_line, hist`,
    stochastic: `def _stochastic(high, low, close, k_period=14, d_period=3):
    ll = low.rolling(window=k_period, min_periods=k_period).min()
    hh = high.rolling(window=k_period, min_periods=k_period).max()
    k = 100.0 * (close - ll) / (hh - ll).replace(0, np.nan)
    d = k.rolling(window=d_period, min_periods=d_period).mean()
    return k, d`,
    roc: `def _roc(s, period=12):
    prev = s.shift(period)
    return ((s - prev) / prev.replace(0, np.nan)) * 100.0`,
    bollinger: `def _bollinger(s, period=20, std_dev=2.0):
    mid = _sma(s, period)
    std = s.rolling(window=period, min_periods=period).std()
    return mid + std_dev * std, mid, mid - std_dev * std`,
    atr: `def _atr(high, low, close, period=14):
    pc = close.shift(1)
    tr = pd.concat([high - low, (high - pc).abs(), (low - pc).abs()], axis=1).max(axis=1)
    return tr.rolling(window=period, min_periods=period).mean()`,
    keltner: `def _keltner(high, low, close, ema_period=20, atr_period=10, mult=1.5):
    mid = _ema(close, ema_period)
    a = _atr(high, low, close, atr_period)
    return mid + mult * a, mid, mid - mult * a`,
    obv: `def _obv(close, volume):
    d = np.sign(close.diff())
    d.iloc[0] = 0
    return (d * volume).cumsum()`,
    vwap: `def _vwap(high, low, close, volume):
    tp = (high + low + close) / 3.0
    return (tp * volume).cumsum() / volume.cumsum().replace(0, np.nan)`,
    volume_sma: `def _volume_sma(volume, period=20):
    return _sma(volume, period)`,
    funding_rate_filter: `def _funding_rate_filter(fr, threshold=0.01):
    return (fr.abs() < threshold).astype(float)`,
    marketcap_weight: `def _marketcap_weight(mc):
    total = mc.sum()
    return mc / total if total > 0 else mc * 0.0`,
  };
  const funcSource = n => SOURCES[n] || `# Unknown indicator: ${n}`;

  // ── strategy_codegen.py:416-439 ──────────────────────────────────────────
  const DEPS = { dema: ['ema'], bollinger: ['sma'], keltner: ['ema', 'atr'], volume_sma: ['sma'], macd: ['ema'] };

  function toposortFuncs(needed) {
    const ordered = [], visited = new Set();
    function visit(n) {
      if (visited.has(n)) return;
      visited.add(n);
      for (const dep of (DEPS[n] || [])) {
        if (needed.has(dep) || !visited.has(dep)) { needed.add(dep); visit(dep); }
      }
      ordered.push(n);
    }
    // Python iterates sorted(needed) — a snapshot, so mutating `needed` inside is safe.
    for (const n of Array.from(needed).sort()) visit(n);
    return ordered;
  }

  const CONFIG_HINT = {
    funding_rate_filter: 'funding_rate: 100   # add under strategy.config.data (futures only)',
    marketcap_weight:    'marketcap: 30          # add under strategy.config.data',
  };

  // ── strategy_codegen.py:605-643 ──────────────────────────────────────────
  function indicatorCallLine(key, v, params, meta) {
    const p = (n, d) => (params[n] !== undefined && params[n] !== '' ? params[n] : d);
    if (['sma', 'ema', 'wma', 'dema'].includes(key))
      return `${v} = _${key}(close, period=${p('period', meta.params[0].default)})`;
    if (key === 'rsi')  return `${v} = _rsi(close, period=${p('period', 14)})`;
    if (key === 'macd') return `${v}_line, ${v}_signal, ${v}_hist = _macd(close, fast=${p('fast', 12)}, slow=${p('slow', 26)}, signal=${p('signal', 9)})`;
    if (key === 'stochastic') return `${v}_k, ${v}_d = _stochastic(high, low, close, k_period=${p('k_period', 14)}, d_period=${p('d_period', 3)})`;
    if (key === 'roc')  return `${v} = _roc(close, period=${p('period', 12)})`;
    if (key === 'bollinger') return `${v}_upper, ${v}_mid, ${v}_lower = _bollinger(close, period=${p('period', 20)}, std_dev=${p('std_dev', 2.0)})`;
    if (key === 'atr')  return `${v} = _atr(high, low, close, period=${p('period', 14)})`;
    if (key === 'keltner') return `${v}_upper, ${v}_mid, ${v}_lower = _keltner(high, low, close, ema_period=${p('ema_period', 20)}, atr_period=${p('atr_period', 10)}, mult=${p('multiplier', 1.5)})`;
    if (key === 'obv')  return `${v} = _obv(close, volume)`;
    if (key === 'vwap') return `${v} = _vwap(high, low, close, volume)`;
    if (key === 'volume_sma') return `${v} = _volume_sma(volume, period=${p('period', 20)})`;
    if (key === 'funding_rate_filter')
      return `# funding_rate = data['funding_rate']  # requires config.data.funding_rate\n${v} = _funding_rate_filter(funding_rate, threshold=${p('threshold', 0.01)})`;
    if (key === 'marketcap_weight')
      return `# marketcap = data['marketcap']  # requires config.data.marketcap\n${v} = _marketcap_weight(marketcap)`;
    return `# ${key}: call example undefined`;
  }

  // ── strategy_codegen.py:164-203 ──────────────────────────────────────────
  function generateIndicatorSnippet(ind) {
    const key = (ind || {}).key || '';
    const meta = INDICATORS[key];
    if (!meta) return { code: `# Unknown indicator: ${key}`, config_hint: null };

    const v = String(ind.var_name || key).trim() || key;
    const params = ind.params || {};

    const needed = new Set([key]);
    if (key === 'dema') needed.add('ema');
    else if (key === 'keltner') { needed.add('ema'); needed.add('atr'); }
    else if (key === 'bollinger' || key === 'volume_sma') needed.add('sma');
    else if (key === 'macd') needed.add('ema');
    const funcDefs = toposortFuncs(needed).map(funcSource).join('\n\n');

    const header = `# ${meta.name} — ${meta.description || meta.name}\n` +
      `# close/high/low/volume are per-symbol Series (e.g. ohlcv['close'].unstack(level=0)[sym])`;
    return {
      code: `${header}\n${funcDefs}\n\n${indicatorCallLine(key, v, params, meta)}\n`,
      config_hint: CONFIG_HINT[key] || null,
    };
  }

  // ── strategy_codegen.py:578-602 ──────────────────────────────────────────
  function compileSignalRule(rule) {
    const left = rule.left || '', op = rule.operator || '', right = rule.right || '';
    const OPS = { '>': '>', '<': '<', '>=': '>=', '<=': '<=', '==': '==' };
    if (op === 'crosses_above') return `(${left}.iloc[-1] > ${right}) and (${left}.iloc[-2] <= ${right})`;
    if (op === 'crosses_below') return `(${left}.iloc[-1] < ${right}) and (${left}.iloc[-2] >= ${right})`;
    if (!(op in OPS)) return null;
    // float(right) succeeds → bare literal; else it is a Series → .iloc[-1]
    const isNum = String(right).trim() !== '' && isFinite(Number(right));
    return `${left}.iloc[-1] ${OPS[op]} ${isNum ? right : right + '.iloc[-1]'}`;
  }

  // ── strategy_codegen.py:206-230 ──────────────────────────────────────────
  function generateSignalSnippet(rules) {
    const parts = [];
    for (const rule of (rules || [])) {
      const cond = compileSignalRule(rule);
      if (!cond) continue;
      if (parts.length) parts.push(String(rule.join || 'and').toLowerCase() === 'or' ? 'or' : 'and');
      parts.push(`(${cond})`);
    }
    const combined = parts.length ? parts.join(' ') : 'True';
    return {
      code: '# signal condition — assign weight to the asset when True (adapt to your logic)\n' +
            `signal = ${combined}`,
      config_hint: null,
    };
  }

  // ── strategy_codegen.py:233-288 ──────────────────────────────────────────
  const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
  function generateSizingSnippet(sizing, sizingRef) {
    // _norm_sizing: whitelist the mode; score's ref must be a valid identifier,
    // otherwise degrade to equal (this is injection prevention, not cosmetics).
    let mode = ['equal', 'marketcap', 'score'].includes(sizing) ? sizing : 'equal';
    let ref = String(sizingRef || '').trim();
    if (mode === 'score' && !IDENT.test(ref)) { mode = 'equal'; ref = ''; }

    if (mode === 'marketcap') {
      return {
        code: [
          '# position sizing — marketcap weighted (declare marketcap under strategy.config.data)',
          '# before the asset loop:',
          "#   marketcap = data['marketcap']  # MultiIndex [asset, datetime], cols [rank, market_cap]",
          '#   try:',
          "#       mc_latest = marketcap['market_cap'].groupby(level='asset').last()",
          '#   except (KeyError, TypeError, ValueError):',
          '#       mc_latest = {}',
          '#   sizing_scores = {}',
          '# inside the asset loop (after signal):',
          'sizing_scores[asset] = float(mc_latest.get(asset, 0.0)) if signal else 0.0',
          '# after the asset loop — normalize scores into final weights:',
          '# total = sum(sizing_scores.values())',
          '# for _a, _s in sizing_scores.items():',
          "#     weights[_a] = {'weight': round(_s / total, 4) if total > 0 else 0.0}",
        ].join('\n'),
        config_hint: CONFIG_HINT.marketcap_weight,
      };
    }
    if (mode === 'score') {
      return {
        code: [
          `# position sizing — indicator-score weighted (by ${ref}; negative scores clipped to 0)`,
          '# before the asset loop: sizing_scores = {}',
          '# inside the asset loop (after signal):',
          `sizing_scores[asset] = max(float(${ref}.iloc[-1]), 0.0) if signal else 0.0`,
          '# after the asset loop — normalize scores into final weights:',
          '# total = sum(sizing_scores.values())',
          '# for _a, _s in sizing_scores.items():',
          "#     weights[_a] = {'weight': round(_s / total, 4) if total > 0 else 0.0}",
        ].join('\n'),
        config_hint: null,
      };
    }
    return {
      code: '# position sizing — equal weight (insert inside the asset loop, after signal)\n' +
            "weights[asset] = {'weight': round(1.0 / max(len(assets), 1), 4) if signal else 0.0}",
      config_hint: null,
    };
  }

  // ── StrategyBuilder.tsx:140-157 — the PANEL's config snippet.
  // Intentionally a `position:` fragment, NOT the backend's full-file
  // system:/strategy:/live: document. Mirror the panel.
  function generateConfigSnippet(f) {
    const lines = ['# Merge into strategy.config in config.yaml:', '    data:', `      ohlcv: ${f.ohlcv}`];
    if (f.sizing === 'marketcap') lines.push('      marketcap: 30');
    lines.push('    position:');
    lines.push(`      assets: [${f.assets.split(',').map(s => s.trim()).filter(Boolean).join(', ')}]`);
    lines.push(`      frequency: "${f.frequency}"`);
    if (f.market === 'futures') lines.push(`      leverage: ${f.leverage}`);
    lines.push(`      rebalancing_interval_hours: ${f.rebalancing}`);
    return { code: lines.join('\n'), config_hint: null };
  }

  return {
    INDICATORS, generateIndicatorSnippet, generateSignalSnippet,
    generateSizingSnippet, generateConfigSnippet, compileSignalRule, toposortFuncs,
  };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = NM_CODEGEN;

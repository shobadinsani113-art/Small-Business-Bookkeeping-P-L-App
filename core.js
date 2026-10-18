/* core.js — state, storage, dates, money and every bookkeeping rule. No DOM access. */
(function () {
  'use strict';
  var B = window.BOOKS = window.BOOKS || {};

  /* ============ CONSTANTS ============ */
  var STORAGE_KEY = 'cashbook_v1', VERSION = 1;
  var CURRENCIES = [
    { code: 'USD', label: 'US Dollar (USD)', locale: 'en-US' }, { code: 'EUR', label: 'Euro (EUR)', locale: 'de-DE' },
    { code: 'GBP', label: 'British Pound (GBP)', locale: 'en-GB' }, { code: 'AUD', label: 'Australian Dollar (AUD)', locale: 'en-AU' },
    { code: 'CAD', label: 'Canadian Dollar (CAD)', locale: 'en-CA' }, { code: 'SGD', label: 'Singapore Dollar (SGD)', locale: 'en-SG' },
    { code: 'MYR', label: 'Malaysian Ringgit (MYR)', locale: 'ms-MY' }, { code: 'IDR', label: 'Indonesian Rupiah (IDR)', locale: 'id-ID' },
    { code: 'JPY', label: 'Japanese Yen (JPY)', locale: 'ja-JP' }, { code: 'INR', label: 'Indian Rupee (INR)', locale: 'en-IN' }
  ];
  var ZERO_DECIMAL = ['IDR', 'JPY'];
  var GROUPS = {
    'revenue': { dir: 'in', label: 'Revenue' }, 'other-income': { dir: 'in', label: 'Other income' },
    'cogs': { dir: 'out', label: 'Cost of goods sold' }, 'opex': { dir: 'out', label: 'Operating expenses' },
    'other-expense': { dir: 'out', label: 'Other expenses' }, 'non-pl': { dir: null, label: 'Not in profit and loss' }
  };
  var CF_TYPES = { owner: 'Owner', financing: 'Financing', investing: 'Investing' };
  var EXPENSE_GROUPS = ['cogs', 'opex', 'other-expense'];

  /* ============ STATE ============ */
  var state = null, persist = true, listeners = [], lastSaveError = null;
  var clock = function () { return new Date(); };
  function uid(p) { return (p || 'id') + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function ok(n) { return typeof n === 'number' && isFinite(n); }
  function fail(msg) { throw new Error(msg); }
  function byId(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return null; }
  function account(id) { return byId(state.accounts, id); }
  function category(id) { return byId(state.categories, id); }
  function rule(id) { return byId(state.rules, id); }
  function debt(id) { return byId(state.debts, id); }
  function tx(id) { return byId(state.transactions, id); }

  /* ============ STORAGE ============ */
  function save() {
    if (!persist) return true;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); lastSaveError = null; } catch (e) { lastSaveError = e; }
    listeners.forEach(function (fn) { fn(); });
    return !lastSaveError;
  }
  function load() {
    var loaded = null;
    try { var raw = localStorage.getItem(STORAGE_KEY); if (raw) { var p = JSON.parse(raw); if (!validate(p)) loaded = p; } } catch (e) { loaded = null; }
    state = loaded || B.data.buildSample(api, today());
    processRecurring(today());
    save();
  }

  /* ============ DATES (YYYY-MM-DD strings only) ============ */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtDate(y, m, d) { return y + '-' + pad(m) + '-' + pad(d); }
  function today() { var d = clock(); return fmtDate(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  function parts(s) { return { y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) }; }
  function isDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && parts(s).m >= 1 && parts(s).m <= 12 && parts(s).d >= 1 && parts(s).d <= dim(parts(s).y, parts(s).m); }
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function addDays(s, n) { var p = parts(s), t = new Date(Date.UTC(p.y, p.m - 1, p.d + n)); return fmtDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); }
  function diffDays(a, b) { var pa = parts(a), pb = parts(b); return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 864e5); }
  function addMonths(y, m, k) { var t = (y * 12 + (m - 1)) + k; return { y: Math.floor(t / 12), m: t % 12 + 1 }; }
  function monthStart(s) { return s.slice(0, 8) + '01'; }
  function monthEnd(s) { var p = parts(s); return fmtDate(p.y, p.m, dim(p.y, p.m)); }
  function shiftMonth(s, k) { var p = parts(s), q = addMonths(p.y, p.m, k); return fmtDate(q.y, q.m, Math.min(p.d, dim(q.y, q.m))); }

  /* ============ MONEY ============ */
  function currency() { for (var i = 0; i < CURRENCIES.length; i++) if (CURRENCIES[i].code === state.settings.currency) return CURRENCIES[i]; return CURRENCIES[0]; }
  function digits() { return ZERO_DECIMAL.indexOf(state.settings.currency) > -1 ? 0 : 2; }
  function scale() { return Math.pow(10, digits()); }
  function toMinor(v) { if (!ok(v)) return 0; var x = v * scale(); return Math.round(x + (x >= 0 ? 1e-7 : -1e-7)); }
  function fromMinor(n) { return n / scale(); }
  function roundMoney(v) { return fromMinor(toMinor(v)); }
  var fmtCache = {};
  function money(v, signed) {
    if (!ok(v)) return '—';
    var c = currency(), k = c.code;
    if (!fmtCache[k]) fmtCache[k] = new Intl.NumberFormat(c.locale, { style: 'currency', currency: c.code, minimumFractionDigits: digits(), maximumFractionDigits: digits() });
    var s = fmtCache[k].format(Math.abs(v));
    return v < 0 ? '−' + s : (signed && v > 0 ? '+' + s : s);
  }
  function pct(n) { return ok(n) ? (Math.round(n * 10) / 10).toFixed(1) + '%' : '—'; }

  /* ============ BALANCES ============ */
  function balanceAt(accountId, date) {
    var a = account(accountId); if (!a) return 0;
    var t = toMinor(a.opening);
    state.transactions.forEach(function (x) {
      if (date && x.date > date) return;
      var amt = toMinor(x.amount);
      if (x.type === 'in' && x.accountId === accountId) t += amt;
      else if (x.type === 'out' && x.accountId === accountId) t -= amt;
      else if (x.type === 'transfer') { if (x.accountId === accountId) t -= amt; if (x.toAccountId === accountId) t += amt; }
    });
    return fromMinor(t);
  }
  function totalBalance(date, includeArchived) {
    return fromMinor(state.accounts.reduce(function (s, a) { return (includeArchived || !a.archived) ? s + toMinor(balanceAt(a.id, date)) : s; }, 0));
  }
  /* Would saving this transaction push an account below zero at any point from its date onward? */
  function negativeWarning(draft, excludeId) {
    var touched = [draft.accountId]; if (draft.type === 'transfer') touched.push(draft.toAccountId);
    var copy = state.transactions.filter(function (x) { return x.id !== excludeId; }).concat([draft]);
    var warn = [];
    touched.forEach(function (aid) {
      var a = account(aid); if (!a) return;
      var dates = copy.filter(function (x) { return x.accountId === aid || x.toAccountId === aid; }).map(function (x) { return x.date; }).filter(function (d) { return d >= draft.date; });
      var minBal = Infinity;
      dates.sort().forEach(function (d) {
        var t = toMinor(a.opening);
        copy.forEach(function (x) { if (x.date > d) return; var amt = toMinor(x.amount); if (x.type === 'in' && x.accountId === aid) t += amt; else if (x.type === 'out' && x.accountId === aid) t -= amt; else if (x.type === 'transfer') { if (x.accountId === aid) t -= amt; if (x.toAccountId === aid) t += amt; } });
        minBal = Math.min(minBal, t);
      });
      if (minBal < 0) warn.push({ account: a.name, balance: fromMinor(minBal) });
    });
    return warn;
  }

  /* ============ PROFIT & LOSS / CASH FLOW ============ */
  function inRange(x, from, to) { return x.date >= from && x.date <= to; }
  function profitAndLoss(from, to) {
    var byCat = {}, g = { 'revenue': 0, 'other-income': 0, 'cogs': 0, 'opex': 0, 'other-expense': 0 };
    state.transactions.forEach(function (x) {
      if (x.type === 'transfer' || !inRange(x, from, to)) return;
      var c = category(x.categoryId); if (!c || c.group === 'non-pl') return;
      var amt = toMinor(x.amount);
      byCat[c.id] = (byCat[c.id] || 0) + amt; g[c.group] += amt;
    });
    var gross = g.revenue - g.cogs, op = gross - g.opex, net = op + g['other-income'] - g['other-expense'];
    var lines = {};
    Object.keys(g).forEach(function (grp) {
      lines[grp] = state.categories.filter(function (c) { return c.group === grp && byCat[c.id]; }).map(function (c) { return { id: c.id, name: c.name, amount: fromMinor(byCat[c.id]) }; })
        .sort(function (a, b) { return b.amount - a.amount; });
    });
    return {
      from: from, to: to, lines: lines,
      revenue: fromMinor(g.revenue), otherIncome: fromMinor(g['other-income']), cogs: fromMinor(g.cogs), opex: fromMinor(g.opex), otherExpense: fromMinor(g['other-expense']),
      grossProfit: fromMinor(gross), operatingProfit: fromMinor(op), netProfit: fromMinor(net),
      expenses: fromMinor(g.cogs + g.opex + g['other-expense']),
      grossMargin: g.revenue ? gross / g.revenue * 100 : null, netMargin: g.revenue ? net / g.revenue * 100 : null,
      byCategory: byCat
    };
  }
  function cashFlow(from, to) {
    var opening = toMinor(totalBalance(addDays(from, -1), true)), op = { in: 0, out: 0 }, inv = 0, fin = 0, finLines = {}, invLines = {};
    state.transactions.forEach(function (x) {
      if (x.type === 'transfer' || !inRange(x, from, to)) return;
      var c = category(x.categoryId); if (!c) return;
      var amt = toMinor(x.amount) * (x.type === 'in' ? 1 : -1);
      if (c.group !== 'non-pl') { if (amt > 0) op.in += amt; else op.out -= amt; }
      else if (c.cf === 'investing') { inv += amt; invLines[c.name] = (invLines[c.name] || 0) + amt; }
      else { fin += amt; finLines[c.name] = (finLines[c.name] || 0) + amt; }
    });
    var net = op.in - op.out + inv + fin;
    function lines(o) { return Object.keys(o).map(function (k) { return { name: k, amount: fromMinor(o[k]) }; }); }
    return { opening: fromMinor(opening), operatingIn: fromMinor(op.in), operatingOut: fromMinor(op.out), operating: fromMinor(op.in - op.out),
      investing: fromMinor(inv), financing: fromMinor(fin), investingLines: lines(invLines), financingLines: lines(finLines),
      net: fromMinor(net), closing: fromMinor(opening + net), closingCheck: totalBalance(to, true) };
  }
  /* Comparison period per the spec */
  function comparison(preset, from, to) {
    if (preset === 'month' || preset === 'last-month') { var pm = shiftMonth(monthStart(from), -1); return { from: pm, to: monthEnd(pm) }; }
    if (preset === 'year') { var ps = shiftMonth(from, -12); return { from: ps, to: addDays(from, -1) }; }
    var len = diffDays(from, to) + 1;
    return { from: addDays(from, -len), to: addDays(from, -1) };
  }
  function fiscalYearStart(date) {
    var p = parts(date), fs = state.settings.fiscalStart || 1, y = p.m >= fs ? p.y : p.y - 1;
    return fmtDate(y, fs, 1);
  }
  function presetRange(preset, ref) {
    ref = ref || today();
    if (preset === 'month') return { from: monthStart(ref), to: monthEnd(ref) };
    if (preset === 'last-month') { var lm = shiftMonth(monthStart(ref), -1); return { from: lm, to: monthEnd(lm) }; }
    if (preset === 'year') { var fy = fiscalYearStart(ref); return { from: fy, to: addDays(shiftMonth(fy, 12), -1) }; }
    if (preset === '12m') { return { from: shiftMonth(monthStart(ref), -11), to: monthEnd(ref) }; }
    if (preset === '30d') return { from: addDays(ref, -29), to: ref };
    return null;
  }
  function trend(endDate, months) {
    var out = [], end = monthStart(endDate);
    for (var k = months - 1; k >= 0; k--) {
      var s = shiftMonth(end, -k), pl = profitAndLoss(s, monthEnd(s));
      out.push({ month: s.slice(0, 7), revenue: pl.revenue + pl.otherIncome, expenses: pl.expenses, net: pl.netProfit });
    }
    return out;
  }
  function expenseBreakdown(from, to) {
    var pl = profitAndLoss(from, to), total = toMinor(pl.expenses), list = [];
    EXPENSE_GROUPS.forEach(function (g) { pl.lines[g].forEach(function (l) { list.push({ name: l.name, group: g, amount: l.amount, share: total ? toMinor(l.amount) / total * 100 : 0 }); }); });
    return list.sort(function (a, b) { return b.amount - a.amount; });
  }

  /* ============ TRANSACTIONS ============ */
  function debtPaidMinor(debtId, excludeTxId) {
    return state.transactions.reduce(function (s, x) { return x.source && x.source.kind === 'debt-payment' && x.source.debtId === debtId && x.id !== excludeTxId ? s + toMinor(x.amount) : s; }, 0);
  }
  function validateTx(d, existing) {
    if (['in', 'out', 'transfer'].indexOf(d.type) === -1) fail('Choose money in, money out or transfer.');
    if (!ok(d.amount) || toMinor(d.amount) <= 0) fail('Enter an amount above 0.');
    if (!isDate(d.date)) fail('Enter a valid date.');
    var a = account(d.accountId); if (!a) fail('Choose an account.');
    var changedAccount = !existing || existing.accountId !== d.accountId || existing.toAccountId !== d.toAccountId;
    if (a.archived && changedAccount) fail('That account is archived.');
    if (d.type === 'transfer') {
      var b = account(d.toAccountId); if (!b) fail('Choose the account to transfer to.');
      if (b.id === a.id) fail('Choose two different accounts.');
      if (b.archived && changedAccount) fail('That account is archived.');
    } else {
      var c = category(d.categoryId); if (!c) fail('Choose a category.');
      if (c.dir !== d.type) fail('That category is for money ' + c.dir + '.');
      if (c.archived && (!existing || existing.categoryId !== d.categoryId)) fail('That category is archived.');
    }
    if (d.source && d.source.kind === 'debt-payment') {
      var dbt = debt(d.source.debtId);
      if (dbt) {
        var remaining = toMinor(dbt.amount) - debtPaidMinor(dbt.id, existing ? existing.id : null);
        if (toMinor(d.amount) > remaining) fail('A payment cannot exceed the remaining ' + money(fromMinor(remaining)) + '.');
        if (d.date < dbt.date) fail('A payment cannot be dated before the debt.');
      }
    }
  }
  function saveTx(d) {
    var existing = d.id ? tx(d.id) : null;
    var clean = { id: existing ? existing.id : uid('t'), date: d.date, type: d.type, amount: roundMoney(d.amount), accountId: d.accountId,
      toAccountId: d.type === 'transfer' ? d.toAccountId : null, categoryId: d.type === 'transfer' ? null : d.categoryId,
      note: (d.note || '').trim(), source: existing ? existing.source : (d.source || { kind: 'manual' }), createdAt: existing ? existing.createdAt : clock().toISOString() };
    validateTx(clean, existing);
    if (existing) state.transactions[state.transactions.indexOf(existing)] = clean; else state.transactions.push(clean);
    if (clean.categoryId) { var r = state.recent[clean.type] = (state.recent[clean.type] || []).filter(function (id) { return id !== clean.categoryId; }); r.unshift(clean.categoryId); r.length = Math.min(r.length, 5); }
    save();
    return clean;
  }
  function deleteTx(id) { state.transactions = state.transactions.filter(function (x) { return x.id !== id; }); save(); }
  function filterTx(f) {
    var q = (f.search || '').trim().toLowerCase();
    return state.transactions.filter(function (x) {
      if (f.from && x.date < f.from) return false;
      if (f.to && x.date > f.to) return false;
      if (f.type && f.type !== 'all' && x.type !== f.type) return false;
      if (f.account && f.account !== 'all' && x.accountId !== f.account && x.toAccountId !== f.account) return false;
      if (f.category && f.category !== 'all' && x.categoryId !== f.category) return false;
      if (q) { var c = category(x.categoryId); if ((x.note || '').toLowerCase().indexOf(q) === -1 && !(c && c.name.toLowerCase().indexOf(q) > -1)) return false; }
      return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : (a.createdAt < b.createdAt ? 1 : -1); });
  }
  function totalsOf(list, accountFilter) {
    var i = 0, o = 0;
    list.forEach(function (x) {
      var amt = toMinor(x.amount);
      if (x.type === 'in') i += amt; else if (x.type === 'out') o += amt;
      else if (accountFilter && accountFilter !== 'all') { if (x.toAccountId === accountFilter) i += amt; if (x.accountId === accountFilter) o += amt; }
    });
    return { in: fromMinor(i), out: fromMinor(o), net: fromMinor(i - o) };
  }

  /* ============ RECURRING ============ */
  function occurrences(r, upTo) {
    var out = [], end = r.end && r.end < upTo ? r.end : upTo, p = parts(r.start);
    for (var k = 0; k < 5000; k++) {
      var d;
      if (r.freq === 'weekly') d = addDays(r.start, 7 * k);
      else if (r.freq === 'monthly') { var q = addMonths(p.y, p.m, k); d = fmtDate(q.y, q.m, Math.min(p.d, dim(q.y, q.m))); }
      else d = fmtDate(p.y + k, p.m, Math.min(p.d, dim(p.y + k, p.m)));
      if (d > end) break;
      out.push(d);
    }
    return out;
  }
  function nextOccurrence(r, after) {
    var list = occurrences(r, addDays(after, 400)); for (var i = 0; i < list.length; i++) if (list[i] > after && r.handled.indexOf(list[i]) === -1) return list[i]; return null;
  }
  function postOccurrence(r, occ, amount, accountId) {
    state.transactions.push({ id: uid('t'), date: occ, type: r.type, amount: roundMoney(amount), accountId: accountId, toAccountId: null, categoryId: r.categoryId,
      note: r.name, source: { kind: 'recurring', ruleId: r.id, occ: occ }, createdAt: clock().toISOString() });
    r.handled.push(occ);
  }
  function processRecurring(day) {
    var posted = 0;
    state.rules.forEach(function (r) {
      if (r.paused || r.mode !== 'auto') return;
      occurrences(r, day).forEach(function (occ) { if (r.handled.indexOf(occ) === -1) { postOccurrence(r, occ, r.amount, r.accountId); posted++; } });
    });
    if (posted) save();
    return posted;
  }
  function dueItems(day) {
    var out = [];
    state.rules.forEach(function (r) {
      if (r.paused || r.mode !== 'confirm') return;
      occurrences(r, day).forEach(function (occ) { if (r.handled.indexOf(occ) === -1) out.push({ rule: r, occ: occ }); });
    });
    return out.sort(function (a, b) { return a.occ < b.occ ? -1 : 1; });
  }
  function confirmDue(ruleId, occ, amount, accountId) {
    var r = rule(ruleId); if (!r) fail('Rule not found.');
    if (r.handled.indexOf(occ) > -1) fail('Already handled.');
    if (!ok(amount) || toMinor(amount) <= 0) fail('Enter an amount above 0.');
    if (!account(accountId)) fail('Choose an account.');
    postOccurrence(r, occ, amount, accountId); save();
  }
  function skipDue(ruleId, occ) { var r = rule(ruleId); if (r && r.handled.indexOf(occ) === -1) { r.handled.push(occ); save(); } }
  function pendingCountForRule(d, day) {
    return occurrences({ start: d.start, end: d.end, freq: d.freq }, day).length;
  }
  function saveRule(d) {
    var name = (d.name || '').trim(); if (!name) fail('Enter a name.');
    if (d.type !== 'in' && d.type !== 'out') fail('Choose money in or money out.');
    var c = category(d.categoryId); if (!c || c.dir !== d.type) fail('Choose a category for money ' + d.type + '.');
    if (!account(d.accountId)) fail('Choose an account.');
    if (!ok(d.amount) || toMinor(d.amount) <= 0) fail('Enter an amount above 0.');
    if (['weekly', 'monthly', 'yearly'].indexOf(d.freq) === -1) fail('Choose how often.');
    if (!isDate(d.start)) fail('Enter a valid start date.');
    if (d.end && !isDate(d.end)) fail('Enter a valid end date or leave it empty.');
    if (d.end && d.end < d.start) fail('The end date must be after the start date.');
    var existing = d.id ? rule(d.id) : null;
    var fields = { name: name, type: d.type, categoryId: d.categoryId, accountId: d.accountId, amount: roundMoney(d.amount), freq: d.freq, start: d.start, end: d.end || null, mode: d.mode === 'auto' ? 'auto' : 'confirm' };
    if (existing) Object.keys(fields).forEach(function (k) { existing[k] = fields[k]; });
    else { existing = fields; existing.id = uid('r'); existing.paused = false; existing.handled = []; state.rules.push(existing); }
    processRecurring(today()); save();
    return existing;
  }
  function setRulePaused(id, paused) { var r = rule(id); if (r) { r.paused = !!paused; processRecurring(today()); save(); } }
  function deleteRule(id) { state.rules = state.rules.filter(function (r) { return r.id !== id; }); save(); }
  function scheduleText(r) {
    var p = parts(r.start);
    if (r.freq === 'weekly') return 'Every week on ' + new Date(Date.UTC(p.y, p.m - 1, p.d)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    if (r.freq === 'monthly') return p.d >= 29 ? 'Monthly on day ' + p.d + ' (or the last day)' : 'Monthly on day ' + p.d;
    return 'Every year on ' + new Date(Date.UTC(2000, p.m - 1, p.d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
  }

  /* ============ DEBTS ============ */
  function debtInfo(d, day) {
    day = day || today();
    var paid = debtPaidMinor(d.id), remaining = toMinor(d.amount) - paid, status;
    if (remaining <= 0) status = 'paid';
    else if (d.due && d.due < day) status = 'overdue';
    else if (paid > 0) status = 'partial';
    else status = 'open';
    var daysPast = d.due && remaining > 0 ? Math.max(0, diffDays(d.due, day)) : 0;
    var bucket = remaining <= 0 ? null : !d.due || daysPast === 0 ? 'not-due' : daysPast <= 30 ? '1-30' : daysPast <= 60 ? '31-60' : '61+';
    return { debt: d, paid: fromMinor(paid), remaining: fromMinor(remaining), status: status, daysPast: daysPast, bucket: bucket,
      payments: state.transactions.filter(function (x) { return x.source && x.source.kind === 'debt-payment' && x.source.debtId === d.id; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }) };
  }
  function aging(kind, day) {
    var b = { 'not-due': 0, '1-30': 0, '31-60': 0, '61+': 0 };
    state.debts.filter(function (d) { return d.kind === kind; }).forEach(function (d) { var i = debtInfo(d, day); if (i.bucket) b[i.bucket] += toMinor(i.remaining); });
    Object.keys(b).forEach(function (k) { b[k] = fromMinor(b[k]); });
    return b;
  }
  function saveDebt(d) {
    if (d.kind !== 'receivable' && d.kind !== 'payable') fail('Choose receivable or payable.');
    var party = (d.party || '').trim(); if (!party) fail('Enter who owes or is owed.');
    if (!ok(d.amount) || toMinor(d.amount) <= 0) fail('Enter an amount above 0.');
    if (!isDate(d.date)) fail('Enter a valid date.');
    if (d.due && !isDate(d.due)) fail('Enter a valid due date or leave it empty.');
    if (d.due && d.due < d.date) fail('The due date cannot be before the debt date.');
    var c = category(d.categoryId), dir = d.kind === 'receivable' ? 'in' : 'out';
    if (!c || c.dir !== dir) fail('Choose a payment category for money ' + dir + '.');
    var existing = d.id ? debt(d.id) : null;
    if (existing && toMinor(d.amount) < debtPaidMinor(existing.id)) fail('The amount cannot be lower than what has already been paid.');
    if (existing && existing.kind !== d.kind && debtPaidMinor(existing.id) > 0) fail('A debt with payments cannot change between receivable and payable.');
    var fields = { kind: d.kind, party: party, description: (d.description || '').trim(), amount: roundMoney(d.amount), date: d.date, due: d.due || null, categoryId: d.categoryId };
    if (existing) {
      Object.keys(fields).forEach(function (k) { existing[k] = fields[k]; });
      state.transactions.forEach(function (x) { if (x.source && x.source.debtId === existing.id) x.categoryId = existing.categoryId; });
    } else { existing = fields; existing.id = uid('d'); state.debts.push(existing); }
    save();
    return existing;
  }
  function recordPayment(debtId, amount, date, accountId, note) {
    var d = debt(debtId); if (!d) fail('Debt not found.');
    return saveTx({ type: d.kind === 'receivable' ? 'in' : 'out', amount: amount, date: date, accountId: accountId, categoryId: d.categoryId,
      note: note || ('Payment · ' + d.party), source: { kind: 'debt-payment', debtId: d.id } });
  }
  function deleteDebt(id) {
    if (debtPaidMinor(id) > 0) fail('Delete this debt’s payments first.');
    state.debts = state.debts.filter(function (d) { return d.id !== id; }); save();
  }

  /* ============ BUDGETS ============ */
  function budgetStatus(categoryId, monthKey) {
    var b = state.budgets.filter(function (x) { return x.categoryId === categoryId; })[0]; if (!b) return null;
    var from = monthKey + '-01', to = monthEnd(from), spent = 0;
    state.transactions.forEach(function (x) { if (x.type === 'out' && x.categoryId === categoryId && x.date >= from && x.date <= to) spent += toMinor(x.amount); });
    var budget = toMinor(b.amount), share = budget ? spent / budget * 100 : 0;
    return { categoryId: categoryId, budget: fromMinor(budget), spent: fromMinor(spent), remaining: fromMinor(budget - spent), share: share,
      status: share > 100 ? 'over' : share >= 80 ? 'near' : 'ok' };
  }
  function setBudget(categoryId, amount) {
    var c = category(categoryId); if (!c || EXPENSE_GROUPS.indexOf(c.group) === -1) fail('Budgets are for expense categories (COGS, operating or other expenses).');
    if (!ok(amount) || toMinor(amount) <= 0) fail('Enter a monthly budget above 0.');
    var b = state.budgets.filter(function (x) { return x.categoryId === categoryId; })[0];
    if (b) b.amount = roundMoney(amount); else state.budgets.push({ categoryId: categoryId, amount: roundMoney(amount) });
    save();
  }
  function removeBudget(categoryId) { state.budgets = state.budgets.filter(function (x) { return x.categoryId !== categoryId; }); save(); }

  /* ============ CATEGORIES & ACCOUNTS ============ */
  function categoryUsage(id) {
    return {
      transactions: state.transactions.filter(function (x) { return x.categoryId === id; }).length,
      rules: state.rules.filter(function (r) { return r.categoryId === id; }).length,
      debts: state.debts.filter(function (d) { return d.categoryId === id; }).length,
      budget: state.budgets.some(function (b) { return b.categoryId === id; })
    };
  }
  function isUsed(u) { return u.transactions || u.rules || u.debts || u.budget; }
  function saveCategory(d) {
    var name = (d.name || '').trim(); if (!name) fail('Enter a category name.');
    if (!GROUPS[d.group]) fail('Choose a group.');
    var dir = d.group === 'non-pl' ? d.dir : GROUPS[d.group].dir;
    if (dir !== 'in' && dir !== 'out') fail('Choose money in or money out.');
    if (d.group === 'non-pl' && !CF_TYPES[d.cf]) fail('Choose a cash-flow type (Owner, Financing or Investing).');
    if (state.categories.some(function (c) { return c.id !== d.id && c.dir === dir && c.name.toLowerCase() === name.toLowerCase(); })) fail('A category with that name already exists.');
    var existing = d.id ? category(d.id) : null;
    if (existing && existing.dir !== dir && isUsed(categoryUsage(existing.id))) fail('The direction of a category in use cannot change.');
    if (existing && dir === 'in' && state.budgets.some(function (b) { return b.categoryId === existing.id; })) state.budgets = state.budgets.filter(function (b) { return b.categoryId !== existing.id; });
    var fields = { name: name, dir: dir, group: d.group, cf: d.group === 'non-pl' ? d.cf : null };
    if (existing) { Object.keys(fields).forEach(function (k) { existing[k] = fields[k]; }); if (EXPENSE_GROUPS.indexOf(existing.group) === -1) state.budgets = state.budgets.filter(function (b) { return b.categoryId !== existing.id; }); }
    else { existing = fields; existing.id = uid('c'); existing.archived = false; state.categories.push(existing); }
    save();
    return existing;
  }
  function setCategoryArchived(id, v) { var c = category(id); if (c) { c.archived = !!v; save(); } }
  function deleteCategory(id, moveTo) {
    var c = category(id); if (!c) return;
    var u = categoryUsage(id);
    if (isUsed(u)) {
      var t = category(moveTo); if (!t || t.id === id) fail('Choose a category to move everything to.');
      if (t.dir !== c.dir) fail('The target category must be for money ' + c.dir + '.');
      state.transactions.forEach(function (x) { if (x.categoryId === id) x.categoryId = moveTo; });
      state.rules.forEach(function (r) { if (r.categoryId === id) r.categoryId = moveTo; });
      state.debts.forEach(function (d) { if (d.categoryId === id) d.categoryId = moveTo; });
      var b = state.budgets.filter(function (x) { return x.categoryId === id; })[0];
      var hasTarget = state.budgets.some(function (x) { return x.categoryId === moveTo; });
      if (b && !hasTarget && EXPENSE_GROUPS.indexOf(t.group) > -1) b.categoryId = moveTo;
      state.budgets = state.budgets.filter(function (x) { return x.categoryId !== id; });
    }
    state.categories = state.categories.filter(function (x) { return x.id !== id; });
    ['in', 'out'].forEach(function (k) { state.recent[k] = (state.recent[k] || []).filter(function (x) { return x !== id; }); });
    save();
  }
  function accountUsed(id) { return state.transactions.some(function (x) { return x.accountId === id || x.toAccountId === id; }) || state.rules.some(function (r) { return r.accountId === id; }); }
  function saveAccount(d) {
    var name = (d.name || '').trim(); if (!name) fail('Enter an account name.');
    if (['cash', 'bank', 'e-wallet', 'other'].indexOf(d.type) === -1) fail('Choose an account type.');
    if (!ok(d.opening)) fail('Enter an opening balance (0 or more).');
    if (state.accounts.some(function (a) { return a.id !== d.id && a.name.toLowerCase() === name.toLowerCase(); })) fail('An account with that name already exists.');
    var existing = d.id ? account(d.id) : null, fields = { name: name, type: d.type, opening: roundMoney(d.opening) };
    if (existing) Object.keys(fields).forEach(function (k) { existing[k] = fields[k]; });
    else { existing = fields; existing.id = uid('a'); existing.archived = false; state.accounts.push(existing); }
    save();
    return existing;
  }
  function setAccountArchived(id, v) {
    var active = state.accounts.filter(function (a) { return !a.archived; });
    if (v && active.length <= 1) fail('Keep at least one active account.');
    var a = account(id); if (a) { a.archived = !!v; save(); }
  }
  function deleteAccount(id) { if (accountUsed(id)) fail('This account has transactions or recurring rules. Archive it instead.'); state.accounts = state.accounts.filter(function (a) { return a.id !== id; }); save(); }

  /* ============ UPCOMING & DASHBOARD HELPERS ============ */
  function upcoming(day, days) {
    var end = addDays(day, days), out = [];
    state.rules.forEach(function (r) {
      if (r.paused) return;
      occurrences(r, end).forEach(function (o) { if (o > day && r.handled.indexOf(o) === -1) out.push({ kind: 'rule', date: o, label: r.name, amount: r.amount, type: r.type }); });
    });
    state.debts.forEach(function (d) {
      var i = debtInfo(d, day);
      if (d.due && i.remaining > 0 && d.due >= day && d.due <= end) out.push({ kind: d.kind, date: d.due, label: d.party, amount: i.remaining, type: d.kind === 'receivable' ? 'in' : 'out' });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }

  /* ============ SETTINGS ============ */
  function updateSettings(patch) { Object.keys(patch).forEach(function (k) { state.settings[k] = patch[k]; }); if (patch.currency) fmtCache = {}; save(); }

  /* ============ CSV ============ */
  /* Numbers are written as plain numbers; only text cells get the formula-injection guard */
  function csvCell(v) {
    if (typeof v === 'number') return isFinite(v) ? String(v) : '';
    var s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function toCsv(rows) { return '\ufeff' + rows.map(function (r) { return r.map(csvCell).join(','); }).join('\r\n'); }
  function txCsv(list) {
    var rows = [['Date', 'Type', 'Account', 'To account', 'Category', 'Group', 'Amount (' + state.settings.currency + ')', 'Note']];
    list.forEach(function (x) {
      var c = category(x.categoryId), a = account(x.accountId), b = account(x.toAccountId);
      rows.push([x.date, x.type, a ? a.name : '', b ? b.name : '', c ? c.name : '', c ? GROUPS[c.group].label : 'Transfer', Number((x.type === 'out' ? -x.amount : x.amount).toFixed(digits())), x.note]);
    });
    return toCsv(rows);
  }
  function plCsv(pl, prev) {
    var d = digits(), rows = [['Line', 'Current (' + pl.from + ' to ' + pl.to + ')', 'Previous (' + prev.from + ' to ' + prev.to + ')']];
    function line(label, a, b) { rows.push([label, Number(a.toFixed(d)), Number(b.toFixed(d))]); }
    function group(g, label, ca, pa) {
      var names = {}; pl.lines[g].concat(prev.lines[g]).forEach(function (l) { names[l.id] = l.name; });
      Object.keys(names).forEach(function (id) { line('  ' + names[id], fromMinor(pl.byCategory[id] || 0), fromMinor(prev.byCategory[id] || 0)); });
      line(label, ca, pa);
    }
    group('revenue', 'Revenue', pl.revenue, prev.revenue); group('cogs', 'Cost of goods sold', pl.cogs, prev.cogs);
    line('Gross profit', pl.grossProfit, prev.grossProfit); group('opex', 'Operating expenses', pl.opex, prev.opex);
    line('Operating profit', pl.operatingProfit, prev.operatingProfit); group('other-income', 'Other income', pl.otherIncome, prev.otherIncome);
    group('other-expense', 'Other expenses', pl.otherExpense, prev.otherExpense); line('Net profit', pl.netProfit, prev.netProfit);
    rows.push(['Basis', 'Cash basis', '']);
    return toCsv(rows);
  }

  /* ============ IMPORT / EXPORT ============ */
  function validate(d) {
    if (!d || typeof d !== 'object') return 'The file is not a valid backup.';
    if (d.version !== VERSION) return 'This backup was made by a different version of the app.';
    if (!d.settings || typeof d.settings !== 'object') return 'Settings are missing.';
    var arrays = ['accounts', 'categories', 'transactions', 'rules', 'debts', 'budgets'];
    for (var i = 0; i < arrays.length; i++) if (!Array.isArray(d[arrays[i]])) return 'The backup is missing "' + arrays[i] + '".';
    if (!CURRENCIES.some(function (c) { return c.code === d.settings.currency; })) return 'Unsupported currency.';
    if (!d.accounts.length) return 'The backup has no accounts.';
    for (i = 0; i < d.accounts.length; i++) if (!d.accounts[i].id || typeof d.accounts[i].name !== 'string' || !ok(d.accounts[i].opening)) return 'Account ' + (i + 1) + ' is invalid.';
    for (i = 0; i < d.categories.length; i++) { var c = d.categories[i]; if (!c.id || typeof c.name !== 'string' || !GROUPS[c.group] || (c.dir !== 'in' && c.dir !== 'out')) return 'Category ' + (i + 1) + ' is invalid.'; }
    for (i = 0; i < d.transactions.length; i++) { var t = d.transactions[i]; if (!t.id || !isDate(t.date) || ['in', 'out', 'transfer'].indexOf(t.type) === -1 || !ok(t.amount)) return 'Transaction ' + (i + 1) + ' is invalid.'; }
    for (i = 0; i < d.rules.length; i++) { var r = d.rules[i]; if (!r.id || !isDate(r.start) || !Array.isArray(r.handled)) return 'Recurring rule ' + (i + 1) + ' is invalid.'; }
    for (i = 0; i < d.debts.length; i++) { var x = d.debts[i]; if (!x.id || !isDate(x.date) || !ok(x.amount)) return 'Debt ' + (i + 1) + ' is invalid.'; }
    return null;
  }
  function exportState() { return JSON.stringify(state); }
  function importState(json) {
    var d; try { d = JSON.parse(json); } catch (e) { fail('The file is not valid JSON.'); }
    var p = validate(d); if (p) fail(p);
    if (!d.recent) d.recent = { in: [], out: [] };
    state = d; fmtCache = {}; save();
  }
  function loadSample() { state = B.data.buildSample(api, today()); processRecurring(today()); fmtCache = {}; save(); }
  function clearAll() {
    state = { version: VERSION, settings: state.settings, accounts: state.accounts.map(function (a) { return { id: a.id, name: a.name, type: a.type, opening: 0, archived: a.archived }; }),
      categories: state.categories, transactions: [], rules: [], debts: [], budgets: [], recent: { in: [], out: [] } };
    save();
  }

  /* ============ SELF-TESTS (golden tests) ============ */
  function runSelfTests() {
    var saved = state, savedPersist = persist, savedClock = clock, results = [];
    function check(name, actual, expected) {
      var pass = typeof expected === 'number' ? Math.abs(actual - expected) < 1e-6 : actual === expected;
      results.push({ name: name, pass: pass, actual: actual, expected: expected });
    }
    function setToday(s) { var p = parts(s); clock = function () { return new Date(p.y, p.m - 1, p.d, 12, 0, 0); }; }
    function base() {
      return { version: VERSION, settings: { businessName: 'Test', currency: 'USD', fiscalStart: 1, theme: 'system' },
        accounts: [{ id: 'cash', name: 'Cash', type: 'cash', opening: 500, archived: false }, { id: 'bank', name: 'Bank', type: 'bank', opening: 2000, archived: false }],
        categories: [
          { id: 'sales', name: 'Sales', dir: 'in', group: 'revenue', cf: null, archived: false },
          { id: 'interest', name: 'Bank interest', dir: 'in', group: 'other-income', cf: null, archived: false },
          { id: 'ingr', name: 'Ingredients', dir: 'out', group: 'cogs', cf: null, archived: false },
          { id: 'rent', name: 'Rent', dir: 'out', group: 'opex', cf: null, archived: false },
          { id: 'sal', name: 'Salaries', dir: 'out', group: 'opex', cf: null, archived: false },
          { id: 'draw', name: 'Owner drawings', dir: 'out', group: 'non-pl', cf: 'owner', archived: false },
          { id: 'equip', name: 'Equipment purchase', dir: 'out', group: 'non-pl', cf: 'investing', archived: false }],
        transactions: [], rules: [], debts: [], budgets: [], recent: { in: [], out: [] } };
    }
    function test1() {
      state = base(); setToday('2026-10-31');
      [['2026-10-01', 'out', 1500, 'bank', 'rent'], ['2026-10-03', 'in', 3200, 'bank', 'sales'], ['2026-10-04', 'in', 850, 'cash', 'sales'],
       ['2026-10-05', 'out', 1240.5, 'cash', 'ingr'], ['2026-10-15', 'out', 300, 'bank', 'draw'], ['2026-10-20', 'out', 650, 'bank', 'equip'],
       ['2026-10-25', 'out', 900, 'bank', 'sal'], ['2026-10-31', 'in', 4.25, 'bank', 'interest']].forEach(function (r) {
        saveTx({ date: r[0], type: r[1], amount: r[2], accountId: r[3], categoryId: r[4] });
      });
      saveTx({ date: '2026-10-10', type: 'transfer', amount: 200, accountId: 'bank', toAccountId: 'cash' });
    }
    try {
      persist = false; fmtCache = {};
      /* Test 1 */
      test1();
      var pl = profitAndLoss('2026-10-01', '2026-10-31'), cf = cashFlow('2026-10-01', '2026-10-31');
      check('T1 revenue', pl.revenue, 4050); check('T1 COGS', pl.cogs, 1240.5); check('T1 gross profit', pl.grossProfit, 2809.5); check('T1 gross margin', pct(pl.grossMargin), '69.4%');
      check('T1 opex', pl.opex, 2400); check('T1 operating profit', pl.operatingProfit, 409.5); check('T1 net profit', pl.netProfit, 413.75); check('T1 net margin', pct(pl.netMargin), '10.2%');
      check('T1 bank', balanceAt('bank', '2026-10-31'), 1654.25); check('T1 cash', balanceAt('cash', '2026-10-31'), 309.5); check('T1 total', totalBalance('2026-10-31'), 1963.75);
      check('T1 CF opening', cf.opening, 2500); check('T1 CF operating', cf.operating, 413.75); check('T1 CF investing', cf.investing, -650); check('T1 CF financing', cf.financing, -300); check('T1 CF closing', cf.closing, 1963.75);
      /* Test 2 */
      setBudget('ingr', 1500);
      var b1 = budgetStatus('ingr', '2026-10');
      check('T2 spent', b1.spent, 1240.5); check('T2 share', pct(b1.share), '82.7%'); check('T2 status near', b1.status, 'near');
      saveTx({ date: '2026-10-28', type: 'out', amount: 300, accountId: 'cash', categoryId: 'ingr' });
      var b2 = budgetStatus('ingr', '2026-10');
      check('T2 spent after', b2.spent, 1540.5); check('T2 share after', pct(b2.share), '102.7%'); check('T2 status over', b2.status, 'over');
      check('T2 cash', balanceAt('cash', '2026-10-31'), 9.5); check('T2 net profit', profitAndLoss('2026-10-01', '2026-10-31').netProfit, 113.75);
      /* Test 3 */
      test1();
      var dbt = saveDebt({ kind: 'receivable', party: 'Acme Catering', amount: 600, date: '2026-10-02', due: '2026-10-20', categoryId: 'sales' });
      var pay = recordPayment(dbt.id, 250, '2026-10-25', 'bank');
      var di = debtInfo(dbt, '2026-10-31'), pl3 = profitAndLoss('2026-10-01', '2026-10-31');
      check('T3 remaining', di.remaining, 350); check('T3 status', di.status, 'overdue'); check('T3 aging 1-30', aging('receivable', '2026-10-31')['1-30'], 350);
      check('T3 revenue', pl3.revenue, 4300); check('T3 net profit', pl3.netProfit, 663.75); check('T3 bank', balanceAt('bank', '2026-10-31'), 1904.25);
      var rejected = false; try { recordPayment(dbt.id, 400, '2026-10-30', 'bank'); } catch (e) { rejected = true; }
      check('T3 overpayment rejected', rejected, true);
      deleteTx(pay.id);
      var di2 = debtInfo(dbt, '2026-10-31');
      check('T3 remaining after delete', di2.remaining, 600); check('T3 status after delete', di2.status, 'overdue');
      check('T3 revenue after delete', profitAndLoss('2026-10-01', '2026-10-31').revenue, 4050); check('T3 bank after delete', balanceAt('bank', '2026-10-31'), 1654.25);
      /* Test 4 */
      state = base(); setToday('2027-03-15');
      var ra = saveRule({ name: 'Rent', type: 'out', categoryId: 'rent', accountId: 'bank', amount: 1500, freq: 'monthly', start: '2027-01-31', mode: 'auto' });
      var rb = saveRule({ name: 'Electricity', type: 'out', categoryId: 'rent', accountId: 'bank', amount: 180, freq: 'monthly', start: '2027-01-05', mode: 'confirm' });
      processRecurring('2027-03-15');
      var aTx = function () { return state.transactions.filter(function (x) { return x.source.ruleId === ra.id; }).map(function (x) { return x.date; }).sort(); };
      check('T4 rule A count', aTx().length, 2); check('T4 rule A dates', aTx().join(','), '2027-01-31,2027-02-28');
      check('T4 due count', dueItems('2027-03-15').length, 3); check('T4 rule B posts nothing', state.transactions.filter(function (x) { return x.source.ruleId === rb.id; }).length, 0);
      processRecurring('2027-03-15');
      check('T4 idempotent', state.transactions.length, 2); check('T4 still 3 due', dueItems('2027-03-15').length, 3);
      skipDue(rb.id, '2027-01-05'); confirmDue(rb.id, '2027-02-05', 192.4, 'bank');
      var bTx = state.transactions.filter(function (x) { return x.source.ruleId === rb.id; });
      check('T4 confirmed count', bTx.length, 1); check('T4 confirmed amount', bTx[0].amount, 192.4); check('T4 confirmed date', bTx[0].date, '2027-02-05');
      check('T4 due left', dueItems('2027-03-15').length, 1); check('T4 due left date', dueItems('2027-03-15')[0].occ, '2027-03-05');
      setToday('2027-03-31'); processRecurring('2027-03-31');
      check('T4 rule A total', aTx().length, 3); check('T4 rule A last', aTx()[2], '2027-03-31');
      /* Test 5 */
      test1(); setToday('2026-11-30');
      saveTx({ date: '2026-11-01', type: 'out', amount: 1500, accountId: 'bank', categoryId: 'rent' });
      saveTx({ date: '2026-11-02', type: 'in', amount: 1000, accountId: 'cash', categoryId: 'sales' });
      var nov = presetRange('month', '2026-11-30'), plN = profitAndLoss(nov.from, nov.to), cmp = comparison('month', nov.from, nov.to), plO = profitAndLoss(cmp.from, cmp.to);
      check('T5 Nov revenue', plN.revenue, 1000); check('T5 Nov net', plN.netProfit, -500); check('T5 comparison is October', cmp.from + '..' + cmp.to, '2026-10-01..2026-10-31');
      check('T5 Oct net', plO.netProfit, 413.75); check('T5 change', fromMinor(toMinor(plN.netProfit) - toMinor(plO.netProfit)), -913.75);
      check('T5 Nov 1 in November only', filterTx({ from: '2026-10-01', to: '2026-10-31' }).some(function (x) { return x.date === '2026-11-01'; }), false);
    } catch (e) {
      results.push({ name: 'Unexpected error: ' + e.message, pass: false, actual: '', expected: '' });
    } finally { state = saved; persist = savedPersist; clock = savedClock; fmtCache = {}; }
    var failed = results.filter(function (r) { return !r.pass; });
    results.forEach(function (r) { console[r.pass ? 'log' : 'error']((r.pass ? 'PASS ' : 'FAIL ') + r.name + (r.pass ? '' : ' — expected ' + r.expected + ', got ' + r.actual)); });
    console.log('Self-tests: ' + (results.length - failed.length) + '/' + results.length + ' passed');
    return { passed: results.length - failed.length, total: results.length, failed: failed };
  }

  /* ============ PUBLIC API ============ */
  var api = B.core = {
    VERSION: VERSION, CURRENCIES: CURRENCIES, GROUPS: GROUPS, CF_TYPES: CF_TYPES, EXPENSE_GROUPS: EXPENSE_GROUPS,
    get state() { return state; }, load: load, save: save, onSave: function (fn) { listeners.push(fn); }, saveError: function () { return lastSaveError; },
    setClock: function (fn) { clock = fn || function () { return new Date(); }; },
    uid: uid, clone: clone, ok: ok, account: account, category: category, rule: rule, debt: debt, tx: tx,
    today: today, isDate: isDate, addDays: addDays, diffDays: diffDays, monthStart: monthStart, monthEnd: monthEnd, shiftMonth: shiftMonth, parts: parts, dim: dim, fmtDate: fmtDate,
    currency: currency, digits: digits, toMinor: toMinor, fromMinor: fromMinor, roundMoney: roundMoney, money: money, pct: pct,
    balanceAt: balanceAt, totalBalance: totalBalance, negativeWarning: negativeWarning,
    profitAndLoss: profitAndLoss, cashFlow: cashFlow, comparison: comparison, presetRange: presetRange, fiscalYearStart: fiscalYearStart, trend: trend, expenseBreakdown: expenseBreakdown,
    saveTx: saveTx, deleteTx: deleteTx, filterTx: filterTx, totalsOf: totalsOf,
    occurrences: occurrences, nextOccurrence: nextOccurrence, processRecurring: processRecurring, dueItems: dueItems, confirmDue: confirmDue, skipDue: skipDue,
    pendingCountForRule: pendingCountForRule, saveRule: saveRule, setRulePaused: setRulePaused, deleteRule: deleteRule, scheduleText: scheduleText,
    debtInfo: debtInfo, aging: aging, saveDebt: saveDebt, recordPayment: recordPayment, deleteDebt: deleteDebt,
    budgetStatus: budgetStatus, setBudget: setBudget, removeBudget: removeBudget,
    categoryUsage: categoryUsage, isUsed: isUsed, saveCategory: saveCategory, setCategoryArchived: setCategoryArchived, deleteCategory: deleteCategory,
    accountUsed: accountUsed, saveAccount: saveAccount, setAccountArchived: setAccountArchived, deleteAccount: deleteAccount,
    upcoming: upcoming, updateSettings: updateSettings, txCsv: txCsv, plCsv: plCsv,
    validate: validate, exportState: exportState, importState: importState, loadSample: loadSample, clearAll: clearAll, runSelfTests: runSelfTests,
    _withState: function (st, fn) { var prev = state, pp = persist; state = st; persist = false; try { return fn(); } finally { state = prev; persist = pp; } }
  };
})();

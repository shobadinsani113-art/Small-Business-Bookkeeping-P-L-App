/* ui.js — rendering only. Reads state via BOOKS.core and view state via BOOKS.app.view. No business rules. */
(function () {
  'use strict';
  var B = window.BOOKS = window.BOOKS || {};
  function C() { return B.core; }
  function V() { return B.app.view; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function m(v, signed) { return C().money(v, signed); }
  function sel(a, b) { return a === b ? ' selected' : ''; }
  function chk(v) { return v ? ' checked' : ''; }
  function loc() { return C().currency().locale; }
  function dfmt(s, opts) { var p = C().parts(s); return new Date(p.y, p.m - 1, p.d).toLocaleDateString(loc(), opts || { day: 'numeric', month: 'short', year: 'numeric' }); }
  function mfmt(key) { var p = C().parts(key + '-01'); return new Date(p.y, p.m - 1, 1).toLocaleDateString(loc(), { month: 'long', year: 'numeric' }); }
  function mshort(key) { var p = C().parts(key + '-01'); return new Date(p.y, p.m - 1, 1).toLocaleDateString(loc(), { month: 'short' }); }
  var I = {
    plus: '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    x: '<svg class="i" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    edit: '<svg class="i" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
    copy: '<svg class="i" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    trash: '<svg class="i" viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
    search: '<svg class="i" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
    up: '<svg class="i" viewBox="0 0 24 24"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    down: '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
    swap: '<svg class="i" viewBox="0 0 24 24"><path d="M4 8h14l-4-4M20 16H6l4 4"/></svg>',
    repeat: '<svg class="i" viewBox="0 0 24 24"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    warn: '<svg class="i" viewBox="0 0 24 24"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17v.5"/></svg>',
    print: '<svg class="i" viewBox="0 0 24 24"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/></svg>',
    file: '<svg class="i" viewBox="0 0 24 24"><path d="M14 3H6v18h12V7l-4-4Z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
    moon: '<svg class="i" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>',
    sun: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    left: '<svg class="i" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></svg>',
    right: '<svg class="i" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>',
    pause: '<svg class="i" viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>',
    play: '<svg class="i" viewBox="0 0 24 24"><path d="M7 5v14l11-7z"/></svg>',
    check: '<svg class="i" viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>'
  };
  var STATUS = { ok: ['On track', 'good'], near: ['Near limit', 'warn'], over: ['Over', 'bad'], paid: ['Paid', 'good'], overdue: ['Overdue', 'bad'], partial: ['Partial', 'warn'], open: ['Open', 'neutral'] };
  function badge(key) { var s = STATUS[key]; return '<span class="badge ' + s[1] + '">' + s[0] + '</span>'; }
  function amountCell(x) {
    if (x.type === 'transfer') return '<span class="amt amt-t">' + I.swap + m(x.amount) + '</span>';
    return '<span class="amt amt-' + x.type + '">' + (x.type === 'in' ? I.up + '+' : I.down + '−') + m(x.amount).replace('−', '') + '</span>';
  }
  function txTitle(x) {
    var c = C(), cat = c.category(x.categoryId);
    if (x.type === 'transfer') { var a = c.account(x.accountId), b = c.account(x.toAccountId); return 'Transfer · ' + esc(a ? a.name : '?') + ' → ' + esc(b ? b.name : '?'); }
    return esc(cat ? cat.name : 'Uncategorized');
  }
  function srcBadge(x) {
    if (!x.source || x.source.kind === 'manual') return '';
    return x.source.kind === 'recurring' ? '<span class="tag">' + I.repeat + 'Recurring</span>' : '<span class="tag">Debt payment</span>';
  }
  function delta(cur, prev, invert, label) {
    var c = C(), d = c.fromMinor(c.toMinor(cur) - c.toMinor(prev));
    if (d === 0) return '<span class="delta">No change ' + esc(label) + '</span>';
    var good = invert ? d < 0 : d > 0;
    return '<span class="delta ' + (good ? 'pos' : 'neg') + '">' + (d > 0 ? '▲ ' : '▼ ') + m(Math.abs(d)) + ' ' + esc(label) + '</span>';
  }

  /* ============ HEADER ============ */
  function header() {
    var s = C().state;
    return '<div class="brand"><div class="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32" width="26" height="26"><path d="M16 3c6 4 9 9 9 14a9 9 0 0 1-18 0c0-5 3-10 9-14Z" fill="currentColor"/><path d="M16 8c-2 4-2 12 0 20" stroke="var(--accent)" stroke-width="2" fill="none" stroke-linecap="round"/></svg></div>' +
      '<div><h1 class="brand-name">' + esc(s.settings.businessName) + '</h1><p class="brand-tag">Cash book · Cash basis</p></div></div>' +
      '<div class="header-actions"><button type="button" class="btn btn-primary hide-sm" data-action="tx-new">' + I.plus + 'Add transaction <kbd>N</kbd></button>' +
      '<button type="button" class="btn btn-quiet btn-icon" data-action="theme" aria-label="Toggle dark mode">' + (B.app.isDark() ? I.sun : I.moon) + '</button></div>';
  }

  /* ============ DASHBOARD ============ */
  function dashboard() {
    var c = C(), s = c.state, t = c.today(), ms = c.monthStart(t), lm = c.shiftMonth(ms, -1);
    /* Month-to-date is compared with the same days of last month, so a partial month is never compared with a full one */
    var lmTo = c.shiftMonth(t, -1), cur = c.profitAndLoss(ms, t), prev = c.profitAndLoss(lm, lmTo);
    var cmpLabel = 'vs ' + dfmt(lm, { month: 'short', day: 'numeric' }) + '–' + dfmt(lmTo, { day: 'numeric' });
    var total = c.totalBalance(t);
    var accs = s.accounts.filter(function (a) { return !a.archived; }).map(function (a) { var b = c.balanceAt(a.id, t); return '<span class="acc-chip' + (b < 0 ? ' is-neg' : '') + '"><small>' + esc(a.name) + '</small><b>' + m(b) + '</b></span>'; }).join('');
    var due = c.dueItems(t), up = c.upcoming(t, 14);
    var alerts = s.budgets.map(function (b) { return c.budgetStatus(b.categoryId, t.slice(0, 7)); }).filter(function (x) { return x && x.status !== 'ok'; });
    var latest = c.filterTx({}).slice(0, 5);
    return '<section class="hero"><div class="hero-main"><span>Total balance</span><b class="' + (total < 0 ? 'neg' : '') + '">' + m(total) + '</b><small>across ' + s.accounts.filter(function (a) { return !a.archived; }).length + ' accounts · ' + esc(dfmt(t)) + '</small></div><div class="acc-chips">' + accs + '</div></section>' +
      '<section class="kpis">' +
      '<div class="kpi"><span>Revenue this month</span><b>' + m(cur.revenue) + '</b>' + delta(cur.revenue, prev.revenue, false, cmpLabel) + '</div>' +
      '<div class="kpi"><span>Expenses this month</span><b>' + m(cur.expenses) + '</b>' + delta(cur.expenses, prev.expenses, true, cmpLabel) + '</div>' +
      '<div class="kpi"><span>Net profit this month</span><b class="' + (cur.netProfit < 0 ? 'neg' : '') + '">' + m(cur.netProfit) + '</b>' + delta(cur.netProfit, prev.netProfit, false, cmpLabel) + '</div></section>' +
      (due.length ? '<section class="due-banner">' + I.repeat + '<div><b>' + due.length + ' recurring item' + (due.length > 1 ? 's' : '') + ' to confirm</b><span>' + esc(due.slice(0, 3).map(function (d) { return d.rule.name + ' · ' + dfmt(d.occ, { day: 'numeric', month: 'short' }); }).join(', ') + (due.length > 3 ? ' and ' + (due.length - 3) + ' more' : '')) + '</span></div><button type="button" class="btn btn-primary" data-action="due-review">Review</button></section>' : '') +
      '<div class="dash-grid"><section class="card-block"><h2>Upcoming · next 14 days</h2>' +
      (up.length ? '<ul class="list">' + up.map(function (u) { return '<li><span class="date-pill">' + esc(dfmt(u.date, { day: 'numeric', month: 'short' })) + '</span><span class="grow">' + esc(u.label) + '<small>' + (u.kind === 'rule' ? 'Recurring' : u.kind === 'receivable' ? 'Receivable due' : 'Payable due') + '</small></span><b class="amt-' + u.type + '">' + (u.type === 'in' ? '+' : '−') + m(u.amount) + '</b></li>'; }).join('') + '</ul>' : '<p class="empty">Nothing due in the next 14 days.</p>') + '</section>' +
      '<section class="card-block"><h2>Budget alerts · ' + esc(mfmt(t.slice(0, 7))) + '</h2>' +
      (alerts.length ? '<ul class="list">' + alerts.map(function (a) { return '<li><span class="grow">' + esc(c.category(a.categoryId).name) + '<small>' + m(a.spent) + ' of ' + m(a.budget) + '</small></span>' + badge(a.status) + '<b>' + c.pct(a.share) + '</b></li>'; }).join('') + '</ul>' : '<p class="empty">All budgets on track.</p>') + '</section></div>' +
      '<section class="card-block"><div class="block-head"><h2>Latest transactions</h2><button type="button" class="link-btn" data-action="go" data-id="transactions">View all</button></div>' + txTable(latest, true) + '</section>';
  }

  /* ============ TRANSACTIONS ============ */
  function txTable(list, compact) {
    var c = C();
    if (!list.length) return '<p class="empty">No transactions match these filters.</p>';
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Date</th><th>Description</th>' + (compact ? '' : '<th>Account</th>') + '<th class="num">Amount</th>' + (compact ? '' : '<th><span class="sr-only">Actions</span></th>') + '</tr></thead><tbody>' +
      list.map(function (x) {
        var a = c.account(x.accountId);
        return '<tr><td class="nowrap">' + esc(dfmt(x.date)) + '</td><td><b>' + txTitle(x) + '</b>' + srcBadge(x) + (x.note ? '<span class="sub">' + esc(x.note) + '</span>' : '') + '</td>' +
          (compact ? '' : '<td>' + esc(a ? a.name : '') + '</td>') + '<td class="num">' + amountCell(x) + '</td>' +
          (compact ? '' : '<td class="row-acts"><button type="button" class="mini" data-action="tx-edit" data-id="' + esc(x.id) + '">' + I.edit + '<span class="hide-md">Edit</span></button><button type="button" class="mini" data-action="tx-dup" data-id="' + esc(x.id) + '" aria-label="Duplicate">' + I.copy + '</button><button type="button" class="mini mini-danger" data-action="tx-del" data-id="' + esc(x.id) + '" aria-label="Delete">' + I.trash + '</button></td>') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }
  function catOptions(dir, selected, allowArchivedId, withAll) {
    var c = C(), html = withAll ? '<option value="all">All categories</option>' : '<option value="">Choose a category…</option>';
    Object.keys(c.GROUPS).forEach(function (g) {
      var list = c.state.categories.filter(function (x) { return x.group === g && (!dir || x.dir === dir) && (!x.archived || x.id === allowArchivedId || withAll); });
      if (list.length) html += '<optgroup label="' + esc(c.GROUPS[g].label) + '">' + list.map(function (x) { return '<option value="' + esc(x.id) + '"' + sel(selected, x.id) + '>' + esc(x.name) + (x.archived ? ' (archived)' : '') + '</option>'; }).join('') + '</optgroup>';
    });
    return html;
  }
  function accOptions(selected, allowArchivedId, withAll) {
    return (withAll ? '<option value="all">All accounts</option>' : '') + C().state.accounts.filter(function (a) { return !a.archived || a.id === allowArchivedId || withAll; }).map(function (a) { return '<option value="' + esc(a.id) + '"' + sel(selected, a.id) + '>' + esc(a.name) + (a.archived ? ' (archived)' : '') + '</option>'; }).join('');
  }
  function transactions() {
    var c = C(), v = V(), due = c.dueItems(c.today()).length;
    var seg = '<div class="seg seg-wide" role="tablist"><button type="button" role="tab" aria-selected="' + (v.txSub === 'list') + '" data-action="tx-sub" data-id="list">Transactions</button><button type="button" role="tab" aria-selected="' + (v.txSub === 'recurring') + '" data-action="tx-sub" data-id="recurring">Recurring' + (due ? ' <span class="count-badge">' + due + '</span>' : '') + '</button></div>';
    if (v.txSub === 'recurring') return seg + recurring();
    var f = v.tf, list = c.filterTx(f), totals = c.totalsOf(list, f.account);
    var pages = Math.max(1, Math.ceil(list.length / 25)); if (f.page > pages) f.page = pages;
    var presets = [['month', 'This month'], ['last-month', 'Last month'], ['30d', 'Last 30 days'], ['year', 'This year'], ['all', 'All'], ['custom', 'Custom']].map(function (p) { return '<button type="button" class="chip' + (f.preset === p[0] ? ' is-active' : '') + '" data-action="tf-preset" data-id="' + p[0] + '">' + p[1] + '</button>'; }).join('');
    return seg + '<div class="filters-panel"><div class="chips">' + presets + '</div>' +
      (f.preset === 'custom' ? '<div class="filters"><label class="field inline"><span>From</span><input type="date" id="tfFrom" value="' + esc(f.from) + '"/></label><label class="field inline"><span>To</span><input type="date" id="tfTo" value="' + esc(f.to) + '"/></label></div>' : '') +
      '<div class="filters"><label class="field inline"><span class="sr-only">Type</span><select id="tfType"><option value="all"' + sel(f.type, 'all') + '>All types</option><option value="in"' + sel(f.type, 'in') + '>Money in</option><option value="out"' + sel(f.type, 'out') + '>Money out</option><option value="transfer"' + sel(f.type, 'transfer') + '>Transfers</option></select></label>' +
      '<label class="field inline"><span class="sr-only">Account</span><select id="tfAccount">' + accOptions(f.account, null, true) + '</select></label>' +
      '<label class="field inline"><span class="sr-only">Category</span><select id="tfCategory">' + catOptions(null, f.category, null, true) + '</select></label>' +
      '<label class="search">' + I.search + '<span class="sr-only">Search notes and categories</span><input type="search" id="tfSearch" placeholder="Search  ( / )" value="' + esc(f.search) + '"/></label></div></div>' +
      '<div class="totals-bar"><div><span>Money in</span><b class="amt-in">+' + m(totals.in) + '</b></div><div><span>Money out</span><b class="amt-out">−' + m(totals.out).replace('−', '') + '</b></div><div><span>Net</span><b class="' + (totals.net < 0 ? 'neg' : '') + '">' + m(totals.net, true) + '</b></div>' +
      '<div class="grow"></div><button type="button" class="btn btn-quiet" data-action="tx-csv">' + I.file + 'Export CSV</button></div>' +
      txTable(list.slice((f.page - 1) * 25, f.page * 25), false) + pager(list.length, f.page, 'tf-page');
  }
  function pager(total, page, action) {
    var pages = Math.max(1, Math.ceil(total / 25));
    return '<div class="pager"><span>' + total + ' transaction' + (total === 1 ? '' : 's') + '</span><div><button type="button" class="btn btn-quiet" data-action="' + action + '" data-id="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + '>Previous</button><span>Page ' + page + ' of ' + pages + '</span><button type="button" class="btn btn-quiet" data-action="' + action + '" data-id="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + '>Next</button></div></div>';
  }
  function dueList(items) {
    var c = C();
    return '<ul class="due-list">' + items.map(function (d) {
      var a = c.account(d.rule.accountId);
      return '<li><div class="grow"><b>' + esc(d.rule.name) + '</b><small>' + esc(dfmt(d.occ)) + ' · ' + esc(a ? a.name : '') + '</small></div><b class="amt-' + d.rule.type + '">' + m(d.rule.amount) + '</b>' +
        '<button type="button" class="btn btn-primary" data-due-confirm="' + esc(d.rule.id) + '|' + d.occ + '">Confirm</button><button type="button" class="btn btn-quiet" data-due-skip="' + esc(d.rule.id) + '|' + d.occ + '">Skip</button></li>';
    }).join('') + '</ul>';
  }
  function recurring() {
    var c = C(), s = c.state, t = c.today(), due = c.dueItems(t);
    var rows = s.rules.map(function (r) {
      var nx = c.nextOccurrence(r, t), a = c.account(r.accountId), cat = c.category(r.categoryId);
      return '<tr class="' + (r.paused ? 'is-inactive' : '') + '"><td><b>' + esc(r.name) + '</b><span class="sub">' + esc(cat ? cat.name : '') + ' · ' + esc(a ? a.name : '') + '</span></td><td>' + esc(c.scheduleText(r)) + (r.end ? '<span class="sub">until ' + esc(dfmt(r.end)) + '</span>' : '') + '</td>' +
        '<td class="num"><span class="amt-' + r.type + '">' + (r.type === 'in' ? '+' : '−') + m(r.amount) + '</span></td><td class="nowrap">' + (r.paused ? '—' : nx ? esc(dfmt(nx)) : 'Ended') + '</td>' +
        '<td><span class="badge ' + (r.mode === 'auto' ? 'neutral' : 'warn') + '">' + (r.mode === 'auto' ? 'Auto' : 'Confirm') + '</span>' + (r.paused ? ' <span class="badge">Paused</span>' : '') + '</td>' +
        '<td class="row-acts"><button type="button" class="mini" data-action="rule-edit" data-id="' + esc(r.id) + '">' + I.edit + 'Edit</button><button type="button" class="mini" data-action="rule-pause" data-id="' + esc(r.id) + '">' + (r.paused ? I.play + 'Resume' : I.pause + 'Pause') + '</button><button type="button" class="mini mini-danger" data-action="rule-del" data-id="' + esc(r.id) + '" aria-label="Delete rule">' + I.trash + '</button></td></tr>';
    }).join('');
    return (due.length ? '<section class="card-block"><div class="block-head"><h2>Due to confirm</h2><button type="button" class="btn btn-quiet" data-action="due-all">' + I.check + 'Confirm all</button></div>' + dueList(due) + '</section>' : '') +
      '<div class="toolbar"><p class="hint">Auto rules post on their date. Confirm rules wait for you, so you can adjust amounts like utility bills.</p><button type="button" class="btn btn-primary" data-action="rule-new">' + I.plus + 'Add recurring rule</button></div>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Rule</th><th>Schedule</th><th class="num">Amount</th><th>Next</th><th>Mode</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' + (rows || '<tr><td colspan="6" class="empty">No recurring rules yet.</td></tr>') + '</tbody></table></div>';
  }

  /* ============ FORMS ============ */
  function txForm(d) {
    var c = C(), isNew = !d.id, dir = d.type === 'transfer' ? null : d.type, recent = dir ? (c.state.recent[dir] || []).map(c.category).filter(function (x) { return x && !x.archived; }) : [];
    var linked = d.source && d.source.kind === 'debt-payment' ? c.debt(d.source.debtId) : null;
    return '<div class="seg seg-type" role="radiogroup" aria-label="Type">' + [['in', 'Money in'], ['out', 'Money out'], ['transfer', 'Transfer']].map(function (t) {
      return '<button type="button" role="radio" aria-checked="' + (d.type === t[0]) + '" data-tf-type="' + t[0] + '"' + (linked && t[0] !== d.type ? ' disabled' : '') + '>' + t[1] + '</button>'; }).join('') + '</div>' +
      (linked ? '<p class="note">Payment for <b>' + esc(linked.party) + '</b> (' + (linked.kind === 'receivable' ? 'receivable' : 'payable') + '). Category follows the debt.</p>' : '') +
      '<label class="field amount-field"><span>Amount</span><input type="number" id="fAmount" min="0" step="any" inputmode="decimal" value="' + esc(d.amount) + '" placeholder="0.00"/></label>' +
      '<div class="form-grid"><label class="field"><span>Date</span><input type="date" id="fDate" value="' + esc(d.date) + '"/></label>' +
      '<label class="field"><span>' + (d.type === 'transfer' ? 'From account' : 'Account') + '</span><select id="fAccount">' + accOptions(d.accountId, d.accountId) + '</select></label>' +
      (d.type === 'transfer' ? '<label class="field"><span>To account</span><select id="fTo"><option value="">Choose…</option>' + accOptions(d.toAccountId, d.toAccountId) + '</select></label>' : '') + '</div>' +
      (dir && !linked ? '<div class="field"><span>Category</span>' + (recent.length ? '<div class="chips recent">' + recent.map(function (x) { return '<button type="button" class="chip' + (d.categoryId === x.id ? ' is-active' : '') + '" data-tf-cat="' + esc(x.id) + '">' + esc(x.name) + '</button>'; }).join('') + '</div>' : '') +
        '<select id="fCategory" aria-label="Category">' + catOptions(dir, d.categoryId, d.categoryId) + '</select></div>' : '') +
      '<label class="field"><span>Note (optional)</span><input type="text" id="fNote" maxlength="120" value="' + esc(d.note) + '" placeholder="e.g. Invoice #1042"/></label>' +
      '<div id="fWarn"></div>' + (isNew ? '<p class="hint">Press Enter to save.</p>' : '');
  }
  function ruleForm(d) {
    return '<div class="seg" role="radiogroup"><button type="button" role="radio" aria-checked="' + (d.type === 'in') + '" data-rf-type="in">Money in</button><button type="button" role="radio" aria-checked="' + (d.type === 'out') + '" data-rf-type="out">Money out</button></div>' +
      '<div class="form-grid"><label class="field"><span>Name</span><input type="text" id="rName" maxlength="60" value="' + esc(d.name) + '" placeholder="e.g. Rent"/></label>' +
      '<label class="field"><span>Amount</span><input type="number" id="rAmount" min="0" step="any" value="' + esc(d.amount) + '"/></label>' +
      '<label class="field"><span>Category</span><select id="rCategory">' + catOptions(d.type, d.categoryId, d.categoryId) + '</select></label>' +
      '<label class="field"><span>Account</span><select id="rAccount">' + accOptions(d.accountId, d.accountId) + '</select></label>' +
      '<label class="field"><span>How often</span><select id="rFreq"><option value="weekly"' + sel(d.freq, 'weekly') + '>Weekly</option><option value="monthly"' + sel(d.freq, 'monthly') + '>Monthly</option><option value="yearly"' + sel(d.freq, 'yearly') + '>Yearly</option></select></label>' +
      '<label class="field"><span>Start date</span><input type="date" id="rStart" value="' + esc(d.start) + '"/></label>' +
      '<label class="field"><span>End date (optional)</span><input type="date" id="rEnd" value="' + esc(d.end || '') + '"/></label></div>' +
      '<fieldset class="radio-cards"><legend>When a date arrives</legend><label><input type="radio" name="rMode" value="confirm"' + chk(d.mode !== 'auto') + '/><span><b>Ask me to confirm</b><small>Best for amounts that change, like electricity.</small></span></label>' +
      '<label><input type="radio" name="rMode" value="auto"' + chk(d.mode === 'auto') + '/><span><b>Record automatically</b><small>Best for fixed amounts, like rent.</small></span></label></fieldset>' +
      '<p class="hint" id="rSchedule"></p>';
  }
  function debtForm(d) {
    var dir = d.kind === 'receivable' ? 'in' : 'out';
    return '<div class="seg" role="radiogroup"><button type="button" role="radio" aria-checked="' + (d.kind === 'receivable') + '" data-df-kind="receivable"' + (d.locked ? ' disabled' : '') + '>Receivable · owed to you</button><button type="button" role="radio" aria-checked="' + (d.kind === 'payable') + '" data-df-kind="payable"' + (d.locked ? ' disabled' : '') + '>Payable · you owe</button></div>' +
      '<div class="form-grid"><label class="field"><span>' + (d.kind === 'receivable' ? 'Customer' : 'Supplier') + '</span><input type="text" id="dParty" maxlength="60" value="' + esc(d.party) + '"/></label>' +
      '<label class="field"><span>Description</span><input type="text" id="dDesc" maxlength="80" value="' + esc(d.description) + '" placeholder="e.g. Invoice #2231"/></label>' +
      '<label class="field"><span>Amount</span><input type="number" id="dAmount" min="0" step="any" value="' + esc(d.amount) + '"/></label>' +
      '<label class="field"><span>Date</span><input type="date" id="dDate" value="' + esc(d.date) + '"/></label>' +
      '<label class="field"><span>Due date (optional)</span><input type="date" id="dDue" value="' + esc(d.due || '') + '"/></label>' +
      '<label class="field"><span>Payment category</span><select id="dCategory">' + catOptions(dir, d.categoryId, d.categoryId) + '</select></label></div>' +
      '<p class="hint">Cash basis: this ' + (d.kind === 'receivable' ? 'receivable affects profit only when payments come in.' : 'payable affects profit only when you pay it.') + '</p>';
  }
  function paymentForm(info) {
    var c = C();
    return '<p class="note">Remaining: <b>' + m(info.remaining) + '</b> of ' + m(info.debt.amount) + '</p><div class="form-grid">' +
      '<label class="field"><span>Amount</span><input type="number" id="pAmount" min="0" step="any" value="' + info.remaining.toFixed(c.digits()) + '"/></label>' +
      '<label class="field"><span>Date</span><input type="date" id="pDate" value="' + esc(c.today()) + '"/></label>' +
      '<label class="field"><span>' + (info.debt.kind === 'receivable' ? 'Received into' : 'Paid from') + '</span><select id="pAccount">' + accOptions(null) + '</select></label></div>';
  }
  function debtDetail(info) {
    var c = C(), d = info.debt, cat = c.category(d.categoryId);
    return '<div class="sum-grid"><div><span>Amount</span><b>' + m(d.amount) + '</b></div><div><span>Paid</span><b>' + m(info.paid) + '</b></div><div class="hl"><span>Remaining</span><b>' + m(info.remaining) + '</b></div><div><span>Status</span><b>' + badge(info.status) + '</b></div>' +
      '<div><span>Date</span><b>' + esc(dfmt(d.date)) + '</b></div><div><span>Due</span><b>' + (d.due ? esc(dfmt(d.due)) : '—') + '</b></div><div><span>Category</span><b>' + esc(cat ? cat.name : '') + '</b></div></div>' +
      '<h3 class="mt">Payments</h3>' + (info.payments.length ? '<ul class="list">' + info.payments.map(function (p) { var a = c.account(p.accountId); return '<li><span class="date-pill">' + esc(dfmt(p.date, { day: 'numeric', month: 'short' })) + '</span><span class="grow">' + esc(a ? a.name : '') + '<small>' + esc(p.note) + '</small></span><b>' + m(p.amount) + '</b><button type="button" class="mini" data-pay-edit="' + esc(p.id) + '">' + I.edit + '</button><button type="button" class="mini mini-danger" data-pay-del="' + esc(p.id) + '" aria-label="Delete payment">' + I.trash + '</button></li>'; }).join('') + '</ul>' : '<p class="empty">No payments yet.</p>');
  }

  /* ============ DEBTS ============ */
  function debts() {
    var c = C(), v = V(), t = c.today(), kind = v.debtKind;
    var all = c.state.debts.filter(function (d) { return d.kind === kind; }).map(function (d) { return c.debtInfo(d, t); });
    var list = all.filter(function (i) { return v.debtStatus === 'all' || (v.debtStatus === 'unpaid' ? i.status !== 'paid' : i.status === v.debtStatus); })
      .sort(function (a, b) { var ap = a.status === 'paid', bp = b.status === 'paid'; if (ap !== bp) return ap ? 1 : -1; return (a.debt.due || '9999') < (b.debt.due || '9999') ? -1 : 1; });
    var remaining = all.reduce(function (s, i) { return s + c.toMinor(i.remaining); }, 0), ag = c.aging(kind, t), agTotal = Object.keys(ag).reduce(function (s, k) { return s + ag[k]; }, 0);
    var seg = '<div class="seg seg-wide" role="tablist"><button type="button" role="tab" aria-selected="' + (kind === 'receivable') + '" data-action="debt-kind" data-id="receivable">Receivables · owed to you</button><button type="button" role="tab" aria-selected="' + (kind === 'payable') + '" data-action="debt-kind" data-id="payable">Payables · you owe</button></div>';
    var chips = [['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['all', 'All']].map(function (p) { return '<button type="button" class="chip' + (v.debtStatus === p[0] ? ' is-active' : '') + '" data-action="debt-status" data-id="' + p[0] + '">' + p[1] + '</button>'; }).join('');
    var aging = '<div class="aging">' + [['not-due', 'Not due'], ['1-30', '1–30 days'], ['31-60', '31–60 days'], ['61+', '61+ days']].map(function (b) {
      return '<div class="age age-' + b[0] + '"><span>' + b[1] + '</span><b>' + m(ag[b[0]]) + '</b><i style="width:' + (agTotal ? Math.round(ag[b[0]] / agTotal * 100) : 0) + '%"></i></div>'; }).join('') + '</div>';
    var rows = list.map(function (i) {
      var d = i.debt;
      return '<tr class="row-link" data-action="debt-open" data-id="' + esc(d.id) + '" tabindex="0"><td><b>' + esc(d.party) + '</b><span class="sub">' + esc(d.description) + '</span></td><td class="nowrap">' + (d.due ? esc(dfmt(d.due)) + (i.status === 'overdue' ? '<span class="sub neg">' + i.daysPast + ' days overdue</span>' : '') : '—') + '</td>' +
        '<td class="num">' + m(d.amount) + '</td><td class="num">' + m(i.paid) + '</td><td class="num"><b>' + m(i.remaining) + '</b></td><td>' + badge(i.status) + '</td>' +
        '<td class="row-acts">' + (i.remaining > 0 ? '<button type="button" class="mini" data-action="debt-pay" data-id="' + esc(d.id) + '">' + (kind === 'receivable' ? 'Receive' : 'Pay') + '</button>' : '') + '</td></tr>';
    }).join('');
    return seg + '<div class="toolbar"><div class="chips">' + chips + '</div><div class="btn-row"><button type="button" class="btn btn-quiet" data-action="debt-print">' + I.print + 'Print</button><button type="button" class="btn btn-primary" data-action="debt-new">' + I.plus + 'Add ' + kind + '</button></div></div>' +
      '<section class="card-block"><div class="block-head"><h2>' + (kind === 'receivable' ? 'Customers owe you' : 'You owe suppliers') + ' <span class="big">' + m(c.fromMinor(remaining)) + '</span></h2></div>' + aging + '</section>' +
      '<div class="table-wrap"><table class="table"><thead><tr><th>' + (kind === 'receivable' ? 'Customer' : 'Supplier') + '</th><th>Due</th><th class="num">Amount</th><th class="num">Paid</th><th class="num">Remaining</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="7" class="empty">Nothing here.</td></tr>') + '</tbody></table></div>';
  }

  /* ============ BUDGETS ============ */
  function budgets() {
    var c = C(), v = V(), list = c.state.budgets.map(function (b) { return c.budgetStatus(b.categoryId, v.budgetMonth); }).filter(Boolean)
      .sort(function (a, b) { return b.share - a.share; });
    var tb = list.reduce(function (s, x) { return s + c.toMinor(x.budget); }, 0), ts = list.reduce(function (s, x) { return s + c.toMinor(x.spent); }, 0);
    return '<div class="toolbar"><div class="month-nav"><button type="button" class="btn btn-quiet btn-icon" data-action="bm-prev" aria-label="Previous month">' + I.left + '</button><b>' + esc(mfmt(v.budgetMonth)) + '</b><button type="button" class="btn btn-quiet btn-icon" data-action="bm-next" aria-label="Next month">' + I.right + '</button></div>' +
      '<button type="button" class="btn btn-primary" data-action="budget-new">' + I.plus + 'Add budget</button></div>' +
      '<section class="card-block"><div class="sum-grid"><div><span>Total budget</span><b>' + m(c.fromMinor(tb)) + '</b></div><div><span>Spent</span><b>' + m(c.fromMinor(ts)) + '</b></div><div class="hl"><span>Remaining</span><b class="' + (tb - ts < 0 ? 'neg' : '') + '">' + m(c.fromMinor(tb - ts)) + '</b></div></div></section>' +
      (list.length ? '<div class="budget-list">' + list.map(function (b) {
        var cat = c.category(b.categoryId);
        return '<article class="budget s-' + b.status + '"><div class="budget-head"><b>' + esc(cat.name) + '</b>' + badge(b.status) + '</div><div class="bar"><span style="width:' + Math.min(100, b.share).toFixed(1) + '%"></span></div>' +
          '<div class="budget-foot"><span>' + m(b.spent) + ' of ' + m(b.budget) + ' · <b>' + c.pct(b.share) + '</b></span><span class="' + (b.remaining < 0 ? 'neg' : '') + '">' + (b.remaining < 0 ? m(-b.remaining) + ' over' : m(b.remaining) + ' left') + '</span></div>' +
          '<div class="budget-acts"><button type="button" class="mini" data-action="budget-edit" data-id="' + esc(b.categoryId) + '">' + I.edit + 'Edit</button><button type="button" class="mini mini-danger" data-action="budget-del" data-id="' + esc(b.categoryId) + '">' + I.trash + 'Remove</button></div></article>';
      }).join('') + '</div>' : '<p class="empty">No budgets yet. Add one to track monthly spending limits.</p>');
  }
  function budgetForm(categoryId, amount, editing) {
    var c = C(), used = c.state.budgets.map(function (b) { return b.categoryId; });
    var opts = c.state.categories.filter(function (x) { return c.EXPENSE_GROUPS.indexOf(x.group) > -1 && !x.archived && (used.indexOf(x.id) === -1 || x.id === categoryId); });
    return '<div class="form-grid"><label class="field"><span>Category</span><select id="bCategory"' + (editing ? ' disabled' : '') + '>' + opts.map(function (x) { return '<option value="' + esc(x.id) + '"' + sel(categoryId, x.id) + '>' + esc(x.name) + ' · ' + esc(c.GROUPS[x.group].label) + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Monthly budget</span><input type="number" id="bAmount" min="0" step="any" value="' + esc(amount || '') + '"/></label></div><p class="hint">Applies to every calendar month.</p>';
  }

  /* ============ REPORTS ============ */
  function plTable(pl, prev) {
    var c = C();
    function row(label, a, b, cls) {
      var d = c.fromMinor(c.toMinor(a) - c.toMinor(b)), p = b ? (a - b) / Math.abs(b) * 100 : null;
      return '<tr class="' + (cls || '') + '"><td>' + label + '</td><td class="num">' + m(a) + '</td><td class="num muted">' + m(b) + '</td><td class="num ' + (d < 0 ? 'neg' : d > 0 ? 'pos' : '') + '">' + m(d, true) + '</td><td class="num muted">' + (p === null ? '—' : c.pct(p)) + '</td></tr>';
    }
    function group(g, label, ca, pa) {
      var names = {}; pl.lines[g].concat(prev.lines[g]).forEach(function (l) { names[l.id] = l.name; });
      var h = Object.keys(names).map(function (id) { return row('<span class="indent">' + esc(names[id]) + '</span>', c.fromMinor(pl.byCategory[id] || 0), c.fromMinor(prev.byCategory[id] || 0)); }).join('');
      return h + row(label, ca, pa, 'subtotal');
    }
    return '<div class="table-wrap"><table class="table pl"><thead><tr><th></th><th class="num">This period</th><th class="num">Previous</th><th class="num">Change</th><th class="num">%</th></tr></thead><tbody>' +
      group('revenue', 'Revenue', pl.revenue, prev.revenue) + group('cogs', 'Cost of goods sold', pl.cogs, prev.cogs) +
      row('Gross profit <small>' + c.pct(pl.grossMargin) + ' margin</small>', pl.grossProfit, prev.grossProfit, 'total') +
      group('opex', 'Operating expenses', pl.opex, prev.opex) + row('Operating profit', pl.operatingProfit, prev.operatingProfit, 'total') +
      group('other-income', 'Other income', pl.otherIncome, prev.otherIncome) + group('other-expense', 'Other expenses', pl.otherExpense, prev.otherExpense) +
      row('Net profit <small>' + c.pct(pl.netMargin) + ' margin</small>', pl.netProfit, prev.netProfit, 'grand') + '</tbody></table></div>';
  }
  function cashFlowBlock(cf) {
    function r(label, v, cls) { return '<div class="cf-row ' + (cls || '') + '"><span>' + label + '</span><b class="' + (v < 0 ? 'neg' : '') + '">' + m(v, cls === 'sec') + '</b></div>'; }
    return '<div class="cf">' + r('Opening balance', cf.opening, 'edge') + r('Operating · money in', cf.operatingIn) + r('Operating · money out', -cf.operatingOut) + r('Operating cash flow', cf.operating, 'sec') +
      cf.investingLines.map(function (l) { return r('<span class="indent">' + esc(l.name) + '</span>', l.amount); }).join('') + r('Investing cash flow', cf.investing, 'sec') +
      cf.financingLines.map(function (l) { return r('<span class="indent">' + esc(l.name) + '</span>', l.amount); }).join('') + r('Financing cash flow', cf.financing, 'sec') +
      r('Net change', cf.net, 'sec') + r('Closing balance', cf.closing, 'edge') + '<p class="hint">Transfers between your accounts are internal and not shown.</p></div>';
  }
  function trendChart(data) {
    var w = 760, h = 250, padL = 8, padB = 28, top = 18, max = 1, min = 0;
    data.forEach(function (d) { max = Math.max(max, d.revenue, d.expenses, d.net); min = Math.min(min, d.net); });
    var span = max - min, y = function (v) { return top + (max - v) / span * (h - padB - top); }, bw = (w - padL) / data.length;
    var bars = data.map(function (d, i) {
      var x = padL + i * bw, y0 = y(0);
      return '<g><title>' + esc(mfmt(d.month) + ' · Revenue ' + m(d.revenue) + ' · Expenses ' + m(d.expenses) + ' · Net ' + m(d.net)) + '</title>' +
        '<rect class="b-rev" x="' + (x + bw * 0.14).toFixed(1) + '" y="' + y(d.revenue).toFixed(1) + '" width="' + (bw * 0.34).toFixed(1) + '" height="' + Math.max(0, y0 - y(d.revenue)).toFixed(1) + '" rx="3"/>' +
        '<rect class="b-exp" x="' + (x + bw * 0.5).toFixed(1) + '" y="' + y(d.expenses).toFixed(1) + '" width="' + (bw * 0.34).toFixed(1) + '" height="' + Math.max(0, y0 - y(d.expenses)).toFixed(1) + '" rx="3"/>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (h - 8) + '" class="axis" text-anchor="middle">' + esc(mshort(d.month)) + '</text></g>';
    }).join('');
    var pts = data.map(function (d, i) { return (padL + i * bw + bw / 2).toFixed(1) + ',' + y(d.net).toFixed(1); });
    return '<div class="legend"><span><i class="l-rev"></i>Revenue</span><span><i class="l-exp"></i>Expenses</span><span><i class="l-net"></i>Net profit</span></div>' +
      '<svg viewBox="0 0 ' + w + ' ' + h + '" class="chart" role="img" aria-label="12-month trend of revenue, expenses and net profit"><line class="zero" x1="' + padL + '" x2="' + w + '" y1="' + y(0).toFixed(1) + '" y2="' + y(0).toFixed(1) + '"/>' + bars +
      '<polyline class="net-line" points="' + pts.join(' ') + '"/>' + pts.map(function (p, i) { var xy = p.split(','); return '<circle class="net-dot' + (data[i].net < 0 ? ' neg' : '') + '" cx="' + xy[0] + '" cy="' + xy[1] + '" r="4"/>'; }).join('') + '</svg>';
  }
  function reports() {
    var c = C(), v = V(), pl = c.profitAndLoss(v.repFrom, v.repTo), cmp = c.comparison(v.repPreset, v.repFrom, v.repTo), prev = c.profitAndLoss(cmp.from, cmp.to), cf = c.cashFlow(v.repFrom, v.repTo);
    var presets = [['month', 'This month'], ['last-month', 'Last month'], ['year', 'This year'], ['12m', 'Last 12 months'], ['custom', 'Custom']].map(function (p) { return '<button type="button" class="chip' + (v.repPreset === p[0] ? ' is-active' : '') + '" data-action="rep-preset" data-id="' + p[0] + '">' + p[1] + '</button>'; }).join('');
    var bd = c.expenseBreakdown(v.repFrom, v.repTo);
    var accRows = c.state.accounts.map(function (a) { var b = c.balanceAt(a.id, v.repTo); return '<tr><td>' + esc(a.name) + (a.archived ? ' <span class="badge">Archived</span>' : '') + '</td><td class="num ' + (b < 0 ? 'neg' : '') + '">' + m(b) + '</td></tr>'; }).join('');
    function agingRow(kind) { var ag = c.aging(kind, c.today()); return '<tr><td>' + (kind === 'receivable' ? 'Receivables' : 'Payables') + '</td>' + ['not-due', '1-30', '31-60', '61+'].map(function (k) { return '<td class="num">' + m(ag[k]) + '</td>'; }).join('') + '</tr>'; }
    return '<div class="toolbar"><div class="chips">' + presets + '</div><div class="btn-row"><button type="button" class="btn btn-quiet" data-action="pl-csv">' + I.file + 'Export P&amp;L CSV</button><button type="button" class="btn btn-quiet" data-action="rep-print">' + I.print + 'Print report</button></div></div>' +
      (v.repPreset === 'custom' ? '<div class="filters mb"><label class="field inline"><span>From</span><input type="date" id="repFrom" value="' + esc(v.repFrom) + '"/></label><label class="field inline"><span>To</span><input type="date" id="repTo" value="' + esc(v.repTo) + '"/></label></div>' : '') +
      '<p class="period">' + esc(dfmt(v.repFrom)) + ' – ' + esc(dfmt(v.repTo)) + ' <span class="badge neutral">Cash basis</span> <span class="muted">compared with ' + esc(dfmt(cmp.from)) + ' – ' + esc(dfmt(cmp.to)) + '</span></p>' +
      '<div class="rep-grid"><section class="card-block"><h2>Profit and loss</h2>' + plTable(pl, prev) + '</section>' +
      '<div class="rep-side"><section class="card-block"><h2>Cash flow</h2>' + cashFlowBlock(cf) + '</section>' +
      '<section class="card-block"><h2>Balances on ' + esc(dfmt(v.repTo, { day: 'numeric', month: 'short' })) + '</h2><div class="table-wrap"><table class="table"><tbody>' + accRows + '</tbody></table></div></section></div></div>' +
      '<section class="card-block"><h2>12-month trend</h2><div class="chart-wrap">' + trendChart(c.trend(v.repTo, 12)) + '</div></section>' +
      '<div class="rep-grid2"><section class="card-block"><h2>Expense breakdown</h2>' + (bd.length ? '<ul class="breakdown">' + bd.map(function (b) { return '<li><span>' + esc(b.name) + '</span><b>' + m(b.amount) + '</b><small>' + c.pct(b.share) + '</small><i style="width:' + b.share.toFixed(1) + '%"></i></li>'; }).join('') + '</ul>' : '<p class="empty">No expenses in this period.</p>') + '</section>' +
      '<section class="card-block"><h2>Debt aging · today</h2><div class="table-wrap"><table class="table"><thead><tr><th></th><th class="num">Not due</th><th class="num">1–30</th><th class="num">31–60</th><th class="num">61+</th></tr></thead><tbody>' + agingRow('receivable') + agingRow('payable') + '</tbody></table></div></section></div>';
  }
  function reportPrint() {
    var c = C(), v = V(), pl = c.profitAndLoss(v.repFrom, v.repTo), cmp = c.comparison(v.repPreset, v.repFrom, v.repTo), prev = c.profitAndLoss(cmp.from, cmp.to);
    return '<div class="print-doc"><h1>' + esc(c.state.settings.businessName) + '</h1><p>Profit and loss · ' + esc(dfmt(v.repFrom)) + ' – ' + esc(dfmt(v.repTo)) + ' · Cash basis · Compared with ' + esc(dfmt(cmp.from)) + ' – ' + esc(dfmt(cmp.to)) + '</p>' +
      plTable(pl, prev) + '<h2>Cash flow</h2>' + cashFlowBlock(c.cashFlow(v.repFrom, v.repTo)) + '<h2>Account balances on ' + esc(dfmt(v.repTo)) + '</h2><table class="table"><tbody>' +
      c.state.accounts.map(function (a) { return '<tr><td>' + esc(a.name) + '</td><td class="num">' + m(c.balanceAt(a.id, v.repTo)) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  function debtPrint() {
    var c = C(), v = V(), t = c.today(), list = c.state.debts.filter(function (d) { return d.kind === v.debtKind; }).map(function (d) { return c.debtInfo(d, t); }).filter(function (i) { return i.status !== 'paid'; });
    return '<div class="print-doc"><h1>' + esc(c.state.settings.businessName) + '</h1><p>' + (v.debtKind === 'receivable' ? 'Unpaid receivables' : 'Unpaid payables') + ' · ' + esc(dfmt(t)) + '</p><table class="table"><thead><tr><th>Party</th><th>Description</th><th>Due</th><th class="num">Amount</th><th class="num">Paid</th><th class="num">Remaining</th><th>Status</th></tr></thead><tbody>' +
      list.map(function (i) { return '<tr><td>' + esc(i.debt.party) + '</td><td>' + esc(i.debt.description) + '</td><td>' + (i.debt.due ? esc(dfmt(i.debt.due)) : '—') + '</td><td class="num">' + m(i.debt.amount) + '</td><td class="num">' + m(i.paid) + '</td><td class="num">' + m(i.remaining) + '</td><td>' + STATUS[i.status][0] + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ============ SETTINGS ============ */
  function settings() {
    var c = C(), s = c.state, t = c.today();
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    var accRows = s.accounts.map(function (a) {
      return '<tr class="' + (a.archived ? 'is-inactive' : '') + '"><td><b>' + esc(a.name) + '</b><span class="sub">' + esc(a.type) + (a.archived ? ' · archived' : '') + '</span></td><td class="num">' + m(a.opening) + '</td><td class="num ' + (c.balanceAt(a.id, t) < 0 ? 'neg' : '') + '">' + m(c.balanceAt(a.id, t)) + '</td>' +
        '<td class="row-acts"><button type="button" class="mini" data-action="acc-edit" data-id="' + esc(a.id) + '">' + I.edit + '</button><button type="button" class="mini" data-action="acc-archive" data-id="' + esc(a.id) + '">' + (a.archived ? 'Unarchive' : 'Archive') + '</button><button type="button" class="mini mini-danger" data-action="acc-del" data-id="' + esc(a.id) + '" aria-label="Delete account">' + I.trash + '</button></td></tr>';
    }).join('');
    var cats = Object.keys(c.GROUPS).map(function (g) {
      var list = s.categories.filter(function (x) { return x.group === g; });
      return '<div class="cat-group"><h3>' + esc(c.GROUPS[g].label) + '</h3>' + (list.length ? '<ul class="cat-list">' + list.map(function (x) {
        return '<li class="' + (x.archived ? 'is-inactive' : '') + '"><span class="grow">' + esc(x.name) + (g === 'non-pl' ? ' <small>' + (x.dir === 'in' ? 'in' : 'out') + ' · ' + esc(c.CF_TYPES[x.cf]) + '</small>' : '') + (x.archived ? ' <span class="badge">Archived</span>' : '') + '</span>' +
          '<button type="button" class="mini" data-action="cat-edit" data-id="' + esc(x.id) + '">' + I.edit + '</button><button type="button" class="mini" data-action="cat-archive" data-id="' + esc(x.id) + '">' + (x.archived ? 'Unarchive' : 'Archive') + '</button><button type="button" class="mini mini-danger" data-action="cat-del" data-id="' + esc(x.id) + '" aria-label="Delete category">' + I.trash + '</button></li>';
      }).join('') + '</ul>' : '<p class="hint">None.</p>') + '</div>';
    }).join('');
    return '<div class="settings"><section class="card-block"><h2>Business</h2><div class="form-grid">' +
      '<label class="field"><span>Business name</span><input type="text" data-set="businessName" maxlength="60" value="' + esc(s.settings.businessName) + '"/></label>' +
      '<label class="field"><span>Currency</span><select data-set="currency">' + c.CURRENCIES.map(function (x) { return '<option value="' + x.code + '"' + sel(s.settings.currency, x.code) + '>' + x.label + '</option>'; }).join('') + '</select><small class="hint">Formatting only. Amounts are not converted.</small></label>' +
      '<label class="field"><span>Fiscal year starts in</span><select data-set="fiscalStart" data-num>' + months.map(function (n, i) { return '<option value="' + (i + 1) + '"' + sel(s.settings.fiscalStart, i + 1) + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Theme</span><select data-set="theme"><option value="system"' + sel(s.settings.theme, 'system') + '>Follow system</option><option value="light"' + sel(s.settings.theme, 'light') + '>Light</option><option value="dark"' + sel(s.settings.theme, 'dark') + '>Dark</option></select></label></div></section>' +
      '<section class="card-block"><div class="block-head"><h2>Accounts</h2><button type="button" class="btn btn-quiet" data-action="acc-new">' + I.plus + 'Add account</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Account</th><th class="num">Opening</th><th class="num">Balance today</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' + accRows + '</tbody></table></div></section>' +
      '<section class="card-block span-2"><div class="block-head"><h2>Categories</h2><button type="button" class="btn btn-quiet" data-action="cat-new">' + I.plus + 'Add category</button></div><div class="cat-groups">' + cats + '</div></section>' +
      '<section class="card-block span-2"><h2>Data</h2><p class="note">Your data is saved in this browser only. Export a backup regularly, especially before clearing the browser or switching devices.</p>' +
      '<div class="btn-row"><button type="button" class="btn btn-primary" data-action="export">Export backup</button><button type="button" class="btn btn-quiet" data-action="import">Import backup</button><button type="button" class="btn btn-quiet" data-action="sample">Load sample data</button><button type="button" class="btn btn-danger" data-action="clear-all">Clear all data</button></div></section></div>';
  }
  function categoryForm(d) {
    var c = C(), used = d.id ? c.isUsed(c.categoryUsage(d.id)) : false;
    return '<div class="form-grid"><label class="field"><span>Name</span><input type="text" id="cName" maxlength="40" value="' + esc(d.name) + '"/></label>' +
      '<label class="field"><span>Group</span><select id="cGroup">' + Object.keys(c.GROUPS).map(function (g) { return '<option value="' + g + '"' + sel(d.group, g) + '>' + esc(c.GROUPS[g].label) + (c.GROUPS[g].dir ? ' (money ' + c.GROUPS[g].dir + ')' : '') + '</option>'; }).join('') + '</select></label>' +
      (d.group === 'non-pl' ? '<label class="field"><span>Direction</span><select id="cDir"' + (used ? ' disabled' : '') + '><option value="in"' + sel(d.dir, 'in') + '>Money in</option><option value="out"' + sel(d.dir, 'out') + '>Money out</option></select></label>' +
        '<label class="field"><span>Cash-flow type</span><select id="cCf"><option value="owner"' + sel(d.cf, 'owner') + '>Owner (capital, drawings)</option><option value="financing"' + sel(d.cf, 'financing') + '>Financing (loans)</option><option value="investing"' + sel(d.cf, 'investing') + '>Investing (equipment, assets)</option></select></label>' : '') + '</div>' +
      (d.group === 'non-pl' ? '<p class="hint">Not in profit and loss: these change balances and cash flow, never profit.</p>' : '') + (used ? '<p class="hint">This category is in use, so its direction cannot change.</p>' : '');
  }
  function accountForm(d) {
    return '<div class="form-grid"><label class="field"><span>Name</span><input type="text" id="aName" maxlength="40" value="' + esc(d.name) + '"/></label>' +
      '<label class="field"><span>Type</span><select id="aType">' + [['cash', 'Cash'], ['bank', 'Bank'], ['e-wallet', 'E-wallet'], ['other', 'Other']].map(function (t) { return '<option value="' + t[0] + '"' + sel(d.type, t[0]) + '>' + t[1] + '</option>'; }).join('') + '</select></label>' +
      '<label class="field"><span>Opening balance</span><input type="number" id="aOpening" step="any" value="' + esc(d.opening) + '"/></label></div><p class="hint">The opening balance counts before all transactions.</p>';
  }

  B.ui = { esc: esc, I: I, dfmt: dfmt, header: header, dashboard: dashboard, transactions: transactions, debts: debts, budgets: budgets, reports: reports, settings: settings,
    txForm: txForm, ruleForm: ruleForm, debtForm: debtForm, paymentForm: paymentForm, debtDetail: debtDetail, dueList: dueList, budgetForm: budgetForm,
    categoryForm: categoryForm, accountForm: accountForm, reportPrint: reportPrint, debtPrint: debtPrint, badge: badge };
})();

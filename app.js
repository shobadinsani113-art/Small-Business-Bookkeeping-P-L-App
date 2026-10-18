/* app.js — events, dialogs, forms, keyboard shortcuts, printing and start-up */
(function () {
  'use strict';
  var B = window.BOOKS = window.BOOKS || {};
  var core = B.core, ui = B.ui, esc = ui.esc, I = ui.I;
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function num(v) { if (v === '' || v == null) return null; var n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : null; }

  /* ============ VIEW STATE ============ */
  var t0 = core.today(), r0 = core.presetRange('month', t0);
  var view = {
    tab: 'dashboard', txSub: 'list',
    tf: { preset: 'month', from: r0.from, to: r0.to, type: 'all', account: 'all', category: 'all', search: '', page: 1 },
    debtKind: 'receivable', debtStatus: 'unpaid', budgetMonth: t0.slice(0, 7),
    repPreset: 'month', repFrom: r0.from, repTo: r0.to
  };
  var lastDay = t0;

  /* ============ THEME ============ */
  function isDark() { var t = core.state.settings.theme; if (t === 'dark') return true; if (t === 'light') return false; return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  function applyTheme() { var t = core.state.settings.theme; if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }

  /* ============ RENDER ============ */
  var PANELS = { dashboard: ui.dashboard, transactions: ui.transactions, debts: ui.debts, budgets: ui.budgets, reports: ui.reports, settings: ui.settings };
  function render() {
    applyTheme();
    document.title = core.state.settings.businessName + ' · Cash book';
    $('#header').innerHTML = ui.header();
    $all('.nav-btn').forEach(function (b) { b.setAttribute('aria-current', b.dataset.tab === view.tab ? 'page' : 'false'); });
    var active = document.activeElement, id = active && active.id, caret = null;
    try { caret = id && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null; } catch (e) { caret = null; }
    $('#view').innerHTML = PANELS[view.tab]();
    if (id) { var el = document.getElementById(id); if (el && el.closest('#view')) { el.focus(); if (caret) try { el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* not text */ } } }
    $('#saveWarn').hidden = !core.saveError();
  }
  function go(tab) { view.tab = tab; render(); window.scrollTo(0, 0); }

  /* ============ TOAST & DIALOGS ============ */
  var toastTimer;
  function toast(msg, bad) { var t = $('#toast'); t.textContent = msg; t.className = 'toast show' + (bad ? ' bad' : ''); clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.className = 'toast'; }, 2800); }
  function attempt(fn) { try { var r = fn(); return r === undefined ? true : r; } catch (e) { toast(e.message, true); return false; } }
  var stack = [];
  function openDialog(o) {
    var ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = '<div class="dialog' + (o.wide ? ' dialog-wide' : '') + (o.small ? ' dialog-small' : '') + '" role="dialog" aria-modal="true" aria-labelledby="dlg' + stack.length + '">' +
      '<div class="dialog-head"><h2 id="dlg' + stack.length + '">' + esc(o.title) + '</h2><button type="button" class="btn btn-quiet btn-icon" data-close aria-label="Close">' + I.x + '</button></div>' +
      '<div class="dialog-body">' + (o.body || '') + '</div><div class="dialog-foot">' + (o.foot || '') + '</div></div>';
    $('#dialogs').appendChild(ov);
    var d = { el: ov, returnTo: document.activeElement, onClose: o.onClose,
      body: function (h) { $('.dialog-body', ov).innerHTML = h; }, foot: function (h) { $('.dialog-foot', ov).innerHTML = h; }, close: function () { closeDialog(d); } };
    stack.push(d); document.body.classList.add('no-scroll');
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) d.close(); });
    ov.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) d.close(); });
    if (o.onMount) o.onMount(d);
    setTimeout(function () { var f = $(o.focus || '.dialog-body input:not([type=radio]):not([type=checkbox]), .dialog-body select', ov) || $('.dialog-foot .btn-primary, .dialog-foot .btn-danger', ov); if (f) f.focus(); }, 30);
    return d;
  }
  function closeDialog(d) {
    var i = stack.indexOf(d); if (i === -1) return;
    stack.splice(i, 1); d.el.remove(); if (!stack.length) document.body.classList.remove('no-scroll');
    if (d.onClose) d.onClose();
    if (d.returnTo && document.contains(d.returnTo)) d.returnTo.focus();
  }
  function confirmDialog(title, html, okText, danger) {
    return new Promise(function (resolve) {
      var done = false;
      openDialog({ title: title, small: true, body: html, foot: '<button type="button" class="btn btn-quiet" data-close>Cancel</button><button type="button" class="btn ' + (danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(okText || 'OK') + '</button>',
        onClose: function () { if (!done) resolve(false); },
        onMount: function (d) { $('[data-ok]', d.el).addEventListener('click', function () { done = true; d.close(); resolve(true); }); } });
    });
  }
  /* Form dialog helper: onSave returns true to close */
  function formDialog(o) {
    return openDialog({ title: o.title, wide: o.wide, small: o.small, body: o.body, focus: o.focus,
      foot: '<button type="button" class="btn btn-quiet" data-close>Cancel</button>' + (o.extraFoot || '') + '<button type="button" class="btn btn-primary" data-save>' + esc(o.saveText || 'Save') + '</button>',
      onMount: function (d) {
        $('[data-save]', d.el).addEventListener('click', function () { if (o.onSave(d)) d.close(); });
        d.el.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'radio' && e.target.type !== 'checkbox') { e.preventDefault(); if (o.onSave(d)) d.close(); } });
        if (o.onMount) o.onMount(d);
      } });
  }

  /* ============ DOWNLOAD & PRINT ============ */
  function download(name, text, type) {
    var blob = new Blob([text], { type: type }), url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }
  function slug() { return core.state.settings.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cashbook'; }
  function printHtml(html) {
    $('#printArea').innerHTML = html; document.body.classList.add('printing');
    var done = false; function cleanup() { if (done) return; done = true; document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; }
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(function () { window.print(); setTimeout(cleanup, 1000); }, 50);
  }

  /* ============ TRANSACTION FORM ============ */
  function openTxForm(existing, prefill) {
    var t = core.today(), firstAcc = core.state.accounts.filter(function (a) { return !a.archived; })[0];
    var d = existing ? core.clone(existing) : Object.assign({ id: null, type: 'out', amount: '', date: t, accountId: firstAcc ? firstAcc.id : '', toAccountId: '', categoryId: '', note: '', source: null }, prefill || {});
    if (existing) d.amount = existing.amount.toFixed(core.digits());
    function read(dlg) {
      d.amount = $('#fAmount', dlg.el).value; d.date = $('#fDate', dlg.el).value; d.accountId = $('#fAccount', dlg.el).value; d.note = $('#fNote', dlg.el).value;
      var to = $('#fTo', dlg.el); if (to) d.toAccountId = to.value; var cat = $('#fCategory', dlg.el); if (cat) d.categoryId = cat.value;
    }
    function warn(dlg) {
      read(dlg); var amt = num(d.amount), box = $('#fWarn', dlg.el);
      if (!amt || amt <= 0 || !core.isDate(d.date) || !d.accountId || (d.type === 'transfer' && !d.toAccountId)) { box.innerHTML = ''; return; }
      var w = core.negativeWarning({ id: '__draft', date: d.date, type: d.type, amount: amt, accountId: d.accountId, toAccountId: d.toAccountId }, d.id);
      box.innerHTML = w.length ? '<div class="alert alert-warn">' + I.warn + '<div><b>Balance will go negative</b><span>' + w.map(function (x) { return esc(x.account) + ' reaches ' + esc(core.money(x.balance)); }).join('<br>') + '. You can still save.</span></div></div>' : '';
    }
    function rerender(dlg) { dlg.body(ui.txForm(d)); warn(dlg); }
    function save(dlg, again) {
      read(dlg);
      var res = attempt(function () { return core.saveTx({ id: d.id, type: d.type, amount: num(d.amount), date: d.date, accountId: d.accountId, toAccountId: d.toAccountId, categoryId: d.categoryId, note: d.note, source: d.source }); });
      if (!res) return false;
      toast(existing ? 'Transaction updated' : 'Transaction saved'); render();
      if (again) { d.amount = ''; d.note = ''; rerender(dlg); setTimeout(function () { $('#fAmount', dlg.el).focus(); }, 20); return false; }
      return true;
    }
    formDialog({ title: existing ? 'Edit transaction' : 'Add transaction', body: ui.txForm(d), focus: '#fAmount', saveText: 'Save',
      extraFoot: existing ? '' : '<button type="button" class="btn btn-quiet" data-again>Save &amp; add another</button>',
      onSave: function (dlg) { return save(dlg, false); },
      onMount: function (dlg) {
        warn(dlg);
        dlg.el.addEventListener('click', function (e) {
          var ty = e.target.closest('[data-tf-type]'); if (ty && !ty.disabled) { read(dlg); d.type = ty.dataset.tfType; if (d.type !== 'transfer') { var cat = core.category(d.categoryId); if (!cat || cat.dir !== d.type) d.categoryId = ''; } rerender(dlg); $('#fAmount', dlg.el).focus(); }
          var ch = e.target.closest('[data-tf-cat]'); if (ch) { read(dlg); d.categoryId = ch.dataset.tfCat; rerender(dlg); }
          if (e.target.closest('[data-again]')) save(dlg, true);
        });
        dlg.el.addEventListener('input', function () { warn(dlg); });
        dlg.el.addEventListener('change', function (e) { if (e.target.id === 'fCategory') { read(dlg); $all('[data-tf-cat]', dlg.el).forEach(function (b) { b.classList.toggle('is-active', b.dataset.tfCat === d.categoryId); }); } warn(dlg); });
      } });
  }

  /* ============ RECURRING ============ */
  function openDueConfirm(ruleId, occ) {
    var r = core.rule(ruleId); if (!r) return;
    formDialog({ title: 'Confirm ' + r.name, small: true, saveText: 'Record ' + (r.type === 'in' ? 'income' : 'expense'),
      body: '<p class="note">Scheduled for <b>' + esc(ui.dfmt(occ)) + '</b>. Adjust the amount if the bill changed.</p><div class="form-grid"><label class="field"><span>Amount</span><input type="number" id="dcAmount" min="0" step="any" value="' + r.amount.toFixed(core.digits()) + '"/></label>' +
        '<label class="field"><span>Account</span><select id="dcAccount">' + core.state.accounts.filter(function (a) { return !a.archived || a.id === r.accountId; }).map(function (a) { return '<option value="' + esc(a.id) + '"' + (a.id === r.accountId ? ' selected' : '') + '>' + esc(a.name) + '</option>'; }).join('') + '</select></label></div>',
      onSave: function (dlg) { if (attempt(function () { core.confirmDue(ruleId, occ, num($('#dcAmount', dlg.el).value), $('#dcAccount', dlg.el).value); })) { toast('Recorded ' + r.name); render(); refreshDueDialog(); return true; } return false; } });
  }
  var dueDlg = null;
  function refreshDueDialog() { if (!dueDlg) return; var items = core.dueItems(core.today()); if (!items.length) { dueDlg.close(); return; } dueDlg.body(ui.dueList(items)); }
  function openDueReview() {
    dueDlg = openDialog({ title: 'Recurring items to confirm', body: ui.dueList(core.dueItems(core.today())), foot: '<button type="button" class="btn btn-quiet" data-close>Close</button><button type="button" class="btn btn-primary" data-all>Confirm all</button>',
      onClose: function () { dueDlg = null; },
      onMount: function (d) { d.el.addEventListener('click', function (e) { if (e.target.closest('[data-all]')) confirmAll(); handleDueButtons(e); }); } });
  }
  function handleDueButtons(e) {
    var c = e.target.closest('[data-due-confirm]'), s = e.target.closest('[data-due-skip]');
    if (c) { var p = c.dataset.dueConfirm.split('|'); openDueConfirm(p[0], p[1]); }
    if (s) { var q = s.dataset.dueSkip.split('|'), r = core.rule(q[0]); confirmDialog('Skip this occurrence?', '<p>' + esc(r.name) + ' on ' + esc(ui.dfmt(q[1])) + ' will not be recorded and won’t come back.</p>', 'Skip').then(function (y) { if (y) { core.skipDue(q[0], q[1]); toast('Skipped'); render(); refreshDueDialog(); } }); }
  }
  function confirmAll() {
    var items = core.dueItems(core.today()), total = items.reduce(function (s, x) { return s + core.toMinor(x.rule.amount); }, 0);
    confirmDialog('Confirm all ' + items.length + ' items?', '<p>Each item is recorded with its scheduled amount and account (' + esc(core.money(core.fromMinor(total))) + ' in total).</p>', 'Confirm all').then(function (y) {
      if (!y) return; items.forEach(function (x) { core.confirmDue(x.rule.id, x.occ, x.rule.amount, x.rule.accountId); }); toast(items.length + ' items recorded'); render(); refreshDueDialog();
    });
  }
  function openRuleForm(existing) {
    var t = core.today(), firstAcc = core.state.accounts.filter(function (a) { return !a.archived; })[0];
    var d = existing ? core.clone(existing) : { id: null, name: '', type: 'out', categoryId: '', accountId: firstAcc ? firstAcc.id : '', amount: '', freq: 'monthly', start: t, end: '', mode: 'confirm' };
    function read(dlg) {
      d.name = $('#rName', dlg.el).value; d.amount = $('#rAmount', dlg.el).value; d.categoryId = $('#rCategory', dlg.el).value; d.accountId = $('#rAccount', dlg.el).value;
      d.freq = $('#rFreq', dlg.el).value; d.start = $('#rStart', dlg.el).value; d.end = $('#rEnd', dlg.el).value; d.mode = ($('input[name=rMode]:checked', dlg.el) || {}).value || 'confirm';
    }
    function preview(dlg) {
      read(dlg); var box = $('#rSchedule', dlg.el);
      if (!core.isDate(d.start)) { box.textContent = ''; return; }
      var tmp = { start: d.start, end: d.end || null, freq: d.freq, handled: existing ? existing.handled : [] };
      var past = core.occurrences(tmp, t).filter(function (o) { return tmp.handled.indexOf(o) === -1; }).length, nx = core.nextOccurrence(tmp, t);
      box.textContent = core.scheduleText(tmp) + (nx ? ' · next on ' + ui.dfmt(nx) : '') + (past ? ' · ' + past + ' past date' + (past > 1 ? 's' : '') + ' will be ' + (d.mode === 'auto' ? 'recorded now' : 'listed to confirm') : '');
    }
    formDialog({ title: existing ? 'Edit recurring rule' : 'Add recurring rule', body: ui.ruleForm(d), saveText: 'Save rule',
      onSave: function (dlg) {
        read(dlg);
        var data = { id: d.id, name: d.name, type: d.type, categoryId: d.categoryId, accountId: d.accountId, amount: num(d.amount), freq: d.freq, start: d.start, end: d.end || null, mode: d.mode };
        var handled = existing ? existing.handled : [], past = core.isDate(d.start) ? core.occurrences({ start: d.start, end: d.end || null, freq: d.freq }, t).filter(function (o) { return handled.indexOf(o) === -1; }).length : 0;
        function doSave() { if (attempt(function () { core.saveRule(data); })) { toast('Rule saved'); render(); dlg.close(); } }
        if (past > 3) confirmDialog(past + ' past dates', '<p>This rule will immediately ' + (d.mode === 'auto' ? 'record <b>' + past + ' transactions</b>' : 'list <b>' + past + ' items</b> to confirm') + ' for dates before today. Continue?</p>', 'Continue').then(function (y) { if (y) doSave(); });
        else doSave();
        return false;
      },
      onMount: function (dlg) {
        preview(dlg);
        dlg.el.addEventListener('click', function (e) { var b = e.target.closest('[data-rf-type]'); if (b) { read(dlg); d.type = b.dataset.rfType; var c = core.category(d.categoryId); if (!c || c.dir !== d.type) d.categoryId = ''; dlg.body(ui.ruleForm(d)); preview(dlg); } });
        dlg.el.addEventListener('input', function () { preview(dlg); }); dlg.el.addEventListener('change', function () { preview(dlg); });
      } });
  }

  /* ============ DEBTS ============ */
  function openDebtForm(existing, kind) {
    var t = core.today(), info = existing ? core.debtInfo(existing) : null;
    var d = existing ? core.clone(existing) : { id: null, kind: kind || view.debtKind, party: '', description: '', amount: '', date: t, due: core.addDays(t, 30), categoryId: '' };
    d.locked = !!(info && info.paid > 0);
    function read(dlg) { d.party = $('#dParty', dlg.el).value; d.description = $('#dDesc', dlg.el).value; d.amount = $('#dAmount', dlg.el).value; d.date = $('#dDate', dlg.el).value; d.due = $('#dDue', dlg.el).value; d.categoryId = $('#dCategory', dlg.el).value; }
    formDialog({ title: existing ? 'Edit ' + d.kind : 'Add ' + d.kind, body: ui.debtForm(d), saveText: 'Save',
      onSave: function (dlg) { read(dlg); if (attempt(function () { core.saveDebt({ id: d.id, kind: d.kind, party: d.party, description: d.description, amount: num(d.amount), date: d.date, due: d.due || null, categoryId: d.categoryId }); })) { toast('Saved'); render(); return true; } return false; },
      onMount: function (dlg) { dlg.el.addEventListener('click', function (e) { var b = e.target.closest('[data-df-kind]'); if (b && !b.disabled) { read(dlg); d.kind = b.dataset.dfKind; d.categoryId = ''; dlg.body(ui.debtForm(d)); } }); } });
  }
  function openPayment(debtId) {
    var info = core.debtInfo(core.debt(debtId));
    formDialog({ title: (info.debt.kind === 'receivable' ? 'Receive payment · ' : 'Pay · ') + info.debt.party, small: true, body: ui.paymentForm(info), saveText: 'Record payment',
      onSave: function (dlg) { if (attempt(function () { core.recordPayment(debtId, num($('#pAmount', dlg.el).value), $('#pDate', dlg.el).value, $('#pAccount', dlg.el).value); })) { toast('Payment recorded'); render(); refreshDebtDetail(); return true; } return false; } });
  }
  var debtDlg = null;
  function refreshDebtDetail() { if (debtDlg && core.debt(debtDlg.debtId)) debtDlg.body(ui.debtDetail(core.debtInfo(core.debt(debtDlg.debtId)))); }
  function openDebtDetail(id) {
    var dbt = core.debt(id); if (!dbt) return;
    var info = core.debtInfo(dbt);
    debtDlg = openDialog({ title: dbt.party + (dbt.description ? ' · ' + dbt.description : ''), body: ui.debtDetail(info),
      foot: '<button type="button" class="btn btn-quiet btn-danger-text" data-del>' + I.trash + 'Delete</button><button type="button" class="btn btn-quiet" data-edit>' + I.edit + 'Edit</button>' + (info.remaining > 0 ? '<button type="button" class="btn btn-primary" data-pay>' + (dbt.kind === 'receivable' ? 'Receive payment' : 'Record payment') + '</button>' : ''),
      onClose: function () { debtDlg = null; },
      onMount: function (d) {
        d.debtId = id;
        d.el.addEventListener('click', function (e) {
          if (e.target.closest('[data-pay]')) openPayment(id);
          if (e.target.closest('[data-edit]')) { d.close(); openDebtForm(core.debt(id)); }
          if (e.target.closest('[data-del]')) {
            if (core.debtInfo(core.debt(id)).payments.length) return toast('Delete this debt’s payments first.', true);
            confirmDialog('Delete this ' + dbt.kind + '?', '<p>' + esc(dbt.party) + ' · ' + esc(core.money(dbt.amount)) + ' will be removed.</p>', 'Delete', true).then(function (y) { if (y && attempt(function () { core.deleteDebt(id); })) { d.close(); toast('Deleted'); render(); } });
          }
          var pe = e.target.closest('[data-pay-edit]'); if (pe) openTxForm(core.tx(pe.dataset.payEdit));
          var pd = e.target.closest('[data-pay-del]');
          if (pd) confirmDialog('Delete payment?', '<p>The payment is removed and the remaining amount goes back up.</p>', 'Delete payment', true).then(function (y) { if (y) { core.deleteTx(pd.dataset.payDel); toast('Payment deleted'); render(); refreshDebtDetail(); } });
        });
      } });
  }

  /* ============ BUDGETS, CATEGORIES, ACCOUNTS ============ */
  function openBudgetForm(categoryId) {
    var b = categoryId ? core.state.budgets.filter(function (x) { return x.categoryId === categoryId; })[0] : null;
    var free = core.state.categories.filter(function (x) { return core.EXPENSE_GROUPS.indexOf(x.group) > -1 && !x.archived && !core.state.budgets.some(function (y) { return y.categoryId === x.id; }); });
    if (!b && !free.length) return toast('Every expense category already has a budget.', true);
    formDialog({ title: b ? 'Edit budget' : 'Add budget', small: true, body: ui.budgetForm(b ? b.categoryId : free[0].id, b ? b.amount : '', !!b), saveText: 'Save budget', focus: '#bAmount',
      onSave: function (dlg) { if (attempt(function () { core.setBudget($('#bCategory', dlg.el).value, num($('#bAmount', dlg.el).value)); })) { toast('Budget saved'); render(); return true; } return false; } });
  }
  function openCategoryForm(existing) {
    var d = existing ? core.clone(existing) : { id: null, name: '', group: 'opex', dir: 'out', cf: 'owner' };
    function read(dlg) { d.name = $('#cName', dlg.el).value; d.group = $('#cGroup', dlg.el).value; var dir = $('#cDir', dlg.el), cf = $('#cCf', dlg.el); if (dir) d.dir = dir.value; if (cf) d.cf = cf.value; if (d.group !== 'non-pl') d.dir = core.GROUPS[d.group].dir; }
    formDialog({ title: existing ? 'Edit category' : 'Add category', body: ui.categoryForm(d), saveText: 'Save category',
      onSave: function (dlg) {
        read(dlg);
        function doSave() { if (attempt(function () { core.saveCategory(d); })) { toast('Category saved'); render(); dlg.close(); } }
        if (existing && (existing.group !== d.group || existing.cf !== (d.group === 'non-pl' ? d.cf : null))) {
          var n = core.categoryUsage(existing.id).transactions;
          if (n) { confirmDialog('Reclassify “' + existing.name + '”?', '<p>' + n + ' transaction' + (n > 1 ? 's' : '') + ' move from <b>' + esc(core.GROUPS[existing.group].label) + '</b> to <b>' + esc(core.GROUPS[d.group].label) + '</b>. Past reports will change.</p>', 'Reclassify').then(function (y) { if (y) doSave(); }); return false; }
        }
        doSave(); return false;
      },
      onMount: function (dlg) { dlg.el.addEventListener('change', function (e) { if (e.target.id === 'cGroup') { read(dlg); dlg.body(ui.categoryForm(d)); } }); } });
  }
  function deleteCategory(id) {
    var c = core.category(id), u = core.categoryUsage(id);
    if (!core.isUsed(u)) return confirmDialog('Delete category?', '<p>“' + esc(c.name) + '” is not used and will be deleted.</p>', 'Delete', true).then(function (y) { if (y && attempt(function () { core.deleteCategory(id); })) { toast('Category deleted'); render(); } });
    var targets = core.state.categories.filter(function (x) { return x.id !== id && x.dir === c.dir && !x.archived; });
    if (!targets.length) return toast('Create another money ' + c.dir + ' category to move these items to first.', true);
    var parts = []; if (u.transactions) parts.push(u.transactions + ' transactions'); if (u.rules) parts.push(u.rules + ' recurring rules'); if (u.debts) parts.push(u.debts + ' debts'); if (u.budget) parts.push('a budget');
    formDialog({ title: 'Delete “' + c.name + '”?', small: true, saveText: 'Move and delete',
      body: '<p>It is used by ' + esc(parts.join(', ')) + '. Move everything to:</p><label class="field"><span class="sr-only">Move to</span><select id="moveTo">' + targets.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + ' · ' + esc(core.GROUPS[x.group].label) + '</option>'; }).join('') + '</select></label><p class="hint">Archiving keeps the category for past reports without deleting it.</p>',
      onSave: function (dlg) { if (attempt(function () { core.deleteCategory(id, $('#moveTo', dlg.el).value); })) { toast('Moved and deleted'); render(); return true; } return false; } });
  }
  function openAccountForm(existing) {
    var d = existing ? core.clone(existing) : { id: null, name: '', type: 'bank', opening: 0 };
    formDialog({ title: existing ? 'Edit account' : 'Add account', small: true, body: ui.accountForm(d), saveText: 'Save account',
      onSave: function (dlg) { if (attempt(function () { core.saveAccount({ id: d.id, name: $('#aName', dlg.el).value, type: $('#aType', dlg.el).value, opening: num($('#aOpening', dlg.el).value) || 0 }); })) { toast('Account saved'); render(); return true; } return false; } });
  }

  /* ============ CLICK ACTIONS ============ */
  function setTfPreset(p) {
    var f = view.tf; f.preset = p; f.page = 1;
    if (p === 'all') { f.from = ''; f.to = ''; } else if (p !== 'custom') { var r = core.presetRange(p); f.from = r.from; f.to = r.to; }
    else if (!f.from) { var m = core.presetRange('month'); f.from = m.from; f.to = m.to; }
  }
  var actions = {
    'go': function (b) { go(b.dataset.id); },
    'theme': function () { core.updateSettings({ theme: isDark() ? 'light' : 'dark' }); render(); },
    'tx-new': function () { openTxForm(null); },
    'tx-edit': function (b) { openTxForm(core.tx(b.dataset.id)); },
    'tx-dup': function (b) { var x = core.tx(b.dataset.id); if (x.source && x.source.kind === 'debt-payment') return toast('Debt payments can’t be duplicated. Record a new payment on the debt.', true); openTxForm(null, { type: x.type, amount: x.amount.toFixed(core.digits()), accountId: x.accountId, toAccountId: x.toAccountId, categoryId: x.categoryId, note: x.note }); },
    'tx-del': function (b) {
      var x = core.tx(b.dataset.id), extra = x.source && x.source.kind === 'debt-payment' ? ' The linked debt’s remaining amount goes back up.' : x.source && x.source.kind === 'recurring' ? ' The recurring rule will not record this date again.' : '';
      confirmDialog('Delete transaction?', '<p>' + esc(ui.dfmt(x.date)) + ' · ' + esc(core.money(x.amount)) + ' will be deleted.' + extra + '</p>', 'Delete', true).then(function (y) { if (y) { core.deleteTx(x.id); toast('Transaction deleted'); render(); } });
    },
    'tx-sub': function (b) { view.txSub = b.dataset.id; render(); },
    'tf-preset': function (b) { setTfPreset(b.dataset.id); render(); },
    'tf-page': function (b) { view.tf.page = +b.dataset.id; render(); },
    'tx-csv': function () { download(slug() + '-transactions-' + core.today() + '.csv', core.txCsv(core.filterTx(view.tf)), 'text/csv'); toast('CSV exported'); },
    'due-review': openDueReview, 'due-all': confirmAll,
    'rule-new': function () { openRuleForm(null); }, 'rule-edit': function (b) { openRuleForm(core.rule(b.dataset.id)); },
    'rule-pause': function (b) { var r = core.rule(b.dataset.id); core.setRulePaused(r.id, !r.paused); toast(r.paused ? 'Rule paused' : 'Rule resumed'); render(); },
    'rule-del': function (b) { var r = core.rule(b.dataset.id); confirmDialog('Delete rule?', '<p>“' + esc(r.name) + '” stops creating transactions. Transactions it already recorded stay.</p>', 'Delete', true).then(function (y) { if (y) { core.deleteRule(r.id); render(); } }); },
    'debt-kind': function (b) { view.debtKind = b.dataset.id; render(); }, 'debt-status': function (b) { view.debtStatus = b.dataset.id; render(); },
    'debt-new': function () { openDebtForm(null); }, 'debt-open': function (b) { openDebtDetail(b.dataset.id); }, 'debt-pay': function (b) { openPayment(b.dataset.id); },
    'debt-print': function () { printHtml(ui.debtPrint()); },
    'bm-prev': function () { view.budgetMonth = core.shiftMonth(view.budgetMonth + '-01', -1).slice(0, 7); render(); },
    'bm-next': function () { view.budgetMonth = core.shiftMonth(view.budgetMonth + '-01', 1).slice(0, 7); render(); },
    'budget-new': function () { openBudgetForm(null); }, 'budget-edit': function (b) { openBudgetForm(b.dataset.id); },
    'budget-del': function (b) { confirmDialog('Remove budget?', '<p>The monthly limit for “' + esc(core.category(b.dataset.id).name) + '” is removed.</p>', 'Remove', true).then(function (y) { if (y) { core.removeBudget(b.dataset.id); render(); } }); },
    'rep-preset': function (b) { view.repPreset = b.dataset.id; if (b.dataset.id !== 'custom') { var r = core.presetRange(b.dataset.id); view.repFrom = r.from; view.repTo = r.to; } render(); },
    'rep-print': function () { printHtml(ui.reportPrint()); },
    'pl-csv': function () { var cmp = core.comparison(view.repPreset, view.repFrom, view.repTo); download(slug() + '-profit-and-loss-' + view.repFrom + '-to-' + view.repTo + '.csv', core.plCsv(core.profitAndLoss(view.repFrom, view.repTo), core.profitAndLoss(cmp.from, cmp.to)), 'text/csv'); toast('P&L CSV exported'); },
    'acc-new': function () { openAccountForm(null); }, 'acc-edit': function (b) { openAccountForm(core.account(b.dataset.id)); },
    'acc-archive': function (b) { var a = core.account(b.dataset.id); if (attempt(function () { core.setAccountArchived(a.id, !a.archived); })) { toast(a.archived ? 'Account archived' : 'Account restored'); render(); } },
    'acc-del': function (b) { var a = core.account(b.dataset.id); if (core.accountUsed(a.id)) return toast('This account has transactions or rules. Archive it instead.', true); confirmDialog('Delete account?', '<p>“' + esc(a.name) + '” will be deleted.</p>', 'Delete', true).then(function (y) { if (y && attempt(function () { core.deleteAccount(a.id); })) render(); }); },
    'cat-new': function () { openCategoryForm(null); }, 'cat-edit': function (b) { openCategoryForm(core.category(b.dataset.id)); },
    'cat-archive': function (b) { var c = core.category(b.dataset.id); core.setCategoryArchived(c.id, !c.archived); toast(c.archived ? 'Category archived' : 'Category restored'); render(); },
    'cat-del': function (b) { deleteCategory(b.dataset.id); },
    'export': function () { download(slug() + '-cashbook-backup-' + core.today() + '.json', core.exportState(), 'application/json'); toast('Backup exported'); },
    'import': function () { $('#importFile').click(); },
    'sample': function () { confirmDialog('Load sample data?', '<p>This replaces all current data with the sample café and 12 months of history. Export a backup first if you want to keep your data.</p>', 'Load sample data', true).then(function (y) { if (y) { core.loadSample(); toast('Sample data loaded'); render(); } }); },
    'clear-all': function () { confirmDialog('Clear all data?', '<p>All transactions, recurring rules, debts and budgets are deleted, and opening balances are set to 0. Settings, accounts and categories are kept.</p>', 'Clear all data', true).then(function (y) { if (y) { core.clearAll(); toast('All data cleared'); render(); } }); }
  };
  document.addEventListener('click', function (e) {
    var nav = e.target.closest('.nav-btn'); if (nav) return go(nav.dataset.tab);
    if (e.target.closest('.overlay')) return;
    if (e.target.closest('[data-due-confirm], [data-due-skip]')) return handleDueButtons(e);
    var b = e.target.closest('[data-action]'); if (!b || b.disabled) return;
    var fn = actions[b.dataset.action]; if (fn) fn(b);
  });
  document.addEventListener('keydown', function (e) {
    var row = e.target.closest && e.target.closest('tr[data-action]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); actions[row.dataset.action](row); return; }
    if (e.key === 'Escape') { if (stack.length) { stack[stack.length - 1].close(); e.preventDefault(); } return; }
    if (stack.length || /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openTxForm(null); }
    if (e.key === '/') { e.preventDefault(); view.tab = 'transactions'; view.txSub = 'list'; render(); var s = $('#tfSearch'); if (s) s.focus(); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.closest('.overlay')) return;
    if (e.target.id === 'tfSearch') { view.tf.search = e.target.value; view.tf.page = 1; render(); }
  });
  document.addEventListener('change', function (e) {
    if (e.target.closest('.overlay')) return;
    var t = e.target, f = view.tf;
    if (t.id === 'tfFrom' || t.id === 'tfTo') { if (t.value) f[t.id === 'tfFrom' ? 'from' : 'to'] = t.value; f.page = 1; render(); }
    else if (t.id === 'tfType') { f.type = t.value; f.page = 1; render(); }
    else if (t.id === 'tfAccount') { f.account = t.value; f.page = 1; render(); }
    else if (t.id === 'tfCategory') { f.category = t.value; f.page = 1; render(); }
    else if (t.id === 'repFrom' || t.id === 'repTo') { if (t.value) view[t.id] = t.value; if (view.repFrom > view.repTo) { var x = view.repFrom; view.repFrom = view.repTo; view.repTo = x; } render(); }
    else if (t.dataset.set) {
      var key = t.dataset.set, val = t.hasAttribute('data-num') ? +t.value : t.value;
      if (key === 'businessName' && !String(val).trim()) { toast('Enter a business name.', true); render(); return; }
      var patch = {}; patch[key] = typeof val === 'string' ? val.trim() : val; core.updateSettings(patch); toast('Settings saved'); render();
    }
  });
  $('#importFile').addEventListener('change', function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      var parsed; try { parsed = JSON.parse(r.result); } catch (err) { return toast('Import failed: the file is not valid JSON.', true); }
      var problem = core.validate(parsed); if (problem) return toast('Import failed: ' + problem, true);
      confirmDialog('Import backup?', '<p>Replace all current data with “' + esc(f.name) + '” (' + parsed.transactions.length + ' transactions, ' + parsed.debts.length + ' debts)?</p>', 'Import backup').then(function (y) { if (y && attempt(function () { core.importState(r.result); })) { core.processRecurring(core.today()); toast('Backup imported'); render(); } });
    };
    r.onerror = function () { toast('Import failed: the file could not be read.', true); };
    r.readAsText(f);
  });
  $('#fab').addEventListener('click', function () { openTxForm(null); });

  /* ============ DAY CHANGE: process recurring when the app regains focus on a new day ============ */
  function onWake() { var d = core.today(); if (d !== lastDay) { lastDay = d; core.processRecurring(d); render(); } }
  window.addEventListener('focus', onWake);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) onWake(); });

  /* ============ START-UP ============ */
  B.app = { view: view, isDark: isDark, render: render, toast: toast };
  core.load();
  core.onSave(function () { $('#saveWarn').hidden = !core.saveError(); });
  if (window.matchMedia) { var mq = window.matchMedia('(prefers-color-scheme: dark)'), onMq = function () { if (core.state.settings.theme === 'system') render(); }; if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }
  render();
  if (/[?&]selftest\b/.test(location.search)) { var res = core.runSelfTests(); toast('Self-tests: ' + res.passed + '/' + res.total + ' passed', res.failed.length > 0); }
})();

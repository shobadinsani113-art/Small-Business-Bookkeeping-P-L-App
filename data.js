/* data.js — defaults and the deterministic 12-month sample generator for Bean & Leaf (coffee shop, USD) */
(function () {
  'use strict';
  var B = window.BOOKS = window.BOOKS || {};
  var SEED = 20261018;
  var ACCOUNTS = 'Cash, Chase Bank, PayPal';

  function mulberry32(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function accountType(name) {
    var n = name.toLowerCase();
    if (/cash|petty|drawer|till/.test(n)) return 'cash';
    if (/bank|chase|checking|savings|bca|mandiri|bri|bni/.test(n)) return 'bank';
    if (/pay|wallet|gopay|ovo|dana|venmo|wise|cash ?app/.test(n)) return 'e-wallet';
    return 'other';
  }
  function defaultSettings() { return { businessName: 'Bean & Leaf', currency: 'USD', fiscalStart: 1, theme: 'system' }; }
  function cat(id, name, dir, group, cf) { return { id: id, name: name, dir: dir, group: group, cf: cf || null, archived: false }; }
  function defaultCategories() {
    return [
      cat('c_sales', 'Café sales', 'in', 'revenue'), cat('c_catering', 'Catering & events', 'in', 'revenue'),
      cat('c_interest', 'Bank interest', 'in', 'other-income'),
      cat('c_coffee', 'Coffee & ingredients', 'out', 'cogs'), cat('c_pastry', 'Pastries (wholesale)', 'out', 'cogs'),
      cat('c_rent', 'Rent', 'out', 'opex'), cat('c_salaries', 'Salaries', 'out', 'opex'), cat('c_utilities', 'Utilities', 'out', 'opex'),
      cat('c_marketing', 'Marketing', 'out', 'opex'), cat('c_maint', 'Equipment maintenance', 'out', 'opex'), cat('c_software', 'Software & subscriptions', 'out', 'opex'),
      cat('c_supplies', 'Cleaning & supplies', 'out', 'opex'),
      cat('c_fees', 'Bank & card fees', 'out', 'other-expense'),
      cat('c_capital', 'Owner capital', 'in', 'non-pl', 'owner'), cat('c_drawings', 'Owner drawings', 'out', 'non-pl', 'owner'),
      cat('c_loan_in', 'Loan received', 'in', 'non-pl', 'financing'), cat('c_loan_out', 'Loan repayment', 'out', 'non-pl', 'financing'),
      cat('c_equipment', 'Equipment purchase', 'out', 'non-pl', 'investing')
    ];
  }
  function defaultAccounts() {
    var openings = [400, 12000, 300];
    return ACCOUNTS.split(',').map(function (n, i) { n = n.trim(); return { id: 'a_' + i, name: n, type: accountType(n), opening: openings[i] || 0, archived: false }; });
  }

  /* 12 months of history ending `today`. Seasonality: slow February, strong December. */
  var SEASON = [0.9, 0.78, 0.95, 1.0, 1.04, 1.06, 1.02, 1.0, 1.03, 1.05, 1.1, 1.22];
  function buildSample(core, today) {
    var st = { version: core.VERSION, settings: defaultSettings(), accounts: defaultAccounts(), categories: defaultCategories(),
      transactions: [], rules: [], debts: [], budgets: [], recent: { in: [], out: [] } };
    var rng = mulberry32(SEED);
    function r(a, b) { return a + rng() * (b - a); }
    function money(v) { return Math.round(v * 100) / 100; }
    var CASH = 'a_0', BANK = 'a_1', PAYPAL = 'a_2';
    core._withState(st, function () {
      var start = core.shiftMonth(core.monthStart(today), -11);
      function add(date, type, amount, accountId, categoryId, note, toAccountId) {
        if (date > today || date < start) return;
        core.saveTx({ date: date, type: type, amount: money(amount), accountId: accountId, toAccountId: toAccountId, categoryId: categoryId, note: note || '' });
      }
      for (var k = 0; k < 12; k++) {
        var m0 = core.shiftMonth(start, k), p = core.parts(m0), last = core.dim(p.y, p.m), season = SEASON[p.m - 1];
        function day(d) { return core.fmtDate(p.y, p.m, Math.min(d, last)); }
        for (var w = 0; w < 5; w++) {
          var d0 = 2 + w * 7; if (d0 > last) break;
          add(day(d0), 'in', r(3600, 4300) * season, BANK, 'c_sales', 'Card sales deposit');
          add(day(d0 + 1), 'in', r(800, 1000) * season, CASH, 'c_sales', 'Cash sales');
          add(day(d0 + 2), 'in', r(250, 350) * season, PAYPAL, 'c_sales', 'Online orders');
          add(day(d0 + 3), 'out', r(1100, 1300) * season, BANK, 'c_coffee', 'Northside Roasters & dairy');
          if (w < 4) add(day(d0 + 4), 'out', r(350, 450) * season, rng() < 0.5 ? BANK : CASH, 'c_pastry', 'Morning Crust Bakery');
          if (w < 4) add(day(d0 + 5), 'transfer', r(780, 920) * season, CASH, null, 'Cash deposit to bank', BANK);
        }
        var cat1 = Math.floor(r(1, 2.99));
        for (var c = 0; c < cat1; c++) add(day(Math.floor(r(6, 26))), 'in', r(600, 1500), BANK, 'c_catering', 'Event catering');
        add(day(Math.floor(r(8, 20))), 'out', r(150, 380), BANK, 'c_marketing', 'Social ads');
        if (rng() < 0.6) add(day(Math.floor(r(10, 26))), 'out', r(120, 320), BANK, 'c_marketing', 'Flyers & promos');
        add(day(9), 'out', r(70, 130), CASH, 'c_supplies', 'Cleaning supplies'); add(day(23), 'out', r(70, 130), CASH, 'c_supplies', 'Cleaning supplies');
        if (rng() < 0.4) add(day(Math.floor(r(5, 25))), 'out', r(90, 280), BANK, 'c_maint', 'Espresso machine service');
        add(day(last), 'out', r(380, 470) * season, BANK, 'c_fees', 'Card processing fees');
        add(day(last), 'in', r(3, 8), BANK, 'c_interest', 'Interest');
        add(day(15), 'out', 3000, BANK, 'c_drawings', 'Owner drawings');
        add(day(26), 'transfer', r(1200, 1400) * season, PAYPAL, null, 'PayPal payout', BANK);
        if (k === 7) add(day(18), 'out', 1850, BANK, 'c_equipment', 'New coffee grinder');
      }
      /* Recurring rules: auto rules post their history through the normal processing. */
      core.saveRule({ name: 'Rent', type: 'out', categoryId: 'c_rent', accountId: BANK, amount: 3600, freq: 'monthly', start: start, mode: 'auto' });
      core.saveRule({ name: 'Salaries', type: 'out', categoryId: 'c_salaries', accountId: BANK, amount: 9200, freq: 'monthly', start: core.fmtDate(core.parts(start).y, core.parts(start).m, 28), mode: 'auto' });
      core.saveRule({ name: 'Website & POS subscriptions', type: 'out', categoryId: 'c_software', accountId: PAYPAL, amount: 89, freq: 'monthly', start: core.fmtDate(core.parts(start).y, core.parts(start).m, 12), mode: 'auto' });
      var util = core.saveRule({ name: 'Electricity & water', type: 'out', categoryId: 'c_utilities', accountId: BANK, amount: 650, freq: 'monthly', start: core.fmtDate(core.parts(start).y, core.parts(start).m, 5), mode: 'confirm' });
      core.processRecurring(today);
      var occ = core.occurrences(util, today);
      occ.slice(0, -1).forEach(function (o) { core.confirmDue(util.id, o, money(r(560, 760)), BANK); });
      /* Budgets, with this month's Marketing near the limit and Maintenance over it. */
      [['c_coffee', 5600], ['c_marketing', 600], ['c_utilities', 750], ['c_supplies', 300], ['c_maint', 200]].forEach(function (b) { core.setBudget(b[0], b[1]); });
      var ms = core.monthStart(today);
      var mk = st.transactions.filter(function (x) { return x.categoryId === 'c_marketing' && x.date >= ms; }).reduce(function (s, x) { return s + x.amount; }, 0);
      if (mk < 520) core.saveTx({ date: today, type: 'out', amount: money(520 - mk), accountId: BANK, categoryId: 'c_marketing', note: 'Local radio spot' });
      var mt = st.transactions.filter(function (x) { return x.categoryId === 'c_maint' && x.date >= ms; }).reduce(function (s, x) { return s + x.amount; }, 0);
      if (mt <= 200) core.saveTx({ date: today, type: 'out', amount: money(260 - mt), accountId: BANK, categoryId: 'c_maint', note: 'Grinder burr replacement' });
      /* Debts */
      var d1 = core.saveDebt({ kind: 'receivable', party: 'Riverside Co-working', description: 'Monthly catering', amount: 1200, date: core.addDays(today, -40), due: core.addDays(today, -25), categoryId: 'c_catering' });
      core.recordPayment(d1.id, 1200, core.addDays(today, -20), BANK);
      var d2 = core.saveDebt({ kind: 'receivable', party: 'Hale & Co', description: 'Office coffee service', amount: 850, date: core.addDays(today, -50), due: core.addDays(today, -20), categoryId: 'c_catering' });
      core.recordPayment(d2.id, 300, core.addDays(today, -15), BANK);
      core.saveDebt({ kind: 'receivable', party: 'Lincoln High PTA', description: 'Fundraiser event', amount: 640, date: core.addDays(today, -3), due: core.addDays(today, 21), categoryId: 'c_catering' });
      core.saveDebt({ kind: 'payable', party: 'Northside Roasters', description: 'Invoice #2231', amount: 1480, date: core.addDays(today, -10), due: core.addDays(today, 7), categoryId: 'c_coffee' });
      var p2 = core.saveDebt({ kind: 'payable', party: 'Bright Signs', description: 'Menu boards', amount: 420, date: core.addDays(today, -45), due: core.addDays(today, -30), categoryId: 'c_marketing' });
      core.recordPayment(p2.id, 420, core.addDays(today, -31), BANK);
      st.recent = { in: ['c_sales', 'c_catering'], out: ['c_coffee', 'c_pastry', 'c_supplies', 'c_marketing', 'c_maint'] };
    });
    return st;
  }

  B.data = { SEED: SEED, defaultSettings: defaultSettings, defaultCategories: defaultCategories, defaultAccounts: defaultAccounts, buildSample: buildSample };
})();

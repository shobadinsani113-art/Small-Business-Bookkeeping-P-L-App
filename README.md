# Bean & Leaf — Cash Book & Profit and Loss

A cash book and profit-and-loss app for a small business. Plain HTML, CSS and JavaScript in six files. No installation, no server, no internet required.

## How to open
1. Keep all files (`index.html`, `style.css`, `data.js`, `core.js`, `ui.js`, `app.js`) in the same folder.
2. Double-click `index.html` to open it in Chrome, Edge, Firefox or Safari.
3. The app starts with sample data: 12 months of café bookkeeping, recurring rules, budgets and debts.

## Everyday use
- **Add transaction** (or press `N`): money in, money out, or a transfer between accounts.
- **Recurring**: rent and salaries record themselves; bills like electricity wait for you to confirm the amount.
- **Debts**: track who owes you (receivables) and who you owe (payables), with partial payments.
- **Budgets**: set monthly limits per expense category.
- **Reports**: profit and loss with comparison, cash flow, balances, a 12-month trend and expense breakdown.

Keyboard: `N` adds a transaction, `/` searches transactions, `Esc` closes dialogs.

## Why profit is correct
Every category belongs to a group. Owner drawings, loans and equipment purchases are "Not in profit and loss": they change your balances and cash flow, never your profit. Transfers between your own accounts are never income or expenses. Reports use the **cash basis**: income and expenses count on the date money actually moves.

## Recording a bank loan
1. Record the money received as **Money in** with the category **Loan received**.
2. Create a **payable** for the lender with the payment category **Loan repayment**, and record each repayment on it.
Neither step affects profit; both appear in cash flow under financing.

## Check the calculations
Open `index.html?selftest` and look at the browser console (F12). Five built-in tests check profit and loss, budgets, debts, recurring rules and month boundaries.

## Back up your data
Data is saved automatically in this browser only. Use **Settings → Export backup** regularly and **Import backup** to restore it. Use **Export CSV** on the Transactions and Reports tabs to share data with your accountant.

## Limitations
One currency per book, cash basis only, no invoices or attachments, no bank feeds, one user, one device.

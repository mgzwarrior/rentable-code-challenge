# Solution Guide

A guide to what I built, why, what I assumed, and where it stops scaling, written to be walked through together in the technical review. The commit history tells the same story one decision at a time; every message explains why the change was made.

## The short version

The ask was a working **View Ledger** button showing a tenant's transactions and balance. That is done, tested (27 backend and 38 frontend tests), and backed by a ledger API.

Getting there surfaced a bigger problem. The README notes that `import_transactions` "hasn't been checked against" the PMS spec. I checked it. As written it imported nothing, and with the obvious one-line fix it would have **silently attached one tenant's ledger to a different tenant**. So the first six commits make the data trustworthy before any UI is built on it.

After the core ask, I added what an accounting team would reach for next: balances on the tenant list, search, sort, PMS identifiers and a CSV export.

## A five-minute tour

Once the app is running per the README, these steps walk through the full solution, using tenants that show each case.

1. **Tenant list.** 201 tenants with PMS ID, balance, and a summary of what is outstanding.
2. **Click the Balance header.** The tenants who owe the most come to the top; click again for the largest credits.
3. **Search `anderson`.** The list and the summary both narrow to those tenants.
4. **Tick "Hide settled accounts".** Only balances that need action remain.
5. **Open Yuki Anderson** (PMS ID 62). A credit balance, with a running balance on every row.
6. **Open Christopher Jackson** (PMS ID 4). A returned (NSF) payment shows as a negative payment and the ledger still nets to settled.
7. **Export CSV.** The same rows as plain numbers, ready for a spreadsheet.
8. **Find Charlie Chaplin.** He exists locally but not in the PMS, so he is flagged "Not in PMS" with "No ledger" rather than a misleading "Settled".

## What I found in the import

| Gap | Consequence |
|-----|-------------|
| `includeLedgers` was never sent | Reported success, imported zero transactions |
| PMS `tenant_id` used as the local primary key | PMS tenant 3 is Daisy Ridley; local id 3 is Charlie Chaplin. Her ledger landed on his record |
| Tenants never created or updated | 197 of 200 PMS tenants skipped |
| Transaction `type` dropped | Charges and payments indistinguishable, so no balance was possible |
| PMS transaction `id` used as the local primary key | Worked only because ids happen to be numeric |
| Failures exited 0, no timeout, no transaction | A failed or partial import looked like success |

The tenant mismatch was first an inference from reading the code, and I did not want to fix an inferred bug. I had it **reproduced against the live API first**, then fixed it, and ordered the commits so that none of them imports wrong data. Afterwards all 4,424 ledger entries were compared field by field with the API: no missing rows, no extras, no mismatches, no duplicates on re-run.

## Thinking like the accounting team

The request was for "more visibility into tenant financials to reconcile their books efficiently." I treated that sentence, not the button, as the requirement.

| They need to… | So I built… |
|---|---|
| Trust the numbers | One balance rule shared by the list, ledger and export, with tests asserting they agree. Unknown data fails loudly instead of being guessed at |
| See what a tenant owes and why | Separate Charge and Payment columns, a running balance, and a balance labelled "Balance owed", "Credit" or "Settled" |
| Match rows to the PMS | PMS tenant ID on the list, PMS transaction ID on every ledger row |
| Know who needs attention | Balance column, sort by most owed, summary totals, "Hide settled accounts" |
| Find a tenant quickly | Search by name, unit or PMS ID, with totals that follow the search |
| Work in their own tools | CSV export with numeric amounts, guarded against spreadsheet formula injection |
| Notice bad data | "Not in PMS" and "No ledger" labels for tenants with no PMS record |

Details I cared about: meaning never depends on color alone; dates are shown exactly as the PMS sends them, because parsing them in JavaScript shifts them a day in US time zones; and search, sort and filters survive opening a ledger and coming back, since the real workflow is "sort by balance, work down the list".

## Assumptions

The spec gives field names and little else. What I observed is recorded in [`PMS_API_SPEC.md`](backend/api/integration-data/PMS_API_SPEC.md#observed-behavior). The solution leans most on these:

- **Balance = charges − payments, signs kept.** Positive means the tenant owes; negative charges are credits and negative payments are reversals. This is the one I would confirm with the PMS provider first.
- **The PMS is the source of truth** for tenant name and unit.
- **Type is only `charge` or `payment`**, and transaction ids are unique across tenants.
- **Same-day entries keep import order**, as the PMS sends no times. Only intermediate running balances depend on it.
- **Seeded tenants are linked to PMS tenants by exact name**, once. A heuristic that suits this data, not a real migration.

## Where it stops scaling

Sized for today's 201 tenants and 4,424 transactions. I chose the simple option each time on purpose. Thresholds are estimates, not measurements.

| Area | Today | Revisit when | Then |
|---|---|---|---|
| Tenant list balances | Computed in Python from all transactions (about 50 ms) | Tens of thousands of transactions, or roughly 300 ms | Aggregate in SQL, or store a balance per tenant at import |
| Tenant list | One response; search, sort and totals in the browser | A few thousand tenants | Server-side pagination, search and sort, plus a summary endpoint |
| Import | One 520 KB request, one transaction, about 2 seconds, all or nothing | Tens of thousands of entries, or bad rows become routine | Bulk upserts, incremental sync, a background job, and quarantining bad rows |
| Data freshness | Manual command | People rely on it daily | Scheduled import and a "last synced" time on screen |
| Ledger | Whole ledger at once (longest is 51 rows) | Hundreds of rows | Date range with an opening balance |

Other known limits: there is **no authentication** (the template has none, and financial data needs it); tenants removed from the PMS are **not removed locally**; one transaction of unknown type **fails the whole tenant list** by design; and the unfiltered `/api/transactions/` is **unpaginated**.

## What I would do next

- **Aging report**: outstanding balances by 30/60/90 days, the standard receivables view.
- **Portfolio export**: the tenant list with balances as one CSV.
- **Statement periods**: a date range on the ledger with opening and closing balances.
- **Shareable ledger links** between accountants.
- **A way to resolve "Not in PMS" tenants**, not only flag them.
- **An end-to-end browser test** of list → ledger → export.

## How I used AI

I used Claude Code throughout, as a pair that drafts and verifies while I set direction and made the decisions:

- **I set the bar for evidence.** When the tenant mismatch was described, I asked how it had been verified, learned it was inferred, and had it reproduced before any fix.
- **I controlled the shape of the work.** I had the first, large change reverted and redone as small changes, each walked through and approved before it was applied. I committed every one myself, with a message recording why.
- **I made the product calls.** The tenant-list features came from asking what the accounting team would need. Others, like the CSV export, the AI suggested and I chose to include.
- **I made the trade-offs.** I wanted all money math on the server, saw it conflicted with instant search once totals had to follow the search, and chose responsiveness, summing in whole cents.
- **I checked the work** by hand in the running app after each UI change.

AI made me faster. The judgment about what was worth building, what was safe to ship, and when something was not yet proven is mine.

## Commit map

| Commits | Theme | What they do |
|---|---|---|
| 1–6 | Import correctness | PMS identifiers for tenants and transactions, tenant sync, transaction type, `includeLedgers`, loud and atomic failure |
| 7–8 | The core ask | Ledger API with balance and running balance; ledger view behind View Ledger |
| 9–17 | For the accounting team | PMS IDs, search, balances and summary, sorting, transaction filter, CSV export, "No ledger" labelling, hide settled |
| 18–20 | Housekeeping | Observed API behavior, devcontainer lock file, this guide |

---
name: hledger
description: Plain-text double-entry accounting with hledger — journal format, queries, reports, and CSV import.
allowed-tools: Bash(hledger:*), Read, Write
---

# hledger

## Overview

hledger is a robust, cross-platform plain-text double-entry accounting tool. It reads journal files describing financial transactions and generates reports: balances, registers, income statements, balance sheets, cashflow. Data is stored in human-readable `.journal` files you control — versionable with git, editable in any text editor.

hledger is compatible with Ledger journal format and can export to Beancount, CSV, JSON, HTML, SQL, and FODS.

## Prerequisites

Install hledger (version 1.52 recommended):

```bash
# Mac
brew install hledger

# Debian/Ubuntu
apt install hledger hledger-ui hledger-web

# Arch
pacman -Sy hledger hledger-ui hledger-web

# check version
hledger --version
```

Set your journal file location:

```bash
export LEDGER_FILE=~/finance/2026.journal
# Add to ~/.profile for persistence
```

## Journal Format

A journal file contains transactions, directives, and comments. The `.journal` extension is conventional.

### Basic transaction

```
DATE [STATUS] [CODE] DESCRIPTION  [; comment]
    ACCOUNT1    AMOUNT  [; comment]
    ACCOUNT2    AMOUNT
    ...
```

- DATE: `YYYY-MM-DD`, `YYYY/MM/DD`, or `YYYY.MM.DD`
- STATUS: empty (unmarked), `!` (pending), `*` (cleared)
- Positive amount = inflow/debit to account; negative = outflow/credit
- At least two spaces between account name and amount
- One posting may omit its amount — it is inferred to balance the transaction

### Example transactions

```
; ~/.hledger.journal

2026-01-01 * opening balances
    assets:bank:checking        $5000   = $5000
    assets:bank:savings        $10000   = $10000
    liabilities:creditcard       $-500  = $-500
    equity:opening/closing balances

2026-01-15 ! (REF-001) Grocery store
    assets:bank:checking
    expenses:food               $85.50

2026-01-20 * Client payment | Invoice #42
    income:consulting
    assets:bank:checking        $2500

2026-02-01 buy euros for trip
    assets:bank:checking                    ; $-123 is inferred
    assets:cash:eur    €100 @ $1.23         ; @ = unit cost, @@ = total cost
```

### Account hierarchy

Accounts use `:` as a separator to form a hierarchy:

```
assets
assets:bank
assets:bank:checking
expenses
expenses:food
expenses:rent
```

Standard top-level account types: `assets` (A), `liabilities` (L), `equity` (E), `revenues`/`income` (R), `expenses` (X).

### Directives

Directives appear before transactions and control parsing and output:

```
decimal-mark .                  ; declare decimal separator (prevents ambiguity)

account assets:bank:checking    ; declare account (enables strict mode checking)
account expenses:food           ; type:X   ← you can set type explicitly via tag

commodity $1,000.00             ; declare commodity display style
commodity 1.000,00 EUR

payee Whole Foods               ; declare valid payee (for check payees)
tag trip                        ; declare valid tag name

P 2026-01-01 AAPL $185.00      ; market price directive

include other.journal           ; include another file

~ monthly  budget goals         ; periodic rule (two spaces before description!)
    (expenses:rent)             $1500
    (expenses:food)              $600
```

### Tags

Tags add metadata to transactions, postings, or accounts:

```
2026-01-15 groceries    ; trip: tokyo-2026, category: food
    assets:checking
    expenses:food   $120  ; receipt:
```

Query with `tag:trip`, `tag:trip=tokyo`, `tag:.=tokyo`.

### Balance assertions

```
2026-01-31 end of month check
    assets:bank:checking    $0   = $4914.50   ; assert balance after this posting
    assets:bank:savings     $0   = $10000
```

Use `=` for single-commodity assertion, `==` for sole-commodity, `=*` / `==*` for subaccount-inclusive.

## Core Commands

All commands support `-f FILE` to specify a journal file, or use `$LEDGER_FILE`.

### hledger stats

Show journal summary statistics:

```bash
hledger stats
hledger stats -f 2026.journal
```

### hledger print

Show transactions in journal format (great for inspection and export):

```bash
hledger print                          # all transactions
hledger print expenses:food            # transactions touching food accounts
hledger print -x                       # explicit: show inferred amounts
hledger print -O csv > export.csv      # export as CSV
hledger print -O beancount > out.beancount
hledger print --forecast               # include forecast transactions
```

### hledger bal (balance)

Show account balances:

```bash
hledger bal                            # all account balances
hledger bal assets                     # asset accounts only
hledger bal expenses -M                # monthly expense totals
hledger bal -H                         # historical end balances (cumulative)
hledger bal --tree                     # hierarchical view
hledger bal --depth 2                  # limit to 2 account levels
hledger bal --budget                   # compare actuals vs periodic-rule budget
hledger bal expenses -M --budget       # monthly budget report for expenses
```

### hledger reg (register)

Show postings with running total:

```bash
hledger reg                            # all postings
hledger reg assets:checking            # checking account history
hledger reg expenses -M                # monthly expense postings
hledger reg -M --row-total             # monthly with row totals
hledger aregister assets:checking      # account-centric register (single account)
```

### hledger balancesheet (bs)

Show assets, liabilities, and net worth:

```bash
hledger bs                             # current balance sheet
hledger bs --pretty                    # with box-drawing characters
hledger bs -M                          # monthly snapshots
hledger bs -o report.html -O html      # HTML output
```

### hledger incomestatement (is)

Show revenues and expenses for a period:

```bash
hledger is                             # current period income statement
hledger is -M                          # monthly breakdown
hledger is -Y                          # yearly
hledger is --pretty --tree             # hierarchical with pretty borders
hledger is --row-total --average       # with totals and averages
```

### hledger cashflow (cf)

Show changes in liquid (cash/bank) assets:

```bash
hledger cf                             # all time cashflow
hledger cf -M                          # monthly cashflow
```

### hledger check

Run data validation checks:

```bash
hledger check                          # default checks (balanced, assertions)
hledger check -s                       # strict mode (declared accounts/commodities)
hledger check accounts                 # all accounts declared?
hledger check commodities              # all commodities declared?
hledger check ordereddates             # transactions in date order?
hledger check payees                   # all payees declared?
hledger check recentassertions         # balance assertions within last 7 days?
hledger check balanced                 # no implicit-price balanced transactions?
```

## Filtering & Queries

Queries can be passed to most commands as arguments. Multiple terms are ANDed (with special OR handling for descriptions and accounts).

### Query types

| Query | Meaning |
|-------|---------|
| `REGEX` or `acct:REGEX` | Account name contains regex (case insensitive, infix) |
| `date:2026` | In year 2026 |
| `date:2026-01` | In January 2026 |
| `date:2026-01-01..2026-03-31` | Date range |
| `date:thismonth` | Current month |
| `date:lastquarter` | Previous quarter |
| `desc:amazon` | Description contains "amazon" |
| `payee:REGEX` | Payee field matches |
| `note:REGEX` | Note field matches |
| `amt:'>500'` | Amount greater than 500 |
| `amt:'<0'` | Negative amounts |
| `cur:USD` | Amounts in USD |
| `cur:'\$'` | Dollar amounts (escape $ for shell) |
| `status:` | Unmarked transactions |
| `status:!` | Pending transactions |
| `status:*` | Cleared transactions |
| `tag:trip` | Has tag "trip" |
| `tag:trip=tokyo` | Tag "trip" with value containing "tokyo" |
| `not:QUERY` | Negate any query |
| `depth:2` | Accounts at depth 2 or less |

### Examples

```bash
# Expenses this month
hledger reg expenses date:thismonth

# Cleared transactions in Q1 2026
hledger print date:2026Q1 status:'*'

# Grocery spending excluding subscriptions
hledger bal expenses:food not:desc:subscription

# All USD transactions
hledger reg 'cur:^\$$'

# Transactions tagged for Tokyo trip
hledger print tag:trip=tokyo

# Large debits from checking
hledger reg assets:checking 'amt:<-500'

# Boolean query (requires expr: prefix)
hledger print "expr:'date:2026 and (desc:amazon or desc:amzn)'"
```

### Date shorthand

`-b DATE` (begin), `-e DATE` (end), `-p PERIOD` (period expression):

```bash
hledger bal -b 2026-01-01 -e 2026-04-01
hledger bal -p "2026Q1"
hledger bal -p "monthly in 2026"
hledger bal -p "last month"
```

### Report intervals

`-D` (daily), `-W` (weekly), `-M` (monthly), `-Q` (quarterly), `-Y` (yearly):

```bash
hledger is -M                          # monthly income statement
hledger bal expenses -Q                # quarterly expense balances
hledger reg assets -W                  # weekly asset register
```

## Reports

### Balance sheet (assets & liabilities)

```bash
hledger bs --pretty
hledger bs -M -o bs-2026.csv -O csv
```

### Income statement (profit & loss)

```bash
hledger is --pretty --tree
hledger is -M --row-total --average
```

### Cashflow

```bash
hledger cf -M
```

### Budget report

Define budget goals with periodic rules in the journal:

```
~ monthly  budget goals
    (expenses:food)         $600
    (expenses:rent)         $1500
    (expenses:transport)    $200
```

Then run:

```bash
hledger bal expenses -M --budget
hledger bal expenses -M --budget --pretty
```

### Multi-currency / valuation

```bash
# Show amounts in EUR at current market prices
hledger bs -V

# Show amounts converted to USD
hledger bs -X USD

# Show at cost basis
hledger bal -B

# Declare market prices in journal
# P 2026-01-01 EUR $1.09
hledger bs -X USD --infer-market-prices
```

### Forecasting

Define periodic rules, then use `--forecast`:

```
~ monthly from 2026-02-01  rent
    expenses:rent        $1500
    assets:bank:checking
```

```bash
hledger reg --forecast
hledger bal --forecast -M
```

## CSV Import

### Rules file basics

For each `FILE.csv`, create `FILE.csv.rules` in the same directory. Minimum required:

```
# mybank.csv.rules

skip         1                 # skip 1 header line
fields       date, description, , amount
date-format  %m/%d/%Y

account1     assets:bank:checking
account2     expenses:unknown
```

Run:

```bash
hledger print -f mybank.csv       # preview as transactions
hledger import mybank.csv         # import new transactions into $LEDGER_FILE
```

### Common rules directives

```
skip N                  # skip N header lines
fields date, desc, , amount   # map CSV columns to field names (blank = skip)
date-format %d/%m/%Y    # strptime format for non-ISO dates
separator ;             # for SSV; TAB for TSV; auto-detected from extension
decimal-mark ,          # if amounts use comma as decimal

account1 assets:bank:checking
account2 expenses:unknown

# Conditional categorisation
if amazon
    account2 expenses:shopping

if desc:(netflix|spotify|apple)
    account2 expenses:subscriptions
    comment  subscription

if %amount <0
    account2 income:unknown
```

### Full rules example

```
# chase-checking.csv.rules
skip 1
fields date, description, amount, , balance

date-format %m/%d/%Y
account1 assets:bank:chase

if amazon
    account2 expenses:shopping:amazon

if (whole foods|trader joe)
    account2 expenses:food:groceries

if (netflix|hulu|spotify)
    account2 expenses:entertainment:subscriptions

if %amount <0
    account2 income:other
```

### Import workflow

```bash
# Download CSV from bank, then:
hledger print -f bank.csv           # preview
hledger import bank.csv             # import only new transactions (deduplicates)
hledger import bank.csv --dry-run   # dry run
```

With `source` rule, keep rules separate from downloaded files:

```
# rules/chase.csv.rules
source ~/Downloads/Chase*.csv
skip 1
fields date, description, amount, , balance
...
```

```bash
hledger import rules/*.csv.rules    # import all configured sources
```

## Vault Integration

Store journal files in the Obsidian vault under the MnemClaw accounting folder:

```
/workspace/extra/obsidian/MnemClaw/accounting/
├── 2026.journal            ← current year's journal (set as LEDGER_FILE)
├── 2025.journal            ← previous years
├── main.journal            ← optional: includes yearly files
│       include 2025.journal
│       include 2026.journal
├── csv-rules/              ← one .rules file per bank/account
│   ├── chase-checking.csv.rules
│   ├── amex.csv.rules
│   └── schwab.csv.rules
└── reports/                ← exported HTML/CSV reports
```

Set LEDGER_FILE in the container environment or pass `-f` explicitly:

```bash
export LEDGER_FILE=/workspace/extra/obsidian/MnemClaw/accounting/2026.journal
hledger stats
```

## Examples

### Monthly close workflow

```bash
# 1. Import new transactions from all bank CSVs
hledger import /workspace/extra/obsidian/MnemClaw/accounting/csv-rules/*.rules

# 2. Review uncategorised
hledger reg expenses:unknown

# 3. Check balances match bank statements (reconcile)
hledger bs --pretty

# 4. Run income statement for the month
hledger is -p lastmonth --pretty

# 5. Add balance assertions for reconciled accounts
# (manually add to journal, or use: hledger close --assert >> 2026.journal)

# 6. Commit
cd /workspace/extra/obsidian/MnemClaw/accounting
git add 2026.journal
git commit -m "close: $(date +%Y-%m) monthly close"
```

### Reconciliation

```bash
# Show cleared balance for checking (should match bank statement)
hledger bal assets:bank:checking -C

# Show pending items not yet cleared
hledger reg assets:bank:checking -U -P

# Mark transactions cleared: edit journal, add * after date
# Then re-check
hledger bal assets:bank:checking -C
```

### Budget tracking

```bash
# Compare this month vs budget
hledger bal expenses -M --budget -p thismonth --pretty

# See which categories are over budget
hledger bal expenses -M --budget -p 2026
```

### Investment tracking

```bash
# Show investment balances at current market value
hledger bs investments -V

# Track lots (record at cost)
# 2026-01-15 buy AAPL
#     assets:investments:aapl    10 AAPL @ $185.00
#     assets:bank:checking

hledger bal investments -B    # at cost
hledger bal investments -V    # at market value
```

### Year-end close

```bash
# Generate closing transactions to zero revenues/expenses into retained earnings
hledger close --retain -e 2027-01-01 >> 2026.journal

# Generate opening balances for new year file
hledger close --migrate -e 2027-01-01 >> 2027.journal
```

## Notes

- Always use at least two spaces between account name and amount in postings
- Use `hledger check -s` (strict mode) to enforce declared accounts and commodities
- The `hledger import` command deduplicates by date+description+amount — safe to re-run
- Balance assertions use `=` (single commodity) — write one per commodity for multi-currency accounts
- For large journals, split by year and use `include` in a master file
- Add `--pretty` to your `~/.hledger.conf` for nicer table borders everywhere
- Use `hledger stats` to verify the journal loaded correctly before running reports
- `hledger print -x` shows all inferred amounts explicitly — useful for debugging
- Periodic rules need two spaces between period expression and description
- The `LEDGER_FILE` env var is the standard way to set the active journal — set it in the container or pass `-f` each time

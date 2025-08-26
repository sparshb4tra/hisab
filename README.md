## hisab – split expenses without the spreadsheet anxiety

Hisab (Hindi: "account", "reckoning") is a minimal, mobile-first expense splitter. Create a group, add participants, record expenses, and see exactly who owes whom—no sign‑up, no fluff, just math that balances.

Why "hisab"?
- It’s a word friends actually say when settling bills. Approachable and human, not SaaS-y.
- It communicates the product’s intent in one breath: quick accounting; clean reckoning.

### Live demo
- App: https://hi-sab.vercel.app/
- Code: https://github.com/sparshb4tra/hisab

### Table of contents
- Features
- UX highlights
- Tech stack
- Screenshots & gif slots
- Getting started
- Usage notes
- Export formats
- Data model & persistence
- Validation & security
- Roadmap
- Contributing
- License

---

## Features

MVP
- Create groups/events and add participants (with join dates)
- Add expenses with categories and a payer
- Split methods: equal, custom amounts, percentages
- Per‑group currency (USD, EUR, GBP, CAD, INR); currency is locked for the group
- Realtime balances and who owes whom
- Record settlements
- View summary (with perspective selector to see from a specific participant’s POV)

Essential
- Edit/delete expenses (modal)
- Export summary: Text (.txt), CSV, PDF (jsPDF), with consistent styling
- Sidebar groups card with quick actions (Add Expense, View Summary, Export)
- Input validation: numbers only, field-level errors
- Data persistence via localStorage

Nice‑to‑have (implemented tastefully)
- Per‑participant join dates (reflected in group cards)
- Consolidated Export button with overlay (also in sidebar cards)
- Mobile-first off‑canvas sidebar with hamburger; sticky translucent top bar
- Custom icon set + favicon; GitHub link (micro-interactions)
- Perspective view that rewrites balances relative to the selected user
- Minimal, production‑lean palette; Helvetica for text, Courier New for numbers

Removed by design
- All charts/graphs (requested to be removed)—kept the summary simple and legible

---

## UX highlights

- Mobile‑first navigation: hamburger menu takes over until a group is selected; sticky topbar when working inside a group
- Export overlay: one Export button, three clear options (TXT, CSV, PDF)
- Perspective selector: "Show me my hisab"—balances rewrite from a specific participant’s perspective
- Non‑selectable "hisab" titles act like logos; clean, glassy hover for the GitHub link
- Consistent currency per group, visually locked in the expense form

---

## Tech stack

- HTML5, CSS3 (responsive, grid/flex, glassy micro‑interactions)
- Vanilla JavaScript (ES6+), class‑based app logic (`ExpenseSplitter`)
- jsPDF for PDF export
- localStorage for persistence
- No frameworks, zero build requirements

---

## Screenshots & GIFs

Drop your media into `public/` and reference here. Suggested flow:
- 01_home.png — empty state (mobile + desktop)
- 02_create_group.png — creating a group + currency
- 03_add_participants.png — participant dates + list
- 04_add_expense.png — expense form
- 05_summary.png — summary cards and perspective selector
- 06_export_overlay.gif — export overlay interaction
- 07_sidebar_cards.png — group cards with actions

```text
![hisab overview](public/01_home.png)
![Create group](public/02_create_group.png)
![Add participants](public/03_add_participants.png)
![Add expense](public/04_add_expense.png)
![Summary & Analytics](public/05_summary.png)
![Export overlay](public/06_export_overlay.gif)
![Sidebar cards](public/07_sidebar_cards.png)
```

---

## Getting started

Option A — just open it
- Clone the repo and open `index.html` in your browser

Option B — serve locally (recommended for CORS‑safe PDF/fonts)
```bash
# any static server works; examples:
npx serve .
# or
python -m http.server 5173
```
Then visit http://localhost:5173 (or whichever port).

---

## Usage notes

- Create a group and pick a currency (locked thereafter for consistency)
- Add participants (their join date is captured)
- Add expenses:
  - Split equally, by custom amounts, or by percentages
  - "Who paid?" must be one of the participants
- Use Settlements to record transfers between people
- Summary → choose a participant to view from their perspective ("my hisab")
- Export from the main Summary or from any group card

---

## Export formats

- Text (.txt): human‑readable summary
- CSV: machine‑friendly with columns for direction ("Owed"/"Owes")
- PDF: formatted overview (jsPDF), includes participants, expenses, balances, totals

---

## Data model & persistence

- Data is stored in `localStorage`:
  - Groups with participants, expenses, and currency
  - Settlements keyed by `currentGroupId`
- Backward compatibility helper (`migrateParticipants`) ensures older string‑only participants are normalized

---

## Validation & security

- Amount fields accept numbers only; invalid entry prompts a red error
- User‑rendered strings are sanitized to avoid HTML injection
- Money math is done in integer cents internally; equal/percentage splits reconcile remainders fairly

---

## Roadmap

- Optional backend (auth + DB) for multi‑device sync
- Invite links and role permissions
- Multi‑currency conversion rules (fx source + lock date)
- Import/export full app state (JSON)
- Test suite: unit tests for splits and balances; e2e flows

---

## Contributing

Issues and PRs are welcome. Keep the design minimal, the logic readable, and the UX un‑blocky.

---

## License

MIT © sparshb4tra — see `LICENSE` for details.


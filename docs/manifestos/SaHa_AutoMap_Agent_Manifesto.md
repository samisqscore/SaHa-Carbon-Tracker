# SaHa — Project Material Auto-Mapping
## Agent Implementation Manifesto
**Version:** 1.0 | **Date:** 1st March 2026 | **Status:** ✅ Implemented

---

## ⚠️ PRIME DIRECTIVE

> **Inspect before you implement.**
> Read the existing code for every area you plan to touch before writing a single line.
> Understand what is already there — naming conventions, patterns, existing fuzzy
> matching logic, how emission factors are queried, how project materials are updated.
> This codebase already has BOQ import logic that does matching. Your job is to
> surface that capability as an on-demand user action, not to rebuild it from scratch.
>
> **If something already exists that partially solves this — extend it, do not duplicate it.**

---

## Context: What the User Experiences Today (The Problem)

When a user imports a BOQ, the system attempts to match each material row to an
emission factor at import time. If no match is found (because the relevant dataset
wasn't available yet, or the fuzzy threshold wasn't met), the material is saved as
"Unmapped" — it exists in the project but contributes zero emissions.

Later, the user uploads a new emission factors dataset. The materials are still
unmapped. There is currently no way to say "now re-run the matching against this
new dataset." The Report tab shows a "Map Materials" button but it navigates to the
Materials tab with no further action available there.

**The goal of this feature is to close that gap** — let the user trigger mapping
on-demand, against a dataset they choose, after the project already exists.

---

## What You Learned from the Data (Important Context)

Before writing this manifesto, the BOQ and emission factors files were analysed:
- 60 BOQ items total
- 51 are **exact string matches** to the uploaded emission factors dataset
- 9 require **fuzzy matching** (BOQ item has a location descriptor in brackets,
  e.g. "Ready Mix Concrete M40 (Raft Foundation)" needs to match "Ready Mix
  Concrete M40")
- The 9 fuzzy candidates are all genuinely resolvable at high confidence if
  bracket-enclosed suffixes are stripped before comparison

This tells you the matching logic needs to handle bracket-suffix stripping as
a normalisation step. Check whether the existing BOQ import matching already
does this — if it does, reuse that normalisation. If it doesn't, add it here
and consider whether it should be back-ported to the import flow too.

---

## Locked Decisions

| # | Decision |
|---|----------|
| A1 | The user **chooses which dataset(s)** to run automapping against. They are not locked to their org's datasets only — they can select from all datasets available to them (own org + global platform datasets). |
| A2 | Materials that are **already mapped** create a conflict. The system must **ask the user** about each conflict individually before overwriting. It must not silently overwrite, and it must not silently skip. |
| A3 | Fuzzy matches above **85% confidence** are auto-applied. Matches below 85% are flagged for manual review — they appear in a review list but are not applied automatically. |
| A4 | The existing snapshot fields on project materials (`snapshotEmissionValue`, `snapshotSource` or equivalent) must be **updated** when a new mapping is applied — the snapshot must reflect the newly chosen factor. |
| A5 | The "Map Materials" button in the Report tab must be **fixed** to navigate to the Materials tab AND trigger or scroll to the automap action. It must not dead-end. |
| A6 | After automapping completes, the emissions totals and report must **reflect the new mappings immediately** — either by triggering a recalculation or by navigating the user to a refreshed state. |

---

## Phase 1 — Understand the Existing Matching Logic

### INSPECT FIRST — Do This Before Anything Else

This is the most important phase. Everything else depends on what you find here.

Find and read the following:
- The BOQ import processing file (likely `server/boqProcessing.ts` or similar) — this
  is where matching happens at import time. Read it in full.
- The function that matches a material name string to an emission factor record.
  Understand: does it use fuzzy string matching? What library? What threshold?
  Does it normalise the input (strip brackets, lowercase, trim)?
- How it queries emission factors — which tables, which filters, which datasets
  does it search across?
- How it writes the result back to `project_materials` — which fields are set
  on a successful match?
- The existing route that the "Map Materials" button calls, if any. Trace what
  happens when that button is clicked.

### What to Document Before Moving On

Before writing any code, write down (in a comment or scratch note) the answers to:
1. What is the name of the core matching function?
2. What does it accept as input? What does it return?
3. What string normalisation does it already apply?
4. What fields does it set on `project_materials` when a match is found?
5. Does it already support being called for a single material, or only for a full
   BOQ batch?
6. Can it be told which dataset(s) to search, or does it always search all?

These answers determine whether you are **wrapping existing logic** (preferred)
or **extracting and generalising it** before wrapping.

---

## Phase 2 — Backend: On-Demand Mapping Endpoint

### INSPECT FIRST

Before writing the route:
- Find all existing routes related to project materials — understand the URL
  patterns, middleware stack, and response shapes in use
- Find how `organizationId` and `projectId` boundary checks are done on existing
  project material routes — use the exact same pattern
- Check if there is already a route for triggering any kind of remapping or
  recalculation — you may be extending something that exists

### GOAL

Create a new API endpoint that accepts:
- A project ID (from the URL)
- A list of one or more dataset IDs the user has chosen to map against
- A flag indicating whether to skip already-mapped materials or surface them
  as conflicts (this supports Decision A2)

The endpoint must:

**Step 1 — Validate access**
Confirm the requesting user has access to the project (same org boundary checks
as other project routes). Confirm each selected dataset is accessible to this
user (they can choose global datasets too — A1).

**Step 2 — Load unmapped materials**
Fetch all `project_materials` for this project that currently have no emission
factor mapped. These are the primary candidates for automapping.

**Step 3 — Load already-mapped materials**
Fetch all `project_materials` for this project that already have a mapped factor.
These need to be surfaced as potential conflicts (A2) — do not map them
automatically. Return them in the response so the frontend can ask the user.

**Step 4 — Run matching against selected datasets only**
For each unmapped material, run the matching logic against emission factors
that belong to the selected dataset IDs only. Do not search outside those datasets.
Apply the same normalisation the existing matching logic uses, plus bracket-suffix
stripping if not already present.

**Step 5 — Classify results**
Classify each match into one of three buckets:
- `high_confidence`: match score ≥ 85% — will be auto-applied (A3)
- `low_confidence`: match found but score < 85% — needs user review before applying
- `no_match`: no candidate found in the selected datasets

**Step 6 — Return a preview, not a commit**
This endpoint should **not** write anything to the database on first call.
It returns the full classification result so the frontend can show the user
what will happen. The user reviews and confirms before anything is committed.
This is the "dry run" or "preview" mode.

**Step 7 — A separate "commit" endpoint (or parameter)**
Once the user has reviewed and confirmed (resolving conflicts per A2, accepting
or rejecting low-confidence matches), a commit call is made. This writes the
mappings to `project_materials`, updating all relevant fields including the
snapshot fields (A4).

### RULES

- The matching logic must only search the **selected datasets**. Never silently
  expand the search to other datasets.
- A material that is already mapped must **never be overwritten** by the preview
  or commit step without explicit user confirmation per A2. Return them as
  conflicts, not as auto-applies.
- Snapshot fields must be updated on commit — the same fields set during the
  original BOQ import must be set here too. Find those fields by reading the
  import code.
- The commit must be transactional — all mappings in a batch apply together
  or none do. A partial commit that leaves the project in an inconsistent
  state is not acceptable.
- Use the same middleware stack as other project material write routes.

### GUARD QUESTIONS

- Did I read the existing matching function before deciding how to call it?
- Does my endpoint only search the datasets the user selected?
- Does my response clearly separate high-confidence, low-confidence, and
  no-match results?
- Does the preview step write nothing to the database?
- Does the commit step update all the same fields that the original import sets?
- Is the commit wrapped in a transaction?

---

## Phase 3 — Frontend: Automap UI in the Materials Tab

### INSPECT FIRST

Before building anything:
- Read `ProjectMaterialsTab.tsx` (or equivalent) in full — understand its
  current structure, state management, how it loads and displays materials,
  and what actions already exist per row
- Find the `AddMaterial` and existing edit/action patterns — your new UI
  must be visually and behaviourally consistent with these
- Read how other dataset selection UI works elsewhere in the app — there
  may already be a dataset picker component
- Find the "Map Materials" button in the Report tab — trace exactly where
  it navigates to and what (if anything) it triggers

### GOAL

The Materials tab needs an "Auto-Map Materials" action. The full user flow is:

**Step 1 — Entry point**
Add a button in the Materials tab header area (near "Import BOQ" and "Add Material").
Label: "Auto-Map Materials" or "Run Mapping". This should be visually distinct
but not more prominent than Import BOQ.

Also fix the "Map Materials" button in the Report tab so that it navigates to
the Materials tab AND either scrolls to or highlights the Auto-Map action (A5).
It must not dead-end at the Materials tab with nothing to do.

**Step 2 — Dataset selection**
When the user clicks "Auto-Map Materials", show a modal or panel that lets them:
- See a list of datasets available to them (their org's datasets + global datasets,
  same as what's available for calculation — only active, production environment
  datasets)
- Select one or more datasets to map against (A1)
- See a count of currently unmapped materials so they know what will be processed
- A "Preview Matches" button to trigger the dry-run API call

**Step 3 — Preview results**
After the API returns the preview, show the user a structured results view:

*Section A — Will be applied automatically (high confidence ≥ 85%)*
A table showing: BOQ material name | Matched factor name | Dataset | Confidence score | Unit match indicator
These will be applied on confirm unless the user unchecks individual rows.

*Section B — Needs your review (low confidence < 85%)*
Same table structure, but each row has a "Accept" / "Skip" toggle.
The user must make a decision on each one before confirming.

*Section C — No match found*
A simple list of material names with no match in the selected datasets.
These remain unmapped. Suggest the user try a different dataset or map manually.

*Section D — Conflicts (already mapped)*
For materials that already have a mapping, show: current factor | proposed new factor | confidence
The user must explicitly choose "Keep existing" or "Replace with new" for each (A2).
This section only appears if there are any conflicts.

**Step 4 — Confirm and apply**
A "Apply Mappings" button triggers the commit API call with the user's decisions.
Show a progress indicator. On success, close the modal and refresh the materials
list and emissions totals (A6).

Show a summary toast: "X materials mapped. Y skipped (low confidence). Z had
no match."

### RULES

- The dataset selector must only show datasets that are **active and production
  environment** — the same filter used by the calculation engine. Do not show
  draft or test datasets.
- The preview results view must clearly communicate what "confidence" means in
  plain language — not just a percentage number. For example: "High confidence
  — name matches closely" vs "Low confidence — partial match, please verify".
- The conflict resolution UI (Section D) must make it impossible to accidentally
  skip a conflict — the user must make an explicit choice for each one.
- Do not block the user from using the rest of the Materials tab while the
  automap modal is open — use a non-blocking modal pattern consistent with
  the rest of the app.
- If the commit fails, show a clear error and leave the project materials
  unchanged. Do not leave a partially-applied state.
- After successful commit, the materials list must refresh to show the newly
  mapped items with their factors, not remain stale.

### GUARD QUESTIONS

- Is the "Auto-Map Materials" button placement consistent with existing actions
  in the Materials tab header?
- Does the dataset selector filter to active + production datasets only?
- Does the preview clearly separate the four result buckets?
- Can a user accidentally skip a conflict without making a decision?
- Does the "Map Materials" button in the Report tab now lead somewhere useful?
- Does the materials list refresh after a successful commit?

---

## Phase 4 — The Conflict Resolution Flow (Decision A2 in Detail)

This phase has no separate backend work — it is a UI concern only. But it is
important enough to describe in detail because getting it wrong would mean
silently overwriting user-intentional mappings.

### What a Conflict Is

A conflict occurs when:
- A `project_material` already has a mapped emission factor (it is not "Unmapped")
- AND the automap algorithm finds a candidate in the selected dataset that is
  different from the current mapping

The two existing mapped materials in this project (Concrete M30 from India BEI,
Diesel Fuel from Test Data 2024) are examples of what would become conflicts if
the user runs automap and the selected dataset contains better or different matches.

### The Conflict UI Must

- Show the **current** factor: name, dataset it came from, emission value, unit
- Show the **proposed** new factor: name, dataset, emission value, unit, confidence score
- Make the difference between them visually obvious — if the values differ,
  highlight that
- Require an explicit binary choice per row: "Keep current" (default) or
  "Replace with new"
- Default to "Keep current" — the safe option. The user must actively choose
  to replace.
- Not allow proceeding to "Apply Mappings" until every conflict row has a choice

---

## Phase 5 — Fix the Report Tab "Map Materials" Button (Decision A5)

### INSPECT FIRST

Find the Report tab component. Find where the "Map Materials" button is rendered.
Find the "Upload Dataset" button too (also in the incomplete report banner).
Understand what onClick handlers they currently have.

### GOAL

The "Map Materials" button currently navigates to the Materials tab but does
nothing once there. Fix it so that navigating via this button:
- Switches to the Materials tab (existing behaviour — keep it)
- AND automatically opens the Auto-Map Materials modal/panel

This can be done by passing a query parameter, a navigation state flag, or
a shared UI state — use whichever pattern the existing codebase uses for
cross-tab communication. Check how other tabs communicate state before
inventing a new pattern.

The "Upload Dataset" button in the same banner should navigate to the
Data Sources page — verify this already works correctly and fix if not.

---

## What Must Not Change

- The original BOQ import flow. Do not modify how matching works at import time
  unless you are fixing a bug that also affects import. Your changes are additive.
- The snapshot values on materials that the user does **not** remap. Only
  materials where the user confirms a new mapping should have their snapshots
  updated.
- The emissions totals logic. You are changing which factors are mapped —
  the totals will naturally change as a result. Do not modify the calculation
  logic itself.
- Any existing manually-added materials (via "Add Material"). These should
  appear in the conflict section if they have a mapping, handled identically
  to BOQ-imported materials.

---

## Definition of Done

This feature is complete when:

1. A user on the Materials tab can click "Auto-Map Materials", select one or
   more datasets, and see a preview of what will be matched before anything
   is committed.

2. High-confidence matches (≥85%) are shown as "will be applied" and are
   applied on confirm without requiring individual approval.

3. Low-confidence matches (<85%) are shown as "needs review" and require
   the user to accept or skip each one before confirming.

4. Materials with no match in the selected datasets are clearly listed as
   unresolved — the user understands they remain unmapped.

5. Materials that already have a mapping appear as conflicts with a
   "Keep current / Replace" choice defaulting to "Keep current". No existing
   mapping is overwritten without explicit user action.

6. After the user confirms, all accepted mappings are written atomically.
   If any write fails, nothing is written.

7. The materials list and emissions totals refresh immediately after a
   successful commit, reflecting the new mappings.

8. The "Map Materials" button in the Report tab now opens the Auto-Map
   modal directly, not a dead-end navigation.

9. The dataset selector only shows active, production-environment datasets —
   not draft or test datasets.

10. Running automap on the test Data Center BOQ with the uploaded emission
    factors dataset results in at minimum 51 exact matches being applied
    immediately, and the 9 fuzzy candidates (bracket-suffix BOQ items)
    being matched at high confidence and auto-applied — bringing the
    project from 58 unmapped materials to 0 or near-0 unmapped.

---

*Companion documents: SaHa_Datasource_Agent_Manifesto.md (datasource upload implementation).*

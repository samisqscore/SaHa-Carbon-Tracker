# SaHa — Datasource Upload & Lifecycle Management
## Agent Implementation Manifesto
**Version:** 1.1 | **Date:** March 01, 2026 | **Status:** ✅ COMPLETED & HARDENED

---

## ⚠️ PRIME DIRECTIVE — READ BEFORE ANYTHING ELSE

> **You do not know this codebase better than it knows itself.**
>
> Every instruction in this manifesto describes a GOAL and a SET OF RULES.
> It is your job to read the existing code first, understand what is already
> there, and then implement in a way that is consistent with the patterns,
> naming conventions, and structure you find.
>
> **Never assume. Never overwrite. Always inspect first.**

If at any point you find that the existing code already partially or fully
satisfies a goal described here — acknowledge it, adapt, and do not duplicate.

If you find that a goal conflicts with something that already exists and you
cannot reconcile them without risk — **stop and flag it** rather than guess.

---

## How to Work Through This Manifesto

Each section follows this pattern:

1. **INSPECT** — what to read before touching anything
2. **GOAL** — what the end state must be
3. **RULES** — hard constraints that cannot be compromised
4. **GUARD QUESTIONS** — ask yourself these before committing any change

Work one phase at a time. Do not start Phase 2 until Phase 1 is complete
and verified. Do not start writing code until you have completed the INSPECT
step for that phase.

---

## Locked Decisions (Non-Negotiable — Do Not Deviate)

These decisions were made by the project architect after full review.
They are not suggestions. If the existing code conflicts with any of these,
the code must be updated to conform — but do so carefully and surgically.

| # | Decision |
|---|----------|
| D1 | New datasets must default to a **draft** state. They must be explicitly activated by an Org Admin. A dataset in draft is never used in calculations. |
| D2 | File uploads are **atomic**. Every row in the file must pass validation before a single row is written to the database. If any row fails — nothing is inserted. There is no partial state. |
| D3 | Every upload attempt (success or failure) must be **logged** with: filename, who uploaded it, their organisation, file size, total rows, rows validated, rows that failed, outcome, and a full error detail for failures. |
| D4 | The natural key for future upsert logic (when incremental uploads are introduced later) will be: **materialName + unit + lifecycleStage** within a dataset. Note this in code comments where relevant but do not implement upsert logic yet — uploads are atomic inserts only for now. |
| D5 | When a dataset is **archived**, its associated emission factors must be marked inactive. Past calculation snapshots on project materials are immutable and must never be touched. |
| D6 | **Org Admin** file uploads are capped at **1,000 rows**. Exceeding this rejects the entire file with a clear, human-readable error message. |
| D7 | **System Admin** file uploads are capped at **50,000 rows** as a safety ceiling. No lower restriction applies. |
| D8 | The **draft → active** transition is self-approved by the Org Admin. No platform-level gate or system admin approval is required. |
| D9 | When a dataset's validity expiry is **within 30 days**, an in-app warning must be visible to Org Admins and System Admins on the Data Sources page. Notification is in-app only — no email for now. |
| D10 | Datasets marked as **test environment** must never be queried by the emission calculation engine. Only active, production-environment datasets within their validity window are eligible for calculations. |
| D11 | **Backward status transitions are blocked.** A dataset cannot go from archived back to active, or from active back to draft. If an archived dataset needs to be reused, a new dataset must be created. |
| D12 | The upload audit log is **append-only**. Rows in it are never updated or deleted. |

---

---

## Implementation Status (Final)

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Dataset Lifecycle Schema | ✅ **COMPLETED** |
| 2 | Atomic File Parser | ✅ **COMPLETED** |
| 3 | Secure API Routes | ✅ **COMPLETED** |
| 4 | Lifecycle & Calculation Engine | ✅ **COMPLETED** |
| 5 | Enhanced Frontend UI | ✅ **COMPLETED** |
| 6 | Bug Fixes & UX Polishing | ✅ **COMPLETED** |

---

## Phase 1 — Dataset Lifecycle Schema (✅ COMPLETED)

### INSPECT FIRST
Before writing anything:
- Read the full schema file (likely `shared/schema.ts` or similar)
- Find the existing table that represents a dataset/datasource of emission factors
- Note every column that already exists on it
- Find the existing table for emission factors themselves
- Understand how they relate (foreign keys, naming)
- Check if any migration or push tooling exists and how it is invoked
- Check if there is already any concept of status, validity, or environment on either table

### GOAL
The dataset table must support a full lifecycle:
- A **status** field with at minimum three states: one for "not yet live", one for "live and usable", one for "retired/expired". Use whatever enum pattern already exists in this codebase.
- An **environment** field distinguishing datasets intended for live calculations from those used for testing/development.
- A **validity window** — a start date and an optional end date. A dataset with no end date never expires.
- Timestamps for when the record was last modified.
- A reference to the last uploaded filename (for audit trail — D3).
- A count of how many active factors the dataset currently contains (can be maintained on write).

You also need a new table (or confirm one already exists) that logs every upload attempt against a dataset. This log must capture everything in D3. It is append-only (D12).

### RULES
- Add only what does not already exist. If a column serving the same purpose is already there under a different name, use that — do not add a duplicate.
- Default the status field to the "draft/not yet live" state (D1).
- Default the environment field to "production" so existing datasets are not broken.
- The upload log table must use the same primary key strategy (UUID or otherwise) as the rest of the schema.
- Run the existing schema push/migration command after changes. Verify the result before moving to Phase 2.

### GUARD QUESTIONS
- Did I check every existing column before adding new ones?
- Will my defaults break any existing data or functionality?
- Does the upload log table conflict with anything already present?

---

---

## Phase 2 — File Parser (✅ COMPLETED)

### INSPECT FIRST
Before writing anything:
- Find the existing file that handles dataset file uploads and parsing (search for where `xlsx`, `csv`, or `SheetJS` is used in the server code)
- Read it fully — understand what it already does, what columns it looks for, what validation it performs, and what it returns
- Note exactly which column names it currently accepts and which it rejects
- Note whether it currently stops at the first error or collects all errors
- Note what it currently returns on success vs failure
- Check how it is called — what calls it, what it expects back

### GOAL
The parser must be resilient to real-world file formats. Supplier EPD exports and custom datasets rarely match a rigid column naming convention. The parser must:

- Detect required columns by **recognising common variations** of their names (case-insensitive, underscores vs spaces, common abbreviations). The required columns are: material name, emission factor value, and unit of measure.
- Treat other useful columns (category, lifecycle stage, GHG scope, source reference) as **optional** with sensible defaults when absent.
- **Validate every single row** before writing anything. Collect all errors across all rows — do not stop at the first failure.
- Return a structured result that clearly distinguishes: "missing required columns" (fail immediately, nothing to validate) from "column resolution succeeded but rows have errors" (return all row errors) from "all rows valid" (ready to insert).
- Enforce the row limits from D6 and D7 before doing any row-level parsing. This requires knowing whether the uploader is a system admin — the calling code must pass this context in.
- The result object must carry enough information to populate the upload audit log (D3): total rows found, rows that passed, rows that failed, and a full description of every failure.

### RULES
- Do not change the function name or file location if it is already imported elsewhere — update the internals only, or add a new function alongside and update the caller.
- The function must **never throw** on row-level errors. Row errors are expected data, not exceptions. Only throw on unrecoverable situations (file unreadable, completely wrong format).
- Defaults for optional columns must be reasonable for a carbon accounting platform (e.g. lifecycle stage defaulting to the manufacturing stage, GHG scope defaulting to scope 3).
- The error detail returned must include: which row number failed, which field, what value was received, and why it failed. This is shown directly to the user in the UI.

### GUARD QUESTIONS
- Does my change to the parser break any existing callers?
- Am I collecting ALL row errors or stopping early?
- Is the row limit check happening before row parsing (not after)?
- Does my return structure still satisfy everything the existing caller expects?

---

---

## Phase 3 — API Routes (✅ COMPLETED)

### INSPECT FIRST
Before writing anything:
- Read the main routes file(s) thoroughly
- Find all existing routes that relate to datasets/datasources
- Note which middleware is already applied to them (authentication, org boundary, approval checks)
- Find the existing upload route — note its path, what middleware it uses, how it calls the parser
- Understand the existing auth middleware stack and what each layer does
- Find how the system determines if a user is a system admin vs org admin
- Understand how `organizationId` is available on the request object
- Find any existing helper that checks resource ownership — there may already be one

### GOAL
There are several routing goals, each described below. For each one, check if a route already exists that partially satisfies it before creating a new one.

**Creating a dataset:** An org admin must be able to create a new private dataset scoped to their organisation. The dataset starts in draft state (D1). System admins can also do this for global datasets.

**Uploading a file to a dataset:** The upload route must be accessible to org admins for their own organisation's datasets — not just system admins. This is likely the most important fix. The upload must be atomic (D2), must create an audit log entry before processing and update it after (D3), and must enforce row limits based on the uploader's role (D6, D7).

**Updating dataset metadata:** An org admin must be able to edit the name, description, environment, validity dates, and status of their own datasets. Status transitions must be validated (D11). Activating a draft dataset must check that it is not empty (D1). This route must also be available to system admins for global datasets.

**Archiving a dataset:** Archiving must mark the dataset retired and mark all its associated emission factors as inactive (D5). This is a soft operation — nothing is deleted.

**Downloading a reference template:** Any authenticated user must be able to download a reference CSV file showing the expected format. The template should include example rows with realistic data. It must be served with a UTF-8 BOM so it opens correctly in Excel. Check how the BOQ template is already served — use the same pattern.

**Viewing upload history:** An org admin must be able to see the upload log for their own datasets. System admins can see all logs.

**Tenant boundary enforcement:** Every route that reads or writes a dataset must verify the relationship between the requesting user's organisation and the dataset's owning organisation. The rules are:
- Global datasets (no owning org): readable by everyone, writable only by system admins
- Private datasets: readable and writable only by the owning organisation's admins (and system admins)
- No user from organisation A may ever read or write organisation B's private dataset

Check if a helper for this already exists. If it does, extend it. If not, create one that can be reused across all dataset routes.

### RULES
- Every route must use the same authentication and authorisation middleware stack that already protects other sensitive routes in this codebase. Do not invent a new pattern.
- Error responses must be structured and human-readable. Never expose raw database errors. For upload failures, the response must include the full list of row errors so the UI can display them.
- The upload log entry (D3) must be created at the start of the upload request (as "in progress"), then updated at the end (success or failed). If an unexpected error is thrown mid-process, the log entry must still be updated to reflect the failure.
- The template download route must use UTF-8 BOM encoding — verify this is consistent with how the BOQ template is already handled.

### GUARD QUESTIONS
- Does the upload route now work for org admins (not just system admins)?
- Is the tenant boundary check applied to every dataset route, including GET?
- Does every route use the existing middleware stack?
- Is the upload log entry always written — even when the request fails?
- Would an org admin from a different organisation receive a 403, not a 404?

---

---

## Phase 4 — Lifecycle Engine (✅ COMPLETED)

### INSPECT FIRST
Before writing anything:
- Find where emission factors are queried during BOQ processing and emission calculations
- Understand the full query — what tables are joined, what filters are applied
- Check if there is already any filtering by dataset status, validity, or type
- Find where the server starts up — check if there is already any scheduled job infrastructure
- Check `package.json` for any existing scheduling library
- Search for any existing concept of "expiry" or "validity" in the codebase

### GOAL

**Calculation queries must respect the lifecycle:** When the system looks up emission factors for BOQ matching or emission calculations, it must only consider factors that belong to datasets which are: in the active/live state, set to the production environment (D10), and within their validity window (started, not yet expired). Factors from draft, archived, or test datasets must be invisible to the calculation engine.

**Automated expiry:** A background job must run on a regular schedule (daily is appropriate). It must find all active datasets whose validity end date has passed and archive them — setting the dataset to its retired state and marking all associated factors as inactive (D5). This must happen in a transaction so dataset state and factor state are always consistent.

**Expiry warning signal:** The API response for listing datasets must include enough information for the frontend to know whether a dataset is approaching expiry (within 30 days) or has already expired but not yet been auto-archived. This can be a computed field added to the response — it does not need to be stored.

### RULES
- The calculation query changes must be surgical. Only add the new filters — do not restructure existing joins or change how results are used downstream.
- The background job must be transactional (D5 — dataset state and factor state change together or not at all).
- The background job must log what it did (how many datasets were archived) so it is observable in server logs.
- If no scheduling library exists, choose one consistent with the existing Node.js/TypeScript stack and add it properly to `package.json`.
- Existing projects and their project materials must be completely unaffected by archiving. The snapshot values stored on project materials at calculation time are immutable. Verify this is already the case before and after your changes.

### GUARD QUESTIONS
- Did I check all places where emission factors are queried, not just the obvious one?
- Is the new filter additive — did I avoid restructuring existing logic?
- Does the background job run inside a transaction?
- Are project material snapshots untouched after a dataset is archived?

---

---

## Phase 5 — Frontend UI (✅ COMPLETED)

### INSPECT FIRST
Before writing anything:
- Read the existing Data Sources / dataset management page(s) in full
- Understand the current component structure, state management approach, and API call patterns used
- Find how other similar pages handle tabbed layouts — use the same pattern
- Find how badges and status indicators are currently implemented elsewhere in the UI
- Find the existing upload UI (the hidden file input mentioned in the architecture doc) — understand its current flow fully before replacing it
- Find how the BOQ upload modal works — it is a reference for how a multi-step upload flow should look in this codebase
- Check how the existing "Add Data Source" modal is structured
- Understand what the existing API responses look like for datasets before adding new fields

### GOAL

**Separated dataset views:** The Data Sources page must clearly distinguish between an organisation's own private datasets and the global/platform datasets. These should be in separate, clearly labelled sections or tabs. Global datasets are read-only for org users. Org admins see full action menus on their own datasets.

**Status and environment visibility:** Each dataset row must visually communicate its current state — whether it is in draft, live, or archived — and whether it is a production or test dataset. Datasets approaching or past their expiry must show a visible warning. Org admins and system admins must see a page-level warning banner if any of their datasets are expiring soon or have expired (D9).

**Upload experience:** The current hidden file input must be replaced with a proper upload interaction. The new flow must:
- Make a reference template download available prominently before the user selects a file
- Show the user clearly what columns are required vs optional
- Display a full, row-by-row error table when validation fails — not a generic toast message
- Communicate the atomic nature of the upload: "fix all errors, then re-upload the whole file"
- On success, confirm how many rows were imported and remind the user the dataset is still in draft

**Metadata editing:** Org admins must be able to edit a dataset's name, description, environment, validity dates, and status through the UI. The status selector must only offer valid forward transitions (D11) — it must not show options that would be rejected by the API.

**Upload history:** The dataset detail view must show a history of past upload attempts for that dataset, drawn from the audit log (D3). Each entry should show who uploaded, when, the filename, the outcome, and be expandable to show error detail.

### RULES
- Follow every existing UI pattern you find — component structure, state management, API call conventions, error handling, loading states. Do not introduce a new pattern unless nothing comparable exists.
- The upload modal must reuse the existing Dialog/Modal component pattern. Look at the BOQ upload modal as a reference — mirror its structure and UX conventions.
- All new UI text must be clear and actionable. Error messages must tell the user what to do next, not just what went wrong.
- Do not remove or break the existing "Add Data Source" functionality — extend it or replace it cleanly.
- Role-based UI visibility must be consistent with the permission model: org viewers must not see upload or edit controls.

### GUARD QUESTIONS
- Did I read the existing page fully before restructuring it?
- Is the upload modal consistent with how other upload modals work in this codebase?
- Does the status selector prevent invalid transitions at the UI level?
- Are role-based controls correctly hidden from users without permission?
- Does the error display show the full row-by-row list, not just a toast?

---

## Phase 6 — Bug Fixes & UX Optimization (✅ COMPLETED)

During final user acceptance testing on March 01, 2026, the following refinements were implemented to harden the system:

1. **Bug Fix (Factors Route):** Restored the missing `/api/datasets/:id/factors` route in `server/routes.ts` to ensure uploaded data is visible in the frontend factors table.
2. **Bug Fix (Metadata Retention):** Updated the `PATCH` route to correctly persist the `region` field during metadata updates.
3. **UX Observation (Auth Feedback):** Replaced default toast alerts with a high-visibility `AlertDialog` in `DatasetDetails.tsx` for non-admin users attempting to edit global datasets.
4. **UX Observation (Tooltips):** Added contextual tooltips to the "My Organization" tab to clarify metadata editability and warn about the calculation consequences of the "Test" environment.

---

## Cross-Cutting Rules (Apply to Every Phase)

These apply everywhere, always. If you find existing code that violates them, note it but do not fix it as part of this feature — scope creep is a risk.

**On Documentation (MANDATORY):** Every new code file must have a standardized JSDoc header (see `storage.ts` as template). Existing files must have their headers updated whenever a significant feature or logic change is implemented. The header must include:
- `@file`: Filename
- `@description`: High-level purpose
- `@functionality`: Core features implemented
- `@dependencies`: Key modules/schemas relied upon
- `@breaking-changes`: Potential impacts on other modules

**On the ORM:** Use whatever ORM and database access pattern the existing codebase uses. Do not introduce raw SQL if the project uses an ORM. Do not introduce a new query library.

**On tenant isolation:** Every database query that touches datasets or emission factors must be scoped to the correct organisation. Before writing any query, ask: "could this query accidentally return or modify another organisation's data?" If yes, add the boundary condition.

**On soft deletes:** Nothing in this feature should permanently delete data. Archiving is the equivalent of deletion here. Verify that the existing codebase uses soft deletes elsewhere and follow that pattern.

**On error handling:** Look at how existing routes handle and return errors. Match that pattern exactly. The frontend error handling in the upload modal depends on the API returning structured, predictable error shapes.

**On authentication middleware:** Before adding any new route, find the routes that are most similar in sensitivity and copy their middleware stack exactly. Do not guess which middleware to apply.

**On transactions:** Any operation that modifies more than one table must use a transaction. This is especially important for the archive operation (dataset state + factor state) and the upload (factor insert + dataset row count update + audit log update).

---

## What Must Not Change

These are explicitly out of scope. Do not touch them.

- The EPD Extractor sync service. Its behaviour and schedule are unchanged.
- The snapshot values stored on project materials at calculation time. These are immutable records of what was true at the moment of calculation.
- The BOQ Normalizer and BOQ Wizard flows. They consume emission factors — their internal logic is not part of this feature.
- The existing admin upload route, if one exists. Keep it working for system admins managing global datasets. The new route supplements it for org admins.
- Any existing emission factor or dataset records in the database. Schema changes must be additive and use safe defaults.

---

## Definition of Done

This feature is complete when:

1. An org admin can create a private dataset, upload a valid CSV or Excel file, see it in draft state, review the factors, and activate it — without any system admin involvement.
2. An org admin who uploads a file with any invalid rows receives a clear, row-level error report and no data is written to the database.
3. An org admin who uploads a file with more than 1,000 rows receives a clear rejection message.
4. A system admin faces no new restrictions and can still manage global datasets as before, including uploading large files.
5. A dataset with a past expiry date is automatically archived by the background job, and its factors become unavailable for new calculations.
6. A dataset approaching expiry within 30 days shows a visible warning to org admins and system admins in the UI.
7. Every upload attempt — successful or failed — appears in the upload history with the filename, uploader, timestamp, and outcome.
8. A test-environment dataset's factors never appear in BOQ matching or emission calculations.
9. No existing project, project material, calculation, or snapshot value is affected by any of the above changes.
10. An org admin from one organisation cannot access or modify another organisation's datasets in any way.

---

*This manifesto is the authoritative implementation guide. The companion Review Plan document contains the full decision rationale for reference. When in doubt about intent, refer to the decisions table at the top of this document — those are the anchors.*

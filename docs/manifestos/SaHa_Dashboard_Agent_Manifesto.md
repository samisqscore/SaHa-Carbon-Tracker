# SaHa — Dashboard Redesign & Analytics
## Agent Implementation Manifesto
**Version:** 1.1 | **Date:** March 2026 | **Status:** Implementation Complete ✅

---

## ⚠️ PRIME DIRECTIVE

> **Inspect before you implement.**
> The current dashboard exists and partially works. You are fixing, refactoring,
> and extending it — not replacing it. Read every file you plan to touch before
> writing a single line of new code.
>
> Understand the existing Recharts usage, the existing API endpoints, the existing
> component structure, and the existing state management patterns. Every new panel
> you build must be visually and behaviourally consistent with what is already there.
>
> **If a chart component, API endpoint, or utility already exists that partially
> solves a goal — extend it. Do not duplicate it.**

---

## How to Work Through This Manifesto

Each phase follows this pattern:

1. **INSPECT** — what to read before touching anything
2. **GOAL** — what the end state must be
3. **RULES** — hard constraints that cannot be compromised
4. **GUARD QUESTIONS** — ask yourself these before committing any change

Work strictly in phase order. **Phase 0 (bug fixes) must be complete and
verified before any new dashboard work begins.** Do not skip ahead.

---

## Locked Decisions

| # | Decision |
|---|----------|
| V1 | All emission values displayed anywhere on the dashboard are in **tCO2e** (divide kgCO2e by 1000). This is enforced via a shared utility function — never inline division in JSX. |
| V2 | Material-level emissions use a **two-level drill-down**: category donut first, click to see materials within that category as a horizontal bar. Never show all 60+ materials in a single chart. |
| V3 | Maximum **8 segments** in any donut or pie chart. Items beyond 8 are grouped into a single "Other (X items)" segment. |
| V4 | **Lifecycle stage colours** and **material category colours** are defined once in a shared constants file. Both the dashboard and the project Report tab import from it. No hardcoded colour strings in chart components. |
| V5 | The **category drill-down is local component state** — no URL change, no route navigation. It is a within-panel interaction only. |
| V6 | The **"Other" segment in the donut is not drillable**. Clicking it shows an informational tooltip or toast only. |
| V7 | All panels must have **meaningful empty states** — no broken or empty Recharts renders. Every empty state includes an explanatory message and a contextual action. |
| V8 | The dashboard is always **scoped to the currently selected organisation**. Switching org in the existing org selector must refresh all dashboard panels. |
| V9 | **Recharts is the only charting library**. It is already in the codebase. Do not introduce a new charting library. |
| V10 | The **portfolio bar chart colours encode data quality**: green (>85% materials mapped), amber (60–85%), red (<60%). These thresholds are defined in the shared constants file. |

---

## Phase 0 — Fix Four Existing Bugs (Do This First)

> These bugs corrupt the current dashboard. Any new charts built on top of them
> will show wrong numbers. Fix and verify all four before touching anything else.

### INSPECT FIRST
Before fixing anything:
- Read the current dashboard component(s) in full — understand every data fetch,
  every value displayed, every chart rendered
- Read the dashboard API endpoint(s) — understand every query they run and every
  value they return
- Find where emission values are converted between kgCO2e and tCO2e (or where
  they are not being converted but should be)
- Find how projects are queried for the stat cards — what field and value
  determines if a project is "active"
- Find the trend chart data source — what timestamps does it use?
- Find where the "Emissions by Material" chart reads the category field

---

### Bug B1 — "undefined: 100%" in the Emissions by Material Chart

**What you see:** The donut/pie chart shows a single segment labelled
"undefined: 100%" instead of named categories.

**Root cause:** The chart groups materials by their category field. When category
is null or not set on a material or emission factor, the grouping produces the
literal string "undefined" as a key.

**Fix goal:** The aggregation that groups by category must treat any null, empty,
or undefined category value as a fallback label. Choose a fallback that is
consistent with what the metadata edit feature (already implemented) will use —
confirm what that feature stores when no category is provided and match it here.
Apply the fallback at the query or aggregation layer on the server, not in the
frontend rendering code.

**Verify:** After fix, import a BOQ where no materials have categories set.
The chart must show a named segment (e.g. "Uncategorised") instead of "undefined".

---

### Bug B2 — Active Projects Count Shows 0 When Projects Exist

**What you see:** The "Active Projects" stat card shows 0. The "Total Projects"
card shows 1. The same project exists in both queries.

**Root cause:** The "Active Projects" query filters by a status value that does
not match what is actually stored in the projects table for this project. Either
the filter value is wrong, the field name is wrong, or projects are created with
a default status that the filter does not recognise.

**Fix goal:** Inspect what status value is actually stored in the projects table
for existing projects. Align the "Active Projects" query to match reality. If
the concept of "active" is ambiguous in the current schema, define it clearly:
a project is active if it has not been explicitly archived or deleted. Document
this definition in a code comment.

**Verify:** The Active Projects count must equal the number of real, non-archived
projects in the current org.

---

### Bug B3 — Unit Inconsistency: kgCO2e vs tCO2e Mixed in Same View

**What you see:** The Total Emissions stat card shows 13,164,005 tCO2e.
The chart tooltip on the same page shows 8,284.4 tCO2e for a subset of the
same data. The ratio between them (~1590x) does not make sense — this is a
unit mixing error, not a data scoping difference.

**Root cause:** Emission values are stored in kgCO2e in the database. Some
display points divide by 1000 to get tCO2e. Others display the raw kgCO2e
value but label it as tCO2e. The result is numbers that are off by 1000x
appearing in the same view.

**Fix goal:**
- Establish one rule: all DB values are in kgCO2e, all displayed values
  are in tCO2e.
- Create a single shared utility function for this conversion (e.g.
  `kgToTonnes(kg: number): number` returning `kg / 1000`). This function
  belongs in the shared constants/utils file (see Phase 1).
- Find every place in the dashboard component and its API responses where
  an emission value is displayed. Verify each one uses this utility.
- Never divide by 1000 inline in JSX. Always call the utility function.

**Verify:** The stat card total and the chart tooltip must be consistent.
If the stat card shows X tCO2e, the chart showing a subset of that data
must show a value ≤ X tCO2e with the same unit label.

---

### Bug B4 — Trend Chart Shows Fabricated Historical Data

**What you see:** The Emissions Trend line chart shows 6 months of data
(January through June) for a project that was just created. A brand-new
project cannot have 6 months of emission history.

**Root cause:** The trend query is either reading from seed/dummy data, using
a date field that does not represent when emissions were actually recorded,
or generating synthetic data points. Investigate before assuming.

**Fix goal:** The trend chart must only show real data points based on actual
timestamps — either when materials were added to a project, when calculations
were run, or when BOQ imports occurred (use whichever timestamp is most
meaningful and already available in the schema).

If there is insufficient real data to draw a trend (e.g. a new project with
one import event), show only the real data points and add a label:
*"More trend data will appear as your project is updated over time."*

Do not show a trend line if there is only one data point — show a single
point marker instead.

**Verify:** Create a fresh test project. The trend chart must show only the
data point(s) corresponding to the actual import/calculation events, not
pre-populated historical data.

---

### Phase 0 Guard Questions
- Is the category fallback applied server-side, not in JSX?
- Does the Active Projects count now match the number of visible projects?
- Do the stat card and chart tooltip show the same unit (tCO2e) and
  consistent values?
- Does the trend chart show zero fabricated data points for a new project?

---

## Phase 1 — Shared Constants & Utilities

### INSPECT FIRST
- Check if a colour constants, theme, or design tokens file already exists
- Check how Recharts colour arrays are currently passed in existing chart
  components — are they hardcoded inline or imported from somewhere?
- Check what lifecycle stage values are actually stored in the database
  (e.g. is it "A1-A3" or "A1A3" or "a1_a3"?) — the colour map keys
  must match exactly
- Check what material category values are stored — what categories exist
  in the test dataset?

### GOAL
Create or extend a shared file (confirm the right location by checking
the existing project structure — it may be `lib/constants.ts`,
`utils/emissions.ts`, or similar) that exports:

**Emission unit conversion:**
- `kgToTonnes(kg: number): number` — returns `kg / 1000`
- `formatTonnes(value: number): string` — formats with appropriate
  decimal places and unit suffix for display

**Lifecycle stage colour map:**
A consistent colour per EN 15804 stage. Every chart in the app that
displays lifecycle stages must import this map — never hardcode stage
colours in a component. The colours must be visually distinct and
work on both white and light grey backgrounds.

**Material category colour map:**
A consistent colour per category name. Categories should include at
minimum the ones present in your emission factors dataset. Include a
default/fallback colour for any category not in the map.

**Data quality thresholds:**
- `QUALITY_GREEN = 85` (% mapped)
- `QUALITY_AMBER = 60`
- A helper: `getQualityColour(percent: number): string` returning
  the appropriate colour token

### RULES
- The constants file must not import from any component or page file —
  it is a leaf dependency, not a circular one
- Use the same colour token system already in use in the codebase
  (Tailwind classes, CSS variables, or hex strings — match what exists)
- Every chart component that previously had hardcoded colours must be
  updated to import from this file

### GUARD QUESTIONS
- Do the lifecycle stage keys in the colour map exactly match the values
  stored in the database?
- Does every existing chart that uses stage or category colours now
  import from this file?
- Is `kgToTonnes` used in every place that previously had inline `/ 1000`?

---

## Phase 2 — API Endpoints

### INSPECT FIRST
- Read all existing dashboard-related API endpoints thoroughly
- Note their exact URL patterns, middleware, and response shapes
- Check if any of the data needed for new panels is already returned
  by existing endpoints but just not used in the UI
- Check how the existing org boundary is enforced on dashboard queries —
  use the exact same pattern
- Check if there is an existing portfolio-level summary endpoint
  (mentioned in the project analysis as existing) — extend it rather
  than duplicate it

### GOAL
The dashboard needs the following data. For each item, first check if
an existing endpoint already returns it. If yes, extend that endpoint.
If no, create a new one.

**Summary / KPI data (one call):**
- Total project count for current org
- Total emissions in kgCO2e (frontend converts to tCO2e via V1)
- Average carbon intensity in kgCO2e/m² (only for projects where
  floor area > 0; null if no qualifying projects)
- Data quality percentage (mapped materials ÷ total materials × 100,
  across all projects in org)

**Portfolio emissions (one call):**
- One entry per project: project id, project name, total emissions
  in kgCO2e, data quality percent, floor area (nullable), carbon
  intensity in kgCO2e/m² (nullable if no floor area)
- Used by both the portfolio bar chart and the scatter plot

**Emissions by category (one call):**
- One entry per category: category name, total kgCO2e, percent of
  org total
- Null/empty categories must use the fallback label (fix from B1)
- Scoped to current org; optionally filtered by a projectId query param
  so the same endpoint serves both portfolio view and project-level view

**Emissions by category → materials drill-down (one call per category):**
- Triggered when user clicks a category in the donut
- Returns: material name, total kgCO2e, unit, lifecycle stage, dataset
  source — for all materials in the specified category
- Scoped to current org + category; optionally filtered by projectId

**Emissions by lifecycle stage (one call):**
- One entry per project, with a breakdown by stage
- Stage keys must match the constants file colour map exactly
- Scoped to current org

**Unmapped materials summary (one call):**
- One entry per project that has at least one unmapped material
- Returns: project id, project name, total material count, unmapped
  count, quality percent
- Used by Band 4 action table

### RULES
- Every endpoint must enforce the org boundary — the requesting user's
  `organisationId` must scope all queries. Use the existing middleware.
- All emission values in API responses are in kgCO2e. The frontend
  converts using the shared utility (V1). Do not convert in the API.
- Endpoints that can be scoped to a single project (category, stage)
  must accept an optional `projectId` query parameter. When absent,
  return data for all projects in the org.
- Return sensible empty arrays (not null or errors) when there is no
  data yet — the frontend handles empty states (V7).

### GUARD QUESTIONS
- Did I check for existing endpoints before creating new ones?
- Does every endpoint enforce the org boundary?
- Are all values returned in kgCO2e (not tCO2e)?
- Do endpoints that support project-level filtering accept a `projectId`
  query param?

---

## Phase 3 — Dashboard Component Restructure

### INSPECT FIRST
- Read the current dashboard component in full before restructuring
- Understand its current state: how does it fetch data? What hooks does
  it use? How is loading state handled?
- Read the existing project Report tab chart components — you will reuse
  their Recharts patterns and styling
- Check how other multi-panel pages are structured in this codebase —
  match that pattern

### GOAL
Restructure the dashboard into a four-band layout. Each band is always
visible — the user scrolls down for more detail. No tabs on the dashboard.

**Band 1 — KPI Stat Cards (top of page)**
Four cards in a row: Total Projects, Total Emissions (tCO2e), Avg Carbon
Intensity (kgCO2e/m²), Data Quality (%). Card colours use the quality
threshold constants for the Data Quality card. The others use the existing
card styling already in the codebase.

**Band 2 — Portfolio View (two panels side by side)**
Left panel: horizontal bar chart, one bar per project, sorted by total
emissions descending, bars coloured by data quality (V10). Clicking a bar
navigates to that project.
Right panel: scatter chart, X = floor area (m²), Y = carbon intensity
(kgCO2e/m²), one dot per project with a name label. A horizontal dashed
line shows a typology benchmark (hardcode a reasonable value per building
type for now — confirm with the project owner what benchmark values to use;
if uncertain, make the benchmark line optional and only show it when a value
is configured).

**Band 3 — Material & Stage Breakdown (two panels side by side)**
Left panel: CategoryDrillDown component (see Phase 4).
Right panel: lifecycle stage stacked bar chart, one bar per project, stacked
by stage using the shared stage colour map. A toggle above the chart switches
between absolute (tCO2e) and relative (%) view.

A project filter (Select component) sits above Band 3. When "All Projects"
is selected (default), Band 3 shows portfolio-level data. When a specific
project is selected, Band 3 filters to that project only. Band 2 always
shows the full portfolio regardless of this filter.

**Band 4 — Data Quality & Actions (bottom)**
Left: unmapped materials table. Columns: Project | Total | Unmapped | % Complete | Action.
The Action column has a link/button that navigates to that project's Materials
tab and triggers the Auto-Map modal (consistent with the automap manifesto — check
how that navigation trigger was implemented and use the same mechanism).
Right: three quick-action buttons as described in the design plan.

### RULES
- Each panel component is responsible for its own loading skeleton and
  empty state. The parent page should not show a full-page loader — panels
  load independently.
- Use the existing card/panel component pattern for panel containers —
  do not introduce new wrapper components if existing ones work.
- The project filter in Band 3 must not affect Band 2 panels.
- All tCO2e display values must use `kgToTonnes()` from the shared utility.
- The org selector at the top of the page (existing) must trigger a full
  data refresh when changed — verify this works with the new data fetching
  structure and fix if it does not.

### GUARD QUESTIONS
- Do Band 2 panels ignore the Band 3 project filter?
- Does each panel show a loading skeleton while its data fetches?
- Does each panel show a meaningful empty state when there is no data?
- Does switching org in the existing selector refresh all panels?
- Are all displayed values going through `kgToTonnes()`?

---

## Phase 4 — Category Drill-Down Component

This is the most complex UI interaction and deserves its own phase.

### INSPECT FIRST
- Read how the existing project Report tab handles the emissions by category
  chart — there may already be a category donut component you can extend
- Check the existing Recharts PieChart/RadialChart usage in the codebase
  for the correct pattern to follow
- Check how animated transitions between chart states are handled elsewhere
  — use the same approach

### GOAL
Build (or extend) a `CategoryDrillDown` component with two internal states:

**State A — Category View (default, selectedCategory = null)**
- Donut chart (Recharts PieChart with innerRadius set)
- Shows top 8 categories by tCO2e + a single "Other" segment for the rest (V3)
- The donut centre label shows the total tCO2e for the current scope
- Segment colours come from the category colour map in the shared constants (V4)
- Clicking any segment (except "Other") sets selectedCategory and fetches
  drill-down data
- Clicking "Other" shows a toast/tooltip: "This group contains X materials
  across multiple categories. See the full list in the table below." (V6)
- Below the donut: full ranked table of all materials. Columns:
  Material Name | Category | tCO2e | % of Total | Lifecycle Stage
  Table is sortable by any column. A search/filter input above it.

**State B — Material View (selectedCategory is set)**
- Horizontal bar chart (Recharts BarChart with layout="vertical")
- Shows materials within the selected category, ranked by tCO2e
- Bar colours come from the category colour map — same colour as the
  parent segment they drilled from
- Above the chart: breadcrumb showing "All Categories > [Category Name]"
  and a "← Back" button that resets selectedCategory to null
- Below the chart: filtered version of the full table showing only
  materials in this category

### RULES
- The transition between State A and State B must be smooth — at minimum
  a simple fade. Do not do a jarring instant swap.
- selectedCategory is local state in this component. No URL changes, no
  lifting state to the parent (V5).
- The table below the chart must always be visible in both states — it is
  not hidden when in State B.
- The component accepts a `projectId` prop (nullable). When null, shows
  portfolio-level data. When set, shows project-level data. The parent
  Band 3 project filter passes this prop.

### GUARD QUESTIONS
- Is the "Other" segment undrillable? Does clicking it show information
  rather than attempting a drill-down?
- Is selectedCategory local state only — no URL change?
- Is the table visible in both State A and State B?
- Does the component respond correctly when its `projectId` prop changes?

---

## Phase 5 — Empty States

Every panel must have a well-designed empty state. This is not optional.
Design these before implementing them.

| Panel | Empty State Condition | What to Show |
|---|---|---|
| All panels | No projects in org | Replace entire dashboard content with a single call-to-action: "Create your first project to start tracking embodied carbon." with a Create Project button. |
| Portfolio bar | Projects exist but all have 0 emissions | "No emissions data yet. Import a BOQ or add materials to your projects." |
| Intensity scatter | No projects have floor area set | "Add floor area in Project Settings to enable carbon intensity benchmarking." with a link. |
| Category donut | All materials unmapped | "No emission factors mapped yet. Use Auto-Map to match materials to your datasets." with a link to the first project's Materials tab. |
| Stage bar | No lifecycle stage data | "Lifecycle stage data will appear after materials are mapped to emission factors." |
| Unmapped table | All materials mapped | Show a green success banner: "All materials across all projects are mapped." No table. |

### RULES
- Empty states must never be blank — always show text and an action.
- Empty states must be styled consistently with the rest of the app —
  check how other empty states look in the existing codebase and match them.
- A loading skeleton must always be shown while data is fetching, even
  if the fetch is fast — prevents layout shift.

---

## What Must Not Change

These are explicitly out of scope. Do not touch them.

- The project Report tab internals — you may update it to import colours
  from the shared constants file (Phase 1), but do not change its layout,
  data fetching, or chart types.
- The org selector component — it already works. You only need to ensure
  your data fetching reacts to org changes correctly.
- The existing stat card styling if it already looks correct — only update
  the values and logic, not the visual design, unless something is clearly
  broken.
- Any project-level calculation logic — the dashboard reads and displays
  existing calculated values, it does not perform new calculations.

---

## Definition of Done

This feature is complete when:

1. **B1 fixed:** The category chart shows named segments (e.g. "Uncategorised")
   instead of "undefined" for materials with no category set.

2. **B2 fixed:** The Active Projects stat card shows a count matching the
   actual number of non-archived projects in the current org.

3. **B3 fixed:** All emission values across the dashboard are in tCO2e.
   The stat card total and the chart values are in the same unit and
   consistent with each other.

4. **B4 fixed:** The trend chart shows no fabricated data. A freshly created
   project shows only real data points or an empty state message.

5. A shared constants file exists containing the tCO2e utility function,
   lifecycle stage colour map, category colour map, and quality thresholds.
   Both the dashboard and the project Report tab import stage/category
   colours from it.

6. The four KPI stat cards show correct values for Total Projects, Total
   Emissions (tCO2e), Avg Carbon Intensity, and Data Quality %.

7. The portfolio bar chart shows all projects ranked by emissions, bars
   coloured by data quality level.

8. The carbon intensity scatter shows projects with floor area set, with a
   benchmark reference line. Projects without floor area show a prompt.

9. The category donut shows top 8 categories + Other. Clicking a category
   transitions to a material bar chart with a breadcrumb and back button.
   Clicking "Other" shows an informational message only.

10. The lifecycle stage stacked bar shows all projects broken down by stage,
    with an absolute/relative toggle, using the shared stage colour map.

11. The unmapped materials table shows projects with incomplete mapping,
    with a direct link to trigger Auto-Map for each project.

12. Every panel has a meaningful empty state — no blank or broken charts.

13. Switching organisation in the org selector refreshes all dashboard panels.

14. Running the entire dashboard against the Data Center test project shows
    correct tCO2e values consistent with the project Report tab figures.

---

*Companion manifesto documents:*
- *SaHa_Datasource_Agent_Manifesto.md — datasource upload implementation*
- *SaHa_AutoMap_Agent_Manifesto.md — project material auto-mapping*

# Phase 5 Continuation Manifesto: Hybrid Data Architecture & Next Steps

**Date:** December 25, 2025
**Status:** Phase 5 (Intelligent Evolution) - Mid-Implementation
**Current Focus:** Data Source Management & Calculation Logic

---

## 🚀 Executive Summary
We have successfully transitioned the backend to the **Hybrid Data Architecture** and built the **Data Source Manager UI**.
The system now supports **Global Datasets** (managed by Admins) and **Private Organization Datasets** (managed by Org Admins).
The database has been migrated ("Clean Slate") and seeded with standard factors (ICE v3, India BEI).

## 📜 **CRITICAL RULE: Documentation Standard**
**ALL** new files and major updates **MUST** include JSDoc/TSDoc headers.
- **Components**: Explain props, purpose, and key logic.
- **API Routes**: Explain inputs, outputs, and permission checks.
- **Functions**: Explain parameters and return values.
*No code shall be committed without embedded documentation.*

## ✅ Work Completed This Session

### 1. Database & Schema (`shared/schema.ts`)
*   **New Entities**:
    *   `emission_datasets`: Containers for factors (e.g., "ICE v3", "My Org Custom"). Supports `organizationId` (null = Global).
    *   `emission_factors`: The actual factors. Linked to a dataset.
*   **Refactoring**:
    *   Updated `project_materials` to store a **snapshot** (`snapshotEmissionValue`) of the factor used at the time of calculation, preventing historical data drift.
    *   Removed legacy `materials` and `material_emission_factors` tables.

### 2. Backend Logic (`server/routes.ts`, `server/storage.ts`)
*   **API Endpoints**:
    *   `GET /api/datasets`: Returns Global + Org-specific datasets.
    *   `POST /api/datasets`: Create new private datasets.
    *   `GET/POST /api/datasets/:id/factors`: Manage factors within a dataset.
*   **Cleanup**:
    *   Fixed legacy references in `storage.ts` (`getProjectEmissions`) to use the new schema.
    *   Refactored `server/routes.ts` to remove dependencies on old tables.

### 3. Frontend UI (`client/src/pages/admin/`)
*   **Data Source Manager** (`DataSources.tsx`):
    *   Lists all available datasets.
    *   Distinguishes between "Global" (Blue/Globe) and "Private" (Amber/Lock) datasets.
*   **Dataset Details** (`DatasetDetails.tsx`):
    *   View all factors in a dataset.
    *   Add new factors manually (Private datasets only).
*   **Navigation**:
    *   Added to Sidebar (Admin & Org sections).
    *   Fixed "Back" navigation bugs.

---

## 🚧 Work in Progress / Known Issues

1.  **Bulk Upload Disabled**:
    *   The `POST /api/admin/datasets/:id/upload` route is currently **stubbed** (returns 501 Not Implemented).
    *   *Reason*: The CSV parsing logic needs to be updated to match the new `emission_factors` schema.
2.  **Calculation Priority Logic Not Connected**:
    *   While we store the data, the **Project Calculation Service** (`emissionCalculationService.ts`) does not yet automatically fallback: `Project Specific -> Org Custom -> Global Default`.
    *   It currently relies on the user selecting a factor explicitly or the snapshot.

---

## 📋 Immediate Next Steps (For Next Session)

### Priority 1: Connect the "Brain" (Calculation Logic)
We need to ensure that when a user adds a material to a project, the system intelligently picks the best emission factor.
*   **Action**: Modify `getEmissionFactorForMaterial` in `server/storage.ts` (or service) to implement the priority chain:
    1.  Check for **Private Dataset** factors for this Organization.
    2.  Fallback to **Global Default** dataset.

### Priority 2: Enable Bulk Upload
*   **Action**: Update the CSV parser/importer in `server/routes.ts`.
    *   Map CSV columns to `emission_factors` (Material Name, Category, Value, Unit).
    *   Allow Org Admins to bulk upload their custom headers.

### Priority 3: Advanced Reporting (Scope 1-2-3)
*   Once data sources are robust, we start tagging them with Scopes and building the **Portfolio Dashboard**.

---

## 🛠️ Technical Context for Resumption
*   **Server Port**: 5001
*   **Database**: PostgreSQL (Railway/Local). Schema is up to date (`npm run db:push` was successful).
*   **Key Files to Watch**:
    *   `server/routes.ts`: logic for datasets.
    *   `server/storage.ts`: `getProjectEmissions` logic.
    *   `client/src/pages/admin/DataSources.tsx`: UI entry point.

**Ready to Resume?**
Start by tackling **Priority 1 (Calculation Logic)** to fully leverage the new data architecture.

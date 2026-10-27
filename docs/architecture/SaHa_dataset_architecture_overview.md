# SaHa Dataset Management: Architectural Overview & Enhancement Proposal

**Prepared for:** SaHa Carbon Footprint Tracker Architecture
**Date:** March 1, 2026 (Updated for SaHa Open Source Release)

---

## 🏗️ 1. Project Context & Current Architecture

The **SaHa Carbon Footprint Tracker** platform utilizes a **Hybrid Architecture** for its primary carbon data backbone. This shift away from legacy (`materials`, `material_emission_factors`) ensures strong multi-tenant separation while allowing global defaults.

### Hybrid Architecture Key Principles
1. **Global/System Datasets:** Publicly available emission factors (e.g., ICE v3, India BEI) maintained by system administrators. These are read-only for organizations.
2. **Private/Organization Datasets:** Custom emission factors uploaded by specific organizations (e.g., supplier-specific EPDs). These are strongly bounded by `organizationId`.
3. **Traceability:** The `project_materials` table links directly to `emission_factors` but captures an immutable snapshot (`snapshotEmissionValue`, `snapshotSource`) to maintain calculation integrity even if the upstream factor changes.

---

## 🗄️ 2. Current Database Structure (Drizzle ORM)

The backbone of dataset management relies on three primary tables:

### `organizations`
- [id](client/src/components/BOQNormalizer/BOQNormalizerReview.tsx#30-55) (uuid, primary key)
- `name` (text)
- `industry`, `country` (Mandatory manifesto fields)

### `emission_datasets` (The Data Sources)
Represents a collection/catalog of emission factors (e.g., "ICE v3.0").
- [id](client/src/components/BOQNormalizer/BOQNormalizerReview.tsx#30-55) (uuid, pk)
- `name` (text) - e.g., 'ICE v3', 'My Custom EPDs'
- `region` (text) - Default "Global"
- `description` (text)
- `isDefault` (boolean)
- `organizationId` (uuid, fk to organizations) - **CRITICAL:** Null means Global/System. UUID means Private.
- `createdAt` (timestamp)

### `emission_factors` (The Individual Materials)
Represents a single emission factor row.
- [id](client/src/components/BOQNormalizer/BOQNormalizerReview.tsx#30-55) (uuid, pk)
- `materialName`, `materialCategory` (text)
- `emissionFactor` (real) - The numerical value
- `unit` (text), `emissionUnit` (text, default "kgCO2e")
- `datasetId` (uuid, fk to `emission_datasets`)
- `sourceReference` (text) - Exact line/table reference
- `scope` (text: 'platform' | 'organization')
- `ghgScope` (text: 'scope1' | 'scope2' | 'scope3')
- `lifecycleStage` (text: 'A1-A3', 'A4-A5', etc.)
- `isActive` (boolean)

---

## 🔄 3. Current Ingestion Mechanisms

### Mechanism A: EPD Sync Service ([server/epdSync.ts](server/epdSync.ts))
- **Type:** Automated System Integration.
- **How it works:** A read-only mirroring script connects to an external **EPD Extractor Database** via `EPD_DATABASE_URL`. It queries approved factor documents, transforms `lifecycle_stage` strings to our internal EN 15804 enums, filters for "GWP Total", and auto-upserts records into the local `emission_factors` table under a dedicated auto-gen dataset (`EPD_DATASET_ID`).
- **Trigger:** Manual button in the Admin UI (`/api/admin/sync-epd`). Note: Modifies only system-level dataset.

### Mechanism B: Bulk CSV Upload ([server/datasetImport.ts](server/datasetImport.ts))
- **Type:** Manual File Upload.
- **How it works:** Uses `xlsx` to parse sheets and attempts a fuzzy match on column headers (e.g., looks for `emission_factor`, `co2e`, `name`, `unit`, `category`). Evaluates rows using `zod` (`datasetRowSchema`).
- **Route:** `POST /api/admin/datasets/:id/upload`.
- **UI Element:** A hidden `<input type="file">` inside [DatasetDetails.tsx](client/src/pages/admin/DatasetDetails.tsx). Clicking a "Bulk Import" button activates it.

---

## ⛔ 4. Identified Problems & Limitations

Upon review, the current manual upload workflow presents significant UX and functional blockers:

1. **Authorization Gate Issue:** The upload route (`/api/admin/*`) enforces a `requireAdmin` middleware. This completely blocks Organization Admins from uploading data into their own private datasets.
2. **Strict Parser Requirements:** The [datasetImport.ts](server/datasetImport.ts) parser strictly enforces a `category` column. Real-world datasets (like the provided test file) often lack categories. It also fails to recognize standard aliases like `kgco2e_per_unit` for the emission factor column, leading to instant failure.
3. **UI Confusion (Global vs. Org):** The frontend ([DataSources.tsx](client/src/pages/admin/DataSources.tsx)) lumps Global and Private datasets into a single visible table. It is not immediately obvious to a user what they have permission to modify.
4. **Poor Feedback Loop:** The "Bulk Import" button provides a generic red toast ("Missing required columns") without instructing the user what columns are actually needed or providing a template.
5. **Lifecycle Blindness:** There is no mechanism to mark a dataset as "Archived" or set a "Valid Until" date when EPDs expire.

---

## 🚀 5. Proposed Enhancements 

To resolve these issues and support robust, scalable dataset management by end-users, we propose the following holistic changes:

### Phase 1: Database & Model Refinement
- **Schema Updates (`emission_datasets`):**
  - Add `status`: enum("draft", "active", "archived") -> default "active"
  - Add `updatedAt`: timestamp
  - Add `validUntil`: timestamp (crucial for EPD expiration tracking)
- **Parser Resiliency ([datasetImport.ts](server/datasetImport.ts)):** 
  - Add aliases (e.g., `kgco2e_per_unit`) to the emission factor mapping. 
  - Change `category` from absolutely required to optional (fallback to "Uncategorized" if not provided by the user).

### Phase 2: API Realignment for Tenants
- **Democratize Uploads:** Move the upload route from `/api/admin/datasets/:id/upload` (System Admin only) to `/api/datasets/:id/upload` (Org Admin allowed).
- **Enforce Tenant Boundaries:** In the new endpoint, verify that the dataset `organizationId` matches the uploading user's `organizationId`. If it's a global dataset (null `organizationId`), enforce a System Admin check.
- **Lifecycle Endpoints:** Add `PUT` and `DELETE` (soft-delete/archive) routes to `/api/datasets/:id`.
- **Template Generation:** Add `GET /api/datasets/template` to serve a perfectly formatted reference CSV to users dynamically.

### Phase 3: UI/UX Optimization
- **Dataset Home ([DataSources.tsx](client/src/pages/admin/DataSources.tsx)):**
  - Implement **Tabs** separating "My Organization Datasets" from "Global/Platform Datasets".
  - Add Status badges (Active/Archived) and Validity Dates to the tables.
  - Expose an inline "Actions" menu (Upload, Edit Meta, Archive) for authorized rows.
- **Upload Modal (`DatasetUploadModal.tsx` - New Component):**
  - Replace the hidden file input with an interactive Dialog Modal.
  - Prominently feature a **"Download Reference Template"** button.
  - Detail exactly which columns are required vs. optional.
  - Improve error reporting (e.g., "Found columns: name, unit. Missing: emission_factor").

---
**Next Steps:** Please review this proposed enhancement architecture. Upon approval, we will proceed with implementing the schema changes, API refactoring, and UI/UX modernization.

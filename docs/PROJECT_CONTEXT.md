# DMBoD V2 Lean: Project Context Manifesto
**Last Updated:** 2026-04-06 | **Status:** Production Verified (V2 Lean Baseline)

## 🎯 1. Project Identity & Vision
**DMBoD (Decision Modeler for Building Decarbonization)** is transitioning into its **"Lean" Phase**.
- **Objective**: Shift from high-complexity feature sets to a simplified, narrative-driven experience.
- **Audience**: High-level business users and construction project managers who need "Decarbonization Roadmaps" rather than raw data grids.
- **Core Principle**: Simplicity First. Faster onboarding, automated mapping, and decision-grade carbon intelligence.

---

## 🚀 2. Current Technical Status
- **Active Branch**: `dmbod-v2-lean` (Isolated from legacy `main` branch).
- **Production URL**: [https://dmbodv2-production.up.railway.app](https://dmbodv2-production.up.railway.app)
- **Deployment Platform**: Railway (DMBOD_V2 service + DMBOD_DB PostgreSQL).
- **Database Status**: Production schema initialized via `drizzle-kit push`.
- **Authentication**: Google OAuth 2.0 fully configured for local (5002) and production.
- **Auth Bootstrap**: The **first user** to log in to a fresh database is automatically granted `Super Admin` status (Role: `admin`, Status: `approved`).

---

## 🏗️ 3. Architecture & Tech Stack
- **Frontend**: React + Vite (Vanilla CSS for styling, no Tailwind unless requested).
- **Backend**: Node.js + Express (TypeScript).
- **ORM**: Drizzle ORM (PostgreSQL).
- **Authentication**: Passport.js with Google Strategy & express-session (Postgres store).
- **Reporting**: Server-side PDF generation via `@react-pdf/renderer`.
- **AI Engine**: DeepSeek API (Material matching and recommendations).

---

## 🛠️ 4. Active Development Guidelines (Lean Pivot)
1. **Destructive Refactoring**: We are actively removing redundant fields (e.g., climate zones, complex building specs) that clutter the "Lean" experience.
2. **Path to Calculation**:
   - **Step 1**: Quick Project Creation (Name, Type, Location).
   - **Step 2**: BOQ Normalization (The primary entry point for data).
   - **Step 3**: Instant Carbon Intelligence (Dashboard & Reports).
3. **Branch Hygiene**: Never merge `dmbod-v2-lean` back into `main` without a full audit.

---

## 📂 5. Key Files & Locations
- **Schema**: `shared/schema.ts` (The source of truth for the simplified data model).
- **Storage**: `server/storage.ts` (Handles User/Org/Project persistence).
- **Auth**: `server/googleAuth.ts` (Configures Passport and Session management).
- **BOQ Logic**: `server/boqNormalizer.ts` (The engine for interpreting multi-sheet Excel files).

---

## 📜 6. Documentation
For architectural details, refer to the guides in the `docs/architecture/` and `docs/manifestos/` directories.

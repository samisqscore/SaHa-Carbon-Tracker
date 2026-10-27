# SaHa Carbon Footprint Tracker: Project Context Manifesto
**Last Updated:** 2026-10-27 | **Status:** Production & Open Source Release (v1.0.0)

> [!NOTE]
> **Project Heritage**: SaHa Carbon Footprint Tracker was formerly developed and scoped under the internal working title **DMBoD** (Decision Modeler for Building Decarbonization / Decarbonize Embodied Emissions). It was transitioned and open-sourced under the **SaHa** brand on GitHub.

## 🎯 1. Project Identity & Vision
**SaHa Carbon Footprint Tracker** is an open-source, narrative-driven carbon intelligence platform.
- **Objective**: Provide a simplified, transparent, and whole-life carbon assessment experience for the built environment.
- **Audience**: Architects, sustainability consultants, structural engineers, and construction project managers who need decision-grade carbon intelligence.
- **Core Principle**: Simplicity First. Rapid onboarding, automated material mapping, and audit-ready reporting.

---

## 🚀 2. Current Technical Status
- **Active Branches**: `open-source` (tracking public repository [SaHa-Carbon-Tracker](https://github.com/samisqscore/SaHa-Carbon-Tracker)), with lineage from `dmbod-v2-lean`.
- **Public Repository**: [https://github.com/samisqscore/SaHa-Carbon-Tracker](https://github.com/samisqscore/SaHa-Carbon-Tracker)
- **Deployment Platform**: Docker / Railway / Cloud containers.
- **Database Status**: Production schema initialized via `drizzle-kit push`.
- **Authentication**: Google OAuth 2.0 fully configured for local development and production.
- **Auth Bootstrap**: The **first user** to log in to a fresh database is automatically granted `Super Admin` status (Role: `admin`, Status: `approved`).

---

## 🏗️ 3. Architecture & Tech Stack
- **Frontend**: React + Vite (Vanilla CSS for styling, Tailwind for component tokens).
- **Backend**: Node.js + Express (TypeScript).
- **ORM**: Drizzle ORM (PostgreSQL).
- **Authentication**: Passport.js with Google Strategy & express-session (Postgres store).
- **Reporting**: Server-side PDF generation via `@react-pdf/renderer` + CSV exports.
- **AI Engine**: DeepSeek / Gemini APIs (Material matching and recommendations).

---

## 🛠️ 4. Active Development Guidelines
1. **Whole-Life Lifecycle Alignment**: Support EN 15804 / RICS modules (A1–A3, A4–A5, B, C, D).
2. **Path to Calculation**:
   - **Step 1**: Quick Project Creation (Name, Type, Location, GFA).
   - **Step 2**: BOQ Normalization (The primary entry point for multi-sheet spreadsheets).
   - **Step 3**: Instant Carbon Intelligence (Dashboard & Reports).
3. **Open-Source Hygiene**: Ensure all proprietary keys, investor artifacts, and private identifiers remain excluded from open-source releases.

---

## 📂 5. Key Files & Locations
- **Schema**: `shared/schema.ts` (The source of truth for the data model).
- **Storage**: `server/storage.ts` (Handles User/Org/Project persistence).
- **Auth**: `server/googleAuth.ts` (Configures Passport and Session management).
- **BOQ Logic**: `server/boqNormalizer.ts` (The engine for interpreting multi-sheet Excel files).

---

## 📜 6. Documentation
For architectural details, refer to the guides in the `docs/architecture/` and `docs/manifestos/` directories.

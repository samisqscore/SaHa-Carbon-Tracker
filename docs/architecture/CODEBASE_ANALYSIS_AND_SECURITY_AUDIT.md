# DMBoD Codebase Analysis & Security Audit
**Date:** 2026-02-24 | **Analyst:** Antigravity AI

---

## 1. Executive Summary

The codebase is a **well-structured full-stack Node.js/React application** built on Express, Drizzle ORM, and Google OAuth. The DMBoD master plan is **100% implementable** with the existing technology stack. No major architectural redesign is needed. The tech foundation (Drizzle ORM, Zod, Recharts, TanStack Query) is capable of supporting all planned features.

**However, 6 security vulnerabilities were identified** that should be remediated before production deployment. These range from a *hardcoded session secret fallback* to *missing authorization middleware* on several routes.

---

## 2. Technology Stack Assessment

| Layer | Technology | Assessment |
|---|---|---|
| **Frontend** | React 18, TanStack Query, Recharts, Shadcn/Radix UI | ✅ Modern and well-chosen |
| **Routing** | Wouter | ✅ Lightweight, suitable for SPAs |
| **Backend** | Node.js + Express 4.21 | ✅ Mature, production-ready |
| **ORM** | Drizzle ORM 0.39 | ✅ Type-safe, integrates with Zod |
| **Validation** | Zod 3.24 | ✅ Strong runtime validation |
| **Database** | PostgreSQL (Neon serverless) | ✅ Correct choice for this scale |
| **Auth** | Passport.js + Google OAuth 2.0 | ✅ Industry standard |
| **Security** | Helmet 8.1 | ✅ Present, but misconfigured (see §4) |
| **File Handling** | Multer 2.0.2 | ⚠️ No file type filtering (see §4) |
| **AI Provider** | `@google/generative-ai` (Gemini) | ⚠️ To be replaced with DeepSeek |

---

## 3. DMBoD Plan Implementability Assessment

### ✅ Phase 1: Technical Foundations (FULLY IMPLEMENTABLE)
- **TypeScript Stabilization:** The ~50 TS errors in `check_log.txt` are type-safety issues (`any` casts and missing null checks). They are straightforward to fix without schema changes.
- **Read-Only EPD Mirroring:** The existing `emissionFactors` table (`shared/schema.ts`) and `storage.ts` layer provide a complete data model that can ingest mirrored EPD data. A sync service just needs to be added.

### ✅ Phase 2: Branding (FULLY IMPLEMENTABLE)
- Branding is localized to 6 UI files. The codebase does **NOT** use the brand name in any API contract, database, or configuration. This is purely a UI string change — very low risk.

### ✅ Phase 3: BOQ Template Flow (FULLY IMPLEMENTABLE)
- `BOQImportWizard.tsx` and `boqProcessing.ts` are modular. The template approach can be added as a new processing path. The AI path can be disabled by a feature flag with one conditional in the UI.

### ⚠️ Phase 4: Lifecycle Stage Analytics (NEEDS SCHEMA CHANGE)
- **Gap Found:** The current `projectMaterials` and `emissionFactors` tables do **NOT** have an explicit `lifecycleStage` column (EN 15804 Stages A, B, C, D). The `ghgScope` field exists (Scope 1/2/3) but this is different from lifecycle stages.
- **Action Required:** A `lifecycleStage varchar` column needs to be added to `projectMaterials` (and potentially `emissionFactors`) and a DB migration run before Stage analytics can be built.

### ✅ Phase 5: DeepSeek AI Integration (FULLY IMPLEMENTABLE)
- **DeepSeek is OpenAI-compatible.** The refactor in `boqProcessing.ts` is a straightforward SDK swap from `@google/generative-ai` to `openai` (pointing at the DeepSeek base URL). No architectural changes needed.

---

## 4. 🔴 Security Vulnerabilities

### [CRITICAL] SEC-01: Hardcoded Session Secret Fallback
**File:** `server/googleAuth.ts:56`
```typescript
secret: process.env.SESSION_SECRET || 'fallback-secret-key',
```
**Risk:** If `SESSION_SECRET` is not set in the environment, the app uses a public, known secret. An attacker could forge valid session cookies and impersonate any user.
**Fix:** Throw an error at startup if `SESSION_SECRET` is missing, rather than using a fallback.
```typescript
if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET env var is required");
secret: process.env.SESSION_SECRET,
```

---

### [HIGH] SEC-02: No File Type Validation on Upload Endpoint
**File:** `server/routes.ts:954`
```typescript
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — but no fileFilter!
});
```
**Risk:** A malicious user can upload any file type (`.php`, `.sh`, `.exe`). While it's stored with a random name, the raw file is passed to `processStandardBOQ` which calls `XLSX.readFile()`. Malformed/malicious XLSX files can trigger memory corruption or DoS in the xlsx library.
**Fix:** Add a `fileFilter` to multer to whitelist allowed MIME types.
```typescript
const upload = multer({
    dest: uploadDir,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 
                         'application/vnd.ms-excel', 'text/csv', 'application/pdf'];
        cb(null, allowed.includes(file.mimetype));
    }
});
```

---

### [HIGH] SEC-03: Authorization Bypass in `policies.ts`
**File:** `server/policies.ts:84`
```typescript
const isOrgMatch = true; // Implicit: storage query usually filters by org.
// Strict check: if (project.organizationId !== user.organizationId) return false;
```
**Risk:** The `canProject` function always returns `true` for `isOrgMatch`. Any `org_admin` can edit/delete projects belonging to **any other organization** if they know the project ID.
**Fix:** Pass the user's active `organizationId` (available from `req.organizationId` in all org-aware routes) into the `can()` function and enforce the check.

---

### [MEDIUM] SEC-04: Missing `requireApprovedUser` on Multiple Routes
**Routes affected:**
- `POST /api/projects/:id/phases`
- `PUT/DELETE /api/projects/:projectId/phases/:id`
- `GET/POST /api/projects/:id/materials`
- `DELETE /api/projects/:projectId/materials/:id`
- `GET /api/projects/:id/emissions`

**Risk:** A user whose account status is `pending` or `rejected` can still create, read, and delete project data if they have a valid session cookie from before their status changed.
**Fix:** Add `requireApprovedUser` middleware to all project resource mutation routes.

---

### [MEDIUM] SEC-05: Full Session Object Stored in PostgreSQL
**File:** `server/googleAuth.ts:146`
```typescript
passport.serializeUser((user: any, done) => {
    done(null, user); // Entire user object stored in session table
});
```
**Risk:** The entire user object (including Google tokens, profile image URL, etc.) is serialized into the PostgreSQL `sessions` table. If the DB is compromised, this leaks more user data than necessary. It also means stale role/status data can persist in old sessions.
**Fix:** Serialize only the user ID:
```typescript
passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
    const user = await storage.getUser(id);
    done(null, user);
});
```

---

### [LOW] SEC-06: CSP `unsafe-inline` for Scripts
**File:** `server/index.ts:42`
```typescript
scriptSrc: ["'self'", "'unsafe-inline'", ...],
```
**Risk:** `'unsafe-inline'` in CSP `scriptSrc` completely negates XSS protection. Any injected `<script>` tag will execute.
**Fix:** Remove `'unsafe-inline'` and use a nonce-based CSP, which Vite and Helmet support. This requires changes to how scripts are served in production.

---

## 5. Additional Observations

### ⚠️ DeepSeek API Key Handling
Ensure the DeepSeek API key (`DEEPSEEK_API_KEY`) is stored only in environment variables and **never committed to git** (`.gitignore` covers `.env` ✅). Regenerate the key if it was ever shared in any non-private channel.

### ⚠️ Missing `lifecycleStage` in Schema
The `emissionFactors` and `projectMaterials` tables lack an EN 15804 stage column (A1-A3, B1-B7, C1-C4, D). This must be added before Phase 3 reporting analytics are implemented.

### ✅ Positive Findings
- **Helmet** is configured (good baseline).
- **UUID validation** in `organizationMiddleware` prevents a common DB crash (PostgreSQL error 22P02).
- **RBAC** pattern in `adminAuth.ts` fetches fresh DB data on every request, preventing stale session elevation.
- **Zod validation** is used consistently throughout routes for input parsing.
- **100,000ms rate-limit mitigation** was already implemented for Gemini (this will be removed with DeepSeek migration).

---

## 6. Recommended Action Priority

| Priority | Item | Effort |
|---|---|---|
| 🔴 Critical | SEC-01: Remove session secret fallback | 5 mins |
| 🔴 Critical | SEC-02: Add multer file type filter | 15 mins |
| 🟠 High | SEC-03: Fix org authorization bypass in policies.ts | 1 hour |
| 🟠 High | SEC-04: Add `requireApprovedUser` to missing routes | 30 mins |
| 🟡 Medium | SEC-05: Serialize only user ID in sessions | 30 mins |
| 🟡 Medium | Schema: Add `lifecycleStage` column to `projectMaterials` | 1 hour |
| 🔵 Low | SEC-06: Replace `unsafe-inline` CSP with nonce-based | 2 hours |

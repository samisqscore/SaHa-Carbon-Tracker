# 📘 Cognisio Development Standards & Replit Agent Guidelines

**Version:** 1.0  
**Created On:** 2025-06-02  
**Maintainer:** SaHa Product & Architecture Team

---

## 🧭 1. General Development Philosophy

| Principle | Rule |
|----------|------|
| ✅ Clarity First | Prioritize readable, clean, maintainable code. Avoid clever hacks. |
| ✅ Enterprise Standard | Treat this like a production SaaS platform. No "playground" shortcuts. |
| ✅ Long-Term View | Never favor speed over sustainability. No hard-coded hacks or band-aids. |
| ✅ Responsibility | Every module should fail gracefully, log clearly, and be testable. |

---

## 📐 2. Architecture & Structure

- ✅ Use modular and decoupled architecture (e.g., controller-service-repository pattern)
- ✅ Each module must be reusable, documented, and unit testable
- ❌ Do not use inline logic in React pages/components
- ✅ State must be stored consistently (Supabase → API → local state)
- ✅ Feature flags or configuration-driven design is preferred

---

## 📱 3. Mobile Responsiveness

- ✅ All components must be responsive by default
- ✅ Use Tailwind’s mobile-first breakpoints (`sm`, `md`, `lg`, `xl`)
- ✅ Test layout on:
  - Mobile (iPhone SE/12 equivalent)
  - Tablet
  - Desktop (Full HD)
- ❌ Never assume desktop-only interactions (e.g., hover menus without fallback)

---

## 🔐 4. Security Standards

- ✅ Always use HTTPS APIs
- ✅ Sanitize all inputs at:
  - Client (basic)
  - Server/API (strict)
- ✅ Validate authentication tokens on all sensitive routes
- ✅ Use role-based access control (RBAC) for corporate vs. individual accounts
- ✅ Strip personally identifiable information (PII) before storing logs
- ❌ Never expose API keys or tokens to the client

---

## 🧪 5. Bug Handling & Root Cause Analysis

- ✅ Do not fix bugs without first logging the cause
- ✅ All bugs must include:
  - Root cause (where & why it failed)
  - Fix description (what was changed)
  - Risk of side effects
- ✅ Every fix must be regression-tested for surrounding functionality
- ❌ Never introduce a fix that breaks another feature

---

## 🛠 6. Enhancement Guidelines

- ✅ All enhancements must be backward compatible
- ✅ Use feature toggles or flags if making major logic changes
- ✅ Consider user experience (UX) before technical implementation
- ✅ Document all API/DB/Logic changes in the release notes

---

## 📁 7. Code Quality & Style

- ✅ Follow Prettier + ESLint formatting rules
- ✅ All functions/components must have:
  - A clear name
  - Input/output type definitions
  - Optional inline comments (if logic is non-obvious)
- ✅ Use React functional components with hooks
- ❌ Avoid long files (> 250 LOC per file ideally)
- ✅ Split complex logic into utils/hooks/services

---

## 📈 8. Database & Data Flow

- ✅ All tables must have:
  - Primary key
  - `created_at`, `updated_at` columns
  - Indexed foreign keys (if used in join)
- ✅ Use Supabase RLS for security
- ✅ Migrations should be incremental and reversible

---

## 🔌 9. API Standards

- ✅ Use RESTful conventions:
  - `GET /resource`
  - `POST /resource`
  - `PUT /resource/:id`
  - `DELETE /resource/:id`
- ✅ Validate all request payloads (types, structure, auth)
- ✅ Return consistent error formats (message, code, field)

---

## 🧠 10. Agent Specific Rules

| Area | Rule |
|------|------|
| 🧠 Context Awareness | Always check existing logic before injecting new code |
| 🧠 Ask Before Overwriting | If unsure, prompt the user before overwriting or deleting |
| 🧠 Respect Standards | All code must follow Cognisio's style and security rules |
| 🧠 Log Changes | Clearly log what was added/modified and why |
| 🧠 Prefer Durable Fixes | Avoid hacks, hidden `setTimeout` fixes, or duplicate logic |
| 🧠 Approval First | Any code change requires USER prior approval for planned changes. |

---

## 📦 Enforcing These Rules

- Add this rulebook to `/docs/DEVELOPMENT_STANDARDS.md`
- Display a message inside `Replit index.ts` to reference it
- Use as a checklist before merging any code or task by Replit Agent

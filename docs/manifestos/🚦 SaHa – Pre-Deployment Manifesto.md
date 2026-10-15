🚦 SaHa – Pre-Deployment Manifesto

Purpose: This manifesto defines mandatory, non-negotiable checks that must be completed before deploying SaHa for public preview or production use.

Target Platform: Railway.app
Audience: AI Development Agent, DevOps Agent, Release Manager
Status: Mandatory for every public-facing deployment

⸻

🎯 Deployment Objective

Ensure SaHa is:
	•	Secure
	•	Stable
	•	Calculation-safe
	•	Demo-ready
	•	Enterprise-ready

No deployment is considered valid unless every section below is verified and passed.

⸻

🔐 1. Environment & Secrets Management (HARD STOP)

1.1 Environment Variable Discipline
	•	✅ All secrets must be stored only in Railway Environment Variables
	•	❌ No secrets in source code, commits, logs, or frontend bundles

Mandatory Environment Variables

Variable	Purpose
DATABASE_URL	PostgreSQL connection
GOOGLE_CLIENT_ID	OAuth client ID
GOOGLE_CLIENT_SECRET	OAuth secret
JWT_SECRET	Token signing key
APP_ENV	preview / production
APP_BASE_URL	Public domain


⸻

1.2 Environment Separation
	•	Logical separation between preview and production
	•	OAuth redirect URIs mapped correctly per environment
	•	No test data exposed in production UI

⸻

🔒 2. Authentication & RBAC Validation
	•	OAuth login works on deployed domain
	•	No auth bypass routes
	•	Role-based access enforced server-side

Scenario	Expected
Viewer → Admin APIs	❌ Blocked
Estimator → Material edit	❌ Blocked
Admin → All actions	✅ Allowed


⸻

🧮 3. Data Integrity & Calculation Safety
	•	No null / NaN emissions
	•	Project total equals sum of materials
	•	Recalculation triggers on all updates

Validation Rules
	•	Quantity > 0
	•	Emission factor > 0
	•	Units mandatory

Both client-side and server-side validation required.

⸻

📊 4. Reporting & Export Readiness

4.1 Mandatory Report Title

SaHa Carbon Intelligence & Embodied Emissions Summary Report

4.2 Report Requirements
	•	Project metadata
	•	Total emissions
	•	Category breakdown
	•	Insight text (not charts only)

⸻

4.3 PDF Export Validation
	•	PDF values match UI exactly
	•	Responsive layout
	•	Footer includes:
	•	Project name
	•	Generated date
	•	SaHa branding

⸻

🌐 5. Frontend Stability & UX
	•	No console errors
	•	No broken charts
	•	Clear empty states
	•	Loading states for data-heavy views
	•	Responsive on desktop, tablet, mobile

⸻

⚙️ 6. Backend & API Health

6.1 API Contract

{
  "success": true,
  "data": {},
  "error": null
}

	•	No raw exceptions exposed
	•	Logs contain context but no secrets

⸻

🚀 7. Deployment & Rollback Safety
	•	Build completes without warnings
	•	App boots successfully
	•	Database migrations completed
	•	PostgreSQL backups enabled

Rollback must be possible without data loss.

⸻

🧪 8. Final Smoke Test (Release Gate)
	1.	Login
	2.	Create project
	3.	Add materials
	4.	Verify emissions
	5.	Generate report
	6.	Export PDF

All steps must complete successfully within 3 minutes.

⸻

🏁 9. Release Declaration (Mandatory)

The agent must explicitly confirm:

“All pre-deployment checks have passed. SaHa is safe for public preview deployment.”

⸻

🧠 Closing Principle

Production is not where we test. Production is where trust begins.

This manifesto protects:
	•	Product credibility
	•	User trust
	•	Enterprise readiness

⸻

End of Manifesto
🏢 SaHa Organization Onboarding – Implementation Manifest

🔐 Status

ACTIVE & BINDING – This manifest defines how organizations are created, managed, and used across SaHa. All agents must follow this specification.

⸻

🎯 Purpose

Introduce organization-level ownership in SaHa to enable:
	•	Multi-company accounts
	•	Enterprise-grade data isolation
	•	Audit-ready emission calculations
	•	Future scalability without refactoring

Organization onboarding in v1 must be lightweight, fast, and frictionless, while remaining future-proof.

⸻

🧠 Core Principles (Non-Negotiable)
	1.	Every Project, Emission Factor, and Calculation MUST belong to an Organization
	2.	Organization onboarding must take < 60 seconds
	3.	No legal, financial, or compliance documents required in v1
	4.	Organization context must always be explicit in backend APIs
	5.	UX should feel implicit, not enterprise-heavy

⸻

🏗️ Organization Data Model (v1)

Required Fields

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT NOT NULL,              -- Construction, Manufacturing, etc.
  country TEXT NOT NULL,               -- Determines regulations
  reporting_region TEXT,               -- EU, India, Global
  default_unit_system TEXT CHECK (default_unit_system IN ('metric', 'imperial')) DEFAULT 'metric',
  created_at TIMESTAMP DEFAULT now()
);

Design Notes
	•	country is mandatory for regulatory and emission logic
	•	industry supports future templates and benchmarks
	•	No legal entity identifiers in v1

⸻

👤 User ↔ Organization Relationship

SaHa supports many-to-many relationships between users and organizations.

CREATE TABLE organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('org_admin', 'estimator', 'viewer')) NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (organization_id, user_id)
);


⸻

🔐 Role Definitions

Role	Capabilities
org_admin	Manage org, users, emission factors, projects
estimator	Create/edit projects, materials, BOQ
viewer	Read-only access


⸻

🧭 Organization Onboarding Flow (v1)

✅ Implicit Organization Creation (MANDATORY)

During user signup:
	1.	Collect the following fields:
	•	Organization Name
	•	Industry
	•	Country
	2.	System automatically:
	•	Creates Organization
	•	Assigns user as org_admin
	•	Sets default unit system based on country

❌ No separate “Create Organization” screen in v1

⸻

🔁 Multi-Organization Support
	•	A user may belong to multiple organizations
	•	User must always operate within an active organization context
	•	Organization switching may be UI-hidden in v1 but MUST be supported in backend

⸻

🔐 Security & Data Isolation Rules
	1.	All queries MUST filter by organization_id
	2.	No cross-org data access under any circumstances
	3.	Platform-level data is read-only and globally scoped

Example:

SELECT * FROM projects WHERE organization_id = $orgId;


⸻

📦 Impacted Modules (Must Be Updated)

Module	Required Change
Auth	Attach org context on login
Projects	Add organization_id
Materials	Org-scoped emission factors
BOQ Import	Resolve factors within org
Reports	Org-based aggregation


⸻

🚫 Explicitly Out of Scope (v1)
	•	Legal entity verification
	•	Billing & subscriptions
	•	Compliance document uploads
	•	Organization hierarchy (parent/child)

⸻

🧠 Strategic Rationale

This approach:
	•	Signals enterprise SaaS maturity
	•	Enables consultants managing multiple clients
	•	Avoids future schema migrations
	•	Keeps onboarding friction low

⸻

📌 Final Declaration

✔ Organization is a first-class domain object in SaHa
✔ Onboarding is lightweight but real
✔ All future features must respect org boundaries

⸻

SaHa – Built for organizations, not just users.
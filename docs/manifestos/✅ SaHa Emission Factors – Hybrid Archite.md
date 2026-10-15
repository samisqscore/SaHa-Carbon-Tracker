
Note : Not a current version, may be outdated as of 2026-03-05 

✅ SaHa Emission Factors – Hybrid Architecture Manifest

🔐 Final Architectural Decision

Model Chosen: Hybrid (Platform Defaults + Organization Overrides)

SaHa will implement a multi-tenant, organization-scoped emission factor system with a read-only platform-wide dataset and organization-specific override datasets.

This manifest is binding for all development agents (Replit, Codex, Cursor, etc.). No deviation is permitted without architectural review.

⸻

🎯 Core Principles (Non-Negotiable)
	1.	Platform Emission Factors
	•	Global across SaHa
	•	Read-only for all users
	•	Maintained only by SaHa Super Admin
	•	Derived from open / EPD-based sources only
	•	Used strictly as fallback
	2.	Organization Emission Factors
	•	Owned and managed by an organization
	•	Editable only by Org Admins
	•	Override platform defaults during calculations
	•	Fully auditable and isolated per tenant
	3.	Licensing Compliance
	•	❌ No bulk upload of proprietary datasets (ICE, GaBi, etc.)
	•	✅ Metadata references allowed (name, source, version)

⸻

🏗️ Required Data Model (PostgreSQL)

1️⃣ Organizations

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  industry TEXT,
  country TEXT,
  created_at TIMESTAMP DEFAULT now()
);

2️⃣ Organization–User Mapping (Multi-Company Support)

CREATE TABLE organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('org_admin', 'estimator', 'viewer')),
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

3️⃣ Emission Factors (Hybrid Scope)

CREATE TABLE emission_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_name TEXT NOT NULL,
  material_category TEXT,
  unit TEXT NOT NULL,
  emission_factor NUMERIC NOT NULL,
  emission_unit TEXT DEFAULT 'kgCO2e',
  source TEXT NOT NULL,
  source_reference TEXT,
  source_version TEXT,
  valid_from DATE,
  valid_to DATE,
  scope TEXT CHECK (scope IN ('platform', 'organization')) NOT NULL,
  organization_id UUID REFERENCES organizations(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  CONSTRAINT scope_validation CHECK (
    (scope = 'platform' AND organization_id IS NULL)
    OR
    (scope = 'organization' AND organization_id IS NOT NULL)
  )
);


⸻

🔢 Emission Factor Resolution Logic (Mandatory)

Priority order for resolving emission factors:

1. Project-level override (future)
2. Organization emission factor
3. Platform default emission factor
4. ❌ Error – No factor found

Reference SQL Pattern

SELECT *
FROM emission_factors
WHERE material_name = $1
AND is_active = true
AND (
  (scope = 'organization' AND organization_id = $orgId)
  OR (scope = 'platform')
)
ORDER BY CASE scope
  WHEN 'organization' THEN 1
  WHEN 'platform' THEN 2
END
LIMIT 1;

⚠️ Never merge or average emission factors.

⸻

🧮 Emission Calculation Audit Model

CREATE TABLE emission_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_material_id UUID,
  emission_factor_id UUID REFERENCES emission_factors(id),
  calculated_value NUMERIC NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);

Each calculation must store:
	•	Emission Factor ID
	•	Source & version
	•	Timestamp

⸻

🔐 Access Control Rules

Platform Emission Factors
	•	Read-only for all users
	•	Editable only by SaHa Super Admin

Organization Emission Factors
	•	Editable: org_admin
	•	Read-only: estimator, viewer

⸻

📤 Data Ingestion Rules

❌ Not Allowed
	•	Bulk import of licensed datasets (ICE, GaBi, ecoinvent)
	•	Scraping proprietary databases

✅ Allowed
	•	Manual entry from public EPDs
	•	Supplier-provided emission documents
	•	Government publications
	•	CSV upload of organization-owned datasets only

⸻

🎨 UI/UX Requirements

Emission Factor Management Screen

Tabs:
	•	Platform Defaults (Read-only)
	•	Organization Factors (Editable)

Each record must display:
	•	Material Name
	•	Unit
	•	Emission Factor
	•	Source + Version
	•	Validity Period
	•	Scope Badge (Platform / Organization)

⸻

📦 BOQ Import Rules
	1.	Parse BOQ
	2.	Match material
	3.	Resolve emission factor using priority logic
	4.	If unresolved → show mapping UI
	5.	Never auto-create platform emission factors

⸻

🚀 Strategic Rationale

This model enables:
	•	Multi-company accounts
	•	Consultant-led workflows
	•	EU audit compliance
	•	Safe enterprise onboarding
	•	Extensible data integration (custom datasets, regional services)

This architecture signals enterprise-grade ClimateTech maturity.

⸻

📌 Status

This manifest is FINAL and ACTIVE.

All future modules must comply with this document.

⸻

SaHa – Making carbon intelligence practical, auditable, and enterprise-ready.
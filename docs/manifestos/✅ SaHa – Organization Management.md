✅ SaHa – Organization Management

Agent Task Checklist (Validation + Completion)

⸻

🎯 Objective

Enable minimum yet complete Organization Management to support:
	•	Single-organization users
	•	Consultants working with multiple client organizations
	•	Proper project & emission factor isolation

This checklist defines what must exist and work, not how to architect it.

⸻

1️⃣ Organization Core (Data & Behavior)

⬜ Organization Entity Exists
	•	Organization has a unique ID
	•	Organization has at least:
	•	name (mandatory)
	•	createdAt
	•	Optional fields (if implemented):
	•	industry
	•	country / region
	•	description
	•	logo

⸻

⬜ User ↔ Organization Membership
	•	A user can belong to one or more organizations
	•	Membership has a role:
	•	ORG_ADMIN
	•	ORG_MEMBER
	•	Membership records link:
	•	userId
	•	organizationId

⸻

2️⃣ Organization Creation (Minimum UI)

⬜ Create Organization UI Exists
	•	User can create a new organization via UI
	•	Mandatory input:
	•	Organization Name
	•	Optional inputs:
	•	Industry
	•	Country / Region

⸻

⬜ Post-Creation Behavior
	•	Creator is automatically assigned:
	•	Role: ORG_ADMIN
	•	Newly created org becomes:
	•	Active organization context

⸻

3️⃣ Active Organization Context (Critical)

⬜ Organization Switcher Exists
	•	Visible in header or sidebar
	•	Displays:
	•	List of organizations user belongs to
	•	Allows:
	•	Switching active organization
	•	Creating a new organization

⸻

⬜ Active Org Context Is Enforced
	•	Active organization is:
	•	Stored in session / state
	•	Passed to all project & data operations
	•	No action should occur without an active org context

⸻

4️⃣ Organization Settings (Minimum Edit Capability)

⬜ Organization Settings Page Exists
	•	Accessible to ORG_ADMIN
	•	Editable fields:
	•	Organization Name
	•	Optional metadata (industry, country, description)

⸻

⬜ Access Control Works
	•	Only users with ORG_ADMIN role can:
	•	Edit organization details
	•	ORG_MEMBER users have read-only access

⸻

5️⃣ Project ↔ Organization Association

⬜ Project Creation Requires Organization
	•	Every project must be linked to:
	•	One and only one organization
	•	Project creation:
	•	Automatically tags project with active org ID
	•	Manual org selection during project creation:
	•	❌ Not required (context-driven)

⸻

⬜ Project Isolation Is Enforced
	•	User can view only:
	•	Projects belonging to active organization
	•	Switching organization updates:
	•	Project list
	•	Dashboards
	•	Reports

⸻

6️⃣ Material & Emission Factor Scoping

⬜ Factor Scopes Supported

Each emission factor must belong to one scope:
	•	GLOBAL (read-only, platform-provided)
	•	ORGANIZATION (custom, org-specific)

⸻

⬜ Organization-Specific Factors
	•	Org admins can:
	•	Create factors scoped to their organization
	•	Factors are visible only when:
	•	Matching active organization

⸻

⬜ Global Factors
	•	Global factors:
	•	Are read-only
	•	Are visible across all organizations
	•	Cannot be edited or deleted by org users

⸻

7️⃣ Consultant / Multi-Client Scenario Validation

⬜ Multi-Org User Supported
	•	Same user can:
	•	Belong to multiple organizations
	•	Switch orgs freely

⸻

⬜ Data Isolation Verified
	•	Projects created in Org A:
	•	Are NOT visible in Org B
	•	Custom factors created in Org A:
	•	Are NOT visible in Org B

⸻

8️⃣ Reporting & Export Validation

⬜ Organization Identity in Reports
	•	Generated reports (PDF / CSV) must include:
	•	Organization Name
	•	Organization shown must match:
	•	Active org context at report generation time

⸻

9️⃣ Validation & Guardrails

⬜ No Orphan Data Allowed
	•	System must prevent:
	•	Projects without organization
	•	Custom factors without organization

⸻

⬜ Graceful Empty States
	•	If user has no organizations:
	•	Prompt to create one
	•	If organization has no projects:
	•	Show empty state message

⸻

10️⃣ Explicitly Out of Scope (Agent Must NOT Implement)

❌ Platform Super Admin
❌ Organization approval workflows
❌ Cross-organization project sharing
❌ Billing or subscription management
❌ Compliance automation

⸻

✅ Completion Result

The feature is considered DONE when:
	•	Single-org users can work naturally
	•	Consultants can manage multiple client orgs
	•	Projects, factors, and reports are cleanly isolated
	•	No admin-heavy workflows exist
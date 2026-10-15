📜 SaHa Project Workspace UX Manifesto — BOQ Import Redesign

1. Purpose of This Manifesto

This document defines the mandatory UX improvements for the SaHa Carbon Footprint Application to ensure the BOQ Import feature is intuitive, discoverable, and contextually placed for all project users (Estimator / Admin / Viewer).

All AI Agents must implement these specifications without deviation.

⸻

2. Core UX Problems Identified
	1.	Users perceive View Project as read-only.
	2.	BOQ Import is hidden inside Materials tab, reducing discoverability.
	3.	Users expect BOQ Import to be available immediately when they open a project.
	4.	The separation between Edit Project (metadata) and Manage Project (workspace) is unclear.

⸻

3. Mandatory UX Rules (High Priority)

Rule 1 — Rename “View” to “Open Project”

Everywhere in the UI, replace:
	•	“View” → “Open Project”
This clarifies that the user is entering the project workspace, not a read-only mode.

Rule 2 — Make Entire Project Card Clickable

Clicking anywhere on the project card should open:
➡️ /projects/[id] (Project Workspace)

The small icons (Edit, Delete) remain clickable separately.

Rule 3 — Move BOQ Import to a High-Visibility Area

Inside the Project Workspace:

Primary location (on Materials tab)
Place the button here:
📜 SaHa Project Workspace UX Manifesto — BOQ Import Redesign

1. Purpose of This Manifesto

This document defines the mandatory UX improvements for the SaHa Carbon Footprint Application to ensure the BOQ Import feature is intuitive, discoverable, and contextually placed for all project users (Estimator / Admin / Viewer).

All AI Agents must implement these specifications without deviation.

⸻

2. Core UX Problems Identified
	1.	Users perceive View Project as read-only.
	2.	BOQ Import is hidden inside Materials tab, reducing discoverability.
	3.	Users expect BOQ Import to be available immediately when they open a project.
	4.	The separation between Edit Project (metadata) and Manage Project (workspace) is unclear.

⸻

3. Mandatory UX Rules (High Priority)

Rule 1 — Rename “View” to “Open Project”

Everywhere in the UI, replace:
	•	“View” → “Open Project”
This clarifies that the user is entering the project workspace, not a read-only mode.

Rule 2 — Make Entire Project Card Clickable

Clicking anywhere on the project card should open:
➡️ /projects/[id] (Project Workspace)

The small icons (Edit, Delete) remain clickable separately.

Rule 3 — Move BOQ Import to a High-Visibility Area

Inside the Project Workspace:

Primary location (on Materials tab)
Place the button here:
Top Right Corner → Inline with "Add Material"
[ Import BOQ ]  [ Add Material ]

Button must be visually prominent (primary button style).

Secondary location (on Overview tab)
Add a BOQ card block:

BOQ Status Card
	•	If no BOQ uploaded → “No BOQ Uploaded” + Upload BOQ button
	•	If BOQ exists → show summary + Re-Upload BOQ button

This ensures discoverability for first-time users.

⸻

4. Secondary UX Rules (Medium Priority)

Rule 4 — Add BOQ Hint Inside Edit Project Modal

Inside the Edit Project popup, place a non-clickable note:

Note: BOQ upload and material management are available inside the project workspace under “Open Project”.

This reduces confusion for new users.

⸻

5. UI Behavior Specifications

Project Workspace Tabs

Tabs remain:
	•	Overview
	•	Phases
	•	Materials
	•	Emissions

BOQ Import belongs STRICTLY to:
	•	Materials tab (functional area)
	•	Overview tab (for visibility only)

Agents must NOT place BOQ import inside:
	•	Edit Project
	•	Settings
	•	Side menus

Button Styling
	•	Import BOQ → btn-primary
	•	Add Material → btn-secondary

⸻

6. Workflow Definition (Mandatory Logic)

When user clicks “Import BOQ”:
	1.	Trigger file picker (.xlsx / .csv)
	2.	Validate structure (material name, qty, unit)
	3.	Map materials to catalog
	4.	Create project-material entries
	5.	Recalculate emissions

Status must sync with Overview tab BOQ block

⸻

7. Implementation Instructions for AI Agent

Frontend Tasks
	•	Modify all “View” buttons → “Open Project”
	•	Update project cards to be fully clickable
	•	Add BOQ card in Overview tab
	•	Move BOQ Import button to top-right of Materials tab
	•	Update Edit Project modal with BOQ hint

Backend Tasks

No backend logic changes required except:
	•	BOQ upload endpoint must support both entries:
	•	From Materials tab
	•	From Overview tab

State Management
	•	Ensure BOQ upload triggers a refresh of:
	•	Materials list
	•	Emissions calculation
	•	Overview BOQ block

⸻

8. Acceptance Criteria

The BOQ Import feature must meet the following:

Discoverability

Users must see BOQ Import immediately within:
	•	2 seconds of opening a project
	•	Without clicking deep into menus

Consistency

BOQ upload status must be identical in:
	•	Overview tab
	•	Materials tab

User Clarity

No user should confuse:
	•	Edit Project (metadata)
	•	Open Project (workspace)

⸻

9. Agent Behavioral Rules
	•	Follow this manifesto exactly.
	•	Do not remove existing functionality.
	•	Do not restructure databases.
	•	Maintain responsiveness and mobile layout.
	•	Ensure accessibility standards (ARIA, keyboard navigation).
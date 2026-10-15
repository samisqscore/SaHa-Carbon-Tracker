🧭 SaHa Universal BOQ Import — Architecture-Agnostic Implementation Manifesto

(Agent-Ready, No Technology or Framework Prescriptions)

⸻

1. 🎯 Purpose of This Manifesto

Define the functional behavior, workflows, UI expectations, data flow, and business logic for implementing a Universal BOQ Import system in SaHa, without mandating any particular tech stack or architecture.

All implementation decisions—storage, parsing, OCR engines, AI models, file processors—are left to the coding agent based on the existing SaHa stack.

⸻

2. 🌍 Business Reality & Why This Feature Matters

BOQ files (Bills of Quantities) come in highly inconsistent formats:
	•	Structured Excel files
	•	Poorly structured Excels
	•	CSV dumps
	•	PDFs (both text-based & scanned)
	•	Screenshots / Photos sent via WhatsApp
	•	Multi-vendor formats with no standard column order

Construction companies want one thing:

➜ “Upload any BOQ and get clean, structured, ready-to-use material data.”

This manifesto describes how SaHa should support that.

⸻

3. 🔥 Two-Tier BOQ Import Strategy (New Requirement)

To protect cost, performance, and profitability, BOQ import will follow a tiered experience:

⸻

Tier A — AI BOQ Import (Premium & Enterprise Clients Only)

Enabled for:
	•	Big corporates
	•	High-revenue clients
	•	Sustainability consulting firms
	•	Paid enterprise plans

Capabilities:
	•	Accept Excel, CSV, PDF, Scanned PDFs, Images
	•	AI-powered extraction & structuring
	•	AI-assisted material mapping
	•	Confidence scoring
	•	Interactive preview & correction
	•	AI unit normalization
	•	AI-driven error handling
	•	Vendor-format learning for future imports

⸻

Tier B — Standard BOQ Import (Free Tier, Small Businesses, Freelance Architects)

Enabled for:
	•	Free tier
	•	Trial/demo accounts
	•	Independent architects
	•	Small contractors

Capabilities:
	•	Accept Excel / CSV only
	•	User must follow the standard BOQ template
	•	No AI involvement
	•	No PDF scanning
	•	No automated mapping
	•	No vendor-format flexibility

This ensures the platform is cost-efficient while offering premium capabilities where appropriate.

⸻

4. 🧩 Core Functional Modules (Technology-Neutral)

4.1 BOQ Upload Module

Accepts:
	•	Tier A: CSV, XLS/XLSX, PDF, Image
	•	Tier B: CSV, XLS/XLSX only

Validates file type based on user’s subscription tier.

⸻

4.2 BOQ Processing Pipeline

Tier-Based Decision Flow:
IF user_is_enterprise:
    Use AI pipeline (OCR + AI parsing + AI mapping)
ELSE:
    Use Standard CSV/Excel parser (existing functionality)

	AI Pipeline (Tier A only):
	1.	Extract text/tables from source file
	2.	Normalize rows & interpret BOQ structures
	3.	Use AI to convert raw rows into uniform structured line items
	4.	Auto-map items to SaHa material catalog
	5.	Assign confidence scores
	6.	Flag low-confidence rows for user correction
	7.	Produce a unified JSON line-item array

Standard Pipeline (Tier B):
	1.	Read Excel/CSV columns
	2.	Validate required columns
	3.	Convert rows to structured line items
	4.	No AI or fuzzy mapping
	5.	User corrects mismatches manually

⸻

4.3 Material Mapping Engine

Two modes based on subscription tier.

Enterprise (AI):
	•	AI-assisted material identification
	•	Fuzzy matching
	•	Confidence scoring
	•	Suggestions for similar materials
	•	Ability to train per-vendor templates

Standard:
	•	Manual dropdown selection
	•	Strict material name matching
	•	No fuzzy logic
	•	No AI suggestions

⸻

4.4 Preview & Validation Workspace

Both tiers display:
	•	Parsed rows
	•	Quantities
	•	Units
	•	Descriptions
	•	Proposed mappings
	•	Editable fields

Differences by tier:

Enterprise:
	•	AI confidence indicators
	•	Auto-mapped materials
	•	“Map all similar lines” suggestions
	•	“Improve detection” using AI
	•	Vendor template suggestions

Standard:
	•	No confidence scores
	•	No AI suggestions
	•	Manual selection only
	•	Strict row validation

⸻

4.5 Confirm & Import

Regardless of tier:
	•	User reviews
	•	User confirms
	•	System imports items into Project Material list
	•	Emissions recalculated using project’s preferred dataset

⸻

5. 🎨 UI/UX Blueprint (Technology-Neutral)

5.1 Where “Import BOQ” Appears
	•	Materials tab (primary)
	•	Project Overview → BOQ card
	•	Optional: Project list (small import icon)

⸻

5.2 Import Modal / Wizard Steps (For both tiers)
	1.	Upload
	2.	Detect & parse (AI or non-AI depending on tier)
	3.	Preview
	4.	Validate
	5.	Confirm

⸻

Enterprise UI Enhancements
	•	Shows AI parsing progress
	•	Side-by-side file-to-table view
	•	Confidence badge (green/yellow/red)
	•	Quick Actions:
	•	“Map All Similar”
	•	“Auto Fix Units”
	•	“AI Improve Extraction”
	•	“Save Vendor Template”

⸻

Standard UI Simplifications
	•	No AI indicators
	•	Only table preview
	•	Only manual corrections allowed
	•	Template support optional
	•	Errors shown explicitly if format invalid

⸻

6. 📐 Data Models (Format-Only, No SQL Statements)

BOQ Upload Record

Stores:
	•	User tier
	•	File type
	•	Status (uploaded → processed → reviewed → imported)
	•	Raw extraction
	•	Structured output
	•	Mapping confidence (enterprise tier only)

BOQ Line Item

Stores:
	•	Raw extracted line
	•	Structured fields (item, quantity, unit, description)
	•	Material mapping
	•	Mapping confidence (enterprise only)
	•	Audit links
	•	Vendor template info

⸻

7. 🧠 AI-Specific Rules (Only for Enterprise Tier)

AI should:
	•	Interpret any file type
	•	Understand tables in images & scanned PDFs
	•	Extract material names, quantities, units, descriptions
	•	Normalize units (kg → kilograms → kg)
	•	Identify best material mapping candidates
	•	Generate confidence scores
	•	Provide explanations when mapping is unclear
	•	Flag low-confidence rows for review
	•	Suggest alternative material matches
	•	Learn from vendor patterns if the user saves a template

AI should NOT:
	•	Automatically import without user confirmation
	•	Modify project emission preferences
	•	Delete or overwrite existing project materials
	•	Learn from data unless explicitly stored as a vendor template

⸻

8. 🔐 Access Control Rules

Enterprise Users:
	•	Can upload any file format
	•	Can access AI parsing
	•	Can train templates
	•	Can use fuzzy/autocomplete mapping
	•	Can expect intelligent suggestions

Standard/Free Users:
	•	Restricted to Excel/CSV
	•	Must follow predefined column structure
	•	No AI access
	•	No fuzzy matching
	•	No templates

Errors:
	•	If a free-tier user uploads PDF → show “Feature available for Enterprise Plan.”
	•	If import format invalid → show exact columns required.

⸻

9. 🧾 Auditability & Traceability

Regardless of tier:
	•	Every material imported must store:
	•	Source BOQ ID
	•	Line index
	•	Original raw text
	•	Mapping logic (AI or manual)
	•	Dataset used for emissions

This ensures:
	•	Transparent calculations
	•	Compliance with sustainability auditor expectations
	•	Verifiability for ISO / GHG protocols

⸻

10. 🧪 Functional Acceptance Criteria

Enterprise
	•	BOQ import works for Excel, CSV, PDF, images
	•	AI extraction handles most industry document patterns
	•	Confidence scoring shown
	•	User can override any field
	•	Vendor templates reduce rework
	•	Import creates correct project materials

Standard
	•	Upload accepts only Excel/CSV
	•	Invalid format → clear user guidance
	•	Manual mapping enforced
	•	Imports successfully reflect in project materials

⸻

11. 🧭 Recommendations for Implementation Priority

Phase 1 — Establish Tiered Flow
	•	Detect user plan
	•	Conditional rendering for Import BOQ options
	•	Block PDFs/images for standard tier

Phase 2 — Enterprise AI Pipeline
	•	Integrate OCR + AI parsing
	•	Material mapping with confidence
	•	Preview UI with AI indicators

Phase 3 — Standard Pipeline Enhancement
	•	Improve CSV/Excel validation
	•	Provide downloadable template
	•	Offer sample BOQ formats

Phase 4 — Vendor Template Learning (Enterprise Only)

⸻

12. ⚡ Final Note for the Coding Agent

This document intentionally avoids specifying:
	•	Programming languages
	•	Frameworks
	•	Libraries
	•	Cloud providers
	•	Database types
	•	OCR engines
	•	AI model versions
	•	File storage architecture

You must use the existing SaHa implementation stack and choose the optimal architecture within it.
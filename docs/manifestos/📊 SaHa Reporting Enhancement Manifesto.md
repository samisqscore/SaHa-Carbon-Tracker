📊 SaHa Reporting Enhancement Manifesto

Purpose of This Document

This manifesto defines what the SaHa Report module must become and provides clear execution guidance for development agents. The goal is to transform reporting from a visual dashboard export into a decision-grade carbon intelligence report.

This is a binding implementation guide. All report-related development must align with this document.

⸻

1️⃣ Report Philosophy (Non-Negotiable)

❌ What SaHa Reports Are NOT (for now)
	•	Not a certified ISO 14040/14044 LCA report
	•	Not an audit-ready regulatory submission
	•	Not a raw data dump or UI screenshot

✅ What SaHa Reports MUST BE
	•	LCA-aligned (methodologically consistent, but simplified)
	•	Decision-support oriented
	•	Narrative-driven (explains the “why”, not just “what”)
	•	Shareable with non-technical stakeholders
	•	Future-ready for certified LCA expansion

Positioning statement to embed in product:

“SaHa provides LCA-aligned embodied carbon intelligence reports for early to mid-stage design and construction decision-making.”

⸻

2️⃣ Report Types to Implement (v1)

🔹 Report Type A: Executive Carbon Summary (Default)

Target users:
	•	Developers
	•	CXOs
	•	Clients
	•	Auditors & Regulators

Characteristics:
	•	High-level metrics
	•	Hotspots and insights
	•	Minimal technical jargon

🔹 Report Type B: Detailed Carbon Breakdown

Target users:
	•	Sustainability consultants
	•	Estimators
	•	Technical reviewers

Characteristics:
	•	Material- and phase-level breakdowns
	•	Transparent calculation logic
	•	Methodology disclosure

⚠️ Only these two report types are in scope. Certified LCA reports are explicitly out of scope.

⸻

3️⃣ Mandatory Report Structure

All reports (UI + PDF) must follow this structure.

⸻

🧩 Section 1: Report Header & Context

Purpose: Establish clarity, trust, and context.

Required fields:
	•	Project name
	•	Location
	•	Built-up area (m²)
	•	Construction type
	•	Report generation date
	•	SaHa version

Mandatory disclaimer text:

“This report provides an estimate of embodied carbon emissions based on available material quantities and emission factors at the time of analysis.”

⸻

📊 Section 2: Key Carbon Metrics

Replace existing metric cards with:
	•	Total Embodied Carbon (kgCO₂e)
	•	Carbon Intensity (kgCO₂e/m²) (must never show 0.00 unless data is missing)
	•	Top Emission Contributor (% share)
	•	Number of materials analysed

Metrics must be computed server-side and validated.

⸻

🔥 Section 3: Emission Hotspot Analysis (Critical)

This section is mandatory and must include insight text.

Required outputs:
	•	Top 3 emitting materials
	•	% contribution of each
	•	Combined contribution percentage

Example insight text (template-driven):

“Concrete (M30), reinforcement steel, and structural steel together account for 78% of total embodied emissions.”

Charts must always be accompanied by narrative interpretation.

⸻

🏗️ Section 4: Phase-wise Emissions

Rules:
	•	No material should remain permanently “Unassigned”
	•	Default phase mapping must exist

Phases:
	•	Foundation
	•	Superstructure
	•	Envelope
	•	Interiors
	•	Services

Each phase must include:
	•	Absolute emissions
	•	% contribution
	•	Insight text

Example:

“Superstructure contributes the highest emissions due to steel and concrete-intensive elements.”

⸻

🧱 Section 5: Material-Level Breakdown

Mandatory table:
| Material | Quantity | Unit | Emissions (kgCO₂e) | % |

Rules:
	•	Sorted by emissions (descending)
	•	Top 20% highlighted visually
	•	Table must be exportable to CSV

⸻

🌱 Section 6: Reduction Opportunities (Rule-Based v1)

This is not AI-driven yet.

Implement rule-based suggestions such as:
	•	Blended cement → 20–30% reduction
	•	Recycled steel usage
	•	Local sourcing to reduce transport emissions

All suggestions must be labeled:

“Indicative suggestions based on industry best practices.”

⸻

📈 Section 7: Benchmark Comparison

Implement static benchmark ranges initially.

Example:
	•	Typical office building: 400–650 kgCO₂e/m²

Display:
	•	Project value
	•	Status indicator (Within / Above / Below benchmark)

Benchmarks must be configurable via admin settings.

⸻

📄 Section 8: Methodology & Assumptions

Mandatory inclusions:
	•	Emission factor source (EPD / generic datasets)
	•	Calculation method (quantity × factor)
	•	Exclusions (operations, end-of-life, etc.)
	•	Intended usage disclaimer

This section is non-optional for PDF export.

⸻

4️⃣ PDF Export Standards (Hard Rule)

❌ Not Allowed
	•	Screenshot-based exports
	•	UI layout dumps

✅ Required
	•	Structured, server-generated PDF
	•	Section-based layout
	•	Page headers & footers
	•	Page numbers
	•	Embedded charts with captions

PDF must be suitable for:
	•	Client sharing
	•	Management review
	•	ESG compliance audits

⸻

5️⃣ Engineering Responsibilities

Backend
	•	Report aggregation APIs
	•	Hotspot ranking logic
	•	Benchmark comparison service
	•	Rule-based recommendation engine

Frontend
	•	Section-based report components
	•	Insight text rendering
	•	Toggle between Executive / Detailed views

Performance
	•	Cache report computations
	•	Lazy-load detailed sections

⸻

6️⃣ UX & Quality Rules
	•	Every chart must have an explanation
	•	Never show raw numbers without context
	•	Errors must clearly indicate missing data
	•	Maintain consistency between UI and PDF outputs

⸻

7️⃣ Strategic Guardrails
	•	Do not claim “ISO-certified LCA” anywhere
	•	Use the term “LCA-aligned” consistently
	•	Prioritize clarity over complexity
	•	Optimize for actionability, not academic completeness

⸻

Final Mandate

The SaHa Report module must help users understand, explain, and reduce carbon — not just measure it.

All enhancements, refactors, or new features in reporting must be validated against this manifesto before implementation.

⸻

📄 Report Naming & Positioning Recommendation (Mandatory)

🎯 Official Report Title (PDF & View Screen)

SaHa Carbon Intelligence & Embodied Emissions Summary Report

Subtitle (auto-generated):

Project Name | Location | Reporting Period | Generated by SaHa

This title must be used consistently across:
	•	On-screen report views
	•	Exported PDF reports
	•	Shared or downloadable versions

⸻

🧠 Why This Title (Strategic Rationale)
	•	“Carbon Intelligence” positions SaHa beyond calculators and dashboards
	•	“Embodied Emissions” is technically precise and credible for engineers, ESG teams, and auditors
	•	“Summary Report” avoids claiming ISO-certified LCA status while remaining decision-grade

This naming:
	•	Avoids regulatory risk
	•	Signals enterprise maturity
	•	Aligns with future expansion into certified LCA reporting

⸻

⚠️ Explicit Positioning Guardrails (Do Not Violate)

The report must NOT be labeled as:
	•	❌ “ISO 14040/44 LCA Report”
	•	❌ “Certified LCA Report”
	•	❌ “Environmental Product Declaration (EPD)”

Unless a certified LCA workflow is formally introduced later.

⸻

📘 Optional Alternate Titles (Use Only If Needed)

For specific audiences or versions:
	•	SaHa Carbon Intelligence Report (Executive / Board-level)
	•	SaHa Embodied Carbon Assessment Report (Engineering / Technical)
	•	SaHa Project Carbon Summary (Early-stage / Concept phase)

Default remains:

SaHa Carbon Intelligence & Embodied Emissions Summary Report

⸻

🛠️ Agent Implementation Rules
	•	Report title must be dynamic but standardized
	•	Title and subtitle must appear:
	•	On the first page of PDF
	•	At the top of the report UI screen
	•	Metadata (date, version, project ID) must be included in the footer

This section is mandatory and must be implemented before report export features are marked complete.
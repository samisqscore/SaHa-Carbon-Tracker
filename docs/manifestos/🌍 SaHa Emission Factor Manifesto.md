
Note: This manifesto is a work in progress and is subject to change. It is intended to guide the development of the SaHa Carbon Footprint Platform and it's not the current version as of 2026-03-05.

🌍 SaHa Emission Factor Manifesto 

A Unified, Scalable, and Region-Aware Architecture for Carbon Tracking

⸻

1. Purpose of This Manifesto

This document establishes the core design philosophy and non-negotiable development rules for enabling multi-dataset emission factors in the SaHa Carbon Footprint Platform.

It ensures that SaHa evolves into a globally compatible, audit-ready, enterprise-grade LCA tool, capable of serving industries beyond construction—including manufacturing, shipbuilding, and aerospace.

This manifesto must guide all AI agents and developers when modifying or expanding the system.

⸻

2. Fundamental Principle

Emission factors must always be maintained at the material level, not the project level.

Why?

Because every serious carbon accounting tool—EC3, OneClick LCA, eTool—relies on material-level dataset granularity to ensure accuracy, auditability, and compliance with government and industry standards.

⸻

3. The Problem With Project-Level Emission Factors

Selecting EF based on the project alone (e.g., “Use ICE” or “Use India BEI”) creates:

❌ Data mismatches

Materials differ across regions and datasets.

❌ Missing value gaps

Some materials exist only in ICE, others only in India BEI.

❌ Weak auditability

Regulators expect EF traceability per material.

❌ Poor scalability

Future datasets: EU EPDs, Singapore BCA, supplier-specific EPDs, etc.

This approach is not viable for an enterprise SaaS product.

⸻

4. The SaHa Standard: Material-Level Dataset Mapping

SaHa will adopt the global best-practice design:

✔️ Each material may have multiple emission factor records, one per dataset.

✔️ Each EF record contains:
	•	dataset identifier
	•	emission factor value
	•	unit
	•	source reference
	•	version number

✔️ Projects may choose a preferred dataset, but calculation always happens at material-level EF.

This creates precision, transparency, and future-proof extensibility.

⸻

5. Core Architecture Rules (Mandatory)

Rule 1 – Dataset as a First-Class Entity

Introduce a material_datasets table to represent EF datasets such as:
	•	ICE (UK)
	•	BEI (India)
	•	Custom/Company-specific datasets

⸻

Rule 2 – Emission Factors Belong to Materials

Create a material_emission_factors table containing:
	•	material_id
	•	dataset_id
	•	emission_factor
	•	unit
	•	source
	•	version
	•	created_at

A material can have multiple EFs, one from each dataset.

⸻

Rule 3 – Projects Choose a ‘Preferred Dataset’

Add these fields to the projects table:
	•	preferred_dataset_id
	•	allow_mixed_datasets (boolean)

This controls default dataset usage.

⸻

Rule 4 – Calculation Logic Is Dataset-Aware

During emission calculation:
	1.	Use the project’s preferred dataset EF if available
	2.	Otherwise use fallback EF (e.g., ICE or India BEI)
	3.	Always store the EF used in the project_materials row for audit traceability

⸻

Rule 5 – Allow (Optional) Per-Material Overrides

Enterprise clients often provide custom EPDs.
The system must support assigning a custom EF to a material in a specific project.

⸻

Rule 6 – Dataset Versioning Must Be Built-In

Every EF must carry a dataset version:
	•	ICE v3 → v4
	•	BEI India v1 → v2

Projects must be able to lock the version they used.

⸻

Rule 7 – UI Must Reflect EF Source Transparently

Display EF table columns:
	•	EF value
	•	Dataset name
	•	Dataset version
	•	Source (ICE/BEI/Custom)

This is essential for compliance reporting.

⸻

6. Workflow Example (Illustrative Standard)

Project A
	•	Preferred dataset: India BEI
	•	Mixed datasets: Allowed

Material usage example:
	•	Cement → BEI EF exists → Use BEI
	•	Rebar Steel → BEI EF exists → Use BEI
	•	Glass → No BEI EF → Fall back to ICE
	•	Special coating → Custom EF uploaded → Use custom

All choices are stored and auditable.

⸻

7. Why This Architecture Is Non-Negotiable

This design enables:

✔ Accurate government sustainability reporting

(India’s MRV standards, EU’s CBAM, global LCA norms)

✔ Enterprise-grade flexibility

(multi-country, multi-dataset, multi-version)

✔ Future-ready expansion

(additives, EPD imports, supplier-specific EFs)

✔ Clear audit traceability

(required by sustainability auditors and compliance bodies)

✔ Customer confidence

because EF transparency builds trust.

⸻

8. Directive for AI Agents

When modifying the SaHa codebase:

Agents must:

● Implement dataset-aware EF storage
● Rewrite EF calculation to material-level mapping
● Add dataset selection in project creation
● Update UI to display EF source/versions
● Migrate existing ICE EF entries into the new schema
● Maintain backward compatibility

Agents must not:

✖ Implement a project-level EF assignment model
✖ Hardcode EF datasets
✖ Create per-project material definitions
✖ Mix EF logic into the UI layer

⸻

9. Final Declaration

SaHa is committed to scientific accuracy, regulatory compliance, and architectural standards that reflect the best of global sustainability software.

This manifesto defines the foundation of SaHa’s evolution into a unified, multi-dataset carbon intelligence platform for construction, shipping, aerospace, and manufacturing.

This document must guide all future enhancements and development decisions.
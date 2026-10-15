📑 SaHa BOQ Import Review & Hardening

Agent Instruction Manifesto (Based on Complex Real-World BOQs)

⸻

📌 Purpose of This Document

This document instructs the development agent to review, validate, harden, and improve the existing BOQ import implementation in SaHa, using real-world complex BOQs (30+ sheets, inconsistent formats) as the benchmark.

The agent must:
	1.	Review the current hybrid BOQ import implementation
	2.	Compare it against the recommended robust architecture
	3.	Identify gaps, risks, and hidden failure points
	4.	Implement missing safeguards
	5.	Test thoroughly using the provided complex BOQ

This is a quality, correctness, and scalability exercise, not feature expansion.

⸻

🎯 Success Criteria (Non-Negotiable)

The BOQ import is considered production-ready only if:
	•	It handles multi-sheet BOQs without data loss
	•	It never invents quantities or materials
	•	It preserves full traceability to the source BOQ
	•	It gracefully handles ambiguity and partial failures
	•	It requires human confirmation before final persistence

⸻

🧠 Architectural Baseline (Must Be Met)

The BOQ import system must conform to this 3-layer architecture:

Layer 1: Deterministic Parsing (Excel → Raw Rows)
Layer 2: LLM Interpretation (Classification & Meaning)
Layer 3: Human-in-the-loop Review (Validation & Control)

Any deviation must be flagged and corrected.

⸻

1️⃣ Review Phase – Architecture Verification

1.1 Deterministic Parsing Layer (Critical)

Verify that:
	•	Excel is parsed using a deterministic library (e.g., SheetJS / pandas)
	•	Each sheet is processed independently
	•	Each row preserves:
	•	Sheet name
	•	Row index
	•	Raw cell values

❌ FAIL if:
	•	The LLM is given raw Excel files directly
	•	Sheet boundaries are lost
	•	Row indices are not preserved

Expected raw structure:

{
  "sheetName": "Concrete Works",
  "rowIndex": 12,
  "cells": ["Providing PCC 1:4:8", "", "m3", "120.5"]
}


⸻

1.2 LLM Interpretation Layer (Gemini Usage)

Verify that the LLM:
	•	Receives small, chunked inputs (not full sheets/files)
	•	Is instructed explicitly to:
	•	Never guess missing values
	•	Never calculate totals
	•	Never invent materials

The LLM should perform ONLY:
	•	Row classification (material / header / subtotal / ignore)
	•	Semantic interpretation of descriptions

❌ FAIL if:
	•	LLM performs arithmetic
	•	LLM outputs totals or inferred quantities
	•	LLM merges rows or sheets

Expected output schema:

{
  "rowType": "material_line",
  "materialGuess": "Concrete",
  "description": "Providing PCC 1:4:8",
  "unit": "m3",
  "quantity": 120.5,
  "confidence": 0.85
}


⸻

1.3 Confidence & Ambiguity Handling

Verify that:
	•	Every interpreted row has a confidence score
	•	Low-confidence rows are flagged for manual review
	•	No low-confidence row is auto-inserted

❌ FAIL if:
	•	Confidence is missing
	•	All rows are auto-accepted

⸻

2️⃣ Material Normalization & Mapping Review

2.1 Material Master Mapping

Verify that:
	•	LLM outputs are mapped against SaHa’s material master
	•	Mapping rules are deterministic (not LLM-based)
	•	Unmatched materials are marked as “Unresolved”

Hierarchy to enforce:

Project Override
↑
Organization Library
↑
Global / Public Library

❌ FAIL if:
	•	LLM creates new materials automatically
	•	Emission factors are inferred without user action

⸻

3️⃣ Human-in-the-Loop Review (Mandatory)

Verify presence of a BOQ Review UI that shows:
	•	Original BOQ text (read-only)
	•	Sheet name & row number
	•	AI-interpreted material
	•	Editable quantity & unit
	•	Emission factor selection

❌ FAIL if:
	•	Data is persisted without review
	•	User cannot trace back to source row

⸻

4️⃣ Persistence & Auditability

Verify that final persisted data includes:
	•	Original BOQ row reference
	•	Import source metadata
	•	Timestamp
	•	User who approved the import

Expected persisted structure:

{
  "source": "BOQ_IMPORT",
  "sheet": "Concrete Works",
  "rowIndex": 12,
  "originalText": "Providing PCC 1:4:8",
  "materialId": "uuid",
  "quantity": 120.5,
  "unit": "m3",
  "approvedBy": "userId"
}


⸻

5️⃣ Robustness Testing (Must Perform)

The agent must test with the provided 30-sheet BOQ and validate:

Test Scenarios
	•	Sheets with only headers
	•	Rows with missing quantities
	•	Mixed units in same sheet
	•	Subtotal and total rows
	•	Duplicate material descriptions
	•	Very long textual descriptions

Expected behavior:
	•	No crashes
	•	Clear error or review flags
	•	Zero hallucinated values

⸻

6️⃣ Explicit Anti-Patterns (Do NOT Allow)

🚫 Single-shot LLM prompt for full BOQ
🚫 Silent auto-import without review
🚫 AI-calculated totals
🚫 Material creation without confirmation
🚫 Loss of sheet/row context

Any occurrence must be fixed.

⸻

7️⃣ Output of This Review Exercise

The agent must deliver:
	1.	A gap analysis summary (what was missing / weak)
	2.	A list of changes implemented
	3.	Evidence of testing against the complex BOQ
	4.	Confirmation that all Success Criteria are met

⸻

🔑 Final Rule (Non-Negotiable)

If the system cannot explain where a material came from in the BOQ, it is not production-ready.

⸻


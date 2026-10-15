🧭 SaHa Product Tour Manifesto (Agent Implementation Guide)

🎯 Purpose of This Manifesto

This document defines the non-negotiable design, scope, and implementation rules for building the in-app product tour for SaHa – Carbon Footprint Tracker.

The product tour exists to:

Reduce cognitive load and guide first-time users to their first successful outcome: BOQ → Calculation → Report.

This is not a feature showcase. It is an onboarding accelerator.

⸻

🟢 Core Design Principles (Must Follow)
	1.	Outcome-Oriented – Focus on what the user achieves, not what the system does
	2.	Minimal Steps – Fewer steps with clarity > more steps with confusion
	3.	Non-Blocking – User must always be able to exit
	4.	One-Time Auto Trigger – Shown only on first login or when no projects exist
	5.	Replayable – Accessible later via Help → Product Tour

🚫 Never overwhelm the user with theory, standards, or advanced options.

⸻

🧠 Target User Mental Model

Primary users:
	•	Green Building Consultants
	•	Architects / Sustainability Engineers

They think in this sequence:

Client → Project → BOQ → Numbers → Report

The tour must mirror this exact flow.

⸻

🔑 Success Definition

The tour is successful when the user:
	•	Understands where to start
	•	Knows BOQ upload is the fastest path
	•	Feels confident generating a report

The tour does NOT need to make them an expert.

⸻

🚦 Tour Trigger Rules (Strict)

Auto-trigger the tour when ANY of the following is true:
	•	First-ever login
	•	projects.count === 0

Never auto-trigger again once dismissed.

Persist flag:

user.hasSeenProductTour = true


⸻

🪜 Tour Flow (Final & Approved)

Step 1️⃣ – Welcome

Anchor: Dashboard / Home

Message:

“Welcome to SaHa — your workspace for embodied carbon calculation & reporting.”

Subtext:

“In just a few steps, we’ll show you how to go from BOQ to audit-ready report.”

⸻

Step 2️⃣ – Organization Context

Anchor: Organization switcher / header

Message:

“Your Organization is where your team, projects, and material libraries live.”

⚠️ Do not explain roles, permissions, or hierarchy.

⸻

Step 3️⃣ – Create a Project

Anchor: “Create Project” CTA

Message:

“Projects represent real client jobs — buildings, developments, or scopes.”

Highlight:
	•	Client name
	•	Location

⸻

Step 4️⃣ – BOQ Import (Hero Step)

Anchor: BOQ Upload section

Message:

“Don’t enter materials manually. Upload your BOQ (Excel) to instantly ingest data.”

Subtext:

“You can review and edit quantities before calculations.”

⭐ This is the most important step in the tour.

⸻

Step 5️⃣ – Smart Calculation Engine

Anchor: Calculation summary / emissions panel

Message:

“SaHa automatically applies emission factors to your BOQ items.”

Subtext:

“You can override or refine factors at any time.”

Purpose:
	•	Build trust
	•	Show control

⸻

Step 6️⃣ – Reports & Compliance

Anchor: Report / Export button

Message:

“Generate clear, audit-ready carbon reports in one click.”

Optional subtext:

“Designed for consultants, clients, and regulators.”

⸻

Step 7️⃣ – Exit with Action

Final Message:

“You’re ready. Create your first project to see SaHa in action.”

CTA Button:
Create Project

🚫 Do not use generic buttons like “Finish” or “Close”.

⸻

🛠️ Technical Implementation Guidelines

Recommended Approach
	•	Lightweight tour library (Intro.js / Shepherd.js / custom modals)
	•	Highlight-based, click-through steps
	•	No full-screen blocking modals

State Management

TourState {
  hasSeen: boolean;
  currentStep: number;
}


⸻

🚫 Explicitly Out of Scope (Do NOT Include)
	•	Emission factor theory
	•	LCA standards explanation
	•	AI roadmap
	•	Optimization recommendations
	•	Organization / tenant complexity

These belong in:
	•	Help docs
	•	Tooltips
	•	Phase-2 tours

⸻

🧪 Acceptance Criteria (Agent Must Validate)
	•	Tour runs only once automatically
	•	Tour can be replayed manually
	•	User can exit at any time
	•	BOQ upload is clearly highlighted
	•	Tour leads user to a clear next action

⸻

🧩 Future Extensions (Not Now)
	•	Contextual micro-tours (e.g., BOQ page help)
	•	Advanced user tour (Phase 2)
	•	Consultant vs Enterprise-specific tours

⸻

✅ Final Rule

If a step does not help the user reach their first BOQ-driven report faster, it does not belong in the tour.

This manifesto is the single source of truth for implementing the SaHa product tour.
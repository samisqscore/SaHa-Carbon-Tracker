# 🏗️ SaHa Carbon Footprint Tracker – Functional Validation Checklist

> **Purpose of this document**
> This is the **master functional scope & validation checklist** for SaHa.
> It is intentionally **architecture-agnostic** and must **NOT** influence technology, framework, or deployment decisions.

This document exists to:

* Validate **what is implemented vs what is missing**
* Guide **AI agents / developers** to assess completion status
* Prevent scope creep while completing SaHa end-to-end
* Serve as a **single source of truth** for product completeness

---

## ✅ Validation Rules (Non-Negotiable)

* ❌ **Do NOT propose new features**
* ❌ **Do NOT change architecture or stack**
* ❌ **Do NOT refactor unless required to complete a checklist item**
* ✅ Only **verify, validate, and mark status**

Status definitions:

* 🟢 **Complete** – Fully implemented and usable
* 🟡 **Partial** – Exists but incomplete / buggy / limited
* 🔴 **Missing** – Not implemented at all

---

## 1️⃣ User & Organization Management

| Feature                      | Description                                         | Status |
| ---------------------------- | --------------------------------------------------- | ------ |
| User Registration            | Users can sign up using Google OAuth                |        |
| User Login                   | Secure login with session persistence               |        |
| User Roles                   | Admin / Estimator / Viewer roles enforced           |        |
| Role-based Access Control    | UI & backend respect role permissions               |        |
| Organization Entity          | Each user belongs to an organization                |        |
| Organization Creation        | Organization auto-created or assigned on first user |        |
| Multi-user Organization      | Multiple users can belong to same org               |        |
| Organization Switching       | User can switch orgs (if applicable)                |        |
| Platform-wide Read-only Data | Global materials visible to all orgs                |        |

---

## 2️⃣ Project Management

| Feature           | Description                        | Status |
| ----------------- | ---------------------------------- | ------ |
| Create Project    | Create new carbon tracking project |        |
| Edit Project      | Update project details             |        |
| Delete Project    | Soft or hard delete project        |        |
| Project Ownership | Project tied to org and user       |        |
| Project Status    | Draft / Active / Completed         |        |
| Project Metadata  | Location, type, description        |        |
| Project Listing   | View all org projects              |        |

---

## 3️⃣ Project Phases

| Feature               | Description                  | Status |
| --------------------- | ---------------------------- | ------ |
| Phase Creation        | Define construction phases   |        |
| Phase Editing         | Update phase details         |        |
| Phase Ordering        | Logical sequence of phases   |        |
| Phase Status          | Planned / Active / Completed |        |
| Phase-Project Mapping | Phases linked to projects    |        |

---

## 4️⃣ Material Catalog

| Feature                 | Description                     | Status |
| ----------------------- | ------------------------------- | ------ |
| Global Material Catalog | Platform-maintained materials   |        |
| Org-level Materials     | Organization-specific materials |        |
| Material Categories     | Cement, Steel, Gypsum, etc.     |        |
| Emission Factor         | CO₂e per unit stored            |        |
| Unit Management         | kg / tonne / m³ etc.            |        |
| Source Attribution      | EPD / BE / Manual               |        |
| Material CRUD (Admin)   | Add/edit/deactivate materials   |        |
| Material Versioning     | Changes tracked over time       |        |

---

## 5️⃣ Project Material Assignment

| Feature                    | Description                      | Status |
| -------------------------- | -------------------------------- | ------ |
| Assign Material to Project | Select material for project      |        |
| Phase-wise Assignment      | Material linked to phase         |        |
| Quantity Input             | Quantity with unit validation    |        |
| Waste Factor               | Adjustable waste percentage      |        |
| Supplier Distance          | Transportation distance captured |        |
| Installation Method        | Manual / Equipment-based         |        |
| Edit Assigned Materials    | Update quantities & factors      |        |
| Remove Materials           | Remove material from project     |        |

---

## 6️⃣ Emissions Calculation Engine

| Feature                  | Description                 | Status |
| ------------------------ | --------------------------- | ------ |
| Base Material Emission   | Quantity × Emission Factor  |        |
| Waste Emissions          | Emissions from waste factor |        |
| Transportation Emissions | Distance-based calculation  |        |
| Installation Emissions   | Equipment / method based    |        |
| Phase-wise Emissions     | Aggregated per phase        |        |
| Project Total Emissions  | Sum of all emissions        |        |
| Recalculation on Change  | Auto update on edit         |        |
| Calculation Audit Trail  | Store calculation breakdown |        |

---

## 7️⃣ Dashboards & Visualization

| Feature                   | Description              | Status |
| ------------------------- | ------------------------ | ------ |
| Project Summary Dashboard | Total emissions overview |        |
| Phase-wise Charts         | Emissions by phase       |        |
| Material-wise Charts      | Emissions by material    |        |
| Trend Visualization       | Emissions over time      |        |
| KPI Widgets               | Total CO₂e, hotspots     |        |

---

## 8️⃣ BOQ Import & Bulk Operations

| Feature                | Description                    | Status |
| ---------------------- | ------------------------------ | ------ |
| BOQ Upload             | Upload CSV / PDF BOQ           |        |
| BOQ Parsing            | Extract materials & quantities |        |
| Validation Errors      | Highlight missing materials    |        |
| Mapping UI             | Map BOQ items to catalog       |        |
| Preview Before Import  | Confirm data                   |        |
| Bulk Material Creation | Create materials from BOQ      |        |
| Bulk Assignment        | Assign multiple items at once  |        |

---

## 9️⃣ Reporting & Export

| Feature                 | Description         | Status |
| ----------------------- | ------------------- | ------ |
| Project Emission Report | Full breakdown      |        |
| Phase-wise Report       | Phase emissions     |        |
| Material Impact Report  | Material ranking    |        |
| CSV Export              | Data export         |        |
| PDF Export              | Shareable report    |        |
| Executive Summary       | High-level overview |        |

---

## 🔟 Admin & Governance

| Feature                | Description             | Status |
| ---------------------- | ----------------------- | ------ |
| User Approval Workflow | Admin approves users    |        |
| Role Management        | Change user roles       |        |
| Org Data Isolation     | Strict org-level access |        |
| Data Validation Rules  | Input sanity checks     |        |
| Audit Logs             | Track changes           |        |
| Soft Deletes           | Recoverable deletes     |        |

---

## 1️⃣1️⃣ Security & Compliance

| Feature                   | Description            | Status |
| ------------------------- | ---------------------- | ------ |
| Authentication Security   | Token/session security |        |
| Authorization Enforcement | Backend-enforced RBAC  |        |
| Input Validation          | Prevent invalid data   |        |
| Data Integrity            | No orphan records      |        |
| Export Access Control     | Reports protected      |        |

---

## 1️⃣2️⃣ System Quality Checks

| Feature               | Description            | Status |
| --------------------- | ---------------------- | ------ |
| Error Handling        | Graceful failures      |        |
| Empty State Handling  | No-data scenarios      |        |
| Performance Baseline  | Large project handling |        |
| Mobile Responsiveness | Works on mobile        |        |
| UX Consistency        | Predictable behavior   |        |

---

## 📌 Final Validation Outcome (To be filled by Agent)

* **Total Features**: ___
* **Completed (🟢)**: ___
* **Partial (🟡)**: ___
* **Missing (🔴)**: ___

### 🔍 Gap Summary

* **Critical Gaps**:
* **Medium Gaps**:
* **Low Priority Gaps**:

### 🧭 Recommended Completion Order

1.
2.
3.

---



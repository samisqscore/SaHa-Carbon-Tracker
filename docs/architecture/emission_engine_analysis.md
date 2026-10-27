# Independent Analysis: SaHa Emission Calculation Engine

**Date:** 2026-03-05
**Analyst:** AI Agent (Impartial Review)
**Scope:** Core calculation logic in [server/emissionCalculationService.ts](server/emissionCalculationService.ts) and related data structures.

---

## 1. Methodology Overview
The application uses a multi-factor "plus-plus" model for calculating the embodied carbon of construction materials:
`Total = Material (A1-A3) + Transportation (A4) + Installation (A5) + Waste + Regional Adjustment`

While this structure is conceptually sound and follows basic LCA (Life Cycle Assessment) principles, the current implementation contains several high-impact flaws.

---

## 2. Identified Methodology Gaps & Flaws

### 🚨 Critical Flaw: Inactive Modules (Silent Zeros)
The engine contains logic for Transportation and Installation, but the data required to drive them is either missing from the database or hardcoded to zero.
- **Installation Emissions (A5)**: The `baseInstallationEmissions` value is hardcoded to `0.0` in the main calculation call. This means selecting a "Mechanical" or "Crane" installation method currently adds **zero** emissions to the project. The multipliers (1.2x, 1.3x) are being applied to a zero base.
- **Transportation Factors**: The material-specific `transportFactor` is hardcoded to `0.1`. Furthermore, the transport mode defaults to "Road" for all calculations, ignoring the possibility of maritime or rail transport for global supply chains.

### ❓ Scientific Flaw: Regional Factor Misapplication
The application applies ASHRAE Climate Zone factors (e.g., Zone 1A, 4A) as multipliers to the **Material Production Emissions (A1-A3)**.
- **Issue**: ASHRAE zones describe heating/cooling characteristics of a location. They significantly impact **Operational Carbon (B6)**, but have zero impact on the **Embodied Carbon** of a material produced in a factory elsewhere.
- **Example**: A steel beam produced in a specific factory has the same A1-A3 footprint whether it is used in Miami or Minneapolis. Multiplying its production energy by a local climate factor is scientifically non-standard and artificially inflates/deflates results.
- **Recommendation**: Regional factors should instead reflect **Grid Intensity (kgCO2e/kWh)** of the project location, and should only apply to **Installation (A5)** and **Operational (B)** stages.

### ⚠️ Discrepancy: Frontend vs. Backend Divergence
There is a massive inconsistency between what the UI "tells" the user and what the Engine "calculates."
| Zone | Backend Calculation | Frontend Display Helper | Discrepancy |
|------|---------------------|-------------------------|-------------|
| **1A (Very Hot)** | +5% (1.05) | +15% (1.15) | **10% Error** |
| **6A (Cold)** | +5% (1.05) | -10% (0.90) | **15% Error** |

This leads to a situation where the user sees one factor in the settings but the totals reflect a completely different logic.

---

## 3. Data Integrity & Traceability
### Strengths ✅
- **Immutability**: The use of `snapshotEmissionValue` in `project_materials` is an industry best practice. It ensures that if an emission dataset is updated or deleted, historical reports remain accurate to the time they were generated.
- **Audit Trail**: The `calculation_audits` and `emission_calculations` tables provide a clear non-repudiation log of how every single value was reached.

### Weaknesses ❌
- **Unit Blindness**: The system multiplies `Quantity` by [Factor](shared/schema.ts#556-557) without strict unit validation (e.g., ensuring Quantity is in m³ if the Factor is per m³). While handled by placeholders currently, this is a risk for multi-source data.
- **Dataset Agnosticism**: The engine doesn't distinguish between high-quality EPDs (Level A data) and generic industry averages (Level D data) in its calculation confidence.

---

## 4. Summary of Recommendations

1.  **Harden the Schema**: Add `base_installation_emission` and `transportation_factor` columns to the `emission_factors` table to activate the dormant calculation logic.
2.  **Scientific Realignment**: Move away from ASHRAE multipliers for Embodied Carbon. Replace them with **Regional Grid Factors** that apply only to energy-intensive installation and operations.
3.  **Sync UI/UX**: Standardize the `REGIONAL_FACTORS` map in a `shared/constants.ts` file to ensure the Frontend and Backend are using the same source of truth.
4.  **Transport Modes**: Update the `project_materials` schema to allow users to select a Transportation Mode (Road/Rail/Sea) per material.

---

## Conclusion
The SaHa calculation engine provides a strong foundation for auditing and historical tracking, following EN 15804 and GHG Protocol standards.

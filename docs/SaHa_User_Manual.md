# SaHa Carbon Footprint Tracker: User Manual
**Whole-Life Carbon Intelligence for the Built Environment**

> [!NOTE]
> **Project Heritage Note**: *SaHa Carbon Footprint Tracker was previously developed under the working title **DMBoD** (Decision Modeler for Building Decarbonization). All features and documentation are now unified under the SaHa open-source project.*

Welcome to **SaHa Carbon Footprint Tracker**, the professional-grade open-source carbon intelligence platform designed for Architects, Sustainability Consultants, Structural Engineers, and Project Managers. This manual provides a comprehensive guide to navigating the platform, calculating embodied carbon, and generating decision-grade reports for LEED, BREEAM, and RICS compliance.

---

## Part 1: Quick Start Guide

*Get from a raw Bill of Quantities (BOQ) to a Carbon Intelligence Report in 4 steps.*

### 1. Create your Project
Navigate to the **Projects** tab and click **"Create Project"**. Fill in the name, construction type, total floor area (GFA), and climate zone. This metadata is critical for accurate benchmarking.
> [!NOTE]
> **[SCREENSHOT: PROJECT CREATION DIALOG]** - *A screenshot of the 'New Project' popup showing the mandatory fields like Name, Type, and Area.*

### 2. Prepare your Data (The Normalizer)
Most BOQs are messy. Use the **BOQ Normalizer** in the sidebar to upload your Excel or CSV file. 
- Select the relevant sheet.
- Map your "Material Description" and "Quantity" columns.
- Click **"Analyze & Push"** to move the cleaned data into your project.
> [!NOTE]
> **[SCREENSHOT: BOQ NORMALIZER REVIEW TABLE]** - *A screenshot showing the Review Table with mapped columns and 'Push to Project' button.*

### 3. Map your Materials
Go to the **Materials** tab within your project.
- Use **"Auto-Map"** to let our AI match your items to the Carbon Catalog (ICE, EPD, etc.).
- Review and refine matches manually where needed.
- Add supplier distances to capture **Stage A4 (Transport)** emissions.
> [!NOTE]
> **[SCREENSHOT: MATERIALS MAPPING INTERFACE]** - *A screenshot showing the materials list with 'Mapped' badges and the 'Auto-Map' button.*

### 4. Generate your Report
Open the **Reports** tab. 
- View the **Executive Summary** for a high-level narrative.
- Toggle to **Detailed Mode** for a full material breakdown and transport analysis.
- Click **"Download PDF"** to generate a presentation-ready document for stakeholders.
> [!NOTE]
> **[SCREENSHOT: CARBON INTELLIGENCE REPORT]** - *A screenshot showing the report charts (Hotspots, Phase Breakdown) and the Download PDF button.*

---

## Part 2: Detailed Reference

### 1. Dashboard & Portfolio Analytics
The Dashboard is your organization’s command center. It tracks decarbonization progress across all active and planned projects.
> [!NOTE]
> **[SCREENSHOT: MAIN DASHBOARD VIEW]** - *A full-width screenshot of the dashboard showing KPI cards and the Portfolio Trend chart.*

- **KPI Cards**:
    - **Total Emissions**: Cumulative embodied carbon across your portfolio.
    - **Avg. Intensity (kgCO₂e/m²)**: Your average efficiency compared to industry benchmarks.
    - **Data Quality (%)**: The percentage of materials that have been correctly mapped to emission factors.
- **Project Comparison**: A visual breakdown of which projects are your highest carbon "hotspots."
- **Drill-Down Panels**: Interactive charts showing emissions grouped by lifecycle stage (A1-D) or material category (Concrete, Steel, Timber, etc.).

### 2. Project & Phase Management
SaHa organizes materials into **Project Phases** to align with construction schedules.

- **Creating Phases**: By default, each project includes Foundation, Superstructure, Envelope, Interiors, and MEP.
- **Custom Phases**: You can add or rename phases to match your specific procurement package.
- **Benchmarking**: Each project is automatically compared against LETI (Low Energy Transformation Initiative) and RIBA 2030 Climate Challenge targets based on its typology.

### 3. The BOQ Normalizer
The Normalizer is a standalone utility designed to process real-world construction data.
> [!NOTE]
> **[SCREENSHOT: BOQ NORMALIZER SIDEBAR NAV]** - *A screenshot highlighting the 'BOQ Normalizer' link in the main navigation sidebar.*

- **Multi-Sheet Support**: Upload complex Excel workbooks and select only the sheets containing relevant material quantities.
- **Intelligent Mapping**: The engine identifies the most likely columns for material names and units.
- **Inline Editing**: Fix typos, merge rows, or adjust quantities directly in the review table before pushing to a project.
- **Project Independence**: You can normalize a BOQ and save it to your dashboard before assigning it to a specific project.

### 4. Materials Mapping & The Carbon Catalog
This is the "Engine Room" of the platform, where physical quantities are converted into carbon footprints.

- **The Carbon Catalog**: A unified library combining the ICE Database (Inventory of Carbon and Energy), regional B.E.I factors, and thousands of verified EPDs (Environmental Product Declarations).
- **Auto-Mapping Logic**: Uses advanced pattern matching to find the most specific factor for your materials (e.g., "C30/37 Concrete with 30% GGBS").
- **Logistics & A4 Stage**: 
    - **Supplier Distance**: Enter the distance from the manufacturer to the site.
    - **Transport Mode**: Choose between Road, Rail, Ship, or Air for precise logistics carbon tracking.
- **Waste Factors**: Explicitly set the site waste percentages (e.g., 5% for rebar) to capture A5 stage impacts.
> [!NOTE]
> **[SCREENSHOT: EDIT MATERIAL MODAL]** - *A screenshot of the dialog for editing an individual material item, showing Transport and Waste fields.*

### 5. Interpreting Carbon Intelligence Reports
SaHa reports are "narrative-driven," meaning they explain the data in business-friendly language.

- **Narrative Insights**: Descriptive sentences that explain *why* your project's emissions are high and where the greatest reduction opportunities lie.
- **Benchmark Scale**: A color-coded scale (Excellent to High) showing where your project sits relative to best-practice targets for your building type.
- **Scope 1/2/3**: Clarity on where embodied carbon fits into global GHG Protocol reporting (typically Scope 3).
- **Hotspot Analysis**: A ranking of the top 3 materials or categories that account for the bulk of your carbon footprint.

---

## Part 3: Administration & Data Management

*For Organization Admins and Platform Managers.*

### 1. Organization Setup & Team Management
Effective decarbonization is a team effort. Use the **Organization Dashboard** to manage your workspace.
> [!NOTE]
> **[SCREENSHOT: ORGANIZATION DASHBOARD]** - *A screenshot showing the 'General Details' and 'Team Members' tabs in Organization Settings.*

- **Onboarding Members**: Invite colleagues by email. SaHa enforces a "Closed-Loop" security model, meaning users must be approved by an administrator before they can access project data.
- **User Roles**:
    - **Organization Admin**: Full control over settings, members, and custom emission factors.
    - **Estimator (Standard User)**: Can create projects, import BOQs, and perform material mapping.
    - **Viewer**: Read-only access to dashboards and reports (ideal for senior management or external auditors).

### 2. Managing Data Sources (The Carbon Catalog)
SaHa operates on a "Hybrid Data Model" combining global standards with your organization's specific intelligence.

- **Global Data Sources**: Access a pre-loaded library of thousands of emission factors from the **ICE Database**, **India BEI**, and international **EPD** registries.
- **EPD Data Sync**: For advanced users, the **EPD Sync** tool allows you to mirror the latest approved factors from our central database with a single click.
- **Custom Organization Factors**: Does your supplier provide a specific EPD for their low-carbon concrete? Add it as a **Custom Factor** in your Organization Settings. It will automatically override platform defaults for all your projects.
> [!NOTE]
> **[SCREENSHOT: CUSTOM FACTOR FORM]** - *A screenshot of the 'Add Custom Factor' dialog showing material name, unit, and GWP value fields.*

### 3. Platform Administration (Super-Admins Only)
Platform administrators have high-level oversight of all system activities.
- **User Verification**: Review and approve/reject new registration requests to ensure only authorized personnel access the platform.
- **Dataset Management**: Create and version-control new emission datasets (e.g., "Company Master Factors 2024").
- **Bulk Import**: Upload entire libraries of emission factors via CSV to keep the platform up-to-date with the latest carbon research.
> [!NOTE]
> **[SCREENSHOT: ADMIN PANEL - DATASETS]** - *A screenshot showing the list of global datasets and the 'New Dataset' button.*

---

## Part 4: Professional Standards & Troubleshooting

### Compliance & Standards
SaHa calculations are designed to support professional sustainability assessments:
- **RICS Professional Statement**: Following the RICS "Whole life carbon assessment for the built environment."
- **EN 15804**: Material factors are categorized by lifecycle stages A1-A3, A4-A5, B, C, and D.
- **LEED/BREEAM**: Reports provide the required data points for the "Material & Resources" credits in major building certifications.

### Troubleshooting & Common Pitfalls
| Issue | Cause | Solution |
|--- |--- |--- |
| **Report Understated** | Unmapped Materials | Check the "Materials Analysed" card. If unmapped items exist, run **Auto-Map**. |
| **Intensity shows 0** | Missing GFA | Ensure the "Building Area" is set in Project Settings. |
| **No Benchmark** | Low Benchmarks | Ensure the "Project Type" (e.g. Office) is selected correctly. |
| **Inconsistent Factors** | Dataset Conflict | Check the **Data Sources** in mapping to ensure you are using the correct library version. |

---

### Need Further Assistance?
For technical support or to suggest a new emission factor, please contact your Organization Administrator or open an issue on the SaHa GitHub repository.

# Project Overview: EPD Data Extraction System

This document serves as a technical reference for the EPD (Environmental Product Declaration) Extraction project. The extracted data provides raw material emission factors (lifecycle stages A1 through D), intended for use as input in building-level carbon emission calculations.

## 1. Database Configuration

*   **Database Type:** PostgreSQL
*   **Database Name:** `postgres`
*   **Host:** `localhost`
*   **Default Connection String:** `postgresql://postgres:postgrespassword@localhost:5432/postgres`

## 2. Table Structure & Column Details

The system uses two primary tables to store material information and their associated environmental impacts.

### 2.1 `epd_documents`
Contains metadata for each extracted EPD.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `epd_id` | `SERIAL (PK)` | Unique identifier for the document. |
| `registration_number` | `VARCHAR(100)` | Official EPD registration number (e.g., S-P-01234). |
| `product_name` | `VARCHAR(500)` | Name of the construction material/product. |
| `manufacturer` | `VARCHAR(500)` | Company that produced the material. |
| `validity_date` | `DATE` | Expiration date of the EPD. |
| `declared_unit` | `VARCHAR(200)` | The functional unit (e.g., 1 kg, 1 m2, 1 tonne). |
| `geographical_scope`| `VARCHAR(200)` | Applied region (e.g., Global, Europe, India). |
| `source_url` | `TEXT` | URL link to the original PDF source. |

### 2.2 `impact_indicators`
Stores the numerical emission values for various lifecycle stages.

| Column Name | Type | Description |
| :--- | :--- | :--- |
| `indicator_id` | `SERIAL (PK)` | Unique identifier for the entry. |
| `epd_id` | `INTEGER (FK)` | Links to `epd_documents.epd_id`. |
| `indicator_code` | `VARCHAR(50)` | Short code for the impact (e.g., `GWP-total`). |
| `indicator_name` | `VARCHAR(200)` | Full name (e.g., Global Warming Potential total).|
| `unit` | `VARCHAR(50)` | Unit of measure (e.g., kg CO2 eq.). |
| **Stage A1-A3** | `DECIMAL` | Raw material supply, Transport, Manufacturing. |
| **Stage C1-C4** | `DECIMAL` | De-construction, Transport, Waste processing, Disposal. |
| **Stage D** | `DECIMAL` | Reuse, Recovery, Recycling potential. |

> [!NOTE]
> The schema supports granular stage values (A1, A2, A3, C1, C2, C3, C4) as individual columns, as well as aggregated totals (A1-A3 Total, C1-C4 Total).

## 3. Sample Reference Queries

Use the following queries to extract data for your carbon calculation project.

### Fetching GWP (Global Warming Potential) for all materials
```sql
SELECT 
    d.product_name,
    d.registration_number,
    i.indicator_name,
    i.unit,
    i.a1_a3_total AS "Cradle_to_Gate_A1_A3",
    i.c1_c4_total AS "End_of_Life_C1_C4",
    i.d_value AS "Benefits_Stage_D"
FROM epd_documents d
JOIN impact_indicators i ON d.epd_id = i.epd_id
WHERE i.indicator_code = 'GWP-total'
ORDER BY d.product_name;
```

### Filtering by Manufacturer and Product
```sql
SELECT * FROM epd_documents 
WHERE manufacturer ILIKE '%Saint-Gobain%' 
AND product_name ILIKE '%Glass%';
```

## 4. Work Done So Far

Since the start of the project, we have implemented a robust pipeline for handling EPD data at scale:

1.  **Automated Extraction:** Implemented PDF parsing logic using AI (DeepSeek/Llama) and Regex to extract complex tabular data from EPDs.
2.  **Batch Processing System:** Developed a workflow to process EPDs in batches (50-150 files per batch), allowing for thousands of files to be ingested systematically.
3.  **Database Redesign:** Moved from simple CSV storage to a structured PostgreSQL schema to ensure data integrity and facilitate complex queries.
4.  **Verification Tools:** Created validation scripts to check extraction accuracy and generate summary CSVs for manual review.
5.  **Source Tracking:** Integrated source URL tracking to maintain a link between the database record and the original documentation.

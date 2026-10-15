# Integration Guide: EPD Extractor Database Sync

This guide explains how to integrate the **Carbon Emission Tracker** (or any external agent) with the **EPD Extractor** database to securely pull Environmental Product Declaration (EPD) data for analysis and reporting.

---

## 1. Security & Access Model

To ensure security and data integrity, external applications should connect using a **dedicated read-only user**. This user is restricted to the "Production Area" tables and cannot modify data or access staging logs.

### Step 1: Create the Read-Only User
Run the following SQL on the EPD Extractor PostgreSQL instance:

```sql
-- Create the secure user
CREATE USER epd_readonly WITH PASSWORD 'epd_sync_secret';

-- Grant connection and usage
GRANT CONNECT ON DATABASE postgres TO epd_readonly;
GRANT USAGE ON SCHEMA public TO epd_readonly;

-- Grant SELECT permissions to production tables ONLY
GRANT SELECT ON production_epd_documents TO epd_readonly;
GRANT SELECT ON production_environmental_impacts TO epd_readonly;
```

---

## 2. Connecting to the Database

### Connection URI
**Local (`localhost`):**
`postgresql://epd_readonly:epd_sync_secret@localhost:5432/postgres`

**Remote (Production):**
`postgresql://epd_readonly:epd_sync_secret@<production_ip>:5432/postgres`

---

## 3. Data Schema (Production Area)

The database follows a "Staging-to-Production" architecture. Only validated EPDs are promoted to these tables.

| Table | Description |
| :--- | :--- |
| `production_epd_documents` | Metadata (Product name, registration number, dates, manufacturer) |
| `production_impact_indicators` | Impact values (GWP, ODP, etc.) with pre-calculated lifecycle totals |

---

## 4. Master Data Sync Query

Use this comprehensive query to pull all required fields for the Carbon Emission Tracker. It joins the metadata with the "Global Warming Potential - Total" (GWP) indicator.

```sql
SELECT 
    d.epd_id as external_id,
    d.registration_number as epd_number,
    d.product_name,
    d.manufacturer,
    d.declared_unit,
    d.geographical_scope,
    d.version_date,
    d.validity_date,
    ii.indicator_code,
    ii.unit,
    -- Pre-calculated lifecycle totals from columns
    ii.a1_a3_total as gwp_a1_a3,
    ii.c1_c4_total as gwp_c1_c4,
    ii.d_value as gwp_d
FROM production_epd_documents d
JOIN production_impact_indicators ii ON d.epd_id = ii.epd_id
WHERE ii.indicator_code = 'GWP-total'
ORDER BY d.promoted_at DESC;
```

---

## 5. Incremental Sync Strategy

To sync extra data efficiently as more extraction is completed, your agent should keep track of the `last_synced_id` or `last_synced_time`.

### Example Incremental Query:
```sql
SELECT ... FROM ...
JOIN ...
WHERE d.id > :last_synced_id
  AND ei.indicator_key = 'GWP-total';
```

### Flow Diagram
```mermaid
sequenceDiagram
    participant Tracker as Carbon Tracker Agent
    participant DB as EPD Extractor (Postgres)
    
    Tracker->>DB: Connect as epd_readonly
    DB-->>Tracker: Connection Auth
    Tracker->>DB: SELECT * FROM production_* WHERE id > LAST_SYNC
    DB-->>Tracker: Result Set (Meta + GWP)
    Tracker->>Tracker: Update Emission Records
```

---

## 6. Testing the Connection

You can verify the connection manually using `psql`:

```bash
psql "postgresql://epd_readonly:epd_sync_secret@localhost:5432/postgres" -c "SELECT count(*) FROM production_epd_documents;"
```

> [!NOTE]
> If you receive a "Permission Denied" error, ensure that the grants in Step 1 were executed correctly for the `public` schema.

/**
 * @file epdSync.ts
 * @description Read-only EPD data mirroring service.
 *
 * @strategy
 * - Connects to the EPD Extractor database (EPD_DATABASE_URL env var).
 * - Reads from staging tables: `epd_documents` and `impact_indicators`.
 * - For each EPD, it processes GWP-total for A1-A3, C1-C4, and D stages.
 * - Upserts records into the local `emission_factors` table, splitting stages into separate records.
 * - Includes metadata: Manufacturer, Geographical Scope, Validity Date, and Version (date).
 *
 * @env
 * - EPD_DATABASE_URL: Connection string for the EPD Extractor source database.
 */

import pg from "pg";
import { db } from "./db";
import { emissionFactors, emissionDatasets } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const { Pool } = pg;

// ────────────────────────────────────────────────────────────
// Types matching the EPD Extractor staging schema
// ────────────────────────────────────────────────────────────
interface SourceEpdRow {
    epd_id: number;
    registration_number: string;
    product_name: string;
    manufacturer: string | null;
    geographical_scope: string | null;
    version_date: string | null;
    validity_date: string | null;
    declared_unit: string | null;
    indicator_code: string;
    unit: string;
    a1_a3_total: number | null;
    c1_c4_total: number | null;
    d_value: number | null;
}

export interface SyncResult {
    inserted: number;
    updated: number;
    skipped: number;
    errors: string[];
    durationMs: number;
}

// ────────────────────────────────────────────────────────────
// Unit normalizer — map EPD unit to our schema unit
// ────────────────────────────────────────────────────────────
function normalizeUnit(unit: string): string {
    const parts = unit.split("/");
    if (parts.length > 1) {
        let denom = parts[1].trim().toLowerCase();
        if (denom === "kg") return "kg";
        if (denom === "m3" || denom === "cubic meter") return "m3";
        if (denom === "tonne" || denom === "t") return "tonne";
        return denom;
    }
    return unit.trim();
}

// ────────────────────────────────────────────────────────────
// Main sync function
// ────────────────────────────────────────────────────────────
export async function syncEpdData(): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = { inserted: 0, updated: 0, skipped: 0, errors: [], durationMs: 0 };

    const epdDbUrl = process.env.EPD_DATABASE_URL;
    if (!epdDbUrl) {
        result.errors.push("EPD_DATABASE_URL is not set. Skipping EPD sync.");
        result.durationMs = Date.now() - startTime;
        return result;
    }

    // ── Resolve the local "Digital EPD" Dataset record ──────────
    let epdDatasetId: string;
    const [existingDataset] = await db
        .select()
        .from(emissionDatasets)
        .where(eq(emissionDatasets.name, "Digital EPD"))
        .limit(1);

    if (existingDataset) {
        epdDatasetId = existingDataset.id;
    } else {
        const [created] = await db
            .insert(emissionDatasets)
            .values({
                name: "Digital EPD",
                description: "Digital Environmental Product Declaration (EPD) data source. GWP Total factors with full metadata.",
                region: "Global",
                version: "2.0",
                isDefault: false,
                status: "active",
            })
            .returning();
        epdDatasetId = created.id;
        console.log(`[EPD Sync] Created EPD dataset record: ${epdDatasetId}`);
    }

    // ── Connect to source EPD DB ──────────────────────────────
    const sourcePool = new Pool({
        connectionString: epdDbUrl,
        max: 2,
    });

    let client;
    try {
        client = await sourcePool.connect();

        // ── Query source staging tables ───────────────────────
        const sourceQuery = `
            SELECT 
                d.epd_id, 
                d.registration_number, 
                d.product_name, 
                d.manufacturer,
                d.geographical_scope,
                d.version_date::text as version_date,
                d.validity_date::text as validity_date,
                d.declared_unit,
                ii.indicator_code, 
                ii.unit, 
                ii.a1_a3_total, 
                ii.c1_c4_total, 
                ii.d_value 
            FROM epd_documents d 
            JOIN impact_indicators ii ON d.epd_id = ii.epd_id 
            WHERE ii.indicator_code = 'GWP-total'
        `;

        const { rows } = await client.query<SourceEpdRow>(sourceQuery);
        console.log(`[EPD Sync] Found ${rows.length} EPD GWP rows in staging.`);

        for (const row of rows) {
            const stagesToProcess: Array<{ stage: "A1-A3" | "C1-C4" | "D"; value: number | null }> = [
                { stage: "A1-A3", value: row.a1_a3_total },
                { stage: "C1-C4", value: row.c1_c4_total },
                { stage: "D", value: row.d_value },
            ];

            const versionStr = row.version_date ? row.version_date.slice(0, 10) : "unknown";

            for (const item of stagesToProcess) {
                if (item.value === null || isNaN(item.value)) continue;
                if (item.value === 0 && item.stage !== "D") continue; // Stage D can be positive/negative benefit

                try {
                    // Composite Reference Pattern: EPD:{reg}:{version}:{stage}
                    const sourceRef = `EPD:${row.registration_number}:${versionStr}:${item.stage}`;
                    const materialName = row.product_name?.trim();
                    if (!materialName) continue;

                    const factorData = {
                        materialName,
                        materialCategory: null,
                        emissionFactor: item.value,
                        unit: normalizeUnit(row.unit),
                        emissionUnit: "kgCO2e",
                        datasetId: epdDatasetId,
                        sourceReference: sourceRef,
                        scope: "platform" as const,
                        ghgScope: "scope3" as const,
                        lifecycleStage: item.stage,
                        isActive: true,
                        
                        // Enhanced Metadata
                        manufacturer: row.manufacturer,
                        epdNumber: row.registration_number,
                        validityDate: row.validity_date ? new Date(row.validity_date) : null,
                        geographicalScope: row.geographical_scope,
                        versionInfo: versionStr,
                    };

                    const [existing] = await db
                        .select({ id: emissionFactors.id })
                        .from(emissionFactors)
                        .where(
                            and(
                                eq(emissionFactors.sourceReference, sourceRef),
                                eq(emissionFactors.scope, "platform")
                            )
                        )
                        .limit(1);

                    if (existing) {
                        await db
                            .update(emissionFactors)
                            .set({ ...factorData, updatedAt: new Date() } as any)
                            .where(eq(emissionFactors.id, existing.id));
                        result.updated++;
                    } else {
                        await db.insert(emissionFactors).values(factorData);
                        result.inserted++;
                    }
                } catch (rowErr: any) {
                    result.errors.push(`Row ${row.registration_number} (${item.stage}): ${rowErr.message}`);
                }
            }
        }
    } catch (err: any) {
        result.errors.push(`Source DB Access failed: ${err.message}`);
    } finally {
        client?.release();
        await sourcePool.end();
    }

    result.durationMs = Date.now() - startTime;
    console.log(`[EPD Sync] Complete - ${result.inserted} new, ${result.updated} updated, ${result.errors.length} errors.`);
    return result;
}

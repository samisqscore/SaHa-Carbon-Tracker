
import { db } from "./db";
import { emissionFactors, emissionDatasets } from "@shared/schema";
import { eq, and, or, isNull, desc, SQL, lt, lte, gt, gte, sql } from "drizzle-orm";


export interface EmissionFactorResolution {
    factor: number;
    source: string;
    unit: string;
    scope: 'platform' | 'organization';
    emissionFactorId: string;
}

/**
 * Resolves the emission factor for a given material name within an organization's context.
 * Implements the Hybrid Architecture Priority + Lifecycle Rules:
 * 1. Organization Override (Active, Valid, Production)
 * 2. Platform Default (Active, Valid, Production)
 * 
 * @param materialName The name of the material to resolve
 * @param organizationId The ID of the organization context
 * @param environment The target environment (default 'production')
 * @returns The resolved emission factor or null if not found
 */
export async function resolveEmissionFactor(
    materialName: string,
    organizationId: string,
    environment: "production" | "test" = "production"
): Promise<EmissionFactorResolution | null> {
    const normalizedName = materialName.trim();
    const now = new Date();

    // Query with JOIN to check dataset lifecycle status
    const query = db.select({
        factor: emissionFactors,
        dataset: emissionDatasets
    })
        .from(emissionFactors)
        .innerJoin(emissionDatasets, eq(emissionFactors.datasetId, emissionDatasets.id))
        .where(and(
            // P5 FIX: Case-insensitive match using LOWER() to prevent silent zero-emissions on case mismatches
            sql`LOWER(${emissionFactors.materialName}) = LOWER(${normalizedName})`,
            eq(emissionFactors.isActive, true),
            // Lifecycle Rule: Status must be active (Manifesto Phase 4)
            eq(emissionDatasets.status, "active"),
            // Environment Match (D10)
            eq(emissionDatasets.environment, environment),
            // Validity Window (Manifesto Rule)
            lte(emissionDatasets.validityStart, now),
            or(
                isNull(emissionDatasets.validityEnd),
                gte(emissionDatasets.validityEnd, now)
            ),
            // Scoping
            or(
                isNull(emissionDatasets.organizationId), // Platform
                eq(emissionDatasets.organizationId, organizationId) // Org Specific
            )
        ));

    const results = await query;

    if (results.length === 0) return null;

    // Sorting Logic: Priority to Organization Specific Factors
    const sorted = results.sort((a, b) => {
        const aIsOrg = !!a.dataset.organizationId;
        const bIsOrg = !!b.dataset.organizationId;
        if (aIsOrg && !bIsOrg) return -1;
        if (!aIsOrg && bIsOrg) return 1;
        return 0;
    });

    const bestMatch = sorted[0];

    return {
        factor: bestMatch.factor.emissionFactor,
        source: `${bestMatch.factor.sourceReference} (${bestMatch.dataset.organizationId ? 'organization' : 'platform'})`,
        unit: bestMatch.factor.unit,
        scope: bestMatch.dataset.organizationId ? 'organization' : 'platform',
        emissionFactorId: bestMatch.factor.id
    };
}

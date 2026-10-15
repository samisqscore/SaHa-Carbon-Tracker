/**
 * @file climateFactors.ts
 * @description Single source of truth for ASHRAE climate zone data.
 *
 * IMPORTANT: This file is imported by BOTH the backend calculation engine and
 * the frontend UI. Any change here affects both simultaneously.
 *
 * These multipliers represent construction-phase energy adjustments only.
 * They should be applied to A4-A5 energy costs, NOT to A1-A3 material production.
 *
 * Keys MUST match the ASHRAE format enforced by the schema: /^[1-8][A-C]$/
 */

export const REGIONAL_FACTORS: Record<string, number> = {
    '1A': 1.05, // Very Hot-Humid (Miami)
    '1B': 1.03, // Very Hot-Dry (Phoenix)
    '2A': 1.02, // Hot-Humid (Houston)
    '2B': 1.01, // Hot-Dry (Tucson)
    '3A': 1.00, // Warm-Humid (Atlanta) — baseline
    '3B': 0.99, // Warm-Dry (Las Vegas)
    '3C': 0.98, // Warm-Marine (San Francisco)
    '4A': 1.00, // Mixed-Humid (New York)
    '4B': 0.99, // Mixed-Dry (Albuquerque)
    '4C': 0.97, // Mixed-Marine (Seattle)
    '5A': 1.02, // Cool-Humid (Chicago)
    '5B': 1.01, // Cool-Dry (Denver)
    '5C': 0.98, // Cool-Marine (Vancouver)
    '6A': 1.05, // Cold-Humid (Minneapolis)
    '6B': 1.03, // Cold-Dry (Helena)
    '7A': 1.08, // Very Cold (Duluth)
    '8A': 1.12, // Subarctic (Fairbanks)
};

/** Human-readable descriptions for every ASHRAE zone code */
export const CLIMATE_ZONE_LABELS: Record<string, string> = {
    '1A': '1A — Very Hot, Humid',
    '1B': '1B — Very Hot, Dry',
    '2A': '2A — Hot, Humid',
    '2B': '2B — Hot, Dry',
    '3A': '3A — Warm, Humid',
    '3B': '3B — Warm, Dry',
    '3C': '3C — Warm, Marine',
    '4A': '4A — Mixed, Humid',
    '4B': '4B — Mixed, Dry',
    '4C': '4C — Mixed, Marine',
    '5A': '5A — Cool, Humid',
    '5B': '5B — Cool, Dry',
    '5C': '5C — Cool, Marine',
    '6A': '6A — Cold, Humid',
    '6B': '6B — Cold, Dry',
    '7A': '7A — Very Cold',
    '8A': '8A — Subarctic',
};

/** All valid ASHRAE zone codes in display order */
export const CLIMATE_ZONE_CODES = Object.keys(CLIMATE_ZONE_LABELS);

/**
 * Returns the regional factor for a given climate zone.
 * Defaults to 1.0 (no adjustment) if zone is null or unrecognised.
 */
export function getRegionalFactor(climateZone: string | null): number {
    if (!climateZone) return 1.0;
    return REGIONAL_FACTORS[climateZone] ?? 1.0;
}

/**
 * Returns the human-readable label for a climate zone code.
 * Falls back to the raw code if not found.
 */
export function getClimateZoneLabel(climateZone: string | null): string {
    if (!climateZone) return 'Not specified';
    return CLIMATE_ZONE_LABELS[climateZone] ?? climateZone;
}

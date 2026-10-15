/**
 * @file emissions.ts
 * @description Shared utilities for emission unit conversion and formatting.
 * 
 * @conversion
 * - All database values are in kgCO2e.
 * - All display values are in tCO2e (tonnes).
 */

/**
 * Converts kgCO2e to tCO2e (tonnes).
 * @param kg - Value in kgCO2e
 * @returns Value in tCO2e
 */
export function kgToTonnes(kg: number): number {
    return kg / 1000;
}

/**
 * Formats a tonne value for display with appropriate decimals and unit.
 * @param tonnes - Value in tCO2e
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted string (e.g., "1.23 tCO2e")
 */
export function formatTonnes(tonnes: number, decimals: number = 2): string {
    // Use toFixed but remove trailing zeros if it's a whole number
    const formatted = tonnes.toFixed(decimals);
    return `${parseFloat(formatted).toLocaleString()} tCO₂e`;
}

// ── EN 15804 Lifecycle Stage Colours ────────────────────────────────────
export const LIFECYCLE_COLORS: Record<string, string> = {
    "A1-A3": "#2563eb", // Product stage — blue
    "A4-A5": "#0891b2", // Construction process — cyan
    "B": "#16a34a",     // Use stage — green
    "C1-C4": "#d97706", // End-of-life — amber
    "D": "#7c3aed",     // Beyond boundary — purple
};

export const LIFECYCLE_LABELS: Record<string, string> = {
    "A1-A3": "A1-A3 Product",
    "A4-A5": "A4-A5 Construction",
    "B": "B Use",
    "C1-C4": "C1-C4 End-of-Life",
    "D": "D Beyond Boundary",
};

// ── Material Category Colours ───────────────────────────────────────────
export const CATEGORY_COLORS: Record<string, string> = {
    // Structure
    "CONCRETE": "#3b82f6", // Blue
    "STEEL": "#4f46e5", // Indigo
    "METAL": "#6366f1",
    "REINFORCED CONCRETE": "#1d4ed8",

    // Envelope & Finish
    "TIMBER/WOOD": "#ea580c", // Orange
    "BRICK": "#dc2626", // Red
    "GLASS": "#0ea5e9", // Sky
    "INSULATION": "#10b981", // Emerald
    "PLASTIC": "#f43f5e", // Rose
    "FLOOR FINISHES": "#8b5cf6", // Violet
    "CEILING FINISHES": "#a855f7", // Purple
    "WALL FINISHES": "#d946ef", // Fuchsia

    // MEP (The overlapping ones)
    "MECHANICAL SYSTEMS": "#0891b2", // Cyan
    "ELECTRICAL SYSTEMS": "#f59e0b", // Amber
    "PLUMBING SYSTEMS": "#06b6d4", // Cyan
    "HVAC": "#0d9488", // Teal

    // Others
    "EXCAVATION": "#78350f", // Brown
    "LANDSCAPING": "#22c55e", // Green
    "ROOFING": "#EF4444",
    "FINISHING": "#EC4899",
    "AGGREGATE": "#84CC16",
    "UNCATEGORIZED": "#94a3b8",
    "OTHER": "#64748b",
};

/**
 * Gets a consistent color for a category.
 * If not in CATEGORY_COLORS, generates a deterministic HSL color based on the string.
 */
export function getCategoryColor(category: string): string {
    if (!category) return CATEGORY_COLORS["OTHER"];
    const normalized = category.toUpperCase().trim();
    if (CATEGORY_COLORS[normalized]) {
        return CATEGORY_COLORS[normalized];
    }

    // Deterministic HSL generation
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        hash = normalized.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash % 360);
    // Keep saturation and lightness in a premium range
    return `hsl(${hue}, 65%, 45%)`;
}

// ── Data Quality Thresholds ─────────────────────────────────────────────
export const QUALITY_THRESHOLDS = {
    GREEN: 85,
    AMBER: 60,
};

// ── Brand & UI Colours ───────────────────────────────────────────────────
export const BRAND_COLORS = {
    CHART_PRIMARY: '#0F62FE', // Blue-600
    CHART_SECONDARY: '#8884d8', // Default Recharts Purple
};

/**
 * Returns a hex colour code based on mapping quality percentage.
 * @param percent - 0-100 percentage of mapped materials
 * @returns hex colour string
 */
export function getQualityColor(percent: number): string {
    if (percent >= QUALITY_THRESHOLDS.GREEN) return '#16a34a'; // Green 600
    if (percent >= QUALITY_THRESHOLDS.AMBER) return '#d97706'; // Amber 600
    return '#dc2626'; // Red 600
}

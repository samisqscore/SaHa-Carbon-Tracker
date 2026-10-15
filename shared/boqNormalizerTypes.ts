/**
 * BOQ Normalizer — Shared Types
 *
 * Used by both client (BOQNormalizer components) and server (boqNormalizer.ts + routes.ts).
 * These types define the data contracts for the normalizer pipeline:
 *   Parse → Interpret → Review → Push
 */

export interface RawBoqRow {
    rowIndex: number;
    slNo: string;
    description: string;
    unit: string;
    quantity: string | number | null; // 'QRO' | number | null
    sheetName: string;
    sectionHeader: string;      // last section header seen above this row
    parentDescription: string;  // description of parent item (e.g. CA1 for CA1a)
    isQro: boolean;
    sourceFilename?: string;    // NEW: for trace-back
}

export interface EnrichedBoqRow extends RawBoqRow {
    primaryMaterial: string;
    materialCategory: string;
    lifecycleStageEn15804: 'A1-A3' | 'A4' | 'A5' | 'B1-B7' | 'C1-C4' | 'D';
    grade: string | null;
    confidence: number;          // 0–1
    aiNotes: string | null;
    selected: boolean;           // user selection for push
    editedByUser: boolean;       // true if user changed any AI field

    // Mapping fields
    matchedMaterialId?: string;
    matchedMaterialName?: string;
    lifecycleStage?: string;
}

export interface NormalizerParseResponse {
    projectMeta: {
        client: string | null;
        location: string | null;
        buildingElements: string[];
    };
    sheets: Array<{ name: string; rowCount: number; isBoqSheet: boolean }>;
    rows: RawBoqRow[];
}

export interface NormalizerPushPayload {
    rows: EnrichedBoqRow[];
    projectId?: string;
    newProject?: {
        name: string;
        location: string;
        type: string;
    };
    orgId: string;
}

export interface NormalizerPushResponse {
    inserted: number;
    projectId: string;
    projectName: string;
}

/** Allowed material categories for AI classification */
export const MATERIAL_CATEGORIES = [
    'Concrete - Plain (PCC)',
    'Concrete - Reinforced (RCC)',
    'Concrete - Floor Hardener',
    'Concrete - Kerb',
    'Steel - Reinforcement Bars',
    'Steel - Structural',
    'Steel - Dowel Bars',
    'Masonry - Fly Ash Brick',
    'Masonry - Solid Concrete Block',
    'Masonry - Brick',
    'Earthwork - Excavation',
    'Earthwork - Filling',
    'Subbase - Granular / WMM',
    'Aggregate - Sand',
    'Waterproofing',
    'Finishes - Plastering',
    'Finishes - Paint',
    'Finishes - Tiles',
    'Finishes - Stone',
    'Paving - Interlocking Concrete Pavers',
    'Plastic - Pipe / Membrane',
    'Metal - Grating / Manhole',
    'Chemical - Anti-Termite Treatment',
    'Road Marking',
    'Signage',
    'Joinery',
    'General - Civil Works',
] as const;

export type MaterialCategory = typeof MATERIAL_CATEGORIES[number];

/** Allowed lifecycle stages per EN 15804 */
export const LIFECYCLE_STAGES = ['A1-A3', 'A4', 'A5', 'B1-B7', 'C1-C4', 'D'] as const;
export type LifecycleStage = typeof LIFECYCLE_STAGES[number];

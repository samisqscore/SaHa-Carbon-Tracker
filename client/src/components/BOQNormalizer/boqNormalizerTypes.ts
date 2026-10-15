/**
 * BOQ Normalizer — Client Types
 * Re-exports from shared types for cleaner imports within client components.
 */
export type {
    RawBoqRow,
    EnrichedBoqRow,
    NormalizerParseResponse,
    NormalizerPushPayload,
    NormalizerPushResponse,
    MaterialCategory,
    LifecycleStage,
} from '@shared/boqNormalizerTypes';

export {
    MATERIAL_CATEGORIES,
    LIFECYCLE_STAGES,
} from '@shared/boqNormalizerTypes';

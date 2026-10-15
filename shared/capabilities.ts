/**
 * @file capabilities.ts
 * @description Centralized permission logic for "Feature Flags" or "Capabilities".
 * This abstraction allows us to decouple "User Role" from "What they can do".
 * 
 * If the business model changes (e.g., "Free Trial now gets PDF Import"),
 * we only update this file, not the entire codebase.
 */

import { User } from "./schema";

export type Capability =
    | 'import_boq_basic'      // Excel/CSV
    | 'import_boq_smart'      // Fuzzy matching, AI assistance
    | 'import_boq_pdf'        // PDF extraction
    | 'manage_organization'   // Create orgs, invite users
    | 'export_reports_csv'    // Download CSV
    | 'export_reports_pdf';   // Download/Print PDF

/**
 * Checks if a user has a specific capability.
 * @param user The user object (can be null/undefined)
 * @param action The capability to check
 */
export function can(user: User | null | undefined, action: Capability): boolean {
    if (!user) return false;

    // Admin has god mode
    if ((user.role as string) === 'admin') return true;

    switch (action) {
        case 'import_boq_basic':
            // Everyone (even standard users) can import basic Excel
            return true;

        case 'import_boq_smart':
            // Currently: Only Admins & Managers (Enterprise logic placeholder)
            // Future: Check `user.plan === 'enterprise'`
            // For now, we'll allow 'admin' and 'estimator' (who might be power users)
            return (user.role as string) === 'admin' || (user.role as string) === 'estimator';

        case 'import_boq_pdf':
            // Strictly Enterprise feature
            return (user.role as string) === 'admin' || (user.role as string) === 'estimator';

        case 'manage_organization':
            // Only global admins can create/manage organizations top-level for now
            return (user.role as string) === 'admin';

        case 'export_reports_csv':
            return true;

        case 'export_reports_pdf':
            return true;

        default:
            return false;
    }
}

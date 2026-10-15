
import cron from "node-cron";
import { db } from "./db";
import { emissionDatasets, emissionFactors } from "@shared/schema";
import { eq, and, lt, isNotNull } from "drizzle-orm";

/**
 * Datasource Agent - Phase 4: Lifecycle Engine
 * Background job to auto-archive datasets past their validity_end date.
 * Runs every day at midnight.
 */
export function setupCronJobs() {
    cron.schedule("0 0 * * *", async () => {
        console.log("[CRON] Checking for expired datasets...");
        const now = new Date();

        try {
            // 1. Find all 'active' datasets where validityEnd < now
            const expiredDatasets = await db.select()
                .from(emissionDatasets)
                .where(and(
                    eq(emissionDatasets.status, "active"),
                    isNotNull(emissionDatasets.validityEnd),
                    lt(emissionDatasets.validityEnd, now)
                ));

            if (expiredDatasets.length === 0) {
                console.log("[CRON] No expired datasets found.");
                return;
            }

            console.log(`[CRON] Found ${expiredDatasets.length} expired datasets. Archiving...`);

            for (const dataset of expiredDatasets) {
                await db.transaction(async (tx) => {
                    // A. Update Dataset Status
                    await tx.update(emissionDatasets)
                        .set({ status: "archived", updatedAt: new Date() })
                        .where(eq(emissionDatasets.id, dataset.id));

                    // B. Deactivate all associated factors (Manifesto D5)
                    await tx.update(emissionFactors)
                        .set({ isActive: false })
                        .where(eq(emissionFactors.datasetId, dataset.id));
                });
                console.log(`[CRON] Archived dataset: ${dataset.name} (${dataset.id})`);
            }
        } catch (error) {
            console.error("[CRON] Error during auto-archiving:", error);
        }
    });

    console.log("[CRON] Lifecycle engine cron jobs scheduled.");
}

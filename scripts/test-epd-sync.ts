import dotenv from "dotenv";
dotenv.config();

import { syncEpdData } from "../server/epdSync";
import { db } from "../server/db";
import { emissionFactors, emissionDatasets } from "../shared/schema";
import { eq } from "drizzle-orm";

async function runTest() {
    console.log("🚀 Starting EPD Sync Test...");
    
    try {
        const result = await syncEpdData();
        
        console.log("\n📊 Sync Results:");
        console.log(`- Inserted: ${result.inserted}`);
        console.log(`- Updated: ${result.updated}`);
        console.log(`- Skipped: ${result.skipped}`);
        console.log(`- Errors: ${result.errors.length}`);
        console.log(`- Duration: ${result.durationMs}ms`);

        if (result.errors.length > 0) {
            console.log("\n❌ Sample Errors:");
            result.errors.slice(0, 5).forEach(err => console.log(`  - ${err}`));
        }

        // Verify Data in DB
        const dataset = await db.select().from(emissionDatasets).where(eq(emissionDatasets.name, "Digital EPD")).limit(1);
        if (dataset.length > 0) {
            const factors = await db.select().from(emissionFactors).where(eq(emissionFactors.datasetId, dataset[0].id)).limit(5);
            console.log("\n✅ Sample Synced Factors:");
            factors.forEach(f => {
                console.log(`  - [${f.lifecycleStage}] ${f.materialName} (${f.epdNumber}): ${f.emissionFactor} ${f.unit}`);
            });
        } else {
            console.log("\n❌ Digital EPD dataset not found in database!");
        }

    } catch (error) {
        console.error("\n💥 Sync failed with fatal error:", error);
    } finally {
        process.exit(0);
    }
}

runTest();

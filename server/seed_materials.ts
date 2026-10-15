
import "dotenv/config";
import { db } from "./db";
import { emissionDatasets, emissionFactors } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * @deprecated One-time seed script.
 * Updated to use the current emissionFactors table.
 * The old `materials` + `materialEmissionFactors` tables were removed in the Hybrid Architecture migration.
 *
 * This script seeds the default "ICE v3 (2019)" emission dataset
 * and pre-loads standard construction materials as platform-scoped emission factors.
 */
async function seed() {
    console.log("🌱 Starting seed...");

    // 1. Create a default Emission Dataset
    let [dataset] = await db.select().from(emissionDatasets).where(eq(emissionDatasets.name, "ICE v3 (2019)"));

    if (!dataset) {
        console.log("Creating default dataset: ICE v3 (2019)");
        [dataset] = await db.insert(emissionDatasets).values({
            name: "ICE v3 (2019)",
            region: "Global",
            description: "Inventory of Carbon and Energy",
            version: "3.0",
            isDefault: true,
        }).returning();
    }

    // 2. Define standard materials as emissionFactors
    const standardFactors = [
        { materialName: "Concrete M20", materialCategory: "Concrete", unit: "m3", emissionFactor: 240.0 },
        { materialName: "TMT Steel", materialCategory: "Metals", unit: "kg", emissionFactor: 1.85 },
        { materialName: "Cement OPC", materialCategory: "Cement", unit: "kg", emissionFactor: 0.85 },
        { materialName: "Clay Bricks", materialCategory: "Masonry", unit: "nos", emissionFactor: 0.5 },
        { materialName: "Clear Glass", materialCategory: "Glass", unit: "m2", emissionFactor: 15.0 },
        { materialName: "Timber (Softwood)", materialCategory: "Timber", unit: "m3", emissionFactor: 110.0 },
        { materialName: "Gypsum Plaster", materialCategory: "Finishes", unit: "m2", emissionFactor: 3.5 },
    ];

    for (const factor of standardFactors) {
        // Check if already exists by name in this dataset
        const [existing] = await db
            .select()
            .from(emissionFactors)
            .where(eq(emissionFactors.materialName, factor.materialName))
            .limit(1);

        if (!existing) {
            console.log(`Inserting factor: ${factor.materialName}`);
            await db.insert(emissionFactors).values({
                materialName: factor.materialName,
                materialCategory: factor.materialCategory,
                unit: factor.unit,
                emissionFactor: factor.emissionFactor,
                emissionUnit: "kgCO2e",
                datasetId: dataset.id,
                sourceReference: "ICE v3 Database (2019)",
                scope: "platform",
                ghgScope: "scope3",
                lifecycleStage: "A1-A3",
                isActive: true,
            });
        } else {
            console.log(`Skipping existing: ${factor.materialName}`);
        }
    }

    console.log("✅ Seeding complete!");
    process.exit(0);
}

seed().catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
});

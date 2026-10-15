import dotenv from "dotenv";
import path from "path";
// Load env before anything else
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { eq } from "drizzle-orm";

/**
 * @deprecated One-time Manifesto migration script.
 * Updated to use emissionFactors + emissionDatasets tables.
 * The old `materials` + `materialEmissionFactors` tables were removed in the Hybrid Architecture migration.
 *
 * This script:
 * 1. Ensures the ICE and India BEI emission datasets exist.
 * 2. Checks that platform-scoped emission factors are present (idempotent).
 */
async function main() {
    console.log("🌍 Starting Manifesto Migration...");
    console.log("Debug: CWD is", process.cwd());
    console.log("Debug: DATABASE_URL is", process.env.DATABASE_URL ? "Set" : "Unset");

    // Dynamic import to ensure env is loaded before db initialises
    const { db } = await import("../db");
    const { emissionDatasets, emissionFactors } = await import("@shared/schema");

    // 1. Ensure Datasets Exist
    console.log("👉 Seeding Emission Datasets...");

    let iceDataset = await db.query.emissionDatasets.findFirst({
        where: eq(emissionDatasets.name, "ICE")
    });

    if (!iceDataset) {
        const [inserted] = await db.insert(emissionDatasets).values({
            name: "ICE",
            region: "Global",
            description: "Inventory of Carbon & Energy (ICE) Database",
            version: "3.0",
            isDefault: true,
        }).returning();
        iceDataset = inserted;
        console.log("✅ Created ICE Dataset");
    } else {
        console.log("ℹ️ ICE Dataset already exists");
    }

    let indiaDataset = await db.query.emissionDatasets.findFirst({
        where: eq(emissionDatasets.name, "India BEI")
    });

    if (!indiaDataset) {
        await db.insert(emissionDatasets).values({
            name: "India BEI",
            region: "India",
            description: "Building Emissions Initiative (India) Factors",
            version: "1.0",
            isDefault: false,
        });
        console.log("✅ Created India BEI Dataset");
    } else {
        console.log("ℹ️ India BEI Dataset already exists");
    }

    // 2. Count existing platform emission factors linked to ICE
    console.log("👉 Checking Platform Emission Factors...");
    const allICEFactors = await db
        .select()
        .from(emissionFactors)
        .where(eq(emissionFactors.datasetId, iceDataset!.id));

    console.log(`Found ${allICEFactors.length} emission factors linked to ICE dataset.`);

    if (allICEFactors.length === 0) {
        console.log("⚠️  No factors found. Run seed_materials.ts to populate platform emission factors.");
    } else {
        console.log(`✅ ${allICEFactors.length} factors already present. No migration needed.`);
    }

    console.log("🎉 Manifesto Migration Complete!");
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Migration Failed:", err);
    process.exit(1);
});

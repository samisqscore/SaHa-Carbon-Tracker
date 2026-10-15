
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as dotenv from "dotenv";
import { emissionDatasets, emissionFactors } from "../shared/schema.js";

dotenv.config();

if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL must be set");
}

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

async function main() {
    console.log("🌱 Seeding Global Data...");

    // 1. Create Datasets
    console.log("Creating Datasets...");
    const [indiaBEI] = await db.insert(emissionDatasets).values({
        name: "India BEI 2024",
        region: "India",
        description: "Bureau of Energy Efficiency - Official India Construction Factors",
        version: "2024.1",
        isDefault: true,
    }).returning();

    const [iceV3] = await db.insert(emissionDatasets).values({
        name: "ICE v3",
        region: "UK/Global",
        description: "Inventory of Carbon & Energy (University of Bath)",
        version: "3.0",
        isDefault: false,
    }).returning();

    // 2. Insert Factors (India BEI)
    console.log("Inserting India BEI Factors...");
    await db.insert(emissionFactors).values([
        {
            materialName: "Concrete (M30)",
            materialCategory: "Concrete",
            unit: "m3",
            emissionFactor: 2400 * 0.13, // approx 312 kgCO2e/m3
            datasetId: indiaBEI.id,
            sourceReference: "India BEI 2024",
            scope: "platform",
        },
        {
            materialName: "Reinforcement Steel",
            materialCategory: "Steel",
            unit: "kg",
            emissionFactor: 1.85,
            datasetId: indiaBEI.id,
            sourceReference: "India BEI 2024",
            scope: "platform",
        },
        {
            materialName: "Brick (Red Clay)",
            materialCategory: "Masonry",
            unit: "kg",
            emissionFactor: 0.22,
            datasetId: indiaBEI.id,
            sourceReference: "India BEI 2024",
            scope: "platform",
        },
        {
            materialName: "Glass (Float)",
            materialCategory: "Glazing",
            unit: "kg",
            emissionFactor: 1.1,
            datasetId: indiaBEI.id,
            sourceReference: "India BEI 2024",
            scope: "platform",
        }
    ]);

    // 3. Insert Factors (ICE v3)
    console.log("Inserting ICE v3 Factors...");
    await db.insert(emissionFactors).values([
        {
            materialName: "Concrete (C30/37)",
            materialCategory: "Concrete",
            unit: "m3",
            emissionFactor: 2400 * 0.108, // approx 259 (UK is more efficient)
            datasetId: iceV3.id,
            sourceReference: "ICE v3",
            scope: "platform",
        },
        {
            materialName: "Reinforcement Steel",
            materialCategory: "Steel",
            unit: "kg",
            emissionFactor: 1.99, // global avg often higher than local electric arc
            datasetId: iceV3.id,
            sourceReference: "ICE v3",
            scope: "platform",
        }
    ]);

    console.log("✅ Seeding Complete!");
    process.exit(0);
}

main().catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
});

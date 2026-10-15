import "dotenv/config";
import { processStandardBOQ } from "../server/boqProcessing";
import { storage } from "../server/storage";
import fs from "fs";
import path from "path";

async function run() {
    console.log("🔍 Starting BOQ Logic Verification...");

    // 1. Create a sample CSV
    const filePath = path.join(process.cwd(), "sample_boq.csv");
    const csvContent = `Item Code,Material Description,Qty,UoM
1.1,M25 Concrete Foundation,150,m3
1.2,Structural Steel,2500,kg
2.1,Unknown Material X,10,nr`;

    fs.writeFileSync(filePath, csvContent);
    console.log("📄 Created sample_boq.csv with fuzzy headers (Item Code, Material Description, Qty, UoM)");

    // Seed a material to ensure match works
    const existing = await storage.getMaterials();
    if (!existing.find(m => m.name.includes("Structural Steel"))) {
        console.log("🌱 Seeding 'Structural Steel - Generic' for testing...");
        await storage.createMaterial({
            name: "Structural Steel - Generic",
            category: "Metals",
            unit: "kg",
            emissionFactor: 1.5,
            displayId: "MTL-001"
        } as any);
    }
    if (!existing.find(m => m.name.includes("Concrete"))) {
        await storage.createMaterial({
            name: "Green Concrete M25",
            category: "Concrete",
            unit: "m3",
            emissionFactor: 240,
            displayId: "CON-001"
        } as any);
    }


    try {
        // 2. Process it
        console.log("⚙️  Processing...");
        const result = await processStandardBOQ(filePath, undefined);

        if (result.success) {
            console.log("✅ Success!");
            console.log("Detected Headers:", result.detectedHeaders);
            console.log("Extracted Data:");
            result.data?.forEach(item => {
                console.log(` - [${item.item}] ${item.description} | Qty: ${item.quantity} ${item.unit}`);
                if (item.matchedMaterialId) {
                    console.log(`   -> MATCHED: ${item.matchedMaterialName} (${item.matchConfidence}%)`);
                } else {
                    console.log(`   -> NO MATCH (Confidence: ${item.matchConfidence}%)`);
                }
            });
        } else {
            console.error("❌ Failed:", result.error);
        }

    } catch (err) {
        console.error("❌ Exception:", err);
    } finally {
        // Cleanup
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.log("🧹 Cleanup done.");
        process.exit(0);
    }
}

run();

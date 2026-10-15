import "dotenv/config";
import XLSX from "xlsx";
import { processStandardBOQ } from "../server/boqProcessing";
import fs from "fs";
import path from "path";
import "dotenv/config";

async function run() {
    console.log("🔍 Starting Complex BOQ Logic Verification...");
    const filePath = path.join(process.cwd(), "test_complex_boq.xlsx");

    // 1. Create a Synthetic Complex Excel
    //    Row 0-2: Junk/Title
    //    Row 3: Header
    //    Row 4: Parent Item
    //    Row 5: Child Item
    const data = [
        ["BOQ Title", "", "", ""],
        ["", "", "", ""],
        ["", "", "", ""],
        ["Item No", "Description of Work", "Total Qty", "Unit"], // <--- Header at Row 3 (Index 3)
        ["1.01", "Excavation in all types of soil for foundation including disposal", "", ""], // <--- Parent
        ["a)", "At all levels depth", "100", "m3"], // <--- Child
        ["2.0", "Plain Cement Concrete 1:4:8", "50", "m3"] // <--- Standalone
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filePath);

    console.log("📄 Created test_complex_boq.xlsx");

    try {
        // 2. Process
        console.log("⚙️  Processing...");
        const result = await processStandardBOQ(filePath, undefined);

        if (result.success) {
            console.log("✅ Success!");
            console.log("Detected Headers:", result.detectedHeaders);
            console.log("Extracted Data:");

            result.data?.forEach(item => {
                console.log(` - [${item.item}] ${item.description}`);
                console.log(`   Qty: ${item.quantity} ${item.unit}`);
            });

            // Assertions
            const childItem = result.data?.find(i => i.quantity === 100);
            if (childItem && childItem.description.includes("Excavation") && childItem.description.includes("At all levels")) {
                console.log("🌟 VERIFIED: Parent-Child description merge worked!");
            } else {
                console.error("❌ FAIL: Parent-Child merge failed. Got:", childItem?.description);
            }

        } else {
            console.error("❌ Failed:", result.error);
        }

    } catch (err) {
        console.error("❌ Exception:", err);
    } finally {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        process.exit(0);
    }
}

run();

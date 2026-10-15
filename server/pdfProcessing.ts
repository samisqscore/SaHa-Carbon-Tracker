import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import { BOQLineItem, ProcessResult } from "./boqProcessing";

/**
 * Basic PDF Text Extractor
 * Tries to find lines with Quantity and Unit.
 */
export async function processPdfBOQ(filePath: string): Promise<ProcessResult> {
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer);
        const text = data.text;

        if (!text || text.trim().length === 0) {
            return { success: false, error: "PDF is empty or unreadable." };
        }

        const lines = text.split("\n");
        const extractedItems: BOQLineItem[] = [];

        // Regex to find lines ending with a number and a unit?
        // Or "Item Description Qty Unit" pattern?
        // Very heuristic. 
        // Example: "1.2  Concrete M25  150  m3"
        // Regex: (Item)? (Description...) (Qty) (Unit)

        // This is where AI is usually better. 
        // But for "Text-Based PDF", we can try regex.

        let confidenceAccumulator = 0;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Simple Heuristic: Look for a number followed by a unit at the end of the line
            // e.g. ".... 100 kg" or ".... 100.00 m2"
            const match = trimmed.match(/^(.*?)\s+([\d,]+(\.\d+)?)\s*([a-zA-Z0-9²³]+)$/);

            if (match) {
                const desc = match[1].trim();
                const qtyVal = parseFloat(match[2].replace(/,/g, ""));
                const unit = match[4].toLowerCase();

                // Filter out likely page numbers or headers
                if (unit.length > 5 || isNaN(qtyVal)) continue;

                // Make sure description is long enough to be an item
                if (desc.length < 5) continue;

                extractedItems.push({
                    item: "", // ID hard to parse reliably without strict columns
                    description: desc,
                    quantity: qtyVal,
                    unit: unit,
                    matchConfidence: 70, // Regex isn't perfect
                    sheetName: "PDF",
                    rowIndex: extractedItems.length
                });
                confidenceAccumulator += 70;
            }
        }

        if (extractedItems.length === 0) {
            return { success: false, error: "Could not extract any BOQ items from PDF text. Try formatting as Excel." };
        }

        return {
            success: true,
            data: extractedItems,
            confidence: Math.round(confidenceAccumulator / extractedItems.length)
        };

    } catch (error: any) {
        console.error("PDF Process Error:", error);
        return { success: false, error: "Failed to process PDF: " + error.message };
    }
}

/**
 * @file boqProcessing.ts
 * @description Core engine for processing Bill of Quantities (BOQ) files and matching items to emission factors.
 * Supports Excel, CSV, and handles multi-layered construction descriptions.
 * 
 * @functionality
 * - Header Detection: Multi-strategy (Regex + Fuzzy + AI) column identification.
 * - Material Matching: Exact match, string similarity (Levenshtein), and AI-powered fallback.
 * - Suffix Handling: strips bracketed descriptions for better matching resolution.
 * - Unit Conversion: Automatic alignment of BOQ units to emission factor base units.
 * 
 * @dependencies
 * - XLSX: Excel file parsing.
 * - fast-levenshtein: String similarity metrics.
 * - DeepSeek API: AI-powered header detection and semantic material mapping.
 * - Storage: Database access for emission factors and project materials.
 */

import XLSX from "xlsx";
import OpenAI from "openai";
import fs from "fs";
// @ts-ignore - fast-levenshtein has no bundled types; runtime import is correct
import levenshtein from "fast-levenshtein";
import { db } from "./db";
import { emissionFactors, projectMaterials, projects, boqImports, type EmissionFactor } from "@shared/schema";
import { eq, like, or, sql, and } from "drizzle-orm";
import { storage } from "./storage";

// Helper: normalize string for comparison
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Helper: strip bracketed info (e.g. "Concrete (Raft Foundation)" -> "Concrete")
const stripBrackets = (s: string) => s.replace(/\s*\(.*?\)\s*/g, " ").trim();

// Unit Conversion Helpers
const UNIT_CONVERSIONS: Record<string, number> = {
    // Tonnes to kg
    "tonne": 1000, "tonnes": 1000, "t": 1000, "metric ton": 1000,
    // kg to kg (Identity)
    "kg": 1, "kilogram": 1, "kgs": 1, "kgco2e/kg": 1, "kgco2ekg": 1,
    // m3 to m3 (Identity)
    "m3": 1, "cum": 1, "cubic meter": 1, "m3co2e/m3": 1, "m3co2em3": 1,
    // others can be added
};

// --- PHASE 5: DeepSeek AI CONFIGURATION ---
// Uses the OpenAI-compatible SDK pointed at DeepSeek's API.
// No rate-limit delay needed — DeepSeek has much higher throughput than Gemini free tier.
const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    baseURL: "https://api.deepseek.com",
});
const DEEPSEEK_MODEL = "deepseek-chat";

export type BOQLineItem = {
    item: string;            // The raw Item Code/ID from file
    description: string;     // The raw description from file
    quantity: number;        // The RAW quantity
    unit: string;           // The RAW unit

    // Smart Mapping Fields
    matchedMaterialId?: string;       // ID of the system material we think matches
    matchedMaterialName?: string;     // Name of the system material we think matches
    matchedMaterialUnit?: string;     // Unit of the matched factor
    customName?: string;             // NEW: The human-readable name (BOQ Desc)
    conversionFactor?: number;        // Multiplier to align BOQ Qty to Factor Unit
    sheetName: string;       // Name of the sheet this item came from
    rowIndex: number;        // 1-based index in the source file
    sourceFilename?: string; // NEW: The original filename for trace-back
    matchConfidence?: number;         // 0-100 score
    matchMethod?: 'exact' | 'fuzzy' | 'ai';
    lifecycleStage?: string;          // NEW: To carry over to materials
};

export type ProcessResult = {
    success: boolean;
    data?: BOQLineItem[];
    error?: string;
    detectedHeaders?: Record<string, number>; // Which column index used for what
    confidence?: number; // Average confidence of the whole file
    suggestedPhases?: { sheetName: string; suggestedPhase: string; confidence: number }[]; // AI inferred phase assignments
};


/**
 * AI Phase Inference (DeepSeek)
 * Analyzes sheet names to map them to standard construction phases.
 */
async function suggestPhasesWithAI(sheetNames: string[], existingPhases?: string[]): Promise<{ sheetName: string; suggestedPhase: string; confidence: number }[]> {
    if (!process.env.DEEPSEEK_API_KEY || sheetNames.length === 0) return [];

    const phaseList = existingPhases && existingPhases.length > 0
        ? existingPhases.join(", ")
        : "Foundation, Superstructure, Envelope, Interiors, MEP / Services";

    try {
        const completion = await deepseek.chat.completions.create({
            model: DEEPSEEK_MODEL,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are an AI construction estimator. Map each sheet name to one of these project phases: ${phaseList}. If you cannot confidently map it, return "Unassigned". Never invent new phases. Use the highest context. Example: "Slab" usually means Superstructure. "Excavation" means Foundation. "Plumbing" means MEP / Services.
Return ONLY valid JSON in this exact structure: { "mappings": [{ "sheetName": "name", "suggestedPhase": "phase", "confidence": <0-100 number> }] }`
                },
                {
                    role: "user",
                    content: `Sheet names to classify:\n${JSON.stringify(sheetNames)}`
                }
            ],
            temperature: 0,
        });

        const text = completion.choices[0]?.message?.content || '{"mappings":[]}';
        const json = JSON.parse(text);
        return json.mappings || [];
    } catch (e) {
        console.error("AI Phase Suggestion Failed:", e);
        return [];
    }
}

/**
 * AI Low-Carbon Recommendations (DeepSeek)
 * Analyzes top emitting materials and suggests alternatives.
 */
export async function getAIRecommendations(topMaterials: any[]): Promise<any[]> {
    if (!process.env.DEEPSEEK_API_KEY || topMaterials.length === 0) {
        return [];
    }

    try {
        const materialSummary = topMaterials.map(m => `${m.materialName}: ${m.totalEmissions.toFixed(0)} kgCO2e`).join("\n");
        const completion = await deepseek.chat.completions.create({
            model: DEEPSEEK_MODEL,
            response_format: { type: "json_object" },
            messages: [
                {
                    role: "system",
                    content: `You are an AI Sustainability Consultant. Review the provided top emitting construction materials and suggest 1-3 practical, actionable low-carbon alternatives or strategies to reduce embodied carbon. 
Return ONLY valid JSON in this exact structure: { "recommendations": [{ "material": "string", "suggestion": "string", "potentialReduction": "string (e.g. 15-20%)" }] }`
                },
                {
                    role: "user",
                    content: `Top Emissions:\n${materialSummary}`
                }
            ],
            temperature: 0.2, // slight variability for suggestions
        });

        const text = completion.choices[0]?.message?.content || '{"recommendations":[]}';
        const json = JSON.parse(text);
        return json.recommendations || [];
    } catch (e) {
        console.error("AI Recommendations Failed:", e);
        return [];
    }
}

/**
 * AI Column Detection (DeepSeek)
 * Uses LLM to identify headers when regex fails.
 * No artificial delay needed — DeepSeek handles higher throughput.
 */
async function detectColumnsWithAI(headerRow: string[]): Promise<Record<string, number>> {
    try {
        const completion = await deepseek.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages: [
                {
                    role: "user",
                    content: `Analyze this header row from a Construction BOQ(Bill of Quantities) file:
${JSON.stringify(headerRow)}

Identify the index of the following columns:
1. Item Code(e.g., "Item", "S.No", "Code") - Return - 1 if not found.
2. Description(e.g., "Description", "Particulars", "Material Name").
3. Quantity(e.g., "Qty", "Quantity", "Amount", "Vol").
4. Unit(e.g., "Unit", "UOM").

Return ONLY a JSON object: { "item": number, "description": number, "quantity": number, "unit": number } `
                }
            ],
            temperature: 0,
        });
        const text = completion.choices[0]?.message?.content || "{}";
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error("AI Header Detection Failed:", e);
        return {};
    }
}

/**
 * Smart Column Detection
 * Tries to find which column index corresponds to 'item', 'description', etc.
 */
async function detectColumns(headers: string[]): Promise<Record<string, number>> {
    const map: Record<string, number> = {};
    const normHeaders = headers.map(h => normalize(h));

    const keywords: Record<string, string[]> = {
        item: ["item", "code", "id", "slno", "sno"],
        description: ["description", "desc", "material", "itemname", "particulars", "specification"],
        quantity: ["quantity", "qty", "vol", "volume"],
        unit: ["unit", "uom", "measure", "unitofmeasure"],
        lifecyclestage: ["lifecyclestage", "stage", "lifecycle", "phase", "lifecyclephase", "lcstage", "lifestage", "lifcyclstage", "lifecyle"]
    };

    let regexFound = false;
    for (const [key, words] of Object.entries(keywords)) {
        // 1. Exact/Substring Match on normalized header
        let idx = normHeaders.findIndex(h => words.some(w => h === w || h.includes(w)));

        // 2. If not found, try fuzzy calculation (catch typos like 'Descripton')
        if (idx === -1) {
            let bestDist = 3; // Max tolerance
            normHeaders.forEach((h, i) => {
                for (const w of words) {
                    const dist = levenshtein.get(h, w);
                    if (dist < bestDist) {
                        bestDist = dist;
                        idx = i;
                    }
                }
            });
        }

        if (idx !== -1 && !Object.values(map).includes(idx)) {
            map[key] = idx;
            regexFound = true;
        }
    }

    // IF REGEX FAILS significantly (missing mandatory desc or qty), TRY AI
    if (map["description"] === undefined || map["quantity"] === undefined) {
        // Optimization: Only ask AI if row looks like a header (has > 2 strings of length > 2)
        // This prevents calling AI on empty rows or title rows like "Civil Works"
        const meaningfulCols = headers.filter(h => h && h.trim().length > 2).length;

        if (meaningfulCols >= 3) {
            console.log("⚠️ Basic column detection failed for potential header. Trying AI...");
            const aiMap = await detectColumnsWithAI(headers);
            // Merge AI results if valid
            if (aiMap["description"] !== undefined && aiMap["description"] !== -1) map["description"] = aiMap["description"];
            if (aiMap["quantity"] !== undefined && aiMap["quantity"] !== -1) map["quantity"] = aiMap["quantity"];
            if (aiMap["unit"] !== undefined && aiMap["unit"] !== -1) map["unit"] = aiMap["unit"];
            if (aiMap["item"] !== undefined && aiMap["item"] !== -1) map["item"] = aiMap["item"];
        }
    }

    return map;
}

/**
 * AI Material Matching
 * Asks Gemini to pick the best material from our DB or return null
 */
/**
 * AI Material Matching (DeepSeek)
 * Asks DeepSeek to pick the best material from our DB or return NULL.
 * No artificial delay needed — DeepSeek handles higher throughput than Gemini free tier.
 */
async function matchMaterialWithAI(description: string, choices: { id: string, name: string, unit: string }[]): Promise<{ bestMatchId: string | null, confidence: number }> {
    try {
        const simplifiedChoices = choices.map(c => `${c.id}|${c.name} (${c.unit})`).join("\n");

        const completion = await deepseek.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages: [
                {
                    role: "user",
                    content: `Task: Map a BOQ Item Description to a Standard Emission Factor Material.

BOQ Item: "${description}"

Available Materials:
${simplifiedChoices}

Instructions:
1. Find the material that best matches the BOQ item semantically (e.g., "Wooden false ceiling" -> "Plywood" or "Timber").
2. If confident (>70%), return the ID. If not, return "NULL".
3. Return ONLY the ID string or "NULL".`
                }
            ],
            temperature: 0,
        });

        const matchId = (completion.choices[0]?.message?.content || "").trim();

        if (matchId && matchId !== "NULL") {
            const exists = choices.find(c => c.id === matchId);
            if (exists) return { bestMatchId: matchId, confidence: 85 };
        }
        return { bestMatchId: null, confidence: 0 };
    } catch (e) {
        console.error("AI Material Match Failed:", e);
        return { bestMatchId: null, confidence: 0 };
    }
}

/**
 * Fuzzy Match Material
 * Matches a raw description against the list of system materials.
 * Optionally filters by a list of dataset IDs.
 */
export async function matchMaterial(
    description: string,
    organizationId?: string,
    datasetIds?: string[]
): Promise<{ id?: string, name?: string, unit?: string, confidence: number, method?: 'exact' | 'fuzzy' | 'ai' }> {
    // 1. Fetch all materials
    let materials: EmissionFactor[] = [];

    if (datasetIds && datasetIds.length > 0) {
        // Fetch only from selected datasets
        materials = await db.select().from(emissionFactors).where(
            and(
                eq(emissionFactors.isActive, true),
                sql`${emissionFactors.datasetId} IN ${datasetIds}`
            )
        );
    } else {
        // Fallback to standard context (Global + Org)
        materials = await storage.getMaterials(organizationId);
    }

    if (!description) return { confidence: 0 };

    const target = normalize(description);
    const targetStripped = normalize(stripBrackets(description));

    let bestMatch = null;
    let bestScore = 0; // 0 to 100

    // --- STEP 1: FAST FUZZY/REGEX MATCH ---
    for (const mat of materials) {
        const source = normalize(mat.materialName);

        // Strategy A: Exact Match (Original or Stripped)
        if (source === target || source === targetStripped) {
            return { id: mat.id, name: mat.materialName, unit: mat.unit, confidence: 100, method: 'exact' };
        }

        // Strategy B: Substring (e.g. "Green Concrete" matches "M25 Green Concrete")
        // Check both original and stripped versions
        if (target.includes(source) || source.includes(target) || targetStripped.includes(source) || source.includes(targetStripped)) {
            // Score based on length ratio
            const score = 85;
            if (score > bestScore) {
                bestScore = score;
                bestMatch = mat;
            }
        }

        // Strategy C: Levenshtein
        // Compare against original first
        const dist = levenshtein.get(target, source);
        const maxLen = Math.max(target.length, source.length);
        const similarity = 1 - (dist / maxLen);
        let fuzzyScore = similarity * 100;

        // Try stripped version if it yielded a different string
        if (target !== targetStripped) {
            const distStripped = levenshtein.get(targetStripped, source);
            const maxLenStripped = Math.max(targetStripped.length, source.length);
            const similarityStripped = 1 - (distStripped / maxLenStripped);
            const fuzzyScoreStripped = similarityStripped * 100;
            if (fuzzyScoreStripped > fuzzyScore) fuzzyScore = fuzzyScoreStripped;
        }

        if (fuzzyScore > 60 && fuzzyScore > bestScore) {
            bestScore = fuzzyScore;
            bestMatch = mat;
        }
    }

    if (bestScore > 70) {
        return {
            id: bestMatch?.id,
            name: bestMatch?.materialName,
            unit: bestMatch?.unit,
            confidence: Math.round(bestScore),
            method: 'fuzzy'
        };
    }

    // --- STEP 2: AI BACKUP (DeepSeek — if DEEPSEEK_API_KEY is configured) ---
    if (process.env.DEEPSEEK_API_KEY) {
        const aiMatch = await matchMaterialWithAI(description, materials.map(m => ({ id: m.id, name: m.materialName, unit: m.unit || '' })));
        if (aiMatch.bestMatchId) {
            const mat = materials.find(m => m.id === aiMatch.bestMatchId);
            if (mat) {
                return {
                    id: mat.id,
                    name: mat.materialName,
                    unit: mat.unit,
                    confidence: aiMatch.confidence,
                    method: 'ai'
                };
            }
        }
    }

    return {
        id: bestMatch?.id, // Return best fuzzy anyway if AI fails
        name: bestMatch?.materialName,
        unit: bestMatch?.unit,
        confidence: Math.round(bestScore),
        method: 'fuzzy'
    };
}

/**
 * Process Standard BOQ (Excel/CSV)
 * 
 * CORE LOGIC:
 * 1. Multi-Sheet Support: Iterates through ALL sheets in the workbook (not just the first one).
 * 2. Independent Detection: Performs header detection for each sheet independently.
 * 3. Rate Limiting: Handles AI rate limits (429/503) by gracefully skipping AI match if quota exceeded.
 * 4. Auditability: Tags every item with `sheetName` and `rowIndex` for traceability.
 * 
 * @param filePath Path to the uploaded file
 * @param organizationId Optional org ID for better fuzzy matching context
 */
export async function processStandardBOQ(filePath: string, organizationId?: string, sourceFilename?: string): Promise<ProcessResult> {
    try {
        const workbook = XLSX.readFile(filePath);
        // Sometimes Sheet1 is hidden or not main. Find largest sheet?
        // For now, default to first sheet.
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

        if (rawData.length < 2) {
            return { success: false, error: "Empty file" };
        }

        // --- PHASE 1: PROCESS ALL SHEETS ---
        const allLineItems: BOQLineItem[] = [];
        const detectedHeaders: Record<string, number> = {}; // Store header map for first detected sheet for reference (or merge?)

        let totalSheetsProcessed = 0;
        let successfulSheets = 0;

        for (const sheetName of workbook.SheetNames) {
            totalSheetsProcessed++;
            const worksheet = workbook.Sheets[sheetName];
            const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

            if (rawData.length < 2) {
                console.warn(`[Smart BOQ] Skipping empty sheet: ${sheetName}`);
                continue;
            }

            // --- HEADER DETECTION PER SHEET ---
            // Scan first 25 rows to find the best header row
            let bestHeaderRowIdx = -1;
            let bestHeaderScore = 0;
            let currentSheetColMap: Record<string, number> = {};

            for (let i = 0; i < Math.min(25, rawData.length); i++) {
                // Optimization: Skip empty rows early
                if (!rawData[i] || rawData[i].length === 0) continue;

                const rowStr = rawData[i].map(String);
                const cols = await detectColumns(rowStr); // Now Async!

                // Score = number of recognized keywords
                let score = 0;
                if (cols["description"] !== undefined) score += 2;
                if (cols["quantity"] !== undefined) score += 2;
                if (cols["item"] !== undefined) score += 1;
                if (cols["unit"] !== undefined) score += 1;

                // Prefer rows that have at least (Desc + Qty) OR (Item + Qty)
                // Strictness: Must have Quantity to be useful? Yes.
                if (score > bestHeaderScore) {
                    bestHeaderScore = score;
                    bestHeaderRowIdx = i;
                    currentSheetColMap = cols;
                }

                // OPTIMIZATION: If we found a perfect or near-perfect header, STOP scanning.
                if (score >= 4) {
                    console.log(`[Smart BOQ] Perfect header found in sheet '${sheetName}'. Stopping scan.`);
                    break;
                }
            }

            if (bestHeaderRowIdx === -1 || bestHeaderScore < 3) {
                console.warn(`[Smart BOQ] Could not detect valid header in sheet: ${sheetName}. Skipping.`);
                continue;
            }

            successfulSheets++;
            // Save the first valid header map for general info return
            if (Object.keys(detectedHeaders).length === 0) {
                Object.assign(detectedHeaders, currentSheetColMap);
            }

            console.log(`[Smart BOQ] Sheet '${sheetName}': Header at Row ${bestHeaderRowIdx + 1}`);

            // Column Validation: Only description (Material) and quantity are truly mandatory.
            // unit and lifecyclestage are optional — real-world BOQs may not have them.
            const reqCols = ['description', 'quantity'];
            const missingCols = reqCols.filter(c => currentSheetColMap[c] === undefined);

            if (missingCols.length > 0) {
                return {
                    success: false,
                    error: `Missing required columns: ${missingCols.join(', ')}. Your file must have at least a Material/Description column and a Quantity column.`
                };
            }

            // --- PARSING THIS SHEET ---
            let context = {
                lastParentItem: "",
                lastParentDesc: "",
                currentSection: ""
            };

            for (let i = bestHeaderRowIdx + 1; i < rawData.length; i++) {
                const row = rawData[i];

                // Extract Raw Values
                let desc = currentSheetColMap["description"] !== undefined ? String(row[currentSheetColMap["description"]]).trim() : "";
                const item = currentSheetColMap["item"] !== undefined ? String(row[currentSheetColMap["item"]]).trim() : "";

                // Quantity Strategy:
                let qtyRaw = currentSheetColMap["quantity"] !== undefined ? row[currentSheetColMap["quantity"]] : "";
                let qtyVal = parseFloat(String(qtyRaw).replace(/[^0-9.]/g, ""));

                const unit = currentSheetColMap["unit"] !== undefined ? String(row[currentSheetColMap["unit"]]).trim() : "nr";
                // LifecycleStage is optional — default to A1-A3 if column absent or cell empty
                const rawLifecycle = currentSheetColMap["lifecyclestage"] !== undefined
                    ? String(row[currentSheetColMap["lifecyclestage"]] ?? "").trim()
                    : "";
                const lifecycleStage = rawLifecycle || "A1-A3";

                // Row Classification
                const hasQty = !isNaN(qtyVal) && qtyVal > 0;
                const hasDesc = desc.length > 2; // Noise filter
                const hasItem = item.length > 0;

                if (!hasDesc && !hasItem && !hasQty) continue; // Empty row

                // CASE A: Section Header or Parent Item (No Qty, but has Desc)
                if (!hasQty && hasDesc) {
                    if (item) context.lastParentItem = item;
                    context.lastParentDesc = desc;
                    continue;
                }

                // CASE B: Child/Regular Item (Has Qty)
                if (hasQty) {
                    let finalDesc = desc;

                    // Merge Logic:
                    const isBullet = /^[a-z]\)|^[ivx]+\)|^-/.test(desc.toLowerCase());
                    const isShort = desc.length < 20;

                    if ((isBullet || isShort) && context.lastParentDesc) {
                        finalDesc = `${context.lastParentDesc} - ${desc}`;
                    }

                    // 3. Find Match
                    const match = await matchMaterial(finalDesc, organizationId);

                    // 4. Unit Conversion
                    let conversionFactor = 1.0;
                    if (match?.unit && unit) {
                        const normUnitBOQ = normalize(unit);
                        const normUnitSys = normalize(match.unit);

                        if (normUnitBOQ !== normUnitSys) {
                            if (UNIT_CONVERSIONS[normUnitBOQ] && UNIT_CONVERSIONS[normUnitSys]) {
                                conversionFactor = UNIT_CONVERSIONS[normUnitBOQ] / UNIT_CONVERSIONS[normUnitSys];
                            } else if (UNIT_CONVERSIONS[normUnitBOQ] && normUnitSys === 'kg') {
                                conversionFactor = UNIT_CONVERSIONS[normUnitBOQ];
                            }
                        }
                    }

                    allLineItems.push({
                        sheetName: sheetName,        // NEW: Auditability
                        rowIndex: i + 1,             // NEW: Auditability (1-based)
                        sourceFilename: sourceFilename,
                        item: item || context.lastParentItem,
                        description: finalDesc,
                        quantity: qtyVal,
                        unit: unit,
                        lifecycleStage: lifecycleStage, // Pass the detected/default value
                        matchedMaterialId: match.id,
                        matchedMaterialName: match.name,
                        matchedMaterialUnit: match.unit,
                        customName: finalDesc,
                        conversionFactor: conversionFactor,
                        matchConfidence: match.confidence,
                        matchMethod: match.method || (match.confidence === 100 ? 'exact' : 'fuzzy')
                    });
                }
            }
        }

        if (successfulSheets === 0) {
            return { success: false, error: "Could not detect valid headers in any sheet of the file." };
        }

        // --- PHASE 4: Phase Association (AI Inference) ---
        const uniqueSheets = Array.from(new Set(allLineItems.map(item => item.sheetName)));
        const suggestedPhases = await suggestPhasesWithAI(uniqueSheets);

        return { success: true, data: allLineItems, detectedHeaders, confidence: 80, suggestedPhases };

    } catch (error: any) {
        console.error("Smart BOQ Error:", error);
        return { success: false, error: error.message };
    }
}

import { processPdfBOQ } from "./pdfProcessing";

/**
 * Enterprise AI Pipeline (PDF)
 * Now uses regex-based extraction from pdfProcessing.ts
 */
export async function processEnterpriseBOQ(filePath: string, mimeType: string): Promise<ProcessResult> {
    if (mimeType === "application/pdf") {
        return processPdfBOQ(filePath);
    }

    // Fallback for images (future AI)
    return { success: false, error: "Image Import not yet enabled. Please convert to PDF or Excel." };
}

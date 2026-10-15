/**
 * BOQ Normalizer — Backend Service
 *
 * Standalone parsing and AI enrichment for the BOQ Normalizer utility.
 * These are SEPARATE from the existing boqProcessing.ts functions — the old
 * BOQ upload/confirm flow remains untouched.
 *
 * Pipeline: parseBoqSheets() → interpretBoqRows() → push (in routes.ts)
 */

import XLSX from "xlsx";
import OpenAI from "openai";
import type {
    RawBoqRow,
    EnrichedBoqRow,
    NormalizerParseResponse,
} from "@shared/boqNormalizerTypes";
import { MATERIAL_CATEGORIES, LIFECYCLE_STAGES } from "@shared/boqNormalizerTypes";

// --- DeepSeek AI Configuration ---
const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    baseURL: "https://api.deepseek.com",
});
const DEEPSEEK_MODEL = "deepseek-chat";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Header keyword variants for BOQ sheet detection
// ─────────────────────────────────────────────────────────────────────────────

const SL_NO_KEYWORDS = ["sl", "sno", "slno", "sl.no", "sl.no.", "s.no", "s.no.", "item", "itemno", "item no", "sr", "sr.no"];
const DESC_KEYWORDS = ["description", "desc", "particular", "particulars", "specification", "item description", "material"];
const UNIT_KEYWORDS = ["unit", "uom", "units"];
const QTY_KEYWORDS = ["qty", "quantity", "qnty", "amount", "vol", "volume"];

function normalizeHeader(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Check if a worksheet row is a BOQ header row.
 * Returns column indices if ≥3 of 4 keyword groups match.
 */
function detectHeaderRow(row: string[]): { isHeader: boolean; columns: { slNo: number; description: number; unit: number; quantity: number } } {
    const norm = row.map(cell => normalizeHeader(String(cell ?? "")));
    const result = { slNo: -1, description: -1, unit: -1, quantity: -1 };
    let matchCount = 0;

    for (let i = 0; i < norm.length; i++) {
        const h = norm[i];
        if (!h) continue;

        if (result.slNo === -1 && SL_NO_KEYWORDS.some(k => h === k || h.includes(k))) {
            result.slNo = i; matchCount++;
        } else if (result.description === -1 && DESC_KEYWORDS.some(k => h === k || h.includes(k))) {
            result.description = i; matchCount++;
        } else if (result.unit === -1 && UNIT_KEYWORDS.some(k => h === k || h.includes(k))) {
            result.unit = i; matchCount++;
        } else if (result.quantity === -1 && QTY_KEYWORDS.some(k => h === k || h.includes(k))) {
            result.quantity = i; matchCount++;
        }
    }

    return { isHeader: matchCount >= 3, columns: result };
}

/**
 * Determine if a row is a section header.
 * Section headers: single/short code in Sl.No, no quantity, description < 60 chars
 */
function isSectionHeader(slNo: string, description: string, unit: string, qty: unknown): boolean {
    if (!description || description.length > 60) return false;
    if (unit && unit.trim().length > 0) return false;

    const qtyStr = String(qty ?? "").trim();
    if (qtyStr && qtyStr !== "0" && qtyStr.toLowerCase() !== "qro") return false;

    // Single letter, roman numeral, or short code (1–3 uppercase chars)
    const slTrimmed = slNo.trim();
    if (!slTrimmed) return false;
    if (/^[A-Z]{1,3}$/i.test(slTrimmed)) return true; // E.g. "A", "CA", "MEP"
    if (/^[IVXivx]+$/.test(slTrimmed)) return true;   // Roman numerals
    if (/^[A-Z]\s*[-–]\s*/i.test(slTrimmed) && slTrimmed.length <= 4) return true;

    return false;
}

/**
 * Determine if a row is a parent item (e.g. CA1, CB2, AA3).
 * Pattern: 1-2 letters followed by digit(s), no sub-letter suffix.
 */
function isParentItem(slNo: string): boolean {
    const trimmed = slNo.trim();
    return /^[A-Z]{1,2}\s*\d+$/i.test(trimmed);
}

/**
 * Check if quantity value represents QRO (Quantity Required On-site).
 */
function isQro(qty: unknown): boolean {
    const s = String(qty ?? "").trim().toLowerCase();
    return s === "qro" || s.includes("quantity as required") || s.includes("quantity required");
}

/**
 * Skip row if it matches known noise patterns.
 */
function isSkippableRow(description: string): boolean {
    if (!description) return true;
    const d = description.trim();
    if (d.length > 100 && !/\d/.test(d.substring(0, 30))) return true; // Long preamble text
    const lowerD = d.toLowerCase();
    if (lowerD.startsWith("preferred manufacturer")) return true;
    if (lowerD.startsWith("preferred supplier")) return true;
    if (lowerD.startsWith("note:") || lowerD.startsWith("notes:")) return true;
    return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// parseBoqSheets — Layer 1: Deterministic Excel Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse an Excel file into raw BOQ rows with sheet classification.
 *
 * @param fileBuffer Buffer of the uploaded Excel file
 * @param selectedSheets Optional list of sheet names to include (if omitted, all BOQ sheets used)
 * @returns NormalizerParseResponse with sheet info and raw rows
 */
export async function parseBoqSheets(
    fileBuffer: Buffer,
    selectedSheets?: string[],
    sourceFilename?: string
): Promise<NormalizerParseResponse> {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });

    const sheetsInfo: Array<{ name: string; rowCount: number; isBoqSheet: boolean }> = [];
    const allRows: RawBoqRow[] = [];

    // Extract project metadata from first rows of first sheet
    let projectMeta = { client: null as string | null, location: null as string | null, buildingElements: [] as string[] };

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (firstSheet) {
        const firstRows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: "" }) as any[][];
        if (firstRows.length > 0) projectMeta.client = String(firstRows[0]?.[0] ?? "").trim() || null;
        if (firstRows.length > 1) projectMeta.location = String(firstRows[1]?.[0] ?? "").trim() || null;
    }

    for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

        if (rawData.length < 2) {
            sheetsInfo.push({ name: sheetName, rowCount: 0, isBoqSheet: false });
            continue;
        }

        // Scan first 10 rows for a header row
        let headerRowIdx = -1;
        let columns = { slNo: -1, description: -1, unit: -1, quantity: -1 };

        for (let i = 0; i < Math.min(10, rawData.length); i++) {
            if (!rawData[i] || rawData[i].length === 0) continue;
            const rowStr = rawData[i].map((c: any) => String(c ?? ""));
            const detection = detectHeaderRow(rowStr);
            if (detection.isHeader) {
                headerRowIdx = i;
                columns = detection.columns;
                break;
            }
        }

        const isBOQ = headerRowIdx !== -1;
        const dataRowCount = isBOQ ? rawData.length - headerRowIdx - 1 : rawData.length;
        sheetsInfo.push({ name: sheetName, rowCount: Math.max(0, dataRowCount), isBoqSheet: isBOQ });

        if (isBOQ) {
            projectMeta.buildingElements.push(sheetName);
        }

        // If sheet is not selected for processing, skip row extraction
        if (selectedSheets && !selectedSheets.includes(sheetName)) continue;
        if (!isBOQ) continue;

        // --- Extract rows ---
        let lastSectionHeader = "";
        let lastParentDescription = "";

        for (let i = headerRowIdx + 1; i < rawData.length; i++) {
            const row = rawData[i];

            const slNo = columns.slNo >= 0 ? String(row[columns.slNo] ?? "").trim() : "";
            const description = columns.description >= 0 ? String(row[columns.description] ?? "").trim() : "";
            const unit = columns.unit >= 0 ? String(row[columns.unit] ?? "").trim() : "";
            const qtyRaw = columns.quantity >= 0 ? row[columns.quantity] : null;

            // Skip empty rows
            if (!slNo && !description && !unit) continue;

            // Skip noise rows
            if (isSkippableRow(description)) continue;

            // Section header detection
            if (isSectionHeader(slNo, description, unit, qtyRaw)) {
                lastSectionHeader = description;
                continue;
            }

            // Parent item tracking
            if (isParentItem(slNo)) {
                lastParentDescription = description;
            }

            // QRO detection
            const qroFlag = isQro(qtyRaw);
            let quantity: string | number | null = null;
            if (qroFlag) {
                quantity = null;
            } else {
                const parsed = parseFloat(String(qtyRaw ?? "").replace(/[^0-9.-]/g, ""));
                quantity = isNaN(parsed) ? null : parsed;
            }

            // Only include rows that have a description
            if (!description || description.length < 3) continue;

            allRows.push({
                rowIndex: i + 1, // 1-based
                slNo,
                description,
                unit,
                quantity: qroFlag ? "QRO" : quantity,
                sheetName,
                sectionHeader: lastSectionHeader,
                parentDescription: lastParentDescription,
                isQro: qroFlag,
                sourceFilename,
            });
        }
    }

    return { projectMeta, sheets: sheetsInfo, rows: allRows };
}

// ─────────────────────────────────────────────────────────────────────────────
// interpretBoqRows — Layer 2: AI Classification via DeepSeek
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the DeepSeek prompt for a batch of rows.
 */
function buildPrompt(batch: RawBoqRow[], sectionHeader: string, parentDescription: string): string {
    const categoriesStr = MATERIAL_CATEGORIES.join("\n  ");
    const stagesStr = LIFECYCLE_STAGES.join(" | ");

    return `Process the following BOQ rows and return a JSON array.

Context: section_header="${sectionHeader}", parent_item="${parentDescription}"

For each row, return exactly:
  rowIndex: (integer, preserve from input)
  primaryMaterial: (string) the single dominant material noun, max 5 words
  materialCategory: (string) from the allowed list below
  lifecycleStageEn15804: (string) one of: ${stagesStr}
  grade: (string|null) e.g. "M30", "Fe500", "Grade 43" — null if not stated
  confidence: (float 0.0–1.0) your extraction confidence
  aiNotes: (string|null) brief note if confidence < 0.7, else null

Allowed materialCategory values:
  ${categoriesStr}

Lifecycle stage rules:
  A1-A3: manufacturing of materials (concrete, steel, masonry, finishes, waterproofing)
  A4: transport to site (only if explicitly stated in the description)
  A5: site operations (excavation, filling, compaction, curing, formwork, anti-termite treatment)
  B1-B7: use phase (maintenance, replacement — rare in construction BOQs)
  C1-C4: end of life — only if stated
  D: reuse / recovery — only if stated

Parent context rule: if a sub-item does not explicitly name a material, inherit the material from the parent_item context provided above.

Rows:
${JSON.stringify(batch.map(r => ({ rowIndex: r.rowIndex, slNo: r.slNo, description: r.description, unit: r.unit })))}

Return ONLY the JSON array. No markdown fences, no explanation, no preamble.`;
}

/**
 * Call DeepSeek to enrich a batch of rows.
 */
async function callDeepSeek(batch: RawBoqRow[]): Promise<Partial<EnrichedBoqRow>[]> {
    // Use the section header and parent description from the first row in the batch
    const sectionHeader = batch[0]?.sectionHeader || "";
    const parentDescription = batch[0]?.parentDescription || "";

    try {
        const completion = await deepseek.chat.completions.create({
            model: DEEPSEEK_MODEL,
            messages: [
                {
                    role: "system",
                    content: "You are a construction material classifier for embodied carbon analysis. You extract primary material identities from BOQ line items and map them to EN 15804 lifecycle stages. You always return valid JSON. You never invent quantities.",
                },
                {
                    role: "user",
                    content: buildPrompt(batch, sectionHeader, parentDescription),
                },
            ],
            temperature: 0,
            response_format: { type: "json_object" },
        });

        const text = completion.choices[0]?.message?.content || "[]";
        // DeepSeek with json_object may wrap in { "rows": [...] } or return direct array
        let parsed: any;
        try {
            parsed = JSON.parse(text);
        } catch {
            console.error("[Normalizer] Failed to parse DeepSeek response:", text.substring(0, 200));
            return [];
        }

        // Handle both { rows: [...] } and direct array
        const items: any[] = Array.isArray(parsed) ? parsed : (parsed.rows || parsed.items || parsed.data || []);
        return items;
    } catch (err: any) {
        console.error("[Normalizer] DeepSeek call failed:", err.message);
        return [];
    }
}

/**
 * Enrich raw BOQ rows with AI-classified material data.
 * Processes in batches of 50 rows to stay within token limits.
 * Falls back gracefully if DEEPSEEK_API_KEY is not configured.
 *
 * @param rows Raw parsed rows from parseBoqSheets()
 * @returns Enriched rows with material classification and confidence scores
 */
export async function interpretBoqRows(rows: RawBoqRow[]): Promise<EnrichedBoqRow[]> {
    // Graceful fallback when AI is unavailable
    if (!process.env.DEEPSEEK_API_KEY) {
        console.warn("[Normalizer] DEEPSEEK_API_KEY not configured. Returning rows without AI enrichment.");
        return rows.map(r => ({
            ...r,
            primaryMaterial: r.description.split(" ").slice(0, 5).join(" "),
            materialCategory: "General - Civil Works" as const,
            lifecycleStageEn15804: "A1-A3" as const,
            grade: null,
            confidence: 0,
            aiNotes: "AI unavailable — DEEPSEEK_API_KEY not configured",
            selected: true,
            editedByUser: false,
        }));
    }

    const BATCH_SIZE = 50;
    const results: EnrichedBoqRow[] = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        console.log(`[Normalizer] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} rows)`);

        const aiResults = await callDeepSeek(batch);

        // Merge AI results back with original rows
        for (const row of batch) {
            const aiRow = aiResults.find((a: any) => a.rowIndex === row.rowIndex);

            results.push({
                ...row,
                primaryMaterial: aiRow?.primaryMaterial || row.description.split(" ").slice(0, 5).join(" "),
                materialCategory: (aiRow?.materialCategory as any) || "General - Civil Works",
                lifecycleStageEn15804: (aiRow?.lifecycleStageEn15804 as any) || "A1-A3",
                grade: aiRow?.grade || null,
                confidence: typeof aiRow?.confidence === "number" ? aiRow.confidence : 0.5,
                aiNotes: aiRow?.aiNotes || null,
                selected: true,
                editedByUser: false,
            });
        }
    }

    return results;
}

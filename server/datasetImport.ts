
import XLSX from "xlsx";
import { z } from "zod";


// Expected columns for Dataset Import - Phase 2 Alignment
const REQUIRED_COLUMNS_DATASET = ["name", "unit", "emission_factor"];

export const datasetRowSchema = z.object({
    category: z.string().default("Uncategorized"),
    name: z.string().min(1, "Material name is required"),
    unit: z.string().min(1, "Unit is required"),
    emissionFactor: z.number().positive("Emission factor must be positive"),
    source: z.string().optional(),
    region: z.string().optional(),
    ghgScope: z.enum(["scope1", "scope2", "scope3"]).default("scope3"),
    lifecycleStage: z.enum(["A1-A3", "A4-A5", "B", "C1-C4", "D"]).default("A1-A3"),
    sourceReference: z.string().optional(),
    density: z.number().positive().optional(),
});

export type DatasetImportRow = z.infer<typeof datasetRowSchema>;

export type RowError = {
    row: number;
    field: string;
    value: any;
    reason: string;
};

export type DatasetProcessResult = {
    success: boolean;
    data?: DatasetImportRow[];
    errors?: RowError[];
    error?: string; // For unrecoverable errors (file empty, missing headers)
    stats?: {
        total: number;
        valid: number;
        invalid: number;
    }
};

/**
 * Parsers a generic CSV/Excel for Emission Dataset Import
 */
export async function processDatasetImport(
    filePath: string,
    userRole: "admin" | "org_admin" | string = "org_admin"
): Promise<DatasetProcessResult> {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // transform to json
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as any[][];

        if (rawData.length < 2) {
            return { success: false, error: "File is empty or missing headers." };
        }

        const totalDataRows = rawData.length - 1;

        // D6/D7: Row Limits
        const LIMIT_ORG = 1000;
        const LIMIT_ADMIN = 50000;
        const currentLimit = userRole === "admin" ? LIMIT_ADMIN : LIMIT_ORG;

        if (totalDataRows > currentLimit) {
            return {
                success: false,
                error: `File exceeds the maximum row limit for your role (${currentLimit.toLocaleString()} rows). Your file has ${totalDataRows.toLocaleString()} rows.`
            };
        }

        // Header validation (simple fuzzy match)
        const rawHeaders = rawData[0];
        const headers = rawHeaders.map((h: any) => String(h).toLowerCase().trim().replace(/ /g, "_"));
        console.log("[Dataset Import] Normalized Headers:", headers);

        // Map common aliases (D4 alignment)
        const columnMap: Record<string, string[]> = {
            category: ["category", "group", "material_group", "type"],
            name: ["name", "material", "material_name", "item", "description"],
            unit: ["unit", "uom", "measure", "base_unit"],
            emission_factor: ["emission_factor", "factor", "co2e", "kgco2e", "gwp", "emissionfactor", "kgco2e_per_unit", "value"],
            source: ["source", "db", "dataset"],
            source_reference: ["source_reference", "reference", "table", "row", "ref"],
            region: ["region", "location", "country"],
            ghg_scope: ["ghg_scope", "scope", "emission_scope", "ghgscope"],
            lifecycle_stage: ["lifecycle_stage", "lifecycle", "stage", "module"],
            density: ["density", "weight_per_unit"]
        };

        const mappedIndices: Record<string, number> = {};
        const missingCols: string[] = [];

        for (const req of REQUIRED_COLUMNS_DATASET) {
            const possibleHeaders = columnMap[req] || [req];
            const foundIdx = headers.findIndex(h => possibleHeaders.includes(h));

            if (foundIdx === -1) {
                missingCols.push(req === "name" ? "material_name" : req);
            } else {
                mappedIndices[req] = foundIdx;
            }
        }

        if (missingCols.length > 0) {
            return {
                success: false,
                error: `Missing required columns: ${missingCols.join(", ")}. Please ensure your file has headers for Material Name, Unit, and Emission Factor.`
            };
        }

        // Optional column indices
        const getIdx = (key: string) => headers.findIndex(h => (columnMap[key] || [key]).includes(h));
        const optionalIndices = {
            category: getIdx("category"),
            source: getIdx("source"),
            sourceReference: getIdx("source_reference"),
            region: getIdx("region"),
            ghgScope: getIdx("ghg_scope"),
            lifecycleStage: getIdx("lifecycle_stage"),
            density: getIdx("density")
        };

        const validRows: DatasetImportRow[] = [];
        const rowErrors: RowError[] = [];

        // Skip header row
        for (let i = 1; i < rawData.length; i++) {
            const row = rawData[i];

            // Essential values
            const nameVal = String(row[mappedIndices["name"]]).trim();
            const unitVal = String(row[mappedIndices["unit"]]).trim();
            const factorRaw = row[mappedIndices["emission_factor"]];

            if (!nameVal && !unitVal && (factorRaw === "" || factorRaw === undefined)) {
                continue; // Skip truly empty lines
            }

            const factor = parseFloat(String(factorRaw).replace(/,/g, ""));

            // Resolve Optional values with defaults
            const category = optionalIndices.category > -1 ? String(row[optionalIndices.category]).trim() : "Uncategorized";
            const source = optionalIndices.source > -1 ? String(row[optionalIndices.source]).trim() : undefined;
            const sourceRef = optionalIndices.sourceReference > -1 ? String(row[optionalIndices.sourceReference]).trim() : undefined;
            const region = optionalIndices.region > -1 ? String(row[optionalIndices.region]).trim() : undefined;

            // Normalize Scope
            let ghgScope: any = "scope3";
            if (optionalIndices.ghgScope > -1) {
                const raw = String(row[optionalIndices.ghgScope]).toLowerCase().replace(/ /g, "");
                if (["scope1", "scope2", "scope3"].includes(raw)) ghgScope = raw;
                else if (raw.includes("1") || raw.includes("direct")) ghgScope = "scope1";
                else if (raw.includes("2") || raw.includes("energy")) ghgScope = "scope2";
                else ghgScope = "scope3";
            }

            // Normalize Lifecycle Stage
            let lifecycleStage: any = "A1-A3";
            if (optionalIndices.lifecycleStage > -1) {
                const raw = String(row[optionalIndices.lifecycleStage]).toUpperCase().trim();
                if (["A1-A3", "A4-A5", "B", "C1-C4", "D"].includes(raw)) lifecycleStage = raw;
                else if (raw.includes("A1") || raw.includes("A2") || raw.includes("A3") || raw.includes("PRODUCTION")) lifecycleStage = "A1-A3";
                else if (raw.includes("A4") || raw.includes("A5") || raw.includes("CONSTRUCTION")) lifecycleStage = "A4-A5";
                else if (raw.startsWith("B") || raw.includes("USE")) lifecycleStage = "B";
                else if (raw.startsWith("C") || raw.includes("END")) lifecycleStage = "C1-C4";
                else if (raw.startsWith("D")) lifecycleStage = "D";
            }

            const densityRaw = optionalIndices.density > -1 ? row[optionalIndices.density] : undefined;
            const density = densityRaw ? parseFloat(String(densityRaw).replace(/,/g, "")) : undefined;

            const item: any = {
                category: category || "Uncategorized",
                name: nameVal,
                unit: unitVal,
                emissionFactor: isNaN(factor) ? -1 : factor,
                source: source,
                sourceReference: sourceRef,
                region: region,
                ghgScope: ghgScope,
                lifecycleStage: lifecycleStage,
                density: isNaN(Number(density)) ? undefined : (density || undefined)
            };

            const parsed = datasetRowSchema.safeParse(item);

            if (parsed.success) {
                validRows.push(parsed.data);
            } else {
                parsed.error.issues.forEach(issue => {
                    rowErrors.push({
                        row: i + 1,
                        field: issue.path.join("."),
                        value: item[issue.path[0] as string],
                        reason: issue.message
                    });
                });
            }
        }

        const isSuccess = rowErrors.length === 0 && validRows.length > 0;

        return {
            success: isSuccess,
            data: isSuccess ? validRows : undefined,
            errors: rowErrors.length > 0 ? rowErrors : undefined,
            stats: {
                total: validRows.length + rowErrors.length,
                valid: validRows.length,
                invalid: rowErrors.length
            }
        };

    } catch (err: any) {
        console.error("Dataset Import Process Error:", err);
        return { success: false, error: "Failed to process file. Ensure it is a valid Excel/CSV." };
    }
}

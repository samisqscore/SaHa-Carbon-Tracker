import { useState, useRef, useCallback } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import type { EnrichedBoqRow, NormalizerParseResponse } from "./boqNormalizerTypes";

interface BOQNormalizerUploadProps {
    onAnalysisComplete: (rows: EnrichedBoqRow[]) => void;
    analysing: boolean;
    onAnalysingChange: (analysing: boolean) => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = [".xlsx", ".xls"];

/**
 * BOQ Normalizer — Upload & Sheet Selection
 *
 * 1. File dropzone (xlsx/xls only, 10MB max)
 * 2. POST /api/boq/normalizer/parse → sheet list with auto-detection
 * 3. Sheet selection with checkboxes
 * 4. "Analyse with AI" button → POST /api/boq/normalizer/interpret
 * 5. Progress indicator during analysis
 */
export function BOQNormalizerUpload({
    onAnalysisComplete,
    analysing,
    onAnalysingChange,
}: BOQNormalizerUploadProps) {
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [parsing, setParsing] = useState(false);
    const [parseResult, setParseResult] = useState<NormalizerParseResponse | null>(null);
    const [selectedSheets, setSelectedSheets] = useState<Set<string>>(new Set());
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ─── File Validation ─────────────────────────────────────────
    const validateFile = (f: File): string | null => {
        const ext = "." + f.name.split(".").pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return `Invalid file type (${ext}). Only .xlsx and .xls files are accepted.`;
        }
        if (f.size > MAX_FILE_SIZE) {
            return `File too large (${(f.size / 1024 / 1024).toFixed(1)}MB). Maximum is 10MB.`;
        }
        return null;
    };

    // ─── Upload & Parse ──────────────────────────────────────────
    const handleFileParsed = useCallback(async (selectedFile: File) => {
        setError(null);
        const validationError = validateFile(selectedFile);
        if (validationError) {
            setError(validationError);
            return;
        }

        setFile(selectedFile);
        setParsing(true);

        try {
            const formData = new FormData();
            formData.append("file", selectedFile);

            const response = await fetch("/api/boq/normalizer/parse", {
                method: "POST",
                body: formData,
                credentials: "include",
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Parse failed");
            }

            const result: NormalizerParseResponse = await response.json();
            setParseResult(result);

            // Auto-select BOQ sheets
            const autoSelected = new Set<string>();
            for (const sheet of result.sheets) {
                if (sheet.isBoqSheet) autoSelected.add(sheet.name);
            }
            setSelectedSheets(autoSelected);

            const boqCount = result.sheets.filter(s => s.isBoqSheet).length;
            const nonBoqCount = result.sheets.length - boqCount;
            toast({
                title: "File parsed successfully",
                description: `${result.sheets.length} sheets found. ${boqCount} BOQ sheets selected, ${nonBoqCount} non-BOQ sheets deselected.`,
            });
        } catch (err: any) {
            setError(err.message || "Failed to parse file");
            setFile(null);
        } finally {
            setParsing(false);
        }
    }, [toast]);

    // ─── AI Interpret ────────────────────────────────────────────
    const handleAnalyse = async () => {
        if (!parseResult || selectedSheets.size === 0) return;

        // Filter rows to only selected sheets
        const rowsToInterpret = parseResult.rows.filter(r => selectedSheets.has(r.sheetName));
        if (rowsToInterpret.length === 0) {
            setError("No rows found in selected sheets.");
            return;
        }

        onAnalysingChange(true);
        setError(null);

        try {
            const response = await fetch("/api/boq/normalizer/interpret", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rows: rowsToInterpret }),
                credentials: "include",
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Interpretation failed");
            }

            const { rows: enrichedRows } = await response.json();
            onAnalysisComplete(enrichedRows);
        } catch (err: any) {
            setError(err.message || "AI analysis failed. Please try again.");
            onAnalysingChange(false);
        }
    };

    // ─── Drag & Drop ─────────────────────────────────────────────
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
    const handleDragLeave = () => setDragActive(false);
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFileParsed(droppedFile);
    };

    // ─── Sheet Toggle ────────────────────────────────────────────
    const toggleSheet = (name: string) => {
        setSelectedSheets(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const toggleAll = (checked: boolean) => {
        if (checked) {
            setSelectedSheets(new Set(parseResult?.sheets.map(s => s.name) || []));
        } else {
            setSelectedSheets(new Set());
        }
    };

    // ─── Reset ───────────────────────────────────────────────────
    const handleReset = () => {
        setFile(null);
        setParseResult(null);
        setSelectedSheets(new Set());
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    // ─── Selected row count ──────────────────────────────────────
    const selectedRowCount = parseResult
        ? parseResult.rows.filter(r => selectedSheets.has(r.sheetName)).length
        : 0;

    // ═════════════════════════════════════════════════════════════
    // RENDER: Dropzone state (no file parsed yet)
    // ═════════════════════════════════════════════════════════════
    if (!parseResult) {
        return (
            <div className="space-y-4">
                {/* Dropzone */}
                <div
                    className={`border-2 border-dashed rounded-xl p-12 text-center space-y-4 cursor-pointer transition-all duration-200  ${dragActive
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/30"
                        } ${parsing ? "pointer-events-none opacity-60" : ""}`}
                    onClick={() => !parsing && fileInputRef.current?.click()}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="hidden"
                        onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileParsed(f);
                        }}
                    />

                    {parsing ? (
                        <>
                            <div className="mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center animate-pulse">
                                <Loader2 className="h-7 w-7 text-emerald-600 animate-spin" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">Parsing file...</h3>
                                <p className="text-sm text-gray-500 mt-1">Detecting sheets, headers, and row structure</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                                <Upload className="h-7 w-7 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-gray-900">
                                    {dragActive ? "Drop your file here" : "Upload your BOQ file"}
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Drag and drop an Excel file (.xlsx, .xls) or click to browse
                                </p>
                            </div>
                            <div className="flex items-center justify-center gap-2">
                                <FileSpreadsheet className="h-4 w-4 text-gray-400" />
                                <span className="text-xs text-gray-400">Supported: .xlsx, .xls — Max 10MB</span>
                            </div>
                        </>
                    )}
                </div>

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        <XCircle className="h-4 w-4 flex-shrink-0" />
                        <span>{error}</span>
                        <Button variant="ghost" size="sm" className="ml-auto" onClick={handleReset}>
                            Try Again
                        </Button>
                    </div>
                )}
            </div>
        );
    }

    // ═════════════════════════════════════════════════════════════
    // RENDER: Sheet selection state (file parsed)
    // ═════════════════════════════════════════════════════════════
    const boqSheets = parseResult.sheets.filter(s => s.isBoqSheet);
    const nonBoqSheets = parseResult.sheets.filter(s => !s.isBoqSheet);

    return (
        <div className="space-y-6">
            {/* File Info */}
            <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-900">{file?.name}</p>
                        <p className="text-xs text-gray-500">
                            {parseResult.sheets.length} sheets • {parseResult.rows.length} total rows
                        </p>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset} disabled={analysing}>
                    Change File
                </Button>
            </div>

            {/* Project Metadata (if detected) */}
            {(parseResult.projectMeta.client || parseResult.projectMeta.location) && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div>
                        {parseResult.projectMeta.client && (
                            <p>Client: <span className="font-medium">{parseResult.projectMeta.client}</span></p>
                        )}
                        {parseResult.projectMeta.location && (
                            <p>Location: <span className="font-medium">{parseResult.projectMeta.location}</span></p>
                        )}
                    </div>
                </div>
            )}

            {/* Sheet Selection */}
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-gray-900">Select sheets to analyse</h3>
                    <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                        <Checkbox
                            checked={selectedSheets.size === parseResult.sheets.length}
                            onCheckedChange={(checked: boolean) => toggleAll(!!checked)}
                            disabled={analysing}
                        />
                        Select all
                    </label>
                </div>

                {/* BOQ Sheets */}
                <div className="space-y-1.5">
                    {boqSheets.map(sheet => (
                        <label
                            key={sheet.name}
                            className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${selectedSheets.has(sheet.name)
                                    ? "bg-emerald-50 border-emerald-200"
                                    : "bg-white border-gray-100 hover:bg-gray-50"
                                } ${analysing ? "pointer-events-none opacity-60" : ""}`}
                        >
                            <Checkbox
                                checked={selectedSheets.has(sheet.name)}
                                onCheckedChange={() => toggleSheet(sheet.name)}
                                disabled={analysing}
                            />
                            <div className="flex-1 flex items-center justify-between min-w-0">
                                <span className="text-sm text-gray-800 truncate">{sheet.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-emerald-600 font-medium bg-emerald-100 px-2 py-0.5 rounded-full">
                                        BOQ
                                    </span>
                                    <span className="text-xs text-gray-400">{sheet.rowCount} rows</span>
                                </div>
                            </div>
                        </label>
                    ))}
                </div>

                {/* Non-BOQ Sheets (collapsed by default) */}
                {nonBoqSheets.length > 0 && (
                    <div className="mt-3">
                        <p className="text-xs text-gray-400 mb-1.5 flex items-center gap-1">
                            <Info className="h-3 w-3" />
                            {nonBoqSheets.length} non-BOQ sheet{nonBoqSheets.length > 1 ? "s" : ""} (summary, hardware, etc.) auto-deselected
                        </p>
                        <div className="space-y-1.5">
                            {nonBoqSheets.map(sheet => (
                                <label
                                    key={sheet.name}
                                    className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors cursor-pointer ${selectedSheets.has(sheet.name)
                                            ? "bg-gray-50 border-gray-200"
                                            : "bg-white border-gray-100 hover:bg-gray-50"
                                        } ${analysing ? "pointer-events-none opacity-60" : ""}`}
                                >
                                    <Checkbox
                                        checked={selectedSheets.has(sheet.name)}
                                        onCheckedChange={() => toggleSheet(sheet.name)}
                                        disabled={analysing}
                                    />
                                    <div className="flex-1 flex items-center justify-between min-w-0">
                                        <span className="text-sm text-gray-500 truncate">{sheet.name}</span>
                                        <span className="text-xs text-gray-400">{sheet.rowCount} rows</span>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Error */}
            {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Analyse Button */}
            <div className="flex flex-col items-center gap-2 pt-2">
                <Button
                    size="lg"
                    onClick={handleAnalyse}
                    disabled={selectedSheets.size === 0 || analysing}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8"
                >
                    {analysing ? (
                        <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Analysing {selectedRowCount} rows with AI...
                        </>
                    ) : (
                        <>
                            <Sparkles className="h-4 w-4 mr-2" />
                            Analyse with AI ({selectedRowCount} rows)
                        </>
                    )}
                </Button>
                <p className="text-xs text-gray-400">
                    Typically 15–30 seconds per 100 rows
                </p>
            </div>
        </div>
    );
}

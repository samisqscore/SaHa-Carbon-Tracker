import { useState } from "react";
import { BOQNormalizerUpload } from "@/components/BOQNormalizer/BOQNormalizerUpload";
import { BOQNormalizerReview } from "@/components/BOQNormalizer/BOQNormalizerReview";
import type { EnrichedBoqRow } from "@/components/BOQNormalizer/boqNormalizerTypes";
import { CheckCircle, FileSpreadsheet, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import Sidebar from "@/components/Layout/Sidebar";

type NormalizerState = "upload" | "analysing" | "review" | "pushing" | "done";

interface PushResult {
    projectId: string;
    projectName: string;
    insertedCount: number;
}

/**
 * BOQ Normalizer — Top-Level Page
 *
 * Standalone utility for normalizing complex BOQs into structured materials.
 * State machine: upload → analysing → review → pushing → done
 *
 * This page is independent of any project — users can normalise BOQs
 * before creating a project, then push results into an existing or new project.
 */
export default function BOQNormalizerPage() {
    const [state, setState] = useState<NormalizerState>("upload");
    const [enrichedRows, setEnrichedRows] = useState<EnrichedBoqRow[]>([]);
    const [pushResult, setPushResult] = useState<PushResult | null>(null);
    const [, navigate] = useLocation();

    if (state === "upload" || state === "analysing") {
        return (
            <div className="flex min-h-screen bg-gray-50">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                                BOQ Normalizer
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Upload your contractor BOQ and convert it into structured project materials using AI.
                            </p>
                        </div>
                        <BOQNormalizerUpload
                            onAnalysisComplete={(rows) => {
                                setEnrichedRows(rows);
                                setState("review");
                            }}
                            analysing={state === "analysing"}
                            onAnalysingChange={(v) => setState(v ? "analysing" : "upload")}
                        />
                    </div>
                </main>
            </div>
        );
    }

    if (state === "review" || state === "pushing") {
        return (
            <div className="flex min-h-screen bg-gray-50">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
                                BOQ Normalizer — Review
                            </h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Review AI-classified materials. Edit any field before pushing to a project.
                            </p>
                        </div>
                        <BOQNormalizerReview
                            rows={enrichedRows}
                            onRowsChange={setEnrichedRows}
                            pushing={state === "pushing"}
                            onPushingChange={(v) => setState(v ? "pushing" : "review")}
                            onPushComplete={(projectId, projectName, insertedCount) => {
                                setPushResult({ projectId, projectName, insertedCount });
                                setState("done");
                            }}
                        />
                    </div>
                </main>
            </div>
        );
    }

    if (state === "done" && pushResult) {
        return (
            <div className="flex min-h-screen bg-gray-50">
                <Sidebar />
                <main className="flex-1 overflow-y-auto">
                    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
                        <div className="flex flex-col items-center justify-center text-center space-y-6">
                            <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                                <CheckCircle className="h-10 w-10 text-green-600" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-gray-900">
                                    {pushResult.insertedCount} materials added
                                </h2>
                                <p className="text-gray-500 mt-1">
                                    Successfully pushed to <span className="font-medium text-gray-700">{pushResult.projectName}</span>
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => navigate(`/projects/${pushResult.projectId}?tab=materials`)}
                                >
                                    View Project Materials →
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setEnrichedRows([]);
                                        setPushResult(null);
                                        setState("upload");
                                    }}
                                >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Normalise Another BOQ
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    return null;
}

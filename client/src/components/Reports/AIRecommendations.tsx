import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AIRecommendationsProps {
    projectId: string;
}

export default function AIRecommendations({ projectId }: AIRecommendationsProps) {
    const [recommendations, setRecommendations] = useState<any[] | null>(null);

    const mutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/projects/${projectId}/recommendations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({}),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to fetch recommendations");
            }
            return res.json();
        },
        onSuccess: (data) => {
            setRecommendations(data.recommendations);
        },
    });

    return (
        <Card className="border-indigo-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full translate-x-16 -translate-y-16 pointer-events-none opacity-50" />
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-indigo-800">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    AI Sustainability Recommendations
                </CardTitle>
                <CardDescription>
                    Get low-carbon alternatives and strategies based on your top emitting materials.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {!recommendations && (
                    <div className="flex flex-col items-center justify-center p-6 bg-indigo-50/50 rounded-lg border border-indigo-100 border-dashed text-center space-y-3">
                        <p className="text-sm text-indigo-700 max-w-sm">
                            Our AI engine can analyze your top materials and suggest alternative, low-carbon materials commonly used in the industry.
                        </p>
                        <Button
                            onClick={() => mutation.mutate()}
                            disabled={mutation.isPending}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {mutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating Insights...
                                </>
                            ) : (
                                "Generate Insights"
                            )}
                        </Button>
                        {mutation.isError && (
                            <p className="text-xs text-red-500 mt-2">
                                AI recommendations unavailable. Configure DEEPSEEK_API_KEY to enable.
                            </p>
                        )}
                    </div>
                )}

                {recommendations && recommendations.length > 0 && (
                    <div className="space-y-3">
                        {recommendations.map((rec, i) => (
                            <Alert key={i} className="bg-white border-indigo-100 shadow-sm pr-12 relative group">
                                <AlertTitle className="text-sm font-semibold flex items-center gap-2 text-indigo-900">
                                    <ArrowRight className="h-3 w-3 text-indigo-400" />
                                    Replace: {rec.material}
                                </AlertTitle>
                                <AlertDescription className="text-xs text-slate-600 mt-1 leading-relaxed">
                                    {rec.suggestion}
                                </AlertDescription>
                                {rec.potentialReduction && (
                                    <div className="absolute top-3 right-3">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-[10px] font-medium bg-green-100 text-green-800">
                                            ↓ {rec.potentialReduction}
                                        </span>
                                    </div>
                                )}
                            </Alert>
                        ))}
                        <div className="pt-2 flex justify-between items-center text-[10px] text-slate-400">
                            <span>Indicative suggestions based on industry best practices.</span>
                            <Button variant="ghost" size="sm" onClick={() => setRecommendations(null)} className="h-auto p-0 text-indigo-500 hover:text-indigo-700 hover:bg-transparent">
                                Reset
                            </Button>
                        </div>
                    </div>
                )}

                {recommendations && recommendations.length === 0 && (
                    <p className="text-sm text-slate-500 text-center py-4">
                        No recommendations could be generated at this time. Please check your data or try again later.
                    </p>
                )}
            </CardContent>
        </Card>
    );
}

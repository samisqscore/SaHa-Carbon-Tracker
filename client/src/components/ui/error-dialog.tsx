import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, Copy, CheckCircle2 } from "lucide-react";
import { useError } from "@/hooks/use-error";
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function GlobalErrorDialog() {
    const { error, isOpen, dismissError } = useError();
    const [copied, setCopied] = useState(false);
    const [detailsOpen, setDetailsOpen] = useState(false);

    if (!error) return null;

    const handleCopy = () => {
        const errorText = JSON.stringify(error, (key, value) => {
            if (value instanceof Error) {
                return {
                    name: value.name,
                    message: value.message,
                    stack: value.stack,
                };
            }
            return value;
        }, 2);
        navigator.clipboard.writeText(errorText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatDetails = (details: unknown): string => {
        if (typeof details === 'string') return details;
        if (details instanceof Error) return details.stack || details.message;
        return JSON.stringify(details, null, 2);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && dismissError()}>
            <DialogContent className="sm:max-w-[500px] border-l-4 border-l-red-500">
                <DialogHeader>
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                        <AlertCircle className="h-6 w-6" />
                        <DialogTitle className="text-xl">Error Occurred</DialogTitle>
                    </div>
                    <DialogTitle className="text-lg font-semibold text-foreground">
                        {error.title}
                    </DialogTitle>
                    <DialogDescription className="text-base pt-2">
                        {error.message}
                    </DialogDescription>
                </DialogHeader>

                {!!error.details && (
                    <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mt-4">
                        <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="p-0 h-auto font-normal text-muted-foreground hover:text-foreground">
                                {detailsOpen ? "Hide Technical Details" : "Show Technical Details"}
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <ScrollArea className="h-[200px] w-full rounded-md border bg-muted p-4 mt-2">
                                <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                                    {formatDetails(error.details)}
                                </pre>
                            </ScrollArea>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                <DialogFooter className="flex gap-2 sm:justify-end mt-4">
                    <Button
                        variant="outline"
                        onClick={handleCopy}
                        className="gap-2"
                    >
                        {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                        {copied ? "Copied" : "Copy Error"}
                    </Button>
                    <Button onClick={dismissError}>
                        Dismiss
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


import React, { useState } from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Globe, Factory, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OnboardingWizard() {
    const { createOrganization, isLoading: isCreating } = useOrganization();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: '',
        industry: '',
        country: '',
        reportingRegion: 'Global',
        defaultUnitSystem: 'metric' as 'metric' | 'imperial'
    });

    const handleNext = () => {
        if (step < 3) setStep(step + 1);
        else handleSubmit();
    };

    const handleSubmit = async () => {
        try {
            await createOrganization(formData.name, formData.industry, formData.country);
        } catch (err) {
            console.error("Onboarding failed:", err);
        }
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg shadow-2xl border-primary/20 animate-in fade-in zoom-in duration-300">
                <CardHeader className="space-y-1">
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <Building2 className="w-6 h-6" />
                        <span className="font-bold tracking-tight">SaHa</span>
                    </div>
                    <CardTitle className="text-2xl">Welcome to SaHa</CardTitle>
                    <CardDescription>
                        Let's set up your organization to start measuring embodied carbon.
                    </CardDescription>
                </CardHeader>
                <CardContent className="py-6">
                    <div className="space-y-6">
                        {step === 1 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                <div className="space-y-2">
                                    <Label htmlFor="org-name">Organization Name</Label>
                                    <Input
                                        id="org-name"
                                        placeholder="e.g. Acme Construction"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="industry">Industry</Label>
                                    <Select
                                        value={formData.industry}
                                        onValueChange={(v) => setFormData({ ...formData, industry: v })}
                                    >
                                        <SelectTrigger id="industry">
                                            <SelectValue placeholder="Select industry" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Construction">Construction</SelectItem>
                                            <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                                            <SelectItem value="Real Estate">Real Estate</SelectItem>
                                            <SelectItem value="Logistics">Logistics</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                <div className="space-y-2">
                                    <Label htmlFor="country">Country / Primary Location</Label>
                                    <Input
                                        id="country"
                                        placeholder="e.g. United States, India"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="unit-system">Preferred Unit System</Label>
                                    <Select
                                        value={formData.defaultUnitSystem}
                                        onValueChange={(v: any) => setFormData({ ...formData, defaultUnitSystem: v })}
                                    >
                                        <SelectTrigger id="unit-system">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="metric">Metric (kg, m, m³)</SelectItem>
                                            <SelectItem value="imperial">Imperial (lb, ft, yd³)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                                <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                                        <Globe className="w-4 h-4" /> Ready to Launch
                                    </h4>
                                    <p className="text-sm text-muted-foreground">
                                        We'll create <strong>{formData.name}</strong> as your primary organization.
                                        You can manage team members and custom emission factors from the admin panel.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t pt-6 mt-4">
                    <div className="flex gap-1">
                        {[1, 2, 3].map((i) => (
                            <div
                                key={i}
                                className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary' : 'bg-primary/20'}`}
                            />
                        ))}
                    </div>
                    <Button
                        onClick={handleNext}
                        disabled={
                            isCreating ||
                            (step === 1 && (!formData.name || !formData.industry)) ||
                            (step === 2 && !formData.country)
                        }
                    >
                        {step === 3 ? (isCreating ? 'Creating...' : 'Start Reporting') : 'Next'}
                        {step < 3 && <ChevronRight className="ml-2 w-4 h-4" />}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}

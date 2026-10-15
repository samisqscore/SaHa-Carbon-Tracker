
import React from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import OnboardingWizard from './Onboarding/OnboardingWizard';
import { Loader2 } from 'lucide-react';

export default function OrganizationGuard({ children }: { children: React.ReactNode }) {
    const { organizations, isLoading, currentOrganization } = useOrganization();

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse">Initializing Organization Context...</p>
            </div>
        );
    }

    // If no organization exists, force the onboarding wizard
    if (organizations.length === 0 || !currentOrganization) {
        return <OnboardingWizard />;
    }

    return <>{children}</>;
}

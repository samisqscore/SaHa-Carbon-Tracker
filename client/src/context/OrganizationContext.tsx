
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

export type Organization = {
    id: string;
    name: string;
    industry?: string;
    country?: string;
    role?: 'org_admin' | 'estimator' | 'viewer';
};

interface OrganizationContextType {
    currentOrganization: Organization | null;
    organizations: Organization[];
    setCurrentOrganization: (org: Organization | null) => void;
    isLoading: boolean;
    createOrganization: (name: string, industry: string, country: string, reportingRegion?: string, defaultUnitSystem?: string) => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

/**
 * Custom hook to access organization context data.
 * @returns {OrganizationContextType} The organization context
 * @throws {Error} If used outside of OrganizationProvider
 */
export function useOrganization() {
    const context = useContext(OrganizationContext);
    if (!context) {
        throw new Error('useOrganization must be used within an OrganizationProvider');
    }
    return context;
}

/**
 * Provider component for Organization context.
 * Manages current organization state, fetches user's organizations,
 * and handles organization creation.
 */
export function OrganizationProvider({ children }: { children: ReactNode }) {
    const [currentOrganization, setCurrentOrganizationState] = useState<Organization | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { isAuthenticated } = useAuth();

    // Fetch user's organizations - MOVED UP to avoid initialization errors
    const { data: organizations = [], isLoading } = useQuery<Organization[]>({
        queryKey: ['/api/user/organizations'],
        enabled: isAuthenticated, // Only fetch if authenticated
        queryFn: async () => {
            const res = await apiRequest('GET', '/api/user/organizations');
            return res.json();
        },
        // Don't retry endlessly if 404
        retry: 1
    });

    // Load selected org from local storage on mount (or when orgs load)
    useEffect(() => {
        const storedOrgId = localStorage.getItem('saha_active_org_id');
        // Fix for "undefined" string in localstorage
        if (storedOrgId === "undefined" || storedOrgId === "null") {
            localStorage.removeItem('saha_active_org_id');
            return;
        }

        if (storedOrgId && organizations.length > 0) {
            const org = organizations.find(o => o.id === storedOrgId);
            if (org) setCurrentOrganizationState(org);
        }
    }, [organizations]); // Depend on organizations to load after fetch

    // Sync state with fetching
    useEffect(() => {
        if (!isLoading && organizations.length > 0 && !currentOrganization) {
            // Auto-select first org if none selected
            const storedOrgId = localStorage.getItem('saha_active_org_id');
            // Strict check
            if (storedOrgId && storedOrgId !== "undefined" && storedOrgId !== "null") {
                const found = organizations.find(o => o.id === storedOrgId);
                if (found) {
                    setCurrentOrganizationState(found);
                    return;
                }
            }

            const toSet = organizations[0];
            setCurrentOrganizationState(toSet);
            // Persist partial selection logic
            localStorage.setItem('saha_active_org_id', toSet.id);
        }
    }, [organizations, isLoading, currentOrganization]);

    const setCurrentOrganization = (org: Organization | null) => {
        setCurrentOrganizationState(org);
        if (org) {
            localStorage.setItem('saha_active_org_id', org.id);
            queryClient.invalidateQueries();
        } else {
            localStorage.removeItem('saha_active_org_id');
        }
    };

    const createOrgMutation = useMutation({
        mutationFn: async (data: { name: string; industry: string; country: string; reportingRegion?: string; defaultUnitSystem?: string }) => {
            const res = await apiRequest('POST', '/api/organizations', data);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to create organization");
            }
            return res.json();
        },
        onSuccess: (newOrg) => {
            queryClient.invalidateQueries({ queryKey: ['/api/user/organizations'] });
            toast({
                title: "Organization created",
                description: `${newOrg.name} is now active.`,
            });
            setCurrentOrganization(newOrg);
            // Optionally close dialog via callback if we had one here, but parent handles it via success state usually.
        },
        onError: (error: any) => {
            toast({
                title: "Failed to create organization",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const createOrganization = async (name: string, industry: string, country: string, reportingRegion?: string, defaultUnitSystem?: string) => {
        await createOrgMutation.mutateAsync({ name, industry, country, reportingRegion, defaultUnitSystem });
    };

    return (
        <OrganizationContext.Provider value={{
            currentOrganization,
            organizations,
            setCurrentOrganization,
            isLoading,
            createOrganization
        }}>
            {children}
        </OrganizationContext.Provider>
    );
}

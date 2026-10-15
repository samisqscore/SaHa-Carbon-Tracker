
import React from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Building2, Check, Plus, ChevronsUpDown, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from "wouter";
// We'll implement CreateOrganizationDialog later
import { CreateOrganizationDialog } from './CreateOrganizationDialog';

/**
 * Component for switching between organizations and creating new ones.
 * Displays a dropdown menu in the header.
 *
 * @component
 */
export function OrganizationSwitcher() {
    const { currentOrganization, organizations, setCurrentOrganization } = useOrganization();
    const [_, setLocation] = useLocation();
    const [showCreateDialog, setShowCreateDialog] = React.useState(false);

    // If no orgs, show placeholder or create button
    if (organizations.length === 0) {
        return (
            <>
                <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Organization
                </Button>
                <CreateOrganizationDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
            </>
        );
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-label="Select organization"
                        className="w-[200px] justify-between"
                    >
                        <Building2 className="mr-2 h-4 w-4" />
                        {currentOrganization?.name || "Select Organization"}
                        <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-[200px]">
                    <DropdownMenuLabel>Organizations</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {organizations.map((org) => (
                        <DropdownMenuItem
                            key={org.id}
                            onSelect={() => setCurrentOrganization(org)}
                            className="text-sm"
                        >
                            <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                            {org.name}
                            <Check
                                className={cn(
                                    "ml-auto h-4 w-4",
                                    currentOrganization?.id === org.id ? "opacity-100" : "opacity-0"
                                )}
                            />
                        </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {currentOrganization?.role === 'org_admin' && (
                        <DropdownMenuItem onSelect={() => setLocation('/settings')}>
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => setShowCreateDialog(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create New
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <CreateOrganizationDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} />
        </>
    );
}

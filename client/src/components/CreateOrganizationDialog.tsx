
import React from 'react';
import { useOrganization } from '@/context/OrganizationContext';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const createOrgSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    industry: z.string().min(1, "Industry is required"),
    country: z.string().min(1, "Country is required"),
});

type CreateOrgValues = z.infer<typeof createOrgSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Dialog component for creating a new organization.
 * Uses react-hook-form with zod validation.
 *
 * @component
 * @example
 * return (
 *   <CreateOrganizationDialog open={isOpen} onOpenChange={setIsOpen} />
 * )
 */
export function CreateOrganizationDialog({ open, onOpenChange }: Props) {
    const { createOrganization } = useOrganization();
    const form = useForm<CreateOrgValues>({
        resolver: zodResolver(createOrgSchema),
        defaultValues: {
            name: '',
            industry: '',
            country: '',
        },
    });

    const onSubmit = async (values: CreateOrgValues) => {
        try {
            await createOrganization(values.name, values.industry, values.country);
            onOpenChange(false);
            form.reset();
        } catch (error: any) {
            console.error("Failed to create org", error);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>
                        Create a new organization to manage your projects and team.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Organization Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Acme Inc." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="industry"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Industry</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Construction, Tech, etc." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="country"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Country</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Country" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit">Create Organization</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

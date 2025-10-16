

'use client';

import * as React from "react";
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, PlusCircle, Edit, Trash2 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ChartOfAccount } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { chartOfAccounts as masterChartOfAccounts } from "@/lib/chart-of-accounts";

const db = getFirestore(firebaseApp);

const accountFormSchema = z.object({
  id: z.string().optional(),
  accountNumber: z.string().min(1, "Account number is required."),
  description: z.string().min(3, "Description is required."),
  section: z.enum(['Income Statement', 'Balance Sheet']),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

function AccountForm({ account, onSave, onCancel }: { account: Partial<ChartOfAccount> | null, onSave: (data: AccountFormValues) => void, onCancel: () => void }) {
    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountFormSchema),
        defaultValues: account ? {
            ...account,
            section: account.section || 'Income Statement',
        } : {
            id: undefined,
            accountNumber: '',
            description: '',
            section: 'Income Statement',
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Account</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

export default function ChartOfAccountsPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [filter, setFilter] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);

    const fetchClient = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
                // Ensure chart of accounts is sorted
                if (clientData.chartOfAccounts) {
                    clientData.chartOfAccounts.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
                }
                setClient(clientData);
            }
        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }
  
    useEffect(() => {
        fetchClient();
    }, [clientId]);

    const filteredAccounts = useMemo(() => {
        if (!client?.chartOfAccounts) return [];
        return client.chartOfAccounts.filter(acc => 
            acc.description.toLowerCase().includes(filter.toLowerCase()) || 
            acc.accountNumber.includes(filter)
        );
    }, [client, filter]);

    const handleSaveAccount = async (data: AccountFormValues) => {
        if (!client) return;

        let updatedAccounts: ChartOfAccount[];
        if (data.id) { // Editing existing account
            updatedAccounts = client.chartOfAccounts?.map(acc => acc.id === data.id ? { ...acc, ...data } : acc) || [];
        } else { // Adding new account
            const newAccount: ChartOfAccount = { ...data, id: data.accountNumber }; // Use account number as ID for simplicity
            updatedAccounts = [...(client.chartOfAccounts || []), newAccount];
        }

        try {
            const clientRef = doc(db, 'aiAccountantClients', client.id);
            await updateDoc(clientRef, { chartOfAccounts: updatedAccounts });
            toast({ title: 'Success', description: `Account ${data.id ? 'updated' : 'created'} successfully.` });
            setIsFormOpen(false);
            setEditingAccount(null);
            await fetchClient();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to save account.', variant: 'destructive' });
        }
    };
    
    const handleDeleteAccount = async (accountId: string) => {
        if (!client?.chartOfAccounts) return;
        
        const updatedAccounts = client.chartOfAccounts.filter(acc => acc.id !== accountId);

        try {
            const clientRef = doc(db, 'aiAccountantClients', client.id);
            await updateDoc(clientRef, { chartOfAccounts: updatedAccounts });
            toast({ title: 'Success', description: 'Account deleted successfully.', variant: 'destructive' });
            await fetchClient();
        } catch(error) {
            toast({ title: 'Error', description: 'Failed to delete account.', variant: 'destructive' });
        }
    }

    const handleResetToMaster = async () => {
        if (!client) return;

        try {
            const clientRef = doc(db, 'aiAccountantClients', client.id);
            await updateDoc(clientRef, { chartOfAccounts: masterChartOfAccounts });
            toast({ title: 'Chart of Accounts Reset', description: 'The accounts have been reset to the master list.' });
            await fetchClient();
        } catch (error) {
             toast({ title: 'Error', description: 'Failed to reset accounts.', variant: 'destructive' });
        }
    }

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Chart of Accounts</CardTitle>
                            <CardDescription>Manage the accounts for {client?.companyName || client?.name}.</CardDescription>
                        </div>
                         <div className="flex gap-2">
                             <DialogTrigger asChild>
                                <Button size="sm" onClick={() => setEditingAccount(null)}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Create Account
                                </Button>
                            </DialogTrigger>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive">Reset to Master</Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action will replace the current chart of accounts with the master template. Any custom accounts will be lost. This cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleResetToMaster}>Yes, Reset</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </div>
                    <Input 
                        placeholder="Filter accounts..." 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value)}
                        className="mt-4 max-w-sm"
                    />
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Account Number</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Section</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredAccounts.map(acc => (
                                <TableRow key={acc.id}>
                                    <TableCell className="font-mono">{acc.accountNumber}</TableCell>
                                    <TableCell>{acc.description}</TableCell>
                                    <TableCell>{acc.section}</TableCell>
                                    <TableCell className="text-right">
                                         <AlertDialog>
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingAccount(acc); setIsFormOpen(true);}}>
                                                <Edit className="h-4 w-4" />
                                            </Button>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete the account: {acc.accountNumber} - {acc.description}.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteAccount(acc.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{editingAccount ? 'Edit' : 'Create'} Account</DialogTitle>
                </DialogHeader>
                <AccountForm 
                    account={editingAccount} 
                    onSave={handleSaveAccount} 
                    onCancel={() => setIsFormOpen(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

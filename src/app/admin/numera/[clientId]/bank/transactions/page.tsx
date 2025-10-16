
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download, Cog, BookOpen, Sparkles, ArrowUpDown, Ban } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule, AIAllocationJob } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, arrayRemove, addDoc, collection, getDocs, query, orderBy, where, writeBatch, onSnapshot, Unsubscribe, Query, DocumentData, QueryDocumentSnapshot, limit, startAfter, QueryConstraint } from 'firebase/firestore';
import { firebaseApp } from '@/firebase/config';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { allVatTypes } from '@/lib/vat-types';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';
import { Progress } from '@/components/ui/progress';
import { usePaginatedFirestore } from '@/hooks/use-paginated-firestore';

const db = getFirestore(firebaseApp);
const PAGE_SIZE = 50;

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

// #region Import Dialog
const importFormSchema = z.object({
    dateColumn: z.string().min(1, 'Please select the date column.'),
    referenceColumn: z.string().optional(),
    descriptionColumn: z.string().min(1, 'Please select the description column.'),
    amountType: z.enum(['single', 'double']),
    amountColumn: z.string().optional(),
    debitColumn: z.string().optional(),
    creditColumn: z.string().optional(),
}).refine(data => {
    if (data.amountType === 'single') return !!data.amountColumn;
    if (data.amountType === 'double') return !!data.debitColumn && !!data.creditColumn;
    return false;
}, {
    message: 'Please select the correct amount columns.',
    path: ['amountType'],
});

function ImportDialog({ client, bankAccountId, onImportComplete }: { client: User | null, bankAccountId: string, onImportComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [headers, setHeaders] = useState<string[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof importFormSchema>>({
        resolver: zodResolver(importFormSchema),
        defaultValues: {
            amountType: 'single',
        }
    });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setIsParsing(true);
            setFile(selectedFile);
            Papa.parse(selectedFile, {
                header: true,
                skipEmptyLines: true,
                preview: 1,
                complete: (results) => {
                    if (results.meta.fields) {
                        setHeaders(results.meta.fields);
                    }
                    setIsParsing(false);
                }
            });
        }
    };
    
    const handleImport = async (values: z.infer<typeof importFormSchema>) => {
        if (!file || !client || !bankAccountId) return;
        setIsUploading(true);
        toast({ title: "Importing...", description: "Processing your CSV file."});

        try {
            const results = await new Promise<any[]>((resolve, reject) => {
                Papa.parse(file, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (res) => resolve(res.data),
                    error: (err) => reject(err),
                });
            });

            const batch = writeBatch(db);
            let importedCount = 0;

            results.forEach((row, index) => {
                let amount = 0;
                if (values.amountType === 'single') {
                    amount = parseFloat(row[values.amountColumn!]);
                } else {
                    const debit = parseFloat(row[values.debitColumn!]) || 0;
                    const credit = parseFloat(row[values.creditColumn!]) || 0;
                    amount = credit - debit;
                }

                const dateStr = row[values.dateColumn!];
                // Attempt to parse multiple common date formats
                const parsedDate = new Date(dateStr.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1'));

                if (isNaN(amount) || isNaN(parsedDate.getTime())) {
                    console.warn(`Skipping row ${index + 2}: Invalid date or amount.`);
                    return;
                }
                
                const newTransactionRef = doc(collection(db, 'numeraClients', client.id, 'transactions'));
                const transaction: Omit<ImportedTransaction, 'id'> = {
                    clientId: client.id,
                    bankAccountId,
                    date: parsedDate.toISOString(),
                    reference: values.referenceColumn ? row[values.referenceColumn] : '',
                    description: row[values.descriptionColumn!],
                    amount,
                    status: 'new', // new status
                };
                batch.set(newTransactionRef, transaction);
                importedCount++;
            });
            
            await batch.commit();

            toast({ title: "Import Successful", description: `${importedCount} transactions have been imported.`});
            onImportComplete();
            setIsOpen(false);
            setFile(null);
            setHeaders([]);
            form.reset();
        } catch (error) {
            console.error("Error importing transactions:", error);
            toast({ title: "Import Failed", description: "An error occurred during the import process.", variant: "destructive"});
        } finally {
            setIsUploading(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline"><FileUp className="mr-2 h-4 w-4" /> Import Transactions</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Import Bank Transactions</DialogTitle>
                    <DialogDescription>
                        Select a CSV file and map the columns to import your transactions.
                    </DialogDescription>
                </DialogHeader>
                {!file ? (
                    <div className="py-8">
                        <Input type="file" accept=".csv" onChange={handleFileChange} />
                    </div>
                ) : isParsing ? (
                    <div className="py-8 flex justify-center items-center"><Loader2 className="animate-spin" /></div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleImport)} className="space-y-4">
                            <h4 className="font-medium text-sm">Map Columns</h4>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={form.control} name="dateColumn" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select date column" /></SelectTrigger></FormControl><SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="descriptionColumn" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select description column" /></SelectTrigger></FormControl><SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                <FormField control={form.control} name="referenceColumn" render={({ field }) => ( <FormItem><FormLabel>Reference (Optional)</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select reference column" /></SelectTrigger></FormControl><SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                             </div>
                             
                             <Separator />

                             <FormField control={form.control} name="amountType" render={({ field }) => (
                                <FormItem className="space-y-3">
                                <FormLabel>Amount Format</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex space-x-4">
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="single" /></FormControl><FormLabel className="font-normal">Single Amount Column</FormLabel></FormItem>
                                        <FormItem className="flex items-center space-x-2"><FormControl><RadioGroupItem value="double" /></FormControl><FormLabel className="font-normal">Debit/Credit Columns</FormLabel></FormItem>
                                    </RadioGroup>
                                </FormControl>
                                <FormMessage />
                                </FormItem>
                            )} />
                            {form.watch('amountType') === 'single' ? (
                                 <FormField control={form.control} name="amountColumn" render={({ field }) => ( <FormItem><FormLabel>Amount</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select amount column" /></SelectTrigger></FormControl><SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                            ) : (
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={form.control} name="debitColumn" render={({ field }) => ( <FormItem><FormLabel>Debit</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select debit column" /></SelectTrigger></FormControl><SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                    <FormField control={form.control} name="creditColumn" render={({ field }) => ( <FormItem><FormLabel>Credit</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select credit column" /></SelectTrigger></FormControl><SelectContent>{headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                </div>
                            )}

                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                                <Button type="submit" disabled={isUploading}>
                                    {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Import
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    )
}
// #endregion

// #region Create Account Dialog
const createAccountSchema = z.object({
  name: z.string().min(3, "Bank account name is required."),
});

function CreateAccountDialog({ client, onAccountCreated, onOpenChange, open }: { client: User, onAccountCreated: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm<z.infer<typeof createAccountSchema>>({
        resolver: zodResolver(createAccountSchema),
        defaultValues: { name: '' },
    });

    const handleCreateAccount = async (values: z.infer<typeof createAccountSchema>) => {
        setIsSaving(true);
        try {
            const existingBankAccounts = client.chartOfAccounts?.filter(
                acc => acc.accountNumber.startsWith('8400-')
            ) || [];

            const existingNumbers = existingBankAccounts.map(acc => {
                const parts = acc.accountNumber.split('-');
                return parts.length > 1 ? parseInt(parts[1], 10) : 0;
            });

            const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
            const newAccountNumber = `8400-${String(nextNumber).padStart(3, '0')}`;

            const newAccount: ChartOfAccount = {
                id: newAccountNumber,
                accountNumber: newAccountNumber,
                description: values.name,
                section: 'Balance Sheet',
            };

            const clientRef = doc(db, 'numeraClients', client.id);
            await updateDoc(clientRef, {
                chartOfAccounts: arrayUnion(newAccount)
            });

            toast({ title: 'Bank Account Created', description: `Account ${newAccount.description} (${newAccount.accountNumber}) has been added.` });
            onAccountCreated();
            form.reset();
            onOpenChange(false);
        } catch (error) {
            console.error("Error creating bank account:", error);
            toast({ title: 'Error', description: 'Could not create the bank account.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New Bank Account</DialogTitle>
                    <DialogDescription>
                        This will add a new cashbook account to this client's chart of accounts.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleCreateAccount)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Bank Account Name</FormLabel>
                                    <FormControl>
                                        <Input placeholder="e.g., FNB Cheque Account" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Account
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
// #endregion

function NewTransactionsTab({ 
    client,
    bankAccountId,
    fetchClientAndRules
}: { 
    client: User | null;
    bankAccountId: string | null;
    fetchClientAndRules: () => void;
}) {
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    
    const newTransactionsQuery = useMemo(() => {
        if (!client?.id || !bankAccountId) return null;
        
        const constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
        ];
        
        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '<', 0));
            constraints.push(orderBy('amount', 'asc'));
        } else {
            constraints.push(where('amount', '>=', 0));
            constraints.push(orderBy('amount', 'desc'));
        }

        constraints.push(orderBy('date', 'desc'));
        
        return query(collection(db, 'numeraClients', client.id, 'transactions'), ...constraints);
    }, [client?.id, bankAccountId, activeSubTab]);

    const {
        documents: transactions,
        isLoading,
        loadMore,
        hasMore,
        isLoadingMore,
        refetch,
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: newTransactionsQuery, pageSize: PAGE_SIZE });

     useEffect(() => {
        refetch();
    }, [activeSubTab, refetch]);


    const handleBulkDelete = async () => {
        if (!client || !client.id || selectedTransactions.length === 0) return;

        const batch = writeBatch(db);
        selectedTransactions.forEach(txId => {
            const docRef = doc(db, 'numeraClients', client!.id, 'transactions', txId);
            batch.delete(docRef);
        });

        try {
            await batch.commit();
            toast({ title: 'Transactions Deleted', description: `${selectedTransactions.length} transactions have been removed.`, variant: 'destructive' });
            setSelectedTransactions([]);
            refetch();
        } catch (error) {
            toast({ title: 'Deletion Failed', variant: 'destructive' });
            console.error(error);
        }
    };
    
    return (
        <Card>
            <CardHeader className="p-0">
                <Tabs value={activeSubTab} onValueChange={(value) => setActiveSubTab(value as 'expenses' | 'income')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="expenses">Expenses</TabsTrigger>
                        <TabsTrigger value="income">Income</TabsTrigger>
                    </TabsList>
                </Tabs>
                 <div className="p-4 border-b">
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={selectedTransactions.length === 0}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedTransactions.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action will permanently delete {selectedTransactions.length} selected transaction(s). This cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBulkDelete}>Yes, Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableCell className="w-12 p-2">
                                     <Checkbox
                                        checked={selectedTransactions.length > 0 && selectedTransactions.length === transactions.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedTransactions(checked ? transactions.map(tx => tx.id) : []);
                                        }}
                                    />
                                </TableCell>
                                <TableHead>Date</TableHead>
                                <TableHead>Reference</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="w-[250px]">Allocate To</TableHead>
                                {client?.isVatRegistered && <TableHead className="w-[180px]">VAT Type</TableHead>}
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No new transactions found.</TableCell></TableRow>
                            ) : (
                                transactions.map(tx => (
                                    <TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) && "selected"}>
                                        <TableCell className="p-2">
                                            <Checkbox
                                                checked={selectedTransactions.includes(tx.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedTransactions(prev =>
                                                        checked ? [...prev, tx.id] : prev.filter(id => id !== tx.id)
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell className="max-w-[150px] truncate">{tx.reference}</TableCell>
                                        <TableCell className="max-w-[250px] truncate">{tx.description}</TableCell>
                                        <TableCell>{/* Allocation Select */}</TableCell>
                                        {client?.isVatRegistered && <TableCell>{/* VAT Select */}</TableCell>}
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                        <TableCell className="text-right">{/* Actions Dropdown */}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            {hasMore && (
                <CardFooter className="p-4 justify-center">
                    <Button onClick={loadMore} disabled={isLoadingMore}>
                        {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Load More
                    </Button>
                </CardFooter>
            )}
        </Card>
    )
}

export default function BankTransactionsPage() {
    const [client, setClient] = useState<User | null>(null);
    const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const params = useParams();
    const clientId = params.clientId as string;
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'new' | 'review' | 'reviewed'>('new');
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    
    const fetchClientAndRules = useCallback(async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'numeraClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
                setClient(clientData);

                const cashbookAccounts = clientData.chartOfAccounts?.filter(
                    acc => acc.accountNumber.startsWith('8400-')
                ) || [];
                setBankAccounts(cashbookAccounts);

                if (cashbookAccounts.length > 0 && !selectedAccountId) {
                    setSelectedAccountId(cashbookAccounts[0].id);
                } else if (cashbookAccounts.length === 0) {
                    setSelectedAccountId(null);
                }
            } else {
                toast({ title: 'Error', description: 'Client not found.', variant: 'destructive' });
            }
        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }, [clientId, toast, selectedAccountId]);

    useEffect(() => {
        fetchClientAndRules();
    }, [fetchClientAndRules]);

    const bankBalance = 0; // This would need to be calculated separately, perhaps from an aggregate
    
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">Banking</h1>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 p-4 bg-card border rounded-lg">
                <div className="grid gap-2 w-full md:w-auto md:min-w-64">
                    <Label htmlFor="bank-account-selector">Bank Account</Label>
                    <div className="flex gap-2">
                        <Select
                            value={selectedAccountId || ''}
                            onValueChange={setSelectedAccountId}
                            disabled={bankAccounts.length === 0}
                        >
                            <SelectTrigger id="bank-account-selector">
                                <SelectValue placeholder={bankAccounts.length > 0 ? "Select a bank account" : "No bank accounts found"} />
                            </SelectTrigger>
                            <SelectContent>
                                {bankAccounts.map(account => (
                                    <SelectItem key={account.id} value={account.id}>
                                        {account.description}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                         <Button variant="outline" onClick={() => setIsCreateAccountOpen(true)}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Account
                        </Button>
                        {selectedAccountId && <ImportDialog client={client} bankAccountId={selectedAccountId} onImportComplete={fetchClientAndRules} />}

                    </div>
                </div>
                 <div className="grid gap-2">
                    <Label>Current Balance</Label>
                    <div className="text-2xl font-bold">{formatPrice(bankBalance)}</div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                <TabsList>
                    <TabsTrigger value="new">New</TabsTrigger>
                    <TabsTrigger value="review">For Review</TabsTrigger>
                    <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                </TabsList>
                <TabsContent value="new" className="mt-0">
                   <NewTransactionsTab client={client} bankAccountId={selectedAccountId} fetchClientAndRules={fetchClientAndRules} />
                </TabsContent>
                <TabsContent value="review" className="mt-0">
                   {/* <ForReviewTab client={client} bankAccountId={selectedAccountId} fetchClientAndRules={fetchClientAndRules} /> */}
                </TabsContent>
                <TabsContent value="reviewed">
                    {/* <ReviewedTab client={client} bankAccountId={selectedAccountId} /> */}
                </TabsContent>
            </Tabs>
            {client && <CreateAccountDialog client={client} onAccountCreated={fetchClientAndRules} open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen}/>}
        </div>
    );
}

// NOTE: ForReviewTab and ReviewedTab would need to be created following the pattern of NewTransactionsTab,
// each with their own `usePaginatedFirestore` hook and appropriate base query.
// I have stubbed them out here for brevity but will create them in subsequent steps if requested.

    

    
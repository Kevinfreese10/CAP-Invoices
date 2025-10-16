
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download, Cog, BookOpen, Sparkles, ArrowUpDown, Ban, ChevronLeft, ChevronRight } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule, AIAllocationJob } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, arrayRemove, addDoc, collection, getDocs, query, orderBy, where, writeBatch, onSnapshot, Unsubscribe, Query, DocumentData, QueryDocumentSnapshot, limit, startAfter, QueryConstraint } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem } from '@/components/ui/command';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

const PAGE_SIZE = 50;

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

// #region Import Dialog
const importFormSchema = z.object({
  file: z.any().refine(file => file instanceof File, "A CSV or Excel file is required."),
});

type ParsedTransaction = {
    Date: string;
    Description: string;
    Amount: number;
}

function ImportDialog({ client, bankAccountId, onImportComplete, currentBalance }: { client: User | null, bankAccountId: string, onImportComplete: () => void, currentBalance: number }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
    const [isParsing, setIsParsing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setIsParsing(true);
            setFile(selectedFile);
            setParsedTransactions([]);
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const fileContent = event.target?.result;
                if (!fileContent) {
                    setIsParsing(false);
                    return;
                }

                Papa.parse(fileContent as string, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        const data = results.data as any[];
                        const transactions: ParsedTransaction[] = data.map(row => ({
                            Date: row.Date,
                            Description: row.Description,
                            Amount: parseFloat(row.Amount)
                        })).filter(tx => tx.Date && tx.Description && !isNaN(tx.Amount));
                        
                        setParsedTransactions(transactions);
                        setIsParsing(false);
                    }
                });
            };
            reader.readAsText(selectedFile);
        }
    };
    
    const handleImport = async () => {
        if (!file || !client || !bankAccountId || parsedTransactions.length === 0) return;
        setIsUploading(true);
        toast({ title: "Importing...", description: "Processing your file."});

        try {
            const batch = writeBatch(db);
            let importedCount = 0;
            const dailyCounters: { [key: string]: number } = {};

            parsedTransactions.forEach((row, index) => {
                 const parsedDate = new Date(row.Date.replace(/(\\d{2})\/(\\d{2})\/(\\d{4})/, '$3-$2-$1'));

                if (isNaN(parsedDate.getTime())) {
                    console.warn(`Skipping row ${index + 2}: Invalid date format.`);
                    return;
                }
                
                const dateString = parsedDate.toISOString().split('T')[0].replace(/-/g, '');
                dailyCounters[dateString] = (dailyCounters[dateString] || 0) + 1;
                const dailyIndex = String(dailyCounters[dateString]).padStart(2, '0');
                const reference = `${dateString}${dailyIndex}`;
                
                const newTransactionRef = doc(collection(db, 'numeraClients', client.id, 'transactions'));
                const transaction: Omit<ImportedTransaction, 'id' | 'status'> = {
                    clientId: client.id,
                    date: parsedDate.toISOString(),
                    reference: reference,
                    description: row.Description,
                    amount: row.Amount,
                    bankAccountId: bankAccountId,
                };
                batch.set(newTransactionRef, { ...transaction, status: 'new' });
                importedCount++;
            });
            
            await batch.commit();

            toast({ title: "Import Successful", description: `${importedCount} transactions have been imported.`});
            onImportComplete();
            setIsOpen(false);
            setFile(null);
            setParsedTransactions([]);
        } catch (error) {
            console.error("Error importing transactions:", error);
            toast({ title: "Import Failed", description: "An error occurred during the import process.", variant: "destructive"});
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleDownloadExample = () => {
        const csvContent = "Date,Description,Amount\\nDD/MM/YYYY,Example Payment,-150.00\\nDD/MM/YYYY,Example Income,1000.50";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'example-statement.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    const importTotal = useMemo(() => {
        return parsedTransactions.reduce((sum, tx) => sum + tx.Amount, 0);
    }, [parsedTransactions]);

    const newBalance = currentBalance + importTotal;

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button><FileUp className="mr-2 h-4 w-4" /> Import Bank Statement</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Import Bank Statement</DialogTitle>
                    <DialogDescription>
                        Upload a CSV file to import transactions.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="flex items-center justify-between">
                         <Label htmlFor="statement-file">Statement File</Label>
                         <Button variant="outline" size="sm" onClick={handleDownloadExample}><Download className="mr-2 h-4 w-4"/> Download Example</Button>
                     </div>
                     <Input id="statement-file" type="file" accept=".csv" onChange={handleFileChange} />
                     {isParsing && <p className="text-sm text-muted-foreground flex items-center"><Loader2 className="mr-2 animate-spin"/> Parsing file...</p>}
                     {parsedTransactions.length > 0 && 
                        <div className="pt-4 space-y-4">
                            <p className="text-sm text-green-600">{parsedTransactions.length} transactions found in file.</p>
                            <Card className="bg-muted/50">
                                <CardContent className="p-4 grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Current Balance</p>
                                        <p className="font-semibold">R {formatPrice(currentBalance)}</p>
                                    </div>
                                     <div>
                                        <p className="text-xs text-muted-foreground">Import Amount</p>
                                        <p className={cn("font-semibold", importTotal >= 0 ? "text-green-600" : "text-destructive")}>R {formatPrice(importTotal)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">New Balance</p>
                                        <p className="font-semibold">R {formatPrice(newBalance)}</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                     }
                </div>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button type="button" onClick={handleImport} disabled={isUploading || isParsing || parsedTransactions.length === 0}>
                        {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save {parsedTransactions.length > 0 ? parsedTransactions.length : ''} Transactions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
// #endregion

// #region Bank Account Management Dialogs

const editAccountSchema = z.object({
  id: z.string(),
  name: z.string().min(3, "Bank account name is required."),
});

function EditAccountDialog({ account, client, onAccountUpdated, onOpenChange, open }: { account: ChartOfAccount, client: User, onAccountUpdated: () => void, open: boolean, onOpenChange: (open: boolean) => void }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm<z.infer<typeof editAccountSchema>>({
        resolver: zodResolver(editAccountSchema),
        defaultValues: { id: account.id, name: account.description },
    });

    const handleEditAccount = async (values: z.infer<typeof editAccountSchema>) => {
        setIsSaving(true);
        try {
            const updatedAccounts = client.chartOfAccounts?.map(acc =>
                acc.id === values.id ? { ...acc, description: values.name } : acc
            ) || [];

            const clientRef = doc(db, 'numeraClients', client.id);
            await updateDoc(clientRef, { chartOfAccounts: updatedAccounts });

            toast({ title: 'Bank Account Updated', description: `The account name has been changed to ${values.name}.` });
            onAccountUpdated();
            onOpenChange(false);
        } catch (error) {
            console.error("Error updating bank account:", error);
            toast({ title: 'Error', description: 'Could not update the bank account.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Bank Account</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleEditAccount)} className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Bank Account Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Save Changes</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

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
                        <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Bank Account Name</FormLabel><FormControl><Input placeholder="e.g., FNB Cheque Account" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create Account</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

// #endregion

const NewTransactionsTab = React.forwardRef<
    { refetch: () => void },
    { client: User | null; bankAccountId: string | null; }
>(({ client, bankAccountId }, ref) => {
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [allocations, setAllocations] = useState<{ [txId: string]: { accountId?: string, vatType?: VatType } }>({});
    const [searchAccountTerm, setSearchAccountTerm] = useState('');
    
    const newTransactionsQuery = useMemo(() => {
        if (!client?.id || !bankAccountId) return null;
        
        let constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
        ];
        
        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '<', 0));
        } else {
            constraints.push(where('amount', '>=', 0));
        }
        
        constraints.push(orderBy('amount', 'asc'));
        constraints.push(orderBy('date', 'desc'));
        
        return query(collection(db, 'numeraClients', client.id, 'transactions'), ...constraints);
    }, [client?.id, bankAccountId, activeSubTab]);

    const {
        documents: transactions,
        isLoading,
        goToNextPage,
        goToPreviousPage,
        canGoNext,
        canGoPrev,
        currentPage,
        refetch
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: newTransactionsQuery, pageSize: PAGE_SIZE });
    
    React.useImperativeHandle(ref, () => ({
        refetch,
    }));

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

    const handleBulkAllocate = async (accountId: string, vatType: VatType) => {
        if (!client || !client.id || selectedTransactions.length === 0) return;
        toast({ title: "Allocating...", description: `Allocating ${selectedTransactions.length} transactions.` });

        const batch = writeBatch(db);
        const transactionsToAllocate = transactions.filter(tx => selectedTransactions.includes(tx.id));

        for (const tx of transactionsToAllocate) {
            const { id, ...originalTxData } = tx;

            const allocatedTx: Omit<AllocatedTransaction, 'id' | 'status'> = {
                ...originalTxData,
                allocatedTo: { value: accountId, type: 'account' },
                vatType: vatType,
                vatAmount: 0, // Simplified for now
                allocatedAt: new Date(),
            };

            const newAllocatedRef = doc(collection(db, 'numeraClients', client.id, 'transactions'));
            batch.set(newAllocatedRef, { ...allocatedTx, status: 'allocated' });
            
            const originalTxRef = doc(db, 'numeraClients', client.id, 'transactions', id);
            batch.delete(originalTxRef);
        }

        try {
            await batch.commit();
            toast({ title: "Allocation Successful", description: `${selectedTransactions.length} transactions have been allocated.` });
            setSelectedTransactions([]);
            refetch();
        } catch (error) {
            console.error("Error during bulk allocation:", error);
            toast({ title: "Allocation Failed", variant: "destructive" });
        }
    };

    const filteredAccounts = useMemo(() => {
        if (!client?.chartOfAccounts) return [];
        return client.chartOfAccounts.filter(acc =>
            acc.description.toLowerCase().includes(searchAccountTerm.toLowerCase())
        ).sort((a,b) => a.description.localeCompare(b.description));
    }, [client?.chartOfAccounts, searchAccountTerm]);
    
    return (
        <Card>
            <CardHeader className="p-0">
                <Tabs value={activeSubTab} onValueChange={(value) => setActiveSubTab(value as 'expenses' | 'income')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="expenses">Expenses</TabsTrigger>
                        <TabsTrigger value="income">Income</TabsTrigger>
                    </TabsList>
                </Tabs>
                 <div className="p-4 border-b flex items-center gap-2">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">Actions <MoreHorizontal className="ml-2 h-4 w-4"/></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger disabled={selectedTransactions.length === 0}>Allocate Selected</DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="p-0">
                                     <Command>
                                        <CommandInput placeholder="Search account..." value={searchAccountTerm} onValueChange={setSearchAccountTerm} />
                                        <CommandList>
                                             <ScrollArea className="h-72">
                                                <CommandEmpty>No account found.</CommandEmpty>
                                                {filteredAccounts.map(acc => (
                                                    <DropdownMenuSub key={acc.id}>
                                                        <DropdownMenuSubTrigger>{acc.description}</DropdownMenuSubTrigger>
                                                        <DropdownMenuSubContent>
                                                            {allVatTypes.map(vat => (
                                                                <DropdownMenuItem key={vat.name} onSelect={() => handleBulkAllocate(acc.id, vat.name)}>
                                                                    {vat.label}
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuSubContent>
                                                    </DropdownMenuSub>
                                                ))}
                                             </ScrollArea>
                                        </CommandList>
                                    </Command>
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive" disabled={selectedTransactions.length === 0}>
                                        Delete Selected
                                    </DropdownMenuItem>
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
                        </DropdownMenuContent>
                     </DropdownMenu>

                     <Button variant="outline">Allocation Rules</Button>
                     <Button variant="outline">AI Allocate Selected <Sparkles className="ml-2 h-4 w-4"/></Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableCell className="w-12 p-2">
                                     <Checkbox
                                        checked={transactions.length > 0 && selectedTransactions.length === transactions.length}
                                        onCheckedChange={(checked) => {
                                            setSelectedTransactions(checked ? transactions.map(tx => tx.id) : []);
                                        }}
                                    />
                                </TableCell>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Reference</TableHead>
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
                                        <TableCell className="max-w-[250px] truncate">{tx.description}</TableCell>
                                        <TableCell className="font-mono">{tx.reference}</TableCell>
                                        <TableCell>
                                            <Select
                                              value={allocations[tx.id]?.accountId}
                                              onValueChange={(value) => setAllocations(prev => ({...prev, [tx.id]: {...prev[tx.id], accountId: value}}))}
                                            >
                                                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                                                <SelectContent>
                                                    {client?.chartOfAccounts?.map(acc => (
                                                        <SelectItem key={acc.id} value={acc.id}>
                                                            {acc.accountNumber} - {acc.description}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        {client?.isVatRegistered && (
                                            <TableCell>
                                                <Select
                                                   value={allocations[tx.id]?.vatType}
                                                   onValueChange={(value) => setAllocations(prev => ({...prev, [tx.id]: {...prev[tx.id], vatType: value as VatType}}))}
                                                >
                                                    <SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger>
                                                    <SelectContent>
                                                        {allVatTypes.map(vat => (
                                                            <SelectItem key={vat.name} value={vat.name}>{vat.label}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                        )}
                                        <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                        <TableCell className="text-right">{/* Actions Dropdown */}</TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            <CardFooter className="flex items-center justify-center p-4">
                <div className="flex items-center space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPreviousPage}
                        disabled={!canGoPrev || isLoading}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <span className="text-sm font-medium">
                        Page {currentPage}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextPage}
                        disabled={!canGoNext || isLoading}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    )
});
NewTransactionsTab.displayName = 'NewTransactionsTab';

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
    const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
    const newTransactionsTabRef = useRef<{ refetch: () => void }>(null);
    const [allTransactions, setAllTransactions] = useState<ImportedTransaction[]>([]);
    
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
                ).sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)) || [];

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
    
    useEffect(() => {
        if (!clientId) return;
        const q = query(collection(db, "numeraClients", clientId, "transactions"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const transactions = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ImportedTransaction));
            setAllTransactions(transactions);
        });
        return () => unsubscribe();
    }, [clientId]);


    const bankBalance = useMemo(() => {
        if (!selectedAccountId) return 0;
        return allTransactions
            .filter(tx => tx.bankAccountId === selectedAccountId)
            .reduce((sum, tx) => sum + tx.amount, 0);
    }, [allTransactions, selectedAccountId]);

    const lastImportDate = useMemo(() => {
        if (!selectedAccountId) return null;
        const accountTransactions = allTransactions.filter(tx => tx.bankAccountId === selectedAccountId);
        if (accountTransactions.length === 0) return null;

        const latestDate = new Date(
            Math.max(...accountTransactions.map(tx => new Date(tx.date).getTime()))
        );
        return latestDate;
    }, [allTransactions, selectedAccountId]);
    
    const selectedAccount = useMemo(() => {
        return bankAccounts.find(acc => acc.id === selectedAccountId);
    }, [bankAccounts, selectedAccountId]);
    
    const handleDeleteBankAccount = async () => {
        if (!client || !selectedAccountId) return;
        
        setIsLoading(true);
        toast({ title: "Deleting Account...", description: "Removing the bank account and all its transactions."});

        try {
            const batch = writeBatch(db);

            const updatedAccounts = client.chartOfAccounts?.filter(acc => acc.id !== selectedAccountId) || [];
            const clientRef = doc(db, 'numeraClients', client.id);
            batch.update(clientRef, { chartOfAccounts: updatedAccounts });

            const transactionsQuery = query(collection(db, 'numeraClients', client.id, 'transactions'), where('bankAccountId', '==', selectedAccountId));
            const transactionsSnapshot = await getDocs(transactionsQuery);
            transactionsSnapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            
            await batch.commit();

            toast({ title: "Bank Account Deleted", description: `Account and its ${transactionsSnapshot.size} transactions have been permanently removed.`});
            
            setSelectedAccountId(null);
            fetchClientAndRules();

        } catch (error) {
            console.error("Error deleting bank account:", error);
            toast({ title: "Deletion Failed", variant: 'destructive'});
            setIsLoading(false);
        }
    };
    
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">Banking</h1>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-8 p-4 bg-card border rounded-lg">
                <div className="grid gap-2 flex-grow">
                    <Label htmlFor="bank-account-selector">Bank Account</Label>
                    <div className="flex gap-2">
                        <Select
                            value={selectedAccountId || ''}
                            onValueChange={setSelectedAccountId}
                            disabled={bankAccounts.length === 0}
                        >
                            <SelectTrigger id="bank-account-selector" className="w-full md:w-[250px]">
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
                        
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="icon"><Settings className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onSelect={() => setIsCreateAccountOpen(true)}><PlusCircle className="mr-2 h-4 w-4"/>Create New Account</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setIsEditAccountOpen(true)} disabled={!selectedAccount}><Edit className="mr-2 h-4 w-4"/>Edit Selected Account</DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive" disabled={!selectedAccount}>
                                            <Trash2 className="mr-2 h-4 w-4"/>Delete Selected Account
                                        </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will permanently delete the account "{selectedAccount?.description}" and ALL of its associated transactions. This action cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDeleteBankAccount}>Yes, Delete Everything</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                     {client && selectedAccountId && <ImportDialog client={client} bankAccountId={selectedAccountId} onImportComplete={() => {
                         if(newTransactionsTabRef.current) {
                             newTransactionsTabRef.current.refetch();
                         }
                     }} currentBalance={bankBalance} />}
                     <div className="grid gap-1 text-left md:text-right">
                        <Label>Current Balance</Label>
                        <div className="text-2xl font-bold">R {formatPrice(bankBalance)}</div>
                    </div>
                    <div className="grid gap-1 text-left md:text-right">
                        <Label>Last Import</Label>
                        <div className="text-2xl font-bold">{lastImportDate ? format(lastImportDate, 'dd MMM yyyy') : 'N/A'}</div>
                    </div>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                <TabsList>
                    <TabsTrigger value="new">New</TabsTrigger>
                    <TabsTrigger value="review">For Review</TabsTrigger>
                    <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                </TabsList>
                <TabsContent value="new" className="mt-0">
                   <NewTransactionsTab 
                        ref={newTransactionsTabRef}
                        client={client} 
                        bankAccountId={selectedAccountId} 
                    />
                </TabsContent>
                <TabsContent value="review" className="mt-0">
                   {/* <ForReviewTab client={client} bankAccountId={selectedAccountId} fetchClientAndRules={fetchClientAndRules} /> */}
                </TabsContent>
                <TabsContent value="reviewed">
                    {/* <ReviewedTab client={client} bankAccountId={selectedAccountId} /> */}
                </TabsContent>
            </Tabs>
            {client && <CreateAccountDialog client={client} onAccountCreated={fetchClientAndRules} open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen}/>}
            {client && selectedAccount && <EditAccountDialog client={client} account={selectedAccount} onAccountUpdated={fetchClientAndRules} open={isEditAccountOpen} onOpenChange={setIsEditAccountOpen}/>}
        </div>
    );
}




'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download, Cog, BookOpen, Sparkles, ArrowUpDown } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, arrayRemove, addDoc, collection, getDocs, query, orderBy, where, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
};

const calculateVat = (amount: number, vatType: VatType, isVatRegistered: boolean): number => {
    if (!isVatRegistered) return 0;
    const isStandardVat = vatType === 'standard_rated_purchases' || vatType === 'standard_rated_sales' || vatType === 'capital_goods_purchases';
    if (isStandardVat) {
        // Assuming amount is VAT inclusive
        return amount * (15 / 115);
    }
    return 0;
};

const importFormSchema = z.object({
  file: z.instanceof(FileList).refine(files => files.length > 0, 'A file is required.'),
});

function ImportDialog({
  isOpen,
  onClose,
  onSave,
  currentBalance,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transactions: Omit<ImportedTransaction, 'clientId' | 'bankAccountId'>[]) => void;
  currentBalance: number;
}) {
  const [parsedTransactions, setParsedTransactions] = useState<Omit<ImportedTransaction, 'clientId' | 'bankAccountId'>[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(importFormSchema),
  });

  const importTotal = useMemo(() => {
    return parsedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [parsedTransactions]);

  const newPotentialBalance = useMemo(() => {
    return currentBalance + importTotal;
  }, [currentBalance, importTotal]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsParsing(true);
    setParsedTransactions([]);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        let transactions: any[] = [];
        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(data as string, { header: true });
          transactions = result.data;
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          transactions = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        } else {
          toast({ title: "Unsupported File", description: "Please upload a CSV or Excel file.", variant: "destructive" });
          return;
        }
        
        const dateCounters: { [key: string]: number } = {};

        const mappedTransactions = transactions.map((row: any, index: number) => {
            const dateStr = row.Date || row.date || row.TransactionDate;
            const descriptionStr = row.Description || row.description;
            const amountStr = row.Amount || row.amount || row.Debit || row.Credit;

            if (!dateStr || !descriptionStr || amountStr === undefined) return null;
            
            let date: Date;
            if (typeof dateStr === 'number') { // Excel date serial number
                date = new Date(Math.round((dateStr - 25569) * 864e5));
            } else if (String(dateStr).includes('/')) { // DD/MM/YYYY or MM/DD/YYYY format
                const parts = String(dateStr).split('/');
                if (parts.length === 3) {
                    const year = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
                    date = new Date(`${year}-${parts[1]}-${parts[0]}`);
                } else {
                    date = new Date(dateStr);
                }
            } else { // Standard date string
                date = new Date(dateStr);
            }

            if (isNaN(date.getTime())) {
                console.warn(`Invalid date format for row ${index}: ${dateStr}`);
                return null;
            }

            let amount;
            if (row.Debit && !row.Credit) {
                amount = -Math.abs(parseFloat(String(row.Debit).replace(/,/g, '')));
            } else if (row.Credit && !row.Debit) {
                amount = parseFloat(String(row.Credit).replace(/,/g, ''));
            } else {
                amount = parseFloat(String(amountStr).replace(/,/g, ''));
            }

            if (isNaN(amount)) return null;
            
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            const dd = String(date.getDate()).padStart(2, '0');
            const dateKey = `${yyyy}${mm}${dd}`;

            if (!dateCounters[dateKey]) {
                dateCounters[dateKey] = 0;
            }
            dateCounters[dateKey]++;
            const sequence = String(dateCounters[dateKey]).padStart(2, '0');

            return {
                id: `import-${Date.now()}-${index}`,
                date: date.toISOString().split('T')[0], // YYYY-MM-DD
                reference: `${dateKey}${sequence}`,
                description: descriptionStr,
                amount: amount,
            };
        }).filter(Boolean) as Omit<ImportedTransaction, 'clientId' | 'bankAccountId'>[];

        setParsedTransactions(mappedTransactions);
        toast({ title: 'File Parsed', description: `${mappedTransactions.length} transactions found.`});
      } catch (error) {
        toast({ title: "Parsing Error", description: "Could not read the file.", variant: "destructive"});
        console.error(error);
      } finally {
        setIsParsing(false);
      }
    };

    if (file.name.endsWith('.csv')) {
        reader.readAsText(file);
    } else {
        reader.readAsBinaryString(file);
    }
  };

  const handleSave = () => {
    onSave(parsedTransactions);
    onClose();
  };
  
  const handleClose = () => {
    form.reset();
    setParsedTransactions([]);
    onClose();
  };

  const handleDownloadExample = () => {
    const exampleData = [
      { Date: '01/07/2024', Description: 'Payment from Client X', Amount: 5000.00 },
      { Date: '02/07/2024', Description: 'Office Supplies', Amount: -250.50 },
      { Date: '03/07/2024', Description: 'Bank Charges', Amount: -45.00 },
    ];
    const csv = Papa.unparse(exampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import_example.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Import Bank Statement</DialogTitle>
                <DialogDescription>Upload a CSV or Excel file to import transactions.</DialogDescription>
            </DialogHeader>
             <div className="space-y-4">
                 <Form {...form}>
                    <form>
                        <FormField
                        control={form.control}
                        name="file"
                        render={({ field }) => (
                            <FormItem>
                            <div className="flex items-center justify-between">
                              <FormLabel>Statement File</FormLabel>
                              <Button type="button" variant="outline" size="sm" onClick={handleDownloadExample}>
                                <Download className="mr-2 h-4 w-4" />
                                Download Example
                              </Button>
                            </div>
                            <FormControl>
                                <Input type="file" accept=".csv, .xlsx, .xls" onChange={(e) => {
                                field.onChange(e.target.files);
                                handleFileChange(e);
                                }}/>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </form>
                </Form>
                {isParsing && <Loader2 className="animate-spin mx-auto"/>}

                {parsedTransactions.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Import Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-sm text-muted-foreground">Current Balance</p>
                                <p className="text-lg font-bold">{formatPrice(currentBalance)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Import Amount</p>
                                <p className="text-lg font-bold">{formatPrice(importTotal)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">New Potential Balance</p>
                                <p className="text-lg font-bold">{formatPrice(newPotentialBalance)}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}
             </div>
            <DialogFooter>
                <Button variant="ghost" onClick={handleClose}>Cancel</Button>
                <Button onClick={handleSave} disabled={parsedTransactions.length === 0}>
                    Save {parsedTransactions.length} Transactions
                </Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
  );
}

function ReviewedTransactionsTab({ client, fetchClient, openRuleDialogForTransaction, onUpdateAllocation }: { client: User | null; fetchClient: () => void; openRuleDialogForTransaction: (tx: AllocatedTransaction) => void; onUpdateAllocation: (txId: string, updates: Partial<AllocatedTransaction>) => void; }) {
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof AllocatedTransaction; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' });
    const { toast } = useToast();

    const isVatRegistered = client?.isVatRegistered || false;

    const handleBulkDelete = async () => {
        if (!client || selectedTransactions.length === 0) return;

        const remainingTransactions = client.allocatedTransactions?.filter(
            (tx) => !selectedTransactions.includes(tx.id)
        ) || [];

        try {
            const clientRef = doc(db, 'numeraClients', client.id);
            await updateDoc(clientRef, {
                allocatedTransactions: remainingTransactions
            });
            toast({ title: 'Transactions Deleted', description: `${selectedTransactions.length} transactions have been removed.` });
            setSelectedTransactions([]);
            await fetchClient();
        } catch (error) {
            toast({ title: 'Deletion Failed', description: 'Could not delete the transactions.', variant: 'destructive' });
            console.error(error);
        }
    };

    const handleBulkMarkAsNew = async () => {
        if (!client || selectedTransactions.length === 0) return;
        
        const transactionsToMove = client.allocatedTransactions?.filter(tx => selectedTransactions.includes(tx.id)) || [];
        const importedToMove = transactionsToMove.map(({ allocatedTo, allocatedAt, vatType, vatAmount, ...rest}) => ({
            ...rest,
            id: `import-${Date.now()}-${Math.random()}`
        }));

        const remainingAllocated = client.allocatedTransactions?.filter(tx => !selectedTransactions.includes(tx.id)) || [];
        
        try {
            const clientRef = doc(db, 'numeraClients', client.id);
            await updateDoc(clientRef, {
                allocatedTransactions: remainingAllocated,
                importedTransactions: arrayUnion(...importedToMove),
            });
            toast({ title: 'Transactions Moved', description: `${selectedTransactions.length} transactions have been moved back to New Transactions.` });
            setSelectedTransactions([]);
            await fetchClient();
        } catch (error) {
            toast({ title: 'Move Failed', description: 'Could not move the transactions.', variant: 'destructive' });
            console.error(error);
        }
    }


    const sortedAndFilteredTransactions = useMemo(() => {
        let transactions = [...(client?.allocatedTransactions || [])];
        
        // Filtering
        if (searchTerm) {
            const lowercasedFilter = searchTerm.toLowerCase();
            transactions = transactions.filter(tx => {
                const account = client?.chartOfAccounts?.find(acc => acc.id === tx.allocatedTo.value);
                const accountDescription = account ? `${account.accountNumber} - ${account.description}` : '';

                return (
                    tx.reference.toLowerCase().includes(lowercasedFilter) ||
                    tx.description.toLowerCase().includes(lowercasedFilter) ||
                    accountDescription.toLowerCase().includes(lowercasedFilter) ||
                    tx.vatType.toLowerCase().replace(/_/g, ' ').includes(lowercasedFilter) ||
                    tx.amount.toString().includes(lowercasedFilter)
                );
            });
        }
        
        // Sorting
        if (sortConfig !== null) {
            transactions.sort((a, b) => {
                const aValue = a[sortConfig.key];
                const bValue = b[sortConfig.key];

                if (sortConfig.key === 'date') {
                    const dateA = new Date(aValue).getTime();
                    const dateB = new Date(bValue).getTime();
                    if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                }
                
                if (typeof aValue === 'number' && typeof bValue === 'number') {
                     if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
                    if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
                    return 0;
                }
                
                const stringA = String(aValue).toLowerCase();
                const stringB = String(bValue).toLowerCase();

                if (stringA < stringB) return sortConfig.direction === 'ascending' ? -1 : 1;
                if (stringA > stringB) return sortConfig.direction === 'ascending' ? 1 : -1;
                return 0;
            });
        }
        
        return transactions;
    }, [client, searchTerm, sortConfig]);

    const requestSort = (key: keyof AllocatedTransaction) => {
        let direction: 'ascending' | 'descending' = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };
    
    const SortableHeader = ({ sortKey, children }: { sortKey: keyof AllocatedTransaction; children: React.ReactNode }) => (
        <TableHead onClick={() => requestSort(sortKey)} className="cursor-pointer">
            <div className="flex items-center">
                {children}
                {sortConfig?.key === sortKey && <ArrowUpDown className="ml-2 h-4 w-4" />}
            </div>
        </TableHead>
    );


    return (
        <Card>
            <CardHeader className="p-4 border-b">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" disabled={selectedTransactions.length === 0}>
                                    Actions <MoreHorizontal className="ml-2 h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onSelect={handleBulkMarkAsNew}>Mark as New</DropdownMenuItem>
                                <Separator />
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>Delete</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This action cannot be undone. This will permanently delete {selectedTransactions.length} transaction(s).</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Input 
                                placeholder="Search..." 
                                className="h-8 w-64 pr-8"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12 p-2">
                                    <Checkbox 
                                        checked={selectedTransactions.length === sortedAndFilteredTransactions.length && sortedAndFilteredTransactions.length > 0}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedTransactions(sortedAndFilteredTransactions.map(t => t.id));
                                            } else {
                                                setSelectedTransactions([]);
                                            }
                                        }}
                                    />
                                </TableHead>
                                <SortableHeader sortKey="date">Date</SortableHeader>
                                <SortableHeader sortKey="reference">Reference</SortableHeader>
                                <SortableHeader sortKey="description">Description</SortableHeader>
                                <SortableHeader sortKey="allocatedTo">Allocated To</SortableHeader>
                                {isVatRegistered && <SortableHeader sortKey="vatType">VAT Type</SortableHeader>}
                                <SortableHeader sortKey="amount">Amount</SortableHeader>
                                {isVatRegistered && <SortableHeader sortKey="vatAmount">VAT Amount</SortableHeader>}
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedAndFilteredTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                                        No reviewed transactions match your search.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                sortedAndFilteredTransactions.map(tx => {
                                    return (
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
                                            <TableCell>{tx.reference}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell className="w-[250px]">
                                                <Select
                                                    value={tx.allocatedTo.value}
                                                    onValueChange={(newValue) => onUpdateAllocation(tx.id, { allocatedTo: { value: newValue, type: 'account' }})}
                                                >
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {client?.chartOfAccounts?.map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id}>
                                                                {acc.accountNumber} - {acc.description}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            {isVatRegistered && (
                                                <TableCell className="w-[200px]">
                                                    <Select
                                                        value={tx.vatType}
                                                        onValueChange={(newValue: VatType) => onUpdateAllocation(tx.id, { vatType: newValue, vatAmount: calculateVat(tx.amount, newValue, isVatRegistered) })}
                                                    >
                                                        <SelectTrigger className="h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {allVatTypes.map(vt => (
                                                                <SelectItem key={vt.name} value={vt.name}>
                                                                    {vt.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                            {isVatRegistered && <TableCell className="text-right font-mono">{formatPrice(tx.vatAmount)}</TableCell>}
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onSelect={() => openRuleDialogForTransaction(tx)}>Create Rule</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    )
}

const ruleFormSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(3, "Description is required"),
  keywords: z.string().min(3, "At least one keyword is required"),
  accountId: z.string().min(1, "Please select an account to allocate to."),
  vatType: z.enum(allVatTypes.map(v => v.name) as [VatType, ...VatType[]]),
  scope: z.enum(['client', 'global']).default('client'),
});

function CreateRuleDialog({ isOpen, onClose, onSave, transaction, client }: { 
    isOpen: boolean; 
    onClose: () => void;
    onSave: (ruleData: Omit<AllocationRule, 'id'|'type'>, scope: 'client'|'global') => void;
    transaction: ImportedTransaction | AllocatedTransaction | null;
    client: User | null;
}) {
    const isVatRegistered = client?.isVatRegistered || false;
    const form = useForm<z.infer<typeof ruleFormSchema>>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: { scope: 'client', vatType: 'no_vat' }
    });

    useEffect(() => {
        if (transaction) {
            const allocatedTx = transaction as AllocatedTransaction;
            form.reset({
                description: transaction.description,
                keywords: transaction.description.split(' ').filter(s => s.length > 3).join(', '),
                accountId: allocatedTx.allocatedTo?.value || '',
                vatType: isVatRegistered ? (allocatedTx.vatType || 'no_vat') : 'no_vat',
                scope: 'client',
            });
        }
    }, [transaction, form, isVatRegistered]);

    const handleSave = (values: z.infer<typeof ruleFormSchema>) => {
        const ruleData = {
            description: values.description,
            keywords: values.keywords.split(',').map(k => k.trim().toLowerCase()),
            accountId: values.accountId,
            vatType: isVatRegistered ? values.vatType : 'no_vat',
        };
        onSave(ruleData, values.scope);
        onClose();
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Create New Allocation Rule</DialogTitle>
                    <DialogDescription>Based on transaction: "{transaction?.description}"</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                        <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Rule Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem> )}/>
                        <FormField control={form.control} name="accountId" render={({ field }) => ( <FormItem><FormLabel>Allocate To Account</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl><SelectContent>{client?.chartOfAccounts?.map(acc => ( <SelectItem key={acc.id} value={acc.id}>{acc.accountNumber} - {acc.description}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        {isVatRegistered && <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>}
                         <FormField control={form.control} name="scope" render={({ field }) => (
                            <FormItem className="space-y-3"><FormLabel>Rule Scope</FormLabel><FormControl>
                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="client" /></FormControl><FormLabel className="font-normal">Client Specific</FormLabel></FormItem>
                                    <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="global" /></FormControl><FormLabel className="font-normal">Global (for all clients)</FormLabel></FormItem>
                                </RadioGroup>
                            </FormControl><FormMessage /></FormItem>
                        )}/>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button type="submit">Create and Apply Rule</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function ManageRulesDialog({ 
    isOpen,
    onClose,
    client,
    globalRules,
    fetchClientAndRules
 } : { 
    isOpen: boolean; 
    onClose: () => void;
    client: User | null;
    globalRules: AllocationRule[];
    fetchClientAndRules: () => void;
}) {
    const [editingRule, setEditingRule] = useState<Partial<AllocationRule> & { scope?: 'client' | 'global' } | null>(null);
    const { toast } = useToast();
    const isCreatingNew = editingRule && !editingRule.id;

    const handleSaveRule = async (values: z.infer<typeof ruleFormSchema>) => {
        if (!client) return;

        const ruleData: Omit<AllocationRule, 'id'> = {
            description: values.description,
            keywords: values.keywords.split(',').map(k => k.trim().toLowerCase()),
            accountId: values.accountId,
            vatType: values.vatType,
            type: 'hard', // All user-created rules are 'hard'
        };

        try {
            if (values.id) { // Editing existing rule
                 if (values.scope === 'client') {
                    const clientRef = doc(db, 'numeraClients', client.id);
                    const updatedRules = client.allocationRules?.map(r => r.id === values.id ? { ...ruleData, id: values.id } : r) || [];
                    await updateDoc(clientRef, { allocationRules: updatedRules });
                } else { // Global
                    const ruleRef = doc(db, 'allocationRules', values.id);
                    await updateDoc(ruleRef, ruleData);
                }
                toast({ title: 'Rule Updated' });
            } else { // Creating new rule
                const newRule = { ...ruleData, id: `rule-${Date.now()}` };
                if (values.scope === 'client') {
                    const clientRef = doc(db, 'numeraClients', client.id);
                    await updateDoc(clientRef, { allocationRules: arrayUnion(newRule) });
                } else { // global
                    const newGlobalRuleRef = await addDoc(collection(db, 'allocationRules'), newRule);
                    const newGlobalRuleWithId = { ...newRule, id: newGlobalRuleRef.id };
                    
                    const clientsQuery = query(collection(db, 'numeraClients'));
                    const clientsSnapshot = await getDocs(clientsQuery);
                    
                    const batch = writeBatch(db);
                    clientsSnapshot.forEach(clientDoc => {
                        const clientRef = doc(db, 'numeraClients', clientDoc.id);
                        batch.update(clientRef, {
                            allocationRules: arrayUnion(newGlobalRuleWithId)
                        });
                    });
                    await batch.commit();
                }
                toast({ title: 'Rule Created' });
            }

            setEditingRule(null);
            fetchClientAndRules();
        } catch (error) {
            toast({ title: 'Save Failed', description: 'Could not save the rule.', variant: 'destructive'});
            console.error(error);
        }
    };

    const handleDeleteRule = async (ruleId: string, scope: 'client' | 'global') => {
        if (!client) return;
        try {
            if (scope === 'client') {
                const clientRef = doc(db, 'numeraClients', client.id);
                const ruleToDelete = client.allocationRules?.find(r => r.id === ruleId);
                if (ruleToDelete) {
                    await updateDoc(clientRef, { allocationRules: arrayRemove(ruleToDelete) });
                }
            } else {
                await deleteDoc(doc(db, 'allocationRules', ruleId));
            }
            toast({ title: 'Rule Deleted', variant: 'destructive' });
            fetchClientAndRules();
        } catch (error) {
            toast({ title: 'Delete Failed', description: 'Could not delete the rule.', variant: 'destructive'});
            console.error(error);
        }
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) { setEditingRule(null); onClose(); }}}>
            <DialogContent className="sm:max-w-xl">
                 <DialogHeader>
                    <DialogTitle>Manage Allocation Rules</DialogTitle>
                     <DialogDescription>
                        Create a new rule, or edit an existing one. Any changes will be applied to future transactions.
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                    <Button variant="outline" size="sm" onClick={() => setEditingRule({ scope: 'client' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Create New Rule
                    </Button>
                    
                    {editingRule ? (
                        <Card>
                            <CardContent className="pt-6">
                                <RuleForm
                                    key={editingRule.id || 'new'}
                                    initialData={editingRule}
                                    onSave={handleSaveRule}
                                    onCancel={() => setEditingRule(null)}
                                    client={client}
                                />
                            </CardContent>
                        </Card>
                    ) : (
                         <Tabs defaultValue="client" className="w-full">
                            <TabsList>
                                <TabsTrigger value="client">Client Specific ({client?.allocationRules?.length || 0})</TabsTrigger>
                                <TabsTrigger value="global">Global ({globalRules.length})</TabsTrigger>
                            </TabsList>
                            <TabsContent value="client">
                                <RuleList 
                                    rules={client?.allocationRules || []} 
                                    scope="client" 
                                    onEdit={setEditingRule}
                                    onDelete={handleDeleteRule}
                                />
                            </TabsContent>
                            <TabsContent value="global">
                                <RuleList 
                                    rules={globalRules} 
                                    scope="global" 
                                    onEdit={setEditingRule}
                                    onDelete={handleDeleteRule}
                                />
                            </TabsContent>
                        </Tabs>
                    )}
                 </div>
            </DialogContent>
        </Dialog>
    )
}

function RuleList({ rules, scope, onEdit, onDelete }: { rules: AllocationRule[], scope: 'client' | 'global', onEdit: (rule: Partial<AllocationRule> & {scope: 'client' | 'global'}) => void, onDelete: (id: string, scope: 'client' | 'global') => void }) {
    if (rules.length === 0) {
        return <p className="text-sm text-center text-muted-foreground p-8">No {scope} rules found.</p>
    }
    return (
        <div className="space-y-2">
            {rules.map((rule, index) => (
                <Card key={rule.id || index}>
                    <CardContent className="p-3 flex justify-between items-center">
                        <div className="text-sm">
                            <p className="font-semibold">{rule.description}</p>
                            <p className="text-xs text-muted-foreground">Keywords: {rule.keywords.join(', ')}</p>
                        </div>
                        <div className="flex items-center gap-1">
                             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit({...rule, scope})}>
                                <Edit className="h-4 w-4" />
                            </Button>
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the rule: "{rule.description}".</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => onDelete(rule.id, scope)}>Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    )
}

function RuleForm({ initialData, onSave, onCancel, client } : {
    initialData: Partial<AllocationRule> & { scope?: 'client' | 'global' };
    onSave: (values: z.infer<typeof ruleFormSchema>) => void;
    onCancel: () => void;
    client: User | null;
}) {
     const form = useForm<z.infer<typeof ruleFormSchema>>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: {
            id: initialData.id || '',
            description: initialData.description || '',
            keywords: initialData.keywords?.join(', ') || '',
            accountId: initialData.accountId || '',
            vatType: initialData.vatType || 'no_vat',
            scope: initialData.scope || 'client',
        }
    });

    return (
         <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Rule Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem> )}/>
                <FormField control={form.control} name="accountId" render={({ field }) => ( <FormItem><FormLabel>Allocate To Account</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl><SelectContent>{client?.chartOfAccounts?.map(acc => ( <SelectItem key={acc.id} value={acc.id}>{acc.accountNumber} - {acc.description}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                {client?.isVatRegistered && <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>}
                <FormField control={form.control} name="scope" render={({ field }) => (
                    <FormItem className="space-y-3"><FormLabel>Rule Scope</FormLabel><FormControl>
                        <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="client" /></FormControl><FormLabel className="font-normal">Client Specific</FormLabel></FormItem>
                            <FormItem className="flex items-center space-x-3 space-y-0"><FormControl><RadioGroupItem value="global" /></FormControl><FormLabel className="font-normal">Global (for all clients)</FormLabel></FormItem>
                        </RadioGroup>
                    </FormControl><FormMessage /></FormItem>
                )}/>
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Rule</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

const newAccountFormSchema = z.object({
  description: z.string().min(3, "Description is required"),
  accountNumber: z.string().min(7, "Account number is required").regex(/^\d{4}\/\d{3}$/, "Format must be XXXX/XXX"),
  section: z.enum(['Income Statement', 'Balance Sheet']),
});

function CreateAccountDialog({ isOpen, onClose, onSave, client } : {
    isOpen: boolean;
    onClose: () => void;
    onSave: (account: Omit<ChartOfAccount, 'id'>, andSelect: boolean) => void;
    client: User | null;
}) {
    const form = useForm<z.infer<typeof newAccountFormSchema>>({
        resolver: zodResolver(newAccountFormSchema),
        defaultValues: {
            description: '',
            accountNumber: '',
            section: 'Income Statement',
        }
    });

    const handleSave = (values: z.infer<typeof newAccountFormSchema>) => {
        onSave(values, true);
        onClose();
    }
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Account</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                         <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Account Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                         <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} placeholder="e.g., 3800/001" /></FormControl><FormMessage /></FormItem> )}/>
                          <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Financial Statement Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
                         <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button type="submit">Create Account</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

export default function BankTransactionsPage() {
  const [client, setClient] = useState<User | null>(null);
  const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const params = useParams();
  const clientId = params.clientId as string;
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('expenses');
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [isRuleDialogOpen, setIsRuleDialogOpen] = useState(false);
  const [ruleTransaction, setRuleTransaction] = useState<ImportedTransaction | AllocatedTransaction | null>(null);
  const [isManageRulesOpen, setIsManageRulesOpen] = useState(false);
  const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
  const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
  const [isCreateInlineAccountOpen, setIsCreateInlineAccountOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: keyof ImportedTransaction; direction: 'ascending' | 'descending' } | null>({ key: 'date', direction: 'descending' });
  const [lastSelectedTxId, setLastSelectedTxId] = useState<string | null>(null);

  const isVatRegistered = client?.isVatRegistered || false;

  const fetchClientAndRules = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
        // Fetch Client
        const clientRef = doc(db, 'numeraClients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
            const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
            setClient(clientData);
            const cashbookAccounts = clientData.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400/')) || [];
            setBankAccounts(cashbookAccounts);
            if (cashbookAccounts.length > 0 && !selectedAccountId) {
                setSelectedAccountId(cashbookAccounts[0].id);
            }
        } else { toast({ title: 'Error', description: 'Client not found.', variant: 'destructive'}); }

        // Fetch Global Rules
        const rulesQuery = query(collection(db, "allocationRules"), orderBy("description"));
        const rulesSnapshot = await getDocs(rulesQuery);
        const fetchedRules = rulesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AllocationRule));
        setGlobalRules(fetchedRules);

    } catch (e) { toast({ title: 'Error', description: 'Failed to fetch data.', variant: 'destructive'});
    } finally { setIsLoading(false); }
  }
  
  useEffect(() => { fetchClientAndRules(); }, [clientId]);

  const handleSaveTransactions = async (newTransactions: Omit<ImportedTransaction, 'clientId' | 'bankAccountId'>[]) => {
    if (!client || !selectedAccountId) return;
    
    const transactionsToProcess = newTransactions.map(tx => ({
        ...tx,
        clientId: client.id,
        bankAccountId: selectedAccountId,
    }));

    const allRules = [...(client.allocationRules || []), ...globalRules];
    const allocated: AllocatedTransaction[] = [];
    const unallocated: ImportedTransaction[] = [];
    let allocatedCount = 0;

    for (const tx of transactionsToProcess) {
        let matchedRule: AllocationRule | undefined;
        for (const rule of allRules) {
            if (rule.keywords.some(keyword => tx.description.toLowerCase().includes(keyword))) {
                matchedRule = rule;
                break;
            }
        }

        if (matchedRule) {
            allocated.push({
                ...tx,
                allocatedTo: { value: matchedRule.accountId, type: 'account' as const },
                vatType: isVatRegistered ? matchedRule.vatType : 'no_vat',
                vatAmount: calculateVat(tx.amount, matchedRule.vatType, isVatRegistered),
                allocatedAt: new Date(),
            });
            allocatedCount++;
        } else {
            unallocated.push(tx);
        }
    }
    
    try {
        const clientRef = doc(db, 'numeraClients', client.id);
        const updatePayload: { [key: string]: any } = {};
        if (unallocated.length > 0) {
            updatePayload.importedTransactions = arrayUnion(...unallocated);
        }
        if (allocated.length > 0) {
            updatePayload.allocatedTransactions = arrayUnion(...allocated);
        }

        if (Object.keys(updatePayload).length > 0) {
            await updateDoc(clientRef, updatePayload);
        }
        
        let toastMessage = `${transactionsToProcess.length} transactions imported.`;
        if (allocatedCount > 0) {
            toastMessage += ` ${allocatedCount} were automatically allocated.`
        }
        
        toast({ title: 'Import Successful', description: toastMessage });
        await fetchClientAndRules(); // Re-fetch to show new data
    } catch (error) {
        toast({ title: 'Import Failed', description: 'Could not save the transactions.', variant: 'destructive' });
        console.error(error);
    }
  };

  const handleDownloadExcel = () => {
    if (!client || !selectedAccountId) return;

    const wb = XLSX.utils.book_new();
    const today = new Date().toISOString().split('T')[0];
    const fileName = `${client.companyName || client.name}-Transactions-${today}.xlsx`;
    const allAccounts = client.chartOfAccounts || [];

    // Tab 1: Unallocated Income
    const incomeData = (client.importedTransactions || [])
        .filter(tx => tx.bankAccountId === selectedAccountId && tx.amount >= 0)
        .map(tx => ({
            Date: tx.date,
            Reference: tx.reference,
            Description: tx.description,
            Amount: tx.amount,
        }));
    const wsIncome = XLSX.utils.json_to_sheet(incomeData);
    XLSX.utils.book_append_sheet(wb, wsIncome, "Unallocated Income");

    // Tab 2: Unallocated Expenses
    const expenseData = (client.importedTransactions || [])
        .filter(tx => tx.bankAccountId === selectedAccountId && tx.amount < 0)
        .map(tx => ({
            Date: tx.date,
            Reference: tx.reference,
            Description: tx.description,
            Amount: tx.amount,
        }));
    const wsExpense = XLSX.utils.json_to_sheet(expenseData);
    XLSX.utils.book_append_sheet(wb, wsExpense, "Unallocated Expenses");

    // Tab 3: Reviewed Transactions
    const reviewedData = (client.allocatedTransactions || [])
        .filter(tx => tx.bankAccountId === selectedAccountId)
        .map(tx => {
            const account = allAccounts.find(acc => acc.id === tx.allocatedTo.value);
            return {
                Date: tx.date,
                Reference: tx.reference,
                Description: tx.description,
                'Allocated Account': account ? `${account.accountNumber} - ${account.description}` : tx.allocatedTo.value,
                'VAT Type': tx.vatType,
                'VAT Amount': tx.vatAmount,
                'Total Amount': tx.amount,
            };
        });
    const wsReviewed = XLSX.utils.json_to_sheet(reviewedData);
    XLSX.utils.book_append_sheet(wb, wsReviewed, "Reviewed Transactions");

    XLSX.writeFile(wb, fileName);
    toast({ title: 'Download Started', description: `Your file ${fileName} is downloading.`});
  };

  const transactions = useMemo(() => {
    if (!client || !selectedAccountId) return [];
    return client.importedTransactions?.filter(t => t.bankAccountId === selectedAccountId) || [];
  }, [client, selectedAccountId]);

  const expenseTransactions = useMemo(() => {
    return transactions.filter(t => t.amount < 0);
  }, [transactions]);
  
  const requestSort = (key: keyof ImportedTransaction) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const SortableHeader = ({ sortKey, children }: { sortKey: keyof ImportedTransaction; children: React.ReactNode }) => (
    <TableHead onClick={() => requestSort(sortKey)} className="cursor-pointer">
        <div className="flex items-center">
            {children}
            {sortConfig?.key === sortKey && <ArrowUpDown className="ml-2 h-4 w-4" />}
        </div>
    </TableHead>
  );

  const filteredAndSortedTransactions = useMemo(() => {
    let transactionsToSort = transactions;
    if (activeSubTab === 'income') {
      transactionsToSort = transactions.filter(t => t.amount >= 0);
    } else if (activeSubTab === 'expenses') {
      transactionsToSort = expenseTransactions;
    }
    
    if (sortConfig !== null) {
      transactionsToSort.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];

        if (sortConfig.key === 'date') {
            const dateA = new Date(aValue).getTime();
            const dateB = new Date(bValue).getTime();
            if (dateA < dateB) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (dateA > dateB) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        }

        if (typeof aValue === 'number' && typeof bValue === 'number') {
            if (aValue < bValue) return sortConfig.direction === 'ascending' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'ascending' ? 1 : -1;
            return 0;
        }

        const stringA = String(aValue).toLowerCase();
        const stringB = String(bValue).toLowerCase();

        if (stringA < stringB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (stringA > stringB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }

    return transactionsToSort;
  }, [transactions, activeSubTab, expenseTransactions, sortConfig]);

  const bankBalance = useMemo(() => {
    if (!client || !selectedAccountId) return 0;
    const importedBalance = client.importedTransactions?.filter(t => t.bankAccountId === selectedAccountId).reduce((sum, tx) => sum + tx.amount, 0) || 0;
    const allocatedBalance = client.allocatedTransactions?.filter(t => t.bankAccountId === selectedAccountId).reduce((sum, tx) => sum + tx.amount, 0) || 0;
    return importedBalance + allocatedBalance;
  }, [client, selectedAccountId]);
  
  const lastImportDate = useMemo(() => {
    if (!transactions || transactions.length === 0) return null;
    const latestTransaction = transactions.reduce((latest, current) => {
      return new Date(current.date) > new Date(latest.date) ? current : latest;
    });
    return new Date(latestTransaction.date).toLocaleDateString('en-GB');
  }, [transactions]);

  const handleBulkAllocate = async (accountId: string, vatType: VatType) => {
    if (!client || selectedTransactions.length === 0 || !accountId) return;

    const transactionsToAllocate = client.importedTransactions?.filter(tx => selectedTransactions.includes(tx.id)) || [];
    const remainingImported = client.importedTransactions?.filter(tx => !selectedTransactions.includes(tx.id)) || [];
    
    const allocatedTransactions = transactionsToAllocate.map(tx => ({
      ...tx,
      allocatedTo: { value: accountId, type: 'account' as const },
      vatType: isVatRegistered ? vatType : 'no_vat',
      vatAmount: calculateVat(tx.amount, vatType, isVatRegistered), 
      allocatedAt: new Date(),
    }));

    try {
      const clientRef = doc(db, 'numeraClients', client.id);
      await updateDoc(clientRef, {
        importedTransactions: remainingImported,
        allocatedTransactions: arrayUnion(...allocatedTransactions),
      });
      toast({ title: 'Transactions Allocated', description: `${selectedTransactions.length} transactions have been allocated and moved to Reviewed.`});
      setSelectedTransactions([]);
      await fetchClientAndRules(); // Re-fetch to show new data
    } catch (error) {
      toast({ title: 'Allocation Failed', description: 'Could not allocate the transactions.', variant: 'destructive' });
      console.error(error);
    }
  };


  const handleBulkDelete = async () => {
    if (!client || selectedTransactions.length === 0) return;

    const remainingTransactions = client.importedTransactions?.filter(
      (tx) => !selectedTransactions.includes(tx.id)
    ) || [];

    try {
      const clientRef = doc(db, 'numeraClients', client.id);
      await updateDoc(clientRef, {
        importedTransactions: remainingTransactions
      });
      toast({ title: 'Transactions Deleted', description: `${selectedTransactions.length} transactions have been removed.` });
      setSelectedTransactions([]);
      await fetchClientAndRules(); // Re-fetch to show new data
    } catch (error) {
      toast({ title: 'Deletion Failed', description: 'Could not delete the transactions.', variant: 'destructive' });
      console.error(error);
    }
  };
  
    const handleAiAllocate = async () => {
    if (!client || expenseTransactions.length === 0) return;
    
    setIsAiProcessing(true);
    toast({ title: "AI Allocation Started", description: `Processing ${expenseTransactions.length} expense transactions...` });

    const chartOfAccountsStr = JSON.stringify(client.chartOfAccounts?.map(a => ({ id: a.id, accountNumber: a.accountNumber, description: a.description })));
    let allocatedCount = 0;
    
    const newAllocated: AllocatedTransaction[] = [];
    const stillImported: ImportedTransaction[] = [];
    
    for (const tx of expenseTransactions) {
      try {
        const suggestion = await suggestTransactionAllocation({ description: tx.description, chartOfAccounts: chartOfAccountsStr });
        
        if (suggestion && suggestion.confidence > 50) {
          newAllocated.push({
            ...tx,
            allocatedTo: { value: suggestion.accountId, type: 'account' as const },
            vatType: isVatRegistered ? suggestion.vatType : 'no_vat',
            vatAmount: calculateVat(tx.amount, suggestion.vatType, isVatRegistered),
            allocatedAt: new Date(),
          });
          allocatedCount++;
          toast({ title: "AI Allocation", description: `"${tx.description}" allocated to ${suggestion.accountId} with ${suggestion.confidence}% confidence.` });
        } else {
            stillImported.push(tx);
            toast({ title: "AI Allocation Skipped", description: `AI was not confident enough for "${tx.description}".`, variant: "default"});
        }
      } catch (error) {
          stillImported.push(tx); // Keep transaction if AI fails
          console.error(`AI allocation failed for "${tx.description}":`, error);
          toast({ title: "AI Error", description: `Could not process "${tx.description}".`, variant: "destructive" });
      }
    }
    
    // Update non-expense transactions
    const nonExpenseTransactions = client.importedTransactions?.filter(t => t.amount >= 0) || [];
    const finalImportedTransactions = [...nonExpenseTransactions, ...stillImported];

    try {
        const clientRef = doc(db, 'numeraClients', client.id);
        await updateDoc(clientRef, {
            importedTransactions: finalImportedTransactions,
            allocatedTransactions: arrayUnion(...newAllocated),
        });

        toast({ title: "AI Allocation Complete", description: `${allocatedCount} out of ${expenseTransactions.length} expenses were automatically allocated.` });
        fetchClientAndRules();
    } catch (error) {
        toast({ title: "Update Failed", description: 'Could not save AI allocations to the database.', variant: 'destructive'});
        console.error("Firestore update failed after AI allocation:", error);
    } finally {
        setIsAiProcessing(false);
    }
  };

  const handleUpdateAllocation = async (txId: string, updates: Partial<AllocatedTransaction>) => {
    if (!client) return;

    setClient(prevClient => {
        if (!prevClient) return null;
        const updatedAllocatedTransactions = prevClient.allocatedTransactions?.map(tx => {
            if (tx.id === txId) {
                return { ...tx, ...updates };
            }
            return tx;
        }) || [];
        return { ...prevClient, allocatedTransactions: updatedAllocatedTransactions };
    });

    try {
      const clientRef = doc(db, 'numeraClients', client.id);
      const currentClientSnap = await getDoc(clientRef);
      const currentClientData = currentClientSnap.data() as User;
      
      const updatedAllocatedTransactions = currentClientData.allocatedTransactions?.map(tx => 
          tx.id === txId ? { ...tx, ...updates } : tx
      ) || [];

      await updateDoc(clientRef, { allocatedTransactions: updatedAllocatedTransactions });
      toast({ title: 'Transaction Updated', description: 'The allocation has been changed.' });
      
    } catch (error) {
      toast({ title: 'Update Failed', description: 'Could not update the transaction.', variant: 'destructive' });
      fetchClientAndRules(); // Re-fetch on error to revert optimistic update
      console.error(error);
    }
  };


  const openRuleDialog = (transaction: ImportedTransaction) => {
    setRuleTransaction(transaction);
    setIsRuleDialogOpen(true);
  };
  
  const handleSaveRule = async (ruleData: Omit<AllocationRule, 'id' | 'type'>, scope: 'client' | 'global') => {
    if (!client) return;

    const newRule: AllocationRule = {
        id: `rule-${Date.now()}`,
        type: 'hard', // For now, all created rules are hard
        ...ruleData,
    };
    
    try {
        if (scope === 'client') {
            const clientRef = doc(db, 'numeraClients', client.id);
            await updateDoc(clientRef, {
                allocationRules: arrayUnion(newRule)
            });
        } else { // global
            const newGlobalRuleRef = await addDoc(collection(db, 'allocationRules'), newRule);
            const newGlobalRuleWithId = { ...newRule, id: newGlobalRuleRef.id };
            
            const clientsQuery = query(collection(db, 'numeraClients'));
            const clientsSnapshot = await getDocs(clientsQuery);
            
            const batch = writeBatch(db);
            clientsSnapshot.forEach(clientDoc => {
                const clientRef = doc(db, 'numeraClients', clientDoc.id);
                batch.update(clientRef, {
                    allocationRules: arrayUnion(newGlobalRuleWithId)
                });
            });
            await batch.commit();
        }

        toast({ title: 'Allocation Rule Created', description: `New rule for "${ruleData.description}" has been saved.`});
        
        // --- Auto-apply and move logic ---
        const transactionsToMove = client.importedTransactions?.filter(tx => 
            newRule.keywords.some(keyword => tx.description.toLowerCase().includes(keyword))
        ) || [];

        if (transactionsToMove.length > 0) {
            const remainingImported = client.importedTransactions?.filter(tx => !transactionsToMove.some(m => m.id === tx.id)) || [];
            
            const allocatedTransactions = transactionsToMove.map(tx => ({
                ...tx,
                allocatedTo: { value: newRule.accountId, type: 'account' as const },
                vatType: newRule.vatType,
                vatAmount: calculateVat(tx.amount, newRule.vatType, isVatRegistered),
                allocatedAt: new Date(),
            }));
            
            const clientRef = doc(db, 'numeraClients', client.id);
            await updateDoc(clientRef, {
                importedTransactions: remainingImported,
                allocatedTransactions: arrayUnion(...allocatedTransactions),
            });
            
            toast({ title: 'Rule Applied', description: `${transactionsToMove.length} matching transaction(s) have been automatically allocated and moved.`});
        }
        // --- End of auto-apply logic ---

        await fetchClientAndRules(); // Refresh all data
    } catch (error) {
        toast({ title: 'Rule Creation Failed', description: 'Could not save the new rule.', variant: 'destructive'});
        console.error(error);
    }
  };
  
  const openRuleDialogForTransaction = (tx: AllocatedTransaction) => {
    setRuleTransaction(tx);
    setIsRuleDialogOpen(true);
  };


  const handleAccountSelection = (accountId: string) => {
    if (accountId === 'create-new') {
        setIsCreateAccountOpen(true);
    } else {
        setSelectedAccountId(accountId);
    }
  };

  const handleCreateAccount = async (account: Omit<ChartOfAccount, 'id' | 'section'>) => {
    if (!client) return;
    
    const newAccount: ChartOfAccount = {
        ...account,
        id: account.accountNumber,
        section: 'Balance Sheet',
    };
    try {
        const clientRef = doc(db, 'numeraClients', client.id);
        const clientSnap = await getDoc(clientRef);
        const existingClientData = clientSnap.data() as User;
        const existingAccounts = existingClientData.chartOfAccounts || [];
        
        if (existingAccounts.some(acc => acc.accountNumber === newAccount.accountNumber)) {
            toast({ title: 'Account Exists', description: `An account with number ${newAccount.accountNumber} already exists.`, variant: 'destructive'});
            return;
        }
        
        const updatedAccounts = [...existingAccounts, newAccount];

        await updateDoc(clientRef, {
            chartOfAccounts: updatedAccounts
        });

        toast({ title: 'Bank Account Created', description: `Account ${newAccount.description} has been added.` });
        await fetchClientAndRules();
        setSelectedAccountId(newAccount.id);
    } catch (error) {
        toast({ title: 'Creation Failed', description: 'Could not create the new account.', variant: 'destructive'});
        console.error(error);
    }
  };
  
   const handleCreateInlineAccount = async (account: Omit<ChartOfAccount, 'id' | 'section'>, andSelect?: boolean) => {
    if (!client) return;

    const newAccount: ChartOfAccount = {
        id: account.accountNumber, // Use account number as ID
        ...account,
    };
    try {
        const clientRef = doc(db, 'numeraClients', client.id);
        const clientSnap = await getDoc(clientRef);
        const existingClientData = clientSnap.data() as User;
        const existingAccounts = existingClientData.chartOfAccounts || [];

        if (existingAccounts.some(acc => acc.accountNumber === newAccount.accountNumber)) {
            toast({ title: 'Account Exists', description: `An account with number ${newAccount.accountNumber} already exists.`, variant: 'destructive' });
            return;
        }

        await updateDoc(clientRef, {
            chartOfAccounts: arrayUnion(newAccount)
        });

        toast({ title: 'Account Created', description: `Account ${newAccount.description} has been added.` });
        await fetchClientAndRules();

        if (andSelect && lastSelectedTxId) {
            handleSingleAllocate(lastSelectedTxId, newAccount.id, 'no_vat');
        }
    } catch (error) {
        toast({ title: 'Creation Failed', description: 'Could not create the new account.', variant: 'destructive' });
        console.error(error);
    }
  };
  
  const handleSingleAllocate = async (txId: string, accountId: string, vatType: VatType) => {
    if (!client) return;
    
    if (accountId === 'create-new-inline') {
        setLastSelectedTxId(txId);
        setIsCreateInlineAccountOpen(true);
        return;
    }

    const transaction = client.importedTransactions?.find(tx => tx.id === txId);
    if (!transaction) return;

    const remainingImported = client.importedTransactions?.filter(tx => tx.id !== txId) || [];
    
    const allocatedTransaction: AllocatedTransaction = {
      ...transaction,
      allocatedTo: { value: accountId, type: 'account' as const },
      vatType: isVatRegistered ? vatType : 'no_vat',
      vatAmount: calculateVat(transaction.amount, vatType, isVatRegistered), 
      allocatedAt: new Date(),
    };

    try {
      const clientRef = doc(db, 'numeraClients', client.id);
      await updateDoc(clientRef, {
        importedTransactions: remainingImported,
        allocatedTransactions: arrayUnion(allocatedTransaction),
      });
      toast({ title: 'Transaction Allocated', description: `Transaction has been allocated and moved to Reviewed.`});
      await fetchClientAndRules(); // Re-fetch to show new data
    } catch (error) {
      toast({ title: 'Allocation Failed', description: 'Could not allocate the transaction.', variant: 'destructive' });
      console.error(error);
    }
  };


  return (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Banking</h1>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 p-4 bg-card border rounded-lg">
            <div className="flex items-center gap-2">
                <Label>Bank or Credit Card</Label>
                <Select value={selectedAccountId || ''} onValueChange={handleAccountSelection}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="(None)" />
                    </SelectTrigger>
                    <SelectContent>
                        {bankAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                        ))}
                        <Separator />
                        <SelectItem value="create-new">Create new account...</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="text-center md:text-left">
                <p className="text-xl font-bold">{formatPrice(bankBalance)}</p>
                <p className="text-xs text-muted-foreground">Bank Balance</p>
            </div>
            <div className="text-center md:text-left">
                <p className="text-xl font-bold">{transactions.length}</p>
                 <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <span>To be Reviewed</span>
                    {lastImportDate && <span>(Last import: {lastImportDate})</span>}
                </div>
            </div>
             <div className="md:ml-auto">
                <Button variant="outline" onClick={handleDownloadExcel} disabled={!client}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                </Button>
            </div>
        </div>

        <Tabs defaultValue="new">
            <TabsList>
                <TabsTrigger value="new">New Transactions</TabsTrigger>
                <TabsTrigger value="reviewed">Reviewed Transactions</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="mt-0">
                <Card>
                    <CardHeader className="p-0">
                       <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto">
                                <TabsTrigger value="income" className="rounded-tl-md">
                                    Income ({transactions.filter(t => t.amount >= 0).length})
                                </TabsTrigger>
                                <TabsTrigger value="expenses" className="rounded-tr-md">
                                     Expenses ({expenseTransactions.length})
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="p-4 border-b">
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" disabled={selectedTransactions.length === 0}>
                                                Actions <MoreHorizontal className="ml-2 h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuSub>
                                                <DropdownMenuSubTrigger>Allocate Selected</DropdownMenuSubTrigger>
                                                <DropdownMenuSubContent className="max-h-[300px] overflow-y-auto">
                                                  {client?.chartOfAccounts?.map(acc => (
                                                        <DropdownMenuSub key={acc.id}>
                                                            <DropdownMenuSubTrigger>{acc.accountNumber} - {acc.description}</DropdownMenuSubTrigger>
                                                            <DropdownMenuSubContent>
                                                                {allVatTypes.map(vt => (
                                                                    <DropdownMenuItem key={vt.name} onSelect={() => handleBulkAllocate(acc.id, vt.name)}>
                                                                        {vt.label}
                                                                    </DropdownMenuItem>
                                                                ))}
                                                            </DropdownMenuSubContent>
                                                        </DropdownMenuSub>
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            <Separator />
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem className="text-destructive" onSelect={(e) => e.preventDefault()}>Delete</DropdownMenuItem>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                        <AlertDialogDescription>This action cannot be undone. This will permanently delete {selectedTransactions.length} transaction(s).</AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={handleBulkDelete}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <Button variant="default" size="sm" onClick={() => setIsImportDialogOpen(true)}>Import Bank Statements</Button>
                                    <Button variant="outline" size="sm" onClick={() => setIsManageRulesOpen(true)}>
                                        <BookOpen className="mr-2 h-4 w-4" />
                                        Allocation Rules
                                    </Button>
                                     {activeSubTab === 'expenses' && (
                                        <Button variant="outline" size="sm" onClick={handleAiAllocate} disabled={isAiProcessing}>
                                            {isAiProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                            AI Allocate
                                        </Button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <Input placeholder="Search..." className="h-8 w-40 pr-8" />
                                        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 p-2">
                                        <Checkbox 
                                            checked={filteredAndSortedTransactions.length > 0 && selectedTransactions.length === filteredAndSortedTransactions.length}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedTransactions(filteredAndSortedTransactions.map(t => t.id));
                                                } else {
                                                    setSelectedTransactions([]);
                                                }
                                            }}
                                        />
                                    </TableHead>
                                    <SortableHeader sortKey="date">Date</SortableHeader>
                                    <SortableHeader sortKey="reference">Reference</SortableHeader>
                                    <SortableHeader sortKey="description">Description</SortableHeader>
                                    <TableHead>Allocate To</TableHead>
                                    {isVatRegistered && <TableHead>VAT Type</TableHead>}
                                    <SortableHeader sortKey="amount">Spent</SortableHeader>
                                    <SortableHeader sortKey="amount">Received</SortableHeader>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={9} className="text-center h-24"><Loader2 className="animate-spin" /></TableCell></TableRow>
                                ) : filteredAndSortedTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                                            You have no new Bank Statement transactions to review. Import your Bank Statements or manually enter banking transactions below.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredAndSortedTransactions.map(tx => (
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
                                            <TableCell>{tx.reference}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell>
                                                <Select onValueChange={(value) => handleSingleAllocate(tx.id, value, 'no_vat')}>
                                                    <SelectTrigger className="h-8 w-[200px]">
                                                        <SelectValue placeholder="Select account" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="create-new-inline">Create new account...</SelectItem>
                                                        <Separator />
                                                        {client?.chartOfAccounts?.map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id}>
                                                                {acc.accountNumber} - {acc.description}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            {isVatRegistered && (
                                                 <TableCell>
                                                    <Select>
                                                        <SelectTrigger className="h-8 w-[180px]">
                                                            <SelectValue placeholder="Select VAT type" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {allVatTypes.map(vt => (
                                                                <SelectItem key={vt.name} value={vt.name}>
                                                                    {vt.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                            )}
                                            <TableCell className="text-right">{tx.amount < 0 ? formatPrice(Math.abs(tx.amount)) : ''}</TableCell>
                                            <TableCell className="text-right">{tx.amount >= 0 ? formatPrice(tx.amount) : ''}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" className="h-8" onClick={() => openRuleDialog(tx)}>
                                                    <Cog className="mr-2 h-4 w-4"/>
                                                    Create Allocation Rule
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                                 <TableRow>
                                    <TableCell className="p-2"></TableCell>
                                    <TableCell><Input className="h-8" placeholder="Date" /></TableCell>
                                    <TableCell><Input className="h-8" placeholder="Ref" /></TableCell>
                                    <TableCell><Input className="h-8" placeholder="Description" /></TableCell>
                                    <TableCell>
                                        <Select>
                                            <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Select account" /></SelectTrigger>
                                            <SelectContent>{client?.chartOfAccounts?.map(acc => ( <SelectItem key={acc.id} value={acc.id}>{acc.accountNumber} - {acc.description}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </TableCell>
                                     {isVatRegistered && (
                                        <TableCell>
                                            <Select>
                                                <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Select VAT type" /></SelectTrigger>
                                                <SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent>
                                            </Select>
                                        </TableCell>
                                     )}
                                    <TableCell><Input className="h-8" placeholder="R" /></TableCell>
                                    <TableCell><Input className="h-8" placeholder="R" /></TableCell>
                                     <TableCell>
                                        <Button variant="ghost" size="sm" className="h-8" disabled>
                                            <Cog className="mr-2 h-4 w-4"/>
                                            Create Allocation Rule
                                        </Button>
                                    </TableCell>
                                 </TableRow>
                            </TableBody>
                        </Table>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="reviewed">
                <ReviewedTransactionsTab 
                    client={client} 
                    fetchClient={fetchClientAndRules} 
                    openRuleDialogForTransaction={openRuleDialogForTransaction}
                    onUpdateAllocation={handleUpdateAllocation}
                />
            </TabsContent>
        </Tabs>
        
        <ImportDialog 
            isOpen={isImportDialogOpen}
            onClose={() => setIsImportDialogOpen(false)}
            onSave={handleSaveTransactions}
            currentBalance={bankBalance}
        />
        
        <CreateRuleDialog
            isOpen={isRuleDialogOpen}
            onClose={() => setIsRuleDialogOpen(false)}
            onSave={handleSaveRule}
            transaction={ruleTransaction}
            client={client}
        />

        <ManageRulesDialog
            isOpen={isManageRulesOpen}
            onClose={() => setIsManageRulesOpen(false)}
            client={client}
            globalRules={globalRules}
            fetchClientAndRules={fetchClientAndRules}
        />
        
        <CreateAccountDialog
            isOpen={isCreateAccountOpen}
            onClose={() => setIsCreateAccountOpen(false)}
            onSave={handleCreateAccount}
            client={client}
        />

        <CreateAccountDialog
            isOpen={isCreateInlineAccountOpen}
            onClose={() => setIsCreateInlineAccountOpen(false)}
            onSave={handleCreateInlineAccount}
            client={client}
        />
    </div>
  );
}






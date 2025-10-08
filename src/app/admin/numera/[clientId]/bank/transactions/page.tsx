
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
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download, Cog } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, arrayRemove } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { allVatTypes } from '@/lib/vat-types';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
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

        const mappedTransactions = transactions.map((row: any, index: number) => {
            const dateStr = row.Date || row.date || row.TransactionDate;
            const descriptionStr = row.Description || row.description;
            const amountStr = row.Amount || row.amount || row.Debit || row.Credit;

            if (!dateStr || !descriptionStr || amountStr === undefined) return null;

            let date;
            if (typeof dateStr === 'number') {
                date = new Date(Math.round((dateStr - 25569) * 864e5));
            } else {
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

            return {
                id: `import-${Date.now()}-${index}`,
                date: date.toISOString().split('T')[0], // YYYY-MM-DD
                description: descriptionStr,
                amount: isNaN(amount) ? 0 : amount,
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

function ReviewedTransactionsTab({ client, fetchClient }: { client: User | null; fetchClient: () => void }) {
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    const { toast } = useToast();

    const handleBulkDelete = async () => {
        if (!client || selectedTransactions.length === 0) return;

        const remainingTransactions = client.allocatedTransactions?.filter(
            (tx) => !selectedTransactions.includes(tx.id)
        ) || [];

        try {
            const clientRef = doc(db, 'clients', client.id);
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
            const clientRef = doc(db, 'clients', client.id);
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


    const allocatedTransactions = client?.allocatedTransactions || [];

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
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Move To</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                         <DropdownMenuItem>Other Account</DropdownMenuItem>
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
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Input placeholder="Search..." className="h-8 w-40 pr-8" />
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
                                        checked={selectedTransactions.length === allocatedTransactions.length && allocatedTransactions.length > 0}
                                        onCheckedChange={(checked) => {
                                            if (checked) {
                                                setSelectedTransactions(allocatedTransactions.map(t => t.id));
                                            } else {
                                                setSelectedTransactions([]);
                                            }
                                        }}
                                    />
                                </TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Allocated To</TableHead>
                                <TableHead>VAT Type</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                                <TableHead className="text-right">VAT Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {allocatedTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                                        No reviewed transactions yet.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                allocatedTransactions.map(tx => {
                                    const allocatedAccount = client?.chartOfAccounts?.find(a => a.id === tx.allocatedTo.value);
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
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell>{allocatedAccount ? `${allocatedAccount.accountNumber} - ${allocatedAccount.description}` : tx.allocatedTo.value}</TableCell>
                                            <TableCell>{allVatTypes.find(v => v.name === tx.vatType)?.label || tx.vatType}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(tx.amount)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(tx.vatAmount)}</TableCell>
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


export default function BankTransactionsPage() {
  const [client, setClient] = useState<User | null>(null);
  const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const params = useParams();
  const clientId = params.clientId as string;
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState('all');
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [allocationAccountId, setAllocationAccountId] = useState<string>('');
  const [allocationVatType, setAllocationVatType] = useState<VatType>('no_vat');


  const fetchClient = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
        const clientRef = doc(db, 'clients', clientId);
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
    } catch (e) { toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive'});
    } finally { setIsLoading(false); }
  }
  
  useEffect(() => { fetchClient(); }, [clientId]);

  const handleSaveTransactions = async (newTransactions: Omit<ImportedTransaction, 'clientId' | 'bankAccountId'>[]) => {
    if (!client || !selectedAccountId) return;

    const transactionsToSave = newTransactions.map(tx => ({
        ...tx,
        clientId: client.id,
        bankAccountId: selectedAccountId,
    }));
    
    try {
        const clientRef = doc(db, 'clients', client.id);
        await updateDoc(clientRef, {
            importedTransactions: arrayUnion(...transactionsToSave)
        });
        toast({ title: 'Import Successful', description: `${transactionsToSave.length} transactions have been imported.`});
        await fetchClient(); // Re-fetch to show new data
    } catch (error) {
        toast({ title: 'Import Failed', description: 'Could not save the transactions.', variant: 'destructive' });
        console.error(error);
    }
  };

  const transactions = useMemo(() => {
    if (!client || !selectedAccountId) return [];
    return client.importedTransactions?.filter(t => t.bankAccountId === selectedAccountId) || [];
  }, [client, selectedAccountId]);

  const filteredTransactions = useMemo(() => {
    if (activeSubTab === 'income') {
      return transactions.filter(t => t.amount >= 0);
    }
    if (activeSubTab === 'expenses') {
      return transactions.filter(t => t.amount < 0);
    }
    return transactions;
  }, [transactions, activeSubTab]);

  const bankBalance = useMemo(() => {
    if (!client || !selectedAccountId) return 0;
    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);
  
  const lastImportDate = useMemo(() => {
    if (!transactions || transactions.length === 0) return null;
    const latestTransaction = transactions.reduce((latest, current) => {
      return new Date(current.date) > new Date(latest.date) ? current : latest;
    });
    return new Date(latestTransaction.date).toLocaleDateString('en-GB');
  }, [transactions]);

  const handleBulkAllocate = async (accountId: string) => {
    if (!client || selectedTransactions.length === 0 || !accountId) return;

    const transactionsToAllocate = client.importedTransactions?.filter(tx => selectedTransactions.includes(tx.id)) || [];
    const remainingImported = client.importedTransactions?.filter(tx => !selectedTransactions.includes(tx.id)) || [];
    
    const allocatedTransactions = transactionsToAllocate.map(tx => ({
      ...tx,
      allocatedTo: { value: accountId, type: 'account' as const },
      vatType: 'no_vat' as VatType,
      vatAmount: 0, // Placeholder
      allocatedAt: new Date(),
    }));

    try {
      const clientRef = doc(db, 'clients', client.id);
      await updateDoc(clientRef, {
        importedTransactions: remainingImported,
        allocatedTransactions: arrayUnion(...allocatedTransactions),
      });
      toast({ title: 'Transactions Allocated', description: `${selectedTransactions.length} transactions have been allocated and moved to Reviewed.`});
      setSelectedTransactions([]);
      await fetchClient(); // Re-fetch to show new data
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
      const clientRef = doc(db, 'clients', client.id);
      await updateDoc(clientRef, {
        importedTransactions: remainingTransactions
      });
      toast({ title: 'Transactions Deleted', description: `${selectedTransactions.length} transactions have been removed.` });
      setSelectedTransactions([]);
      await fetchClient(); // Re-fetch to show new data
    } catch (error) {
      toast({ title: 'Deletion Failed', description: 'Could not delete the transactions.', variant: 'destructive' });
      console.error(error);
    }
  };


  return (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Banking</h1>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 p-4 bg-card border rounded-lg">
            <div className="flex items-center gap-2">
                <Label>Bank or Credit Card</Label>
                <Select value={selectedAccountId || ''} onValueChange={setSelectedAccountId}>
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
                            <TabsList className="grid w-full grid-cols-3 rounded-t-lg rounded-b-none h-auto">
                                <TabsTrigger value="all" className="rounded-tl-md">
                                    All ({transactions.length})
                                </TabsTrigger>
                                <TabsTrigger value="income">
                                    Income ({transactions.filter(t => t.amount >= 0).length})
                                </TabsTrigger>
                                <TabsTrigger value="expenses" className="rounded-tr-md">
                                     Expenses ({transactions.filter(t => t.amount < 0).length})
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
                                                        <DropdownMenuItem key={acc.id} onSelect={() => handleBulkAllocate(acc.id)}>
                                                            {acc.accountNumber} - {acc.description}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuSubContent>
                                            </DropdownMenuSub>
                                            <DropdownMenuItem>Mark as Reviewed</DropdownMenuItem>
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
                                            checked={filteredTransactions.length > 0 && selectedTransactions.length === filteredTransactions.length}
                                            onCheckedChange={(checked) => {
                                                if (checked) {
                                                    setSelectedTransactions(filteredTransactions.map(t => t.id));
                                                } else {
                                                    setSelectedTransactions([]);
                                                }
                                            }}
                                        />
                                    </TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Allocate To</TableHead>
                                    <TableHead>VAT Type</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>Spent</TableHead>
                                    <TableHead>Received</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={9} className="text-center h-24"><Loader2 className="animate-spin" /></TableCell></TableRow>
                                ) : filteredTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center text-muted-foreground py-4">
                                            You have no new Bank Statement transactions to review. Import your Bank Statements or manually enter banking transactions below.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTransactions.map(tx => (
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
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell>
                                                <Select onValueChange={(value) => setAllocationAccountId(value)}>
                                                    <SelectTrigger className="h-8 w-[200px]">
                                                        <SelectValue placeholder="Select account" />
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
                                             <TableCell>
                                                <Select onValueChange={(value) => setAllocationVatType(value as VatType)}>
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
                                            <TableCell></TableCell>
                                            <TableCell className="text-right">{tx.amount < 0 ? formatPrice(Math.abs(tx.amount)) : ''}</TableCell>
                                            <TableCell className="text-right">{tx.amount >= 0 ? formatPrice(tx.amount) : ''}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="sm" className="h-8">
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
                                    <TableCell><Input className="h-8" placeholder="Description" /></TableCell>
                                    <TableCell>
                                        <Select>
                                            <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Select account" /></SelectTrigger>
                                            <SelectContent>{client?.chartOfAccounts?.map(acc => ( <SelectItem key={acc.id} value={acc.id}>{acc.accountNumber} - {acc.description}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <Select>
                                            <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Select VAT type" /></SelectTrigger>
                                            <SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell><Input className="h-8" placeholder="Reference" /></TableCell>
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
                <ReviewedTransactionsTab client={client} fetchClient={fetchClient} />
            </TabsContent>
        </Tabs>
        
        <ImportDialog 
            isOpen={isImportDialogOpen}
            onClose={() => setIsImportDialogOpen(false)}
            onSave={handleSaveTransactions}
            currentBalance={bankBalance}
        />
    </div>
  );
}

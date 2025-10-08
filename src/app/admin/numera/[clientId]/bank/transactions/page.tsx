
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
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Label } from '@/components/ui/label';

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
            // Flexible date parsing
            const dateStr = row.Date || row.date || row.TransactionDate;
            const descriptionStr = row.Description || row.description;
            const amountStr = row.Amount || row.amount || row.Debit || row.Credit;

            if (!dateStr || !descriptionStr || amountStr === undefined) return null;

            // Attempt to parse different date formats
            let date;
            if (typeof dateStr === 'number') {
                // Excel date serial number
                date = new Date(Math.round((dateStr - 25569) * 864e5));
            } else {
                date = new Date(dateStr);
            }
             if (isNaN(date.getTime())) {
                console.warn(`Invalid date format for row ${index}: ${dateStr}`);
                return null;
            }

            // Handle separate Debit/Credit columns
            let amount;
            if (row.Debit && !row.Credit) {
                amount = -Math.abs(parseFloat(row.Debit));
            } else if (row.Credit && !row.Debit) {
                amount = parseFloat(row.Credit);
            } else {
                amount = parseFloat(amountStr);
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


export default function BankTransactionsPage() {
  const [client, setClient] = useState<User | null>(null);
  const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const params = useParams();
  const clientId = params.clientId as string;
  const { toast } = useToast();

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
                    <CardHeader className="p-4 border-b">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Actions</Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem>Mark as Reviewed</DropdownMenuItem>
                                        <DropdownMenuItem>Delete</DropdownMenuItem>
                                        <DropdownMenuItem>Keep Duplicates</DropdownMenuItem>
                                        <DropdownMenuItem>Batch Edit</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button variant="ghost" size="sm" disabled>Mark as Reviewed</Button>
                                <Button variant="ghost" size="sm" disabled>Delete</Button>
                                <Button variant="ghost" size="sm" disabled>Keep Duplicates</Button>
                                <Button variant="ghost" size="sm" disabled>Batch Edit</Button>
                                <Button variant="default" size="sm" onClick={() => setIsImportDialogOpen(true)}>Import Bank Statements</Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link href="#" className="text-sm text-primary hover:underline">Shortcut Keys</Link>
                                <div className="relative">
                                    <Input placeholder="Search..." className="h-8 w-40 pr-8" />
                                    <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 p-2"><Checkbox /></TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Selection</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>VAT</TableHead>
                                    <TableHead>Spent</TableHead>
                                    <TableHead>Received</TableHead>
                                    <TableHead>Rec.</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={11} className="text-center h-24"><Loader2 className="animate-spin" /></TableCell></TableRow>
                                ) : transactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center text-muted-foreground py-4">
                                            You have no new Bank Statement transactions to review. Import your Bank Statements or manually enter banking transactions below.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    transactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell className="p-2"><Checkbox/></TableCell>
                                            <TableCell>{tx.date}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell></TableCell>
                                            <TableCell>
                                                <Select>
                                                    <SelectTrigger className="h-8">
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
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                            <TableCell className="text-right">{tx.amount < 0 ? formatPrice(Math.abs(tx.amount)) : ''}</TableCell>
                                            <TableCell className="text-right">{tx.amount >= 0 ? formatPrice(tx.amount) : ''}</TableCell>
                                            <TableCell className="p-2"><Checkbox /></TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><List className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><ArrowRightLeft className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><Paperclip className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><X className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><Minus className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                                 <TableRow>
                                    <TableCell className="p-2"><Checkbox/></TableCell>
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell>
                                        <Select>
                                            <SelectTrigger className="h-8">
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
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell><Input className="h-8" placeholder="R" /></TableCell>
                                    <TableCell><Input className="h-8" placeholder="R" /></TableCell>
                                    <TableCell className="p-2"><Checkbox /></TableCell>
                                    <TableCell>
                                         <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><List className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><ArrowRightLeft className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><Paperclip className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><X className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><Minus className="h-4 w-4" /></Button>
                                        </div>
                                    </TableCell>
                                 </TableRow>
                            </TableBody>
                        </Table>
                        </div>
                    </CardContent>
                    <CardFooter className="p-4 border-t flex-wrap gap-2">
                        <Button>Save Changes</Button>
                        <Button variant="outline">Mark Selected as Reviewed</Button>
                        <Button variant="outline">Mark All as Reviewed</Button>
                    </CardFooter>
                </Card>
            </TabsContent>
            <TabsContent value="reviewed">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-muted-foreground">Reviewed transactions will appear here.</p>
                    </CardContent>
                </Card>
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

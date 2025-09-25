
'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, CalendarIcon, X, Printer, Download, Upload, FileCheck2, ScanLine, Sprout, Search, ArrowUpDown, Edit, Sparkles, BrainCircuit, Copy, MessageSquare, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, ChartOfAccount, VatType } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, add, sub, getMonth, getYear, startOfYear, endOfYear, startOfMonth, endOfMonth, addMonths } from 'date-fns';
import { chartOfAccounts } from '@/lib/chart-of-accounts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import * as XLSX from 'xlsx';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Papa from 'papaparse';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { users as allUsers } from '@/lib/data';
import { allocateTransaction } from '@/ai/flows/allocate-transaction';
import { refineAllocationKnowledge } from '@/ai/flows/refine-allocation-knowledge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const db = getFirestore(firebaseApp);

const formatNumber = (value: number) => {
    return value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type ImportedTransaction = {
    id: string;
    date: string;
    description: string;
    amount: number;
    bankAccountId: string; // The account number of the bank it was imported into
};

type AllocatedTransaction = ImportedTransaction & {
    allocatedTo: {
        value: string; // Account number, customer id, or supplier id
        type: 'account' | 'customer' | 'supplier';
    };
    vatType: VatType;
    vatAmount: number;
    allocatedAt: Date;
};

type TrialBalanceReportData = {
    clientName: string;
    fromDate: string;
    toDate: string;
    data: {
        accountNumber: string;
        description: string;
        debit: number;
        credit: number;
    }[];
};

type GLTransaction = { 
    date: string; 
    description: string; 
    reference: string; 
    debit: number; 
    credit: number;
    balance: number; 
};

type GeneralLedgerReportData = {
    clientName: string;
    fromDate: string;
    toDate: string;
    accounts: {
        accountNumber: string;
        description: string;
        transactions: GLTransaction[];
        openingBalance: number;
        closingBalance: number;
    }[];
};

type JournalLine = {
    accountId: string;
    description: string;
    debit: number;
    credit: number;
    vatType: VatType;
};

type Journal = {
    id: string;
    date: Date;
    narrative: string;
    lines: JournalLine[];
};

const vatCategories = ['A', 'B', 'C'] as const;

const vatCategoryLabels = {
    A: {
        name: 'Category A (Even Months)',
        description: 'e.g., Jan–Feb, Mar–Apr'
    },
    B: {
        name: 'Category B (Odd Months)',
        description: 'e.g., Feb–Mar, Apr–May'
    },
    C: {
        name: 'Category C (Monthly)',
        description: 'e.g., January, February'
    },
};

const clientFormSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Client name is required.'),
  contactPerson: z.string().optional(),
  email: z.string().email('A valid contact email is required.'),
  yearEnd: z.date({ required_error: 'Financial year end is required.'}),
  isVatRegistered: z.boolean().default(false),
  vatCategory: z.enum(vatCategories).optional(),
  vatRegistrationDate: z.date().optional(),
});

function ClientForm({ client, onSubmit, onCancel }: { client: User | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    
    const toDate = (value: any) => {
        if (!value) return undefined;
        if (value.toDate) return value.toDate(); // Firestore Timestamp
        return new Date(value);
    }
    
    const form = useForm<z.infer<typeof clientFormSchema>>({
        resolver: zodResolver(clientFormSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || '',
            contactPerson: client?.contactPerson || '',
            email: client?.email || '',
            yearEnd: toDate(client?.yearEnd),
            isVatRegistered: client?.isVatRegistered || false,
            vatCategory: client?.vatCategory || undefined,
            vatRegistrationDate: toDate(client?.vatRegistrationDate),
        },
    });
    
    const watchIsVatRegistered = form.watch('isVatRegistered');

    const handleSubmit = (values: z.infer<typeof clientFormSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => ( <FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => ( <FormItem><FormLabel>Contact Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField
                    control={form.control}
                    name="yearEnd"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Financial Year End</FormLabel>
                        <Popover>
                            <PopoverTrigger asChild>
                            <FormControl>
                                <Button
                                variant={"outline"}
                                className={cn(
                                    "w-full pl-3 text-left font-normal",
                                    !field.value && "text-muted-foreground"
                                )}
                                >
                                {field.value ? (
                                    format(field.value, "dd MMMM yyyy")
                                ) : (
                                    <span>Pick a date</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={field.value}
                                onSelect={field.onChange}
                                disabled={(date) => date < new Date("1900-01-01")}
                                initialFocus
                            />
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <Separator />
                  <FormField control={form.control} name="isVatRegistered" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5"><FormLabel>Are you registered for VAT?</FormLabel></div>
                            <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />

                    {watchIsVatRegistered && (
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                            control={form.control}
                            name="vatCategory"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>VAT Category</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select VAT category..." />
                                    </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                    {vatCategories.map(c => (
                                        <SelectItem key={c} value={c}>
                                            <div className="flex flex-col">
                                                <span>{vatCategoryLabels[c].name}</span>
                                                <span className="text-xs text-muted-foreground">{vatCategoryLabels[c].description}</span>
                                            </div>
                                        </SelectItem>
                                    ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                                </FormItem>
                            )}
                            />
                            <FormField
                            control={form.control}
                            name="vatRegistrationDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                <FormLabel>VAT Registration Date</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                    <FormControl>
                                        <Button
                                        variant={'outline'}
                                        className={cn(
                                            'pl-3 text-left font-normal',
                                            !field.value && 'text-muted-foreground'
                                        )}
                                        >
                                        {field.value ? (
                                            format(field.value, 'dd MMM yyyy')
                                        ) : (
                                            <span>Pick a date</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                        </Button>
                                    </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        initialFocus
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                        </div>
                    )}


                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Client</Button>
                </div>
            </form>
        </Form>
    )
}

const bankAccountFormSchema = z.object({
  name: z.string().min(2, "Bank name is required (e.g., FNB, ABSA)."),
});

function AddBankAccountForm({ activeClient, onAccountAdded }: { activeClient: User; onAccountAdded: () => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof bankAccountFormSchema>>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: { name: '' },
  });

  const handleSubmit = async (values: z.infer<typeof bankAccountFormSchema>) => {
    if (!activeClient) return;
    setIsSaving(true);
    try {
        let nextAccountNumberIndex = 1;
        const cashbooks = chartOfAccounts.filter(a => a.accountNumber.startsWith('8400/'));
        if (cashbooks.length > 0) {
            const lastCashbook = cashbooks.sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)).pop();
            if (lastCashbook) {
                const lastNum = parseInt(lastCashbook.accountNumber.split('/')[1]);
                if (!isNaN(lastNum)) {
                    nextAccountNumberIndex = lastNum + 1;
                }
            }
        }
        const newAccountNum = `8400/${(nextAccountNumberIndex).toString().padStart(3, '0')}`;
        const newAccount: ChartOfAccount = {
            id: `cashbook-${activeClient.id}-${Date.now()}`,
            accountNumber: newAccountNum,
            description: `${activeClient.name} - ${values.name}`,
            section: 'Balance Sheet',
        };
        
        if (!chartOfAccounts.some(a => a.accountNumber === newAccount.accountNumber)) {
            chartOfAccounts.push(newAccount);
            chartOfAccounts.sort((a,b) => a.accountNumber.localeCompare(b.accountNumber));
        }

        toast({
            title: 'Cashbook Added',
            description: `New cashbook account ${newAccountNum} has been added for ${values.name}.`,
        });
        form.reset();
        onAccountAdded();
        setIsOpen(false);
    } catch (error) {
        console.error("Error adding bank account:", error);
        toast({ title: 'Error', description: 'Could not add bank account.', variant: 'destructive'});
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><PlusCircle className="mr-2 h-4 w-4" /> Add Bank Account</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Bank Account for {activeClient.name}</DialogTitle>
          <DialogDescription>Create a new cashbook in the Chart of Accounts.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl><Input placeholder="e.g., FNB, Standard Bank..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const trialBalanceFormSchema = z.object({
    fromDate: z.date(),
    toDate: z.date(),
    showZeroItems: z.boolean().default(true),
});

function TrialBalanceCard({ activeClient, onAccountClick, allocatedTransactions, unallocatedTransactions }: { activeClient: User; onAccountClick: (accountNumber: string, from: Date, to: Date) => void; allocatedTransactions: AllocatedTransaction[]; unallocatedTransactions: ImportedTransaction[] }) {
    
    const [reportData, setReportData] = useState<TrialBalanceReportData | null>(null);

    const getFinancialYear = (yearEnd: any) => {
        const toDate = yearEnd?.toDate ? yearEnd.toDate() : new Date(yearEnd);
        const endDate = toDate;
        const startDate = add(sub(endDate, { years: 1 }), { days: 1 });
        return { startDate, endDate };
    }

    const { startDate, endDate } = getFinancialYear(activeClient.yearEnd);
    
    const form = useForm<z.infer<typeof trialBalanceFormSchema>>({
        resolver: zodResolver(trialBalanceFormSchema),
        defaultValues: {
            fromDate: startDate,
            toDate: endDate,
            showZeroItems: true,
        }
    });

    const handleGenerate = (values: z.infer<typeof trialBalanceFormSchema>) => {
        const VAT_CONTROL_ACC = '9500/000';
        const UNALLOCATED_SUSPENSE_ACC = '9950/000';
        const VAT_RATE = 0.15;
    
        const accountBalances: { [key: string]: number } = {};
    
        chartOfAccounts.forEach(acc => {
            accountBalances[acc.accountNumber] = 0;
        });
    
        const filterTxsByDate = (txs: (ImportedTransaction | AllocatedTransaction)[]) => {
            return txs.filter(tx => {
                const txDate = new Date(tx.date.split('/').reverse().join('-'));
                return txDate >= values.fromDate && txDate <= values.toDate;
            });
        };
    
        const filteredAllocated = filterTxsByDate(allocatedTransactions) as AllocatedTransaction[];
        const filteredUnallocated = filterTxsByDate(unallocatedTransactions);
    
        filteredAllocated.forEach(tx => {
            const allocationAccNum = tx.allocatedTo.value;
            const bankAccNum = tx.bankAccountId;
            const grossAmount = tx.amount;
    
            const isStandardVat = tx.vatType === 'standard_rated_sales' || tx.vatType === 'standard_rated_purchases' || tx.vatType === 'capital_goods_purchases';
    
            let exclusiveAmount = grossAmount;
            let vatAmount = 0;
    
            if (isStandardVat) {
                exclusiveAmount = grossAmount / (1 + VAT_RATE);
                vatAmount = grossAmount - exclusiveAmount;
            }
    
            accountBalances[bankAccNum] = (accountBalances[bankAccNum] || 0) + grossAmount;
    
            const postAmount = -exclusiveAmount;
            accountBalances[allocationAccNum] = (accountBalances[allocationAccNum] || 0) + postAmount;
    
            const vatPostAmount = tx.vatType === 'standard_rated_sales' ? -vatAmount : vatAmount;
            if(vatPostAmount !== 0) {
              accountBalances[VAT_CONTROL_ACC] = (accountBalances[VAT_CONTROL_ACC] || 0) + vatPostAmount;
            }
        });
    
        filteredUnallocated.forEach(tx => {
            accountBalances[tx.bankAccountId] = (accountBalances[tx.bankAccountId] || 0) + tx.amount;
            accountBalances[UNALLOCATED_SUSPENSE_ACC] = (accountBalances[UNALLOCATED_SUSPENSE_ACC] || 0) - tx.amount;
        });
    
        const reportLedger = Object.entries(accountBalances).map(([accountNumber, netBalance]) => {
            const accountInfo = chartOfAccounts.find(a => a.accountNumber === accountNumber)!;
            
            return {
                accountNumber,
                description: accountInfo?.description || 'Unknown Account',
                debit: netBalance > 0 ? netBalance : 0,
                credit: netBalance < 0 ? Math.abs(netBalance) : 0,
            };
        });
        
        const filteredData = values.showZeroItems ? reportLedger : reportLedger.filter(d => d.debit !== 0 || d.credit !== 0);

        const newReportData = {
            clientName: activeClient.name,
            fromDate: format(values.fromDate, 'dd/MM/yyyy'),
            toDate: format(values.toDate, 'dd/MM/yyyy'),
            data: filteredData,
        };
        setReportData(newReportData);
    }

    const handleDownloadExcel = () => {
        if (!reportData) return;
        const worksheetData = reportData.data.map(item => ({
            'Account': item.accountNumber,
            'Description': item.description,
            'Debit': item.debit,
            'Credit': item.credit,
        }));
        
        const totalDebits = worksheetData.reduce((acc, item) => acc + item.Debit, 0);
        const totalCredits = worksheetData.reduce((acc, item) => acc + item.Credit, 0);

        worksheetData.push({
            'Account': '',
            'Description': 'Totals',
            'Debit': totalDebits,
            'Credit': totalCredits,
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        
        worksheet['!cols'] = [ { wch: 15 }, { wch: 40 }, { wch: 15 }, { wch: 15 } ];
        worksheetData.forEach((_row, index) => {
            const rowIndex = index + 2;
            if (worksheet[`C${rowIndex}`]) {
                worksheet[`C${rowIndex}`].z = '#,##0.00';
            }
            if (worksheet[`D${rowIndex}`]) {
                worksheet[`D${rowIndex}`].z = '#,##0.00';
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Trial Balance');
        XLSX.writeFile(workbook, `Trial-Balance-${activeClient.name}-${reportData.fromDate}-to-${reportData.toDate}.xlsx`);
    };

    const totalDebits = reportData?.data.reduce((acc, item) => acc + item.debit, 0) || 0;
    const totalCredits = reportData?.data.reduce((acc, item) => acc + item.credit, 0) || 0;

    return (
        <>
        <Dialog open={!!reportData} onOpenChange={(isOpen) => !isOpen && setReportData(null)}>
            <DialogContent className="sm:max-w-4xl">
                 <DialogHeader>
                   <DialogTitle>Trial Balance Report</DialogTitle>
                   <DialogDescription>
                       A printable trial balance report for {reportData?.clientName}. Click an amount to view the General Ledger.
                   </DialogDescription>
                </DialogHeader>
                 {reportData && (
                    <div className="printable-area p-2 bg-white max-h-[70vh] overflow-y-auto">
                        <Card className="w-full shadow-none border-none">
                            <CardHeader className="text-center">
                                <CardTitle className="text-2xl">{reportData.clientName}</CardTitle>
                                <CardDescription className="text-lg">Trial Balance</CardDescription>
                                <CardDescription>
                                    For the period: {reportData.fromDate} to {reportData.toDate}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="flex justify-end gap-2 mb-4 print:hidden">
                                    <Button variant="outline" onClick={handleDownloadExcel}>
                                        <Download className="mr-2 h-4 w-4" />
                                        Download Excel
                                    </Button>
                                    <Button variant="outline" onClick={() => window.print()}>
                                        <Printer className="mr-2 h-4 w-4" />
                                        Print
                                    </Button>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[150px]">Account</TableHead>
                                            <TableHead>Description</TableHead>
                                            <TableHead className="text-right w-[150px]">Debit</TableHead>
                                            <TableHead className="text-right w-[150px]">Credit</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {reportData.data.map(item => (
                                            <TableRow key={item.accountNumber}>
                                                <TableCell className="font-mono">{item.accountNumber}</TableCell>
                                                <TableCell>{item.description}</TableCell>
                                                <TableCell className="text-right font-mono">
                                                    <Button variant="link" className="p-0 h-auto" onClick={() => { onAccountClick(item.accountNumber, form.getValues('fromDate'), form.getValues('toDate')); setReportData(null); }}>
                                                        {item.debit > 0 ? formatNumber(item.debit) : '-'}
                                                    </Button>
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    <Button variant="link" className="p-0 h-auto" onClick={() => { onAccountClick(item.accountNumber, form.getValues('fromDate'), form.getValues('toDate')); setReportData(null); }}>
                                                        {item.credit > 0 ? formatNumber(item.credit) : '-'}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter>
                                        <TableRow>
                                            <TableCell colSpan={2} className="font-bold text-base">Totals</TableCell>
                                            <TableCell className="text-right font-bold font-mono text-base">{formatNumber(totalDebits)}</TableCell>
                                            <TableCell className="text-right font-bold font-mono text-base">{formatNumber(totalCredits)}</TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </CardContent>
                        </Card>
                    </div>
                 )}
             </DialogContent>
         </Dialog>
        <Card>
            <CardHeader><CardTitle>Trial Balance</CardTitle></CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                             <FormField
                                control={form.control}
                                name="fromDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>From Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd/MM/yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                                 <FormField
                                control={form.control}
                                name="toDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>To Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd/MM/yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button>
                                            </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )} />
                        </div>
                        <FormField
                            control={form.control}
                            name="showZeroItems"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                <FormControl>
                                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                                </FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Show zero balance accounts</FormLabel>
                                </div>
                                </FormItem>
                            )}
                        />
                        <Button type="submit">Generate</Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
        </>
    );
}

const generalLedgerFormSchema = z.object({
  fromDate: z.date(),
  toDate: z.date(),
  accounts: z.array(z.string()).min(1, 'Please select at least one account.'),
});

function GeneralLedgerCard({ activeClient, initialValues, allocatedTransactions }: { activeClient: User, initialValues?: Partial<z.infer<typeof generalLedgerFormSchema>>, allocatedTransactions: AllocatedTransaction[] }) {
  
  const [reportData, setReportData] = useState<GeneralLedgerReportData | null>(null);
  const VAT_CONTROL_ACC = '9500/000';
  const VAT_RATE = 0.15;

  const getFinancialYear = (yearEnd: any) => {
    const toDate = yearEnd?.toDate ? yearEnd.toDate() : new Date(yearEnd);
    const endDate = toDate;
    const startDate = add(sub(endDate, { years: 1 }), { days: 1 });
    return { startDate, endDate };
  }

  const { startDate, endDate } = getFinancialYear(activeClient.yearEnd);

  const form = useForm<z.infer<typeof generalLedgerFormSchema>>({
    resolver: zodResolver(generalLedgerFormSchema),
    defaultValues: {
      fromDate: initialValues?.fromDate || startDate,
      toDate: initialValues?.toDate || endDate,
      accounts: initialValues?.accounts || [],
    }
  });
  
  const handleGenerate = (values: z.infer<typeof generalLedgerFormSchema>) => {
    const selectedAccounts = values.accounts.includes('all') ? chartOfAccounts.map(a => a.accountNumber) : values.accounts;

    const generatedAccounts = selectedAccounts.map(accNum => {
        const accountInfo = chartOfAccounts.find(a => a.accountNumber === accNum)!;
        const openingBalance = 0; // In a real app, this would be calculated or fetched
        let runningBalance = openingBalance;

        const transactionsForGL: GLTransaction[] = [];

        const relatedTransactions = allocatedTransactions.filter(tx => {
            const txDate = new Date(tx.date.split('/').reverse().join('-'));
            const isWithinDateRange = txDate >= values.fromDate && txDate <= values.toDate;

            if (!isWithinDateRange) return false;

            const isAllocation = tx.allocatedTo.type === 'account' && tx.allocatedTo.value === accNum;
            const isBankContra = tx.bankAccountId === accNum;
            const isVatContra = accNum === VAT_CONTROL_ACC && (tx.vatType === 'standard_rated_sales' || tx.vatType === 'standard_rated_purchases' || tx.vatType === 'capital_goods_purchases');
            
            return isAllocation || isBankContra || isVatContra;
        }).sort((a,b) => new Date(a.date.split('/').reverse().join('-')).getTime() - new Date(b.date.split('/').reverse().join('-')).getTime());

        relatedTransactions.forEach(tx => {
            const grossAmount = tx.amount;
            const isStandardVat = tx.vatType === 'standard_rated_sales' || tx.vatType === 'standard_rated_purchases' || tx.vatType === 'capital_goods_purchases';
            
            let exclusiveAmount = grossAmount;
            let vatAmount = 0;

            if (isStandardVat) {
                exclusiveAmount = grossAmount / (1 + VAT_RATE);
                vatAmount = grossAmount - exclusiveAmount;
            }

            let debit = 0;
            let credit = 0;
            
            if (accNum === tx.bankAccountId) {
                // Bank is always Gross
                debit = grossAmount > 0 ? grossAmount : 0;
                credit = grossAmount < 0 ? Math.abs(grossAmount) : 0;
            } else if (accNum === tx.allocatedTo.value) {
                // Allocation is always Net
                debit = exclusiveAmount < 0 ? Math.abs(exclusiveAmount) : 0;
                credit = exclusiveAmount > 0 ? exclusiveAmount : 0;
            } else if (accNum === VAT_CONTROL_ACC && isStandardVat) {
                // VAT account is always the VAT portion
                const vatPostAmount = tx.vatType === 'standard_rated_sales' ? -vatAmount : vatAmount;
                debit = vatPostAmount > 0 ? vatPostAmount : 0;
                credit = vatPostAmount < 0 ? Math.abs(vatPostAmount) : 0;
            }
            
            if (debit > 0 || credit > 0) {
                runningBalance += (debit - credit);
                transactionsForGL.push({
                    date: tx.date,
                    description: tx.description,
                    reference: tx.id.substring(0, 8),
                    debit,
                    credit,
                    balance: runningBalance,
                });
            }
        });

        return {
            accountNumber: accNum,
            description: accountInfo.description,
            transactions: transactionsForGL,
            openingBalance,
            closingBalance: runningBalance,
        };
    });

    setReportData({
        clientName: activeClient.name,
        fromDate: format(values.fromDate, 'dd/MM/yyyy'),
        toDate: format(values.toDate, 'dd/MM/yyyy'),
        accounts: generatedAccounts,
    });
};

  useEffect(() => {
    if (initialValues && initialValues.accounts && initialValues.accounts.length > 0) {
      const newValues = {
        fromDate: initialValues.fromDate || startDate,
        toDate: initialValues.toDate || endDate,
        accounts: initialValues.accounts,
      };
      form.reset(newValues);
      handleGenerate(newValues as z.infer<typeof generalLedgerFormSchema>);
    }
  }, [initialValues?.accounts, initialValues?.fromDate, initialValues?.toDate]);


  const handleDownloadExcel = () => {
    if (!reportData) return;

    let worksheetData: any[] = [];
    
    reportData.accounts.forEach(account => {
        if (worksheetData.length > 0) {
            worksheetData.push({});
        }
        worksheetData.push({ A: `${account.accountNumber} - ${account.description}` });
        worksheetData.push({
            A: 'Date', B: 'Description', C: 'Reference',
            D: 'Debit', E: 'Credit', F: 'Balance'
        });

        worksheetData.push({ A: 'Opening Balance', F: account.openingBalance });
        
        account.transactions.forEach(tx => {
            worksheetData.push({
                A: tx.date,
                B: tx.description,
                C: tx.reference,
                D: tx.debit || null,
                E: tx.credit || null,
                F: tx.balance
            });
        });
        
        worksheetData.push({ A: 'Closing Balance', F: account.closingBalance });
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData, { skipHeader: true });
    
    worksheet['!cols'] = [
        { wch: 15 }, { wch: 40 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];

    let rowIndex = 0;
    reportData.accounts.forEach(account => {
        if (rowIndex > 0) {
          rowIndex++;
        }
        rowIndex++;
        if (worksheet[`A${rowIndex}`]) worksheet[`A${rowIndex}`].s = { font: { bold: true } };

        rowIndex++;
        
        rowIndex++;
        worksheet[`F${rowIndex}`] = { t: 'n', v: account.openingBalance, z: '#,##0.00' };
        
        account.transactions.forEach(() => {
             rowIndex++;
             const debitCell = worksheet[`D${rowIndex}`];
             const creditCell = worksheet[`E${rowIndex}`];
             const balanceCell = worksheet[`F${rowIndex}`];
             if(debitCell) debitCell.z = '#,##0.00';
             if(creditCell) creditCell.z = '#,##0.00';
             if(balanceCell) balanceCell.z = '#,##0.00';
        });
        
        rowIndex++;
        worksheet[`F${rowIndex}`] = { t: 'n', v: account.closingBalance, z: '#,##0.00' };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'General Ledger');
    XLSX.writeFile(workbook, `General-Ledger-${activeClient.name}-${reportData.fromDate}-to-${reportData.toDate}.xlsx`);
  };

  return (
    <>
      <Dialog open={!!reportData} onOpenChange={(isOpen) => !isOpen && setReportData(null)}>
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>General Ledger Report</DialogTitle>
            <DialogDescription>
              A printable general ledger report for {reportData?.clientName}.
            </DialogDescription>
          </DialogHeader>
          {reportData && (
            <div className="printable-area p-2 bg-white max-h-[70vh] overflow-y-auto">
              <Card className="w-full shadow-none border-none">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">{reportData.clientName}</CardTitle>
                  <CardDescription className="text-lg">General Ledger</CardDescription>
                  <CardDescription>
                    For the period: {reportData.fromDate} to {reportData.toDate}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-end gap-2 mb-4 print:hidden">
                    <Button variant="outline" onClick={handleDownloadExcel}>
                        <Download className="mr-2 h-4 w-4" /> Download Excel
                    </Button>
                    <Button variant="outline" onClick={() => window.print()}>
                      <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                  </div>
                  <div className="space-y-8">
                    {reportData.accounts.map(account => (
                      <div key={account.accountNumber}>
                        <h3 className="text-lg font-bold">{account.accountNumber} - {account.description}</h3>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Description</TableHead>
                              <TableHead>Reference</TableHead>
                              <TableHead className="text-right">Debit</TableHead>
                              <TableHead className="text-right">Credit</TableHead>
                              <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                                <TableCell colSpan={5} className="font-bold">Opening Balance</TableCell>
                                <TableCell className="text-right font-bold font-mono">{formatNumber(account.openingBalance)}</TableCell>
                            </TableRow>
                            {account.transactions.map((tx, i) => (
                              <TableRow key={i}>
                                <TableCell>{tx.date}</TableCell>
                                <TableCell>{tx.description}</TableCell>
                                <TableCell>{tx.reference}</TableCell>
                                <TableCell className="text-right font-mono">{tx.debit > 0 ? formatNumber(tx.debit) : '-'}</TableCell>
                                <TableCell className="text-right font-mono">{tx.credit > 0 ? formatNumber(tx.credit) : '-'}</TableCell>
                                <TableCell className="text-right font-mono">{formatNumber(tx.balance)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={5} className="font-bold text-base">Closing Balance</TableCell>
                              <TableCell className="text-right font-bold font-mono text-base">{formatNumber(account.closingBalance)}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader><CardTitle>General Ledger</CardTitle></CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleGenerate)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="fromDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>From Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd/MM/yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="toDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>To Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd/MM/yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
              </div>
              <FormField
                control={form.control}
                name="accounts"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Accounts</FormLabel>
                     <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" role="combobox" className={cn("w-full justify-between", !field.value?.length && "text-muted-foreground")}>
                            {field.value?.length > 1 ? `${field.value.length} selected` : field.value?.length === 1 ? chartOfAccounts.find(a => a.accountNumber === field.value[0])?.description : "Select accounts"}
                            <MoreHorizontal className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                         <Command>
                           <CommandInput placeholder="Search accounts..." />
                           <CommandEmpty>No accounts found.</CommandEmpty>
                           <CommandGroup className="max-h-64 overflow-y-auto">
                              <CommandItem onSelect={() => { const allSelected = field.value?.includes('all'); const newSelection = allSelected ? [] : ['all', ...chartOfAccounts.map(a => a.accountNumber)]; field.onChange(newSelection); }}> <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", field.value?.includes('all') ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible" )}><Check className={cn("h-4 w-4")} /></div> All Accounts </CommandItem>
                             {chartOfAccounts.map((account) => (
                               <CommandItem key={account.accountNumber} value={account.description} onSelect={() => { const selection = new Set(field.value); if (selection.has(account.accountNumber)) { selection.delete(account.accountNumber); } else { selection.add(account.accountNumber); } field.onChange(Array.from(selection)); }}>
                                 <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", field.value?.includes(account.accountNumber) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible" )}><Check className={cn("h-4 w-4")} /></div>
                                 <span>{account.accountNumber} - {account.description}</span>
                               </CommandItem>
                             ))}
                           </CommandGroup>
                         </Command>
                       </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit">Generate</Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}

const allVatTypes: { name: VatType, label: string, category: 'Output Tax' | 'Input Tax' | 'Other' }[] = [
    { name: 'standard_rated_sales', label: 'Standard-rated supplies (15%)', category: 'Output Tax' },
    { name: 'zero_rated_sales', label: 'Zero-rated supplies (0%)', category: 'Output Tax' },
    { name: 'exempt_sales', label: 'Exempt supplies', category: 'Output Tax' },
    { name: 'standard_rated_purchases', label: 'Standard-rated purchases (15%)', category: 'Input Tax' },
    { name: 'capital_goods_purchases', label: 'Capital goods (15%)', category: 'Input Tax' },
    { name: 'zero_rated_purchases', label: 'Zero-rated purchases (0%)', category: 'Input Tax' },
    { name: 'exempt_purchases', label: 'Exempt purchases', category: 'Input Tax' },
    { name: 'no_vat', label: 'No VAT', category: 'Other' },
];

function VatTypeCombobox({ value, onSelect }: { value?: VatType, onSelect: (value: VatType) => void }) {
    const [open, setOpen] = useState(false);
    const displayValue = value ? allVatTypes.find(v => v.name === value)?.label : "Select VAT type...";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                    <span className="truncate">{displayValue}</span>
                    <MoreHorizontal className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Search VAT type..." />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup heading="Output Tax (Sales)">
                            {allVatTypes.filter(v => v.category === 'Output Tax').map(v => (
                                <CommandItem key={v.name} onSelect={() => { onSelect(v.name); setOpen(false); }}>
                                    {v.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandGroup heading="Input Tax (Purchases)">
                             {allVatTypes.filter(v => v.category === 'Input Tax').map(v => (
                                <CommandItem key={v.name} onSelect={() => { onSelect(v.name); setOpen(false); }}>
                                    {v.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                         <CommandGroup heading="Other">
                             {allVatTypes.filter(v => v.category === 'Other').map(v => (
                                <CommandItem key={v.name} onSelect={() => { onSelect(v.name); setOpen(false); }}>
                                    {v.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function AllocationCombobox({ value, onSelect }: { value?: { value: string, type: string }, onSelect: (value: string, type: 'account'|'customer'|'supplier') => void }) {
    const [open, setOpen] = useState(false);
    const customers = allUsers.filter(u => u.role === 'client');
    // Mock suppliers for now
    const suppliers = [{id: 'supp-1', name: 'Telkom'}, {id: 'supp-2', name: 'Eskom'}];

    const getDisplayValue = () => {
        if (!value) return "Select...";
        if (value.type === 'account') {
            return chartOfAccounts.find(a => a.accountNumber === value.value)?.description || "Select...";
        }
        if (value.type === 'customer') {
            return customers.find(c => c.id === value.value)?.name || "Select...";
        }
        if (value.type === 'supplier') {
            return suppliers.find(s => s.id === value.value)?.name || "Select...";
        }
        return "Select...";
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-[300px] justify-between">
                    <span className="truncate">{getDisplayValue()}</span>
                    <MoreHorizontal className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                        <CommandEmpty>No results found.</CommandEmpty>
                        <CommandGroup heading="Accounts">
                            {chartOfAccounts.filter(a => a.section === "Income Statement" || a.accountNumber.startsWith('8000') || a.accountNumber.startsWith('9000') || a.accountNumber.startsWith('9200')).map(acc => (
                                <CommandItem key={`acc-${acc.id}`} onSelect={() => { onSelect(acc.accountNumber, 'account'); setOpen(false); }}>
                                    {acc.accountNumber} - {acc.description}
                                </CommandItem>
                            ))}
                            <CommandItem onSelect={() => alert('Open create account modal...')}>+ Create new account</CommandItem>
                        </CommandGroup>
                        <CommandGroup heading="Customers">
                             {customers.map(customer => (
                                <CommandItem key={`cust-${customer.id}`} onSelect={() => { onSelect(customer.id, 'customer'); setOpen(false); }}>
                                    {customer.name}
                                </CommandItem>
                            ))}
                            <CommandItem onSelect={() => alert('Open create customer modal...')}>+ Create new customer</CommandItem>
                        </CommandGroup>
                        <CommandGroup heading="Suppliers">
                             {suppliers.map(supplier => (
                                <CommandItem key={`supp-${supplier.id}`} onSelect={() => { onSelect(supplier.id, 'supplier'); setOpen(false); }}>
                                    {supplier.name}
                                </CommandItem>
                            ))}
                            <CommandItem onSelect={() => alert('Open create supplier modal...')}>+ Create new supplier</CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

type SortableField = 'date' | 'description' | 'amount';
type SortDirection = 'asc' | 'desc';

function AllocationTable({ transactions, onAllocate, selectedTransactions, onSelectionChange, onAllocationSelect, allocations, onVatTypeSelect, vatTypes, onFeedback, processingTxId }: { 
    transactions: ImportedTransaction[], 
    onAllocate: (transactionId: string) => void, 
    selectedTransactions: string[], 
    onSelectionChange: (id: string, isSelected: boolean) => void,
    onAllocationSelect: (transactionId: string, value: string, type: 'account'|'customer'|'supplier') => void,
    allocations: { [key: string]: { value: string, type: 'account'|'customer'|'supplier' } },
    onVatTypeSelect: (transactionId: string, vatType: VatType) => void,
    vatTypes: { [key: string]: VatType },
    onFeedback: (transaction: ImportedTransaction) => void,
    processingTxId?: string | null;
}) {
    const [sortConfig, setSortConfig] = useState<{ key: SortableField, direction: SortDirection } | null>({ key: 'date', direction: 'asc'});

    const handleSelectAll = (checked: boolean) => {
        transactions.forEach(tx => onSelectionChange(tx.id, checked));
    };

    const sortedTransactions = useMemo(() => {
        let sortableItems = [...transactions];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: string | number = a[sortConfig.key];
                let bValue: string | number = b[sortConfig.key];
                
                if (sortConfig.key === 'date') {
                    const [dayA, monthA, yearA] = (aValue as string).split('/').map(Number);
                    const [dayB, monthB, yearB] = (bValue as string).split('/').map(Number);
                    aValue = new Date(yearA, monthA - 1, dayA).getTime();
                    bValue = new Date(yearB, monthB - 1, yearB).getTime();
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [transactions, sortConfig]);

    const areAllSelected = transactions.length > 0 && transactions.every(tx => selectedTransactions.includes(tx.id));

    const SortableHeader = ({ field, label }: { field: SortableField, label: string }) => (
        <TableHead>
            <Button variant="ghost" onClick={() => requestSort(field)}>
                {label}
                <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
        </TableHead>
    );

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead padding="checkbox">
                        <Checkbox
                            checked={areAllSelected}
                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                            aria-label="Select all"
                        />
                    </TableHead>
                    <SortableHeader field="date" label="Date" />
                    <SortableHeader field="description" label="Description" />
                    <SortableHeader field="amount" label="Amount" />
                    <TableHead>Allocate To</TableHead>
                    <TableHead>VAT Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {sortedTransactions.map(tx => (
                    <TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) && "selected"}>
                        <TableCell padding="checkbox">
                            <Checkbox
                                checked={selectedTransactions.includes(tx.id)}
                                onCheckedChange={(checked) => onSelectionChange(tx.id, !!checked)}
                                aria-label={`Select transaction ${tx.id}`}
                            />
                        </TableCell>
                        <TableCell>{tx.date}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell className="font-mono">{formatNumber(tx.amount)}</TableCell>
                        <TableCell className="w-[300px]">
                            <AllocationCombobox value={allocations[tx.id]} onSelect={(value, type) => onAllocationSelect(tx.id, value, type)}/>
                        </TableCell>
                        <TableCell className="w-[300px]">
                            <VatTypeCombobox value={vatTypes[tx.id]} onSelect={(value) => onVatTypeSelect(tx.id, value)} />
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                {processingTxId === tx.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                    <Button size="icon" variant="ghost" onClick={() => onFeedback(tx)}>
                                        <MessageSquare className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" onClick={() => onAllocate(tx.id)} disabled={!allocations[tx.id]}>Allocate</Button>
                                    </>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

const customers = allUsers.filter(u => u.role === 'client');
const suppliers = [{id: 'supp-1', name: 'Telkom'}, {id: 'supp-2', name: 'Eskom'}]; // Mock suppliers

function AllocatedTransactionTable({ transactions, onSaveAllocation }: { transactions: AllocatedTransaction[], onSaveAllocation: (transactionId: string, newAllocation: {value: string, type: 'account'|'customer'|'supplier'}, newVatType: VatType) => void }) {
    
    const [editableAllocations, setEditableAllocations] = useState<{ [key: string]: { value: string, type: 'account'|'customer'|'supplier' } }>({});
    const [editableVatTypes, setEditableVatTypes] = useState<{ [key: string]: VatType }>({});

    useEffect(() => {
        const initialAllocations = transactions.reduce((acc, tx) => {
            acc[tx.id] = tx.allocatedTo;
            return acc;
        }, {} as { [key: string]: { value: string, type: 'account'|'customer'|'supplier' } });
        setEditableAllocations(initialAllocations);

        const initialVatTypes = transactions.reduce((acc, tx) => {
            acc[tx.id] = tx.vatType;
            return acc;
        }, {} as { [key: string]: VatType });
        setEditableVatTypes(initialVatTypes);
    }, [transactions]);
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Allocate To</TableHead>
                    <TableHead>VAT Type</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {transactions.map(tx => (
                    <TableRow key={tx.id}>
                        <TableCell>{tx.date}</TableCell>
                        <TableCell>{tx.description}</TableCell>
                        <TableCell className="font-mono">{formatNumber(tx.amount)}</TableCell>
                        <TableCell>
                           <AllocationCombobox value={editableAllocations[tx.id]} onSelect={(value, type) => setEditableAllocations(prev => ({ ...prev, [tx.id]: { value, type } }))}/>
                        </TableCell>
                         <TableCell>
                            <VatTypeCombobox value={editableVatTypes[tx.id]} onSelect={(value) => setEditableVatTypes(prev => ({...prev, [tx.id]: value}))} />
                        </TableCell>
                        <TableCell className="text-right">
                           <Button variant="outline" size="sm" onClick={() => onSaveAllocation(tx.id, editableAllocations[tx.id], editableVatTypes[tx.id])}>
                               <FileCheck2 className="mr-2 h-3 w-3" />
                               Save
                           </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

const journalLineSchema = z.object({
  accountId: z.string().min(1, "Account is required."),
  description: z.string(),
  debit: z.preprocess(v => parseFloat(v as string || '0'), z.number().min(0)),
  credit: z.preprocess(v => parseFloat(v as string || '0'), z.number().min(0)),
  vatType: z.custom<VatType>(),
}).refine(data => data.debit === 0 || data.credit === 0, {
  message: "Enter a debit or a credit, not both.",
  path: ["debit"],
});


const journalFormSchema = z.object({
  id: z.string().optional(),
  date: z.date(),
  narrative: z.string().min(5, "A narrative is required."),
  lines: z.array(journalLineSchema).min(2, "A journal must have at least two lines."),
}).refine(data => {
    const totalDebits = data.lines.reduce((acc, line) => acc + line.debit, 0);
    const totalCredits = data.lines.reduce((acc, line) => acc + line.credit, 0);
    return Math.abs(totalDebits - totalCredits) < 0.001; // Use tolerance for float comparison
}, {
    message: "Total debits must equal total credits.",
    path: ["lines"],
});


function JournalForm({ journal, onSubmit, onCancel }: { journal: Journal | null, onSubmit: (data: Journal) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof journalFormSchema>>({
        resolver: zodResolver(journalFormSchema),
        defaultValues: journal ? {
            ...journal,
            date: new Date(journal.date),
        } : {
            date: new Date(),
            narrative: '',
            lines: [
                { accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' },
                { accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' },
            ],
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    });

    const watchedLines = form.watch('lines');
    const totalDebits = watchedLines.reduce((acc, line) => acc + (line.debit || 0), 0);
    const totalCredits = watchedLines.reduce((acc, line) => acc + (line.credit || 0), 0);
    const difference = totalDebits - totalCredits;
    const isBalanced = Math.abs(difference) < 0.001 && totalDebits > 0;
    
    const handleSubmit = (values: z.infer<typeof journalFormSchema>) => {
        const finalData = {
            ...values,
            id: journal?.id || `JRN-${Date.now()}`,
        };
        onSubmit(finalData);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Journal Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "dd/MM/yyyy") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="narrative" render={({ field }) => ( <FormItem><FormLabel>Narrative</FormLabel><FormControl><Input placeholder="e.g., To record monthly salaries" {...field} /></FormControl><FormMessage /></FormItem>)} />
                </div>
                
                <div className="space-y-2">
                    <Label>Journal Lines</Label>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-1/3">Account</TableHead>
                                <TableHead className="w-1/3">Description</TableHead>
                                <TableHead>VAT Type</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {fields.map((field, index) => (
                                <TableRow key={field.id} className="align-top">
                                    <TableCell className="p-1">
                                        <FormField control={form.control} name={`lines.${index}.accountId`} render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Account..." /></SelectTrigger></FormControl><SelectContent>{chartOfAccounts.map(acc => <SelectItem key={acc.accountNumber} value={acc.accountNumber}>{acc.accountNumber} - {acc.description}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                                    </TableCell>
                                     <TableCell className="p-1">
                                         <FormField control={form.control} name={`lines.${index}.description`} render={({ field }) => ( <FormItem><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                                     </TableCell>
                                     <TableCell className="p-1">
                                        <FormField control={form.control} name={`lines.${index}.vatType`} render={({ field }) => ( <FormItem><VatTypeCombobox value={field.value} onSelect={field.onChange} /></FormItem> )} />
                                     </TableCell>
                                     <TableCell className="p-1">
                                         <FormField control={form.control} name={`lines.${index}.debit`} render={({ field }) => ( <FormItem><FormControl><Input type="number" step="0.01" className="text-right" {...field} onChange={e => { field.onChange(e.target.value); form.setValue(`lines.${index}.credit`, 0) }} /></FormControl><FormMessage /></FormItem>)} />
                                     </TableCell>
                                    <TableCell className="p-1">
                                         <FormField control={form.control} name={`lines.${index}.credit`} render={({ field }) => ( <FormItem><FormControl><Input type="number" step="0.01" className="text-right" {...field} onChange={e => { field.onChange(e.target.value); form.setValue(`lines.${index}.debit`, 0) }} /></FormControl><FormMessage /></FormItem>)} />
                                     </TableCell>
                                     <TableCell className="p-1">
                                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                     </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableFooter>
                            <TableRow>
                                <TableCell colSpan={3} className="font-bold">Totals</TableCell>
                                <TableCell className="text-right font-mono font-bold">{formatNumber(totalDebits)}</TableCell>
                                <TableCell className="text-right font-mono font-bold">{formatNumber(totalCredits)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                             <TableRow>
                                <TableCell colSpan={3} className="font-bold">Difference</TableCell>
                                <TableCell colSpan={2} className={`text-right font-mono font-bold ${Math.abs(difference) > 0.001 ? 'text-destructive' : ''}`}>{formatNumber(difference)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                     <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', description: '', debit: 0, credit: 0, vatType: 'no_vat' })}>
                        <PlusCircle className="mr-2 h-4 w-4" /> Add Line
                    </Button>
                </div>
                
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit" disabled={!isBalanced}>Save Journal</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

const vatReportFormSchema = z.object({
  period: z.string().min(1, 'A period must be selected.'),
});

type VatReportData = {
    totalSales: number;
    outputVat: number;
    totalPurchases: number;
    inputVat: number;
    vatPayable: number;
    transactions: {
        inputs: AllocatedTransaction[];
        outputs: AllocatedTransaction[];
    }
};

function VatReportCard({ allocatedTransactions, activeClient }: { allocatedTransactions: AllocatedTransaction[], activeClient: User }) {
    const [reportData, setReportData] = useState<VatReportData | null>(null);

    const form = useForm<z.infer<typeof vatReportFormSchema>>({
        resolver: zodResolver(vatReportFormSchema),
        defaultValues: { period: '' }
    });

    const vatPeriods = useMemo(() => {
        if (!activeClient.isVatRegistered || !activeClient.vatRegistrationDate) return [];

        const regDate = activeClient.vatRegistrationDate?.toDate ? activeClient.vatRegistrationDate.toDate() : new Date(activeClient.vatRegistrationDate);
        const now = new Date();
        let startDate: Date;
        let periods = [];
        
        switch(activeClient.vatCategory) {
            case 'A': // Jan-Feb, Mar-Apr...
                startDate = startOfMonth(regDate);
                while(startDate <= now) {
                    const endDate = endOfMonth(addMonths(startDate, 1));
                    periods.push({
                        label: `${format(startDate, 'MMM')} - ${format(endDate, 'MMM yyyy')}`,
                        value: `${startDate.toISOString()}|${endDate.toISOString()}`
                    });
                    startDate = addMonths(startDate, 2);
                }
                break;
            case 'B': // Feb-Mar, Apr-May...
                let startMonth = getMonth(regDate);
                if (startMonth % 2 !== 1) startMonth++; // Ensure we start on an odd month index (Feb=1, Apr=3...)
                startDate = startOfMonth(new Date(getYear(regDate), startMonth));
                
                while(startDate <= now) {
                    const endDate = endOfMonth(addMonths(startDate, 1));
                     periods.push({
                        label: `${format(startDate, 'MMM')} - ${format(endDate, 'MMM yyyy')}`,
                        value: `${startDate.toISOString()}|${endDate.toISOString()}`
                    });
                    startDate = addMonths(startDate, 2);
                }
                break;
            case 'C': // Monthly
                startDate = startOfMonth(regDate);
                 while(startDate <= now) {
                    const endDate = endOfMonth(startDate);
                     periods.push({
                        label: `${format(startDate, 'MMM yyyy')}`,
                        value: `${startDate.toISOString()}|${endDate.toISOString()}`
                    });
                    startDate = addMonths(startDate, 1);
                }
                break;
        }
        return periods.reverse();

    }, [activeClient]);

    const handleGenerateVat = (values: z.infer<typeof vatReportFormSchema>) => {
        if (!activeClient.isVatRegistered || !activeClient.vatRegistrationDate) {
            toast({ title: "VAT Not Configured", description: "This client is not set up for VAT reporting.", variant: "destructive"});
            return;
        }

        const [fromDateStr, toDateStr] = values.period.split('|');
        const fromDate = new Date(fromDateStr);
        const toDate = new Date(toDateStr);
        const registrationDate = activeClient.vatRegistrationDate.toDate ? activeClient.vatRegistrationDate.toDate() : new Date(activeClient.vatRegistrationDate);

        const VAT_RATE = 0.15;
        let totalSales = 0;
        let totalPurchases = 0;
        let outputVat = 0;
        let inputVat = 0;
        let outputTransactions: AllocatedTransaction[] = [];
        let inputTransactions: AllocatedTransaction[] = [];

        const filteredTxs = allocatedTransactions.filter(tx => {
            const txDate = new Date(tx.date.split('/').reverse().join('-'));
            return txDate >= fromDate && txDate <= toDate && txDate >= registrationDate;
        });

        filteredTxs.forEach(tx => {
            const isStandardSale = tx.vatType === 'standard_rated_sales';
            const isStandardPurchase = tx.vatType === 'standard_rated_purchases' || tx.vatType === 'capital_goods_purchases';

            if (isStandardSale) {
                const exclusiveAmount = tx.amount / (1 + VAT_RATE);
                totalSales += exclusiveAmount;
                outputVat += tx.amount - exclusiveAmount;
                outputTransactions.push(tx);
            } else if (tx.vatType === 'zero_rated_sales') {
                totalSales += tx.amount;
                outputTransactions.push(tx);
            }

            if (isStandardPurchase) {
                const exclusiveAmount = Math.abs(tx.amount) / (1 + VAT_RATE);
                totalPurchases += exclusiveAmount;
                inputVat += Math.abs(tx.amount) - exclusiveAmount;
                inputTransactions.push(tx);
            } else if (tx.vatType === 'zero_rated_purchases') {
                totalPurchases += Math.abs(tx.amount);
                inputTransactions.push(tx);
            }
        });

        setReportData({
            totalSales,
            outputVat,
            totalPurchases,
            inputVat,
            vatPayable: outputVat - inputVat,
            transactions: { inputs: inputTransactions, outputs: outputTransactions }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>VAT201 Report</CardTitle>
                <CardDescription>Generate a VAT201 calculation based on allocated transactions for a selected period.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {!activeClient.isVatRegistered ? (
                     <Alert variant="destructive">
                        <AlertTitle>VAT Not Enabled</AlertTitle>
                        <AlertDescription>This client is not marked as VAT registered. Please update their profile in the main Client Management screen to enable VAT reporting.</AlertDescription>
                    </Alert>
                ) : (
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleGenerateVat)} className="space-y-4">
                        <FormField control={form.control} name="period" render={({ field }) => ( <FormItem><FormLabel>Select VAT Period</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a period..." /></SelectTrigger></FormControl><SelectContent>{vatPeriods.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )} />
                        <Button type="submit">Generate VAT Report</Button>
                    </form>
                </Form>
                )}
                {reportData && (
                    <div className="pt-6">
                        <h3 className="text-lg font-semibold mb-4">VAT201 Calculation Summary</h3>
                        <div className="border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <p>[Box 4] Standard-rated sales (excl. VAT)</p>
                                <p className="font-mono">{formatNumber(reportData.totalSales)}</p>
                            </div>
                            <div className="flex justify-between items-center">
                                <p>[Box 5] Output VAT on sales</p>
                                <p className="font-mono">{formatNumber(reportData.outputVat)}</p>
                            </div>
                            <Separator />
                             <div className="flex justify-between items-center">
                                <p>[Box 14] Input VAT on purchases</p>
                                <p className="font-mono">{formatNumber(reportData.inputVat)}</p>
                            </div>
                             <Separator />
                              <div className="flex justify-between items-center font-bold text-lg">
                                <p>[Box 12] VAT Payable / (Refundable)</p>
                                <p className="font-mono">{formatNumber(reportData.vatPayable)}</p>
                            </div>
                        </div>
                        <Button variant="outline" className="mt-4" onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" /> Print Report
                        </Button>
                        <div className="mt-6 space-y-4">
                            <div>
                                <h4 className="font-semibold">Output VAT Transactions ({reportData.transactions.outputs.length})</h4>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount (incl.)</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {reportData.transactions.outputs.map(tx => (
                                            <TableRow key={tx.id}><TableCell>{tx.date}</TableCell><TableCell>{tx.description}</TableCell><TableCell className="text-right font-mono">{formatNumber(tx.amount)}</TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                             <div>
                                <h4 className="font-semibold">Input VAT Transactions ({reportData.transactions.inputs.length})</h4>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount (incl.)</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {reportData.transactions.inputs.map(tx => (
                                            <TableRow key={tx.id}><TableCell>{tx.date}</TableCell><TableCell>{tx.description}</TableCell><TableCell className="text-right font-mono">{formatNumber(Math.abs(tx.amount))}</TableCell></TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function NumeraPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const [activeClient, setActiveClient] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('reporting');
  const [glInitialValues, setGlInitialValues] = useState<Partial<z.infer<typeof generalLedgerFormSchema>>>();
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importPreview, setImportPreview] = useState<{ count: number; total: number; balance: number; } | null>(null);
  const [bankBalances, setBankBalances] = useState<{ [accountNumber: string]: number }>({});
  const [unallocatedTransactions, setUnallocatedTransactions] = useState<ImportedTransaction[]>([]);
  const [allocatedTransactions, setAllocatedTransactions] = useState<AllocatedTransaction[]>([]);
  const [unallocatedSearch, setUnallocatedSearch] = useState('');
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<{ [key: string]: { value: string, type: 'account'|'customer'|'supplier' } }>({});
  const [vatTypes, setVatTypes] = useState<{ [key: string]: VatType }>({});
  const [isAiAllocating, setIsAiAllocating] = useState(false);
  const [processingTxId, setProcessingTxId] = useState<string | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [isJournalFormOpen, setIsJournalFormOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [feedbackTransaction, setFeedbackTransaction] = useState<ImportedTransaction | null>(null);
  const [isBulkAllocateOpen, setIsBulkAllocateOpen] = useState(false);

  
  const importForm = useForm();
  
  const fetchClients = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "clients"), where('source', '==', 'Numera'));
        const querySnapshot = await getDocs(q);
        let fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        fetchedClients.sort((a, b) => a.name.localeCompare(b.name));
        setClients(fetchedClients);
    } catch (error) {
        console.error("Error fetching clients:", error);
        toast({ title: 'Error', description: 'Could not fetch clients from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [toast]);

  const handleAdd = () => {
    setSelectedClient(null);
    setIsFormOpen(true);
  };

  const handleEdit = (client: User) => {
    setSelectedClient(client);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (clientId: string) => {
    try {
        await deleteDoc(doc(db, "clients", clientId));
        fetchClients();
        toast({
            title: 'Client Deleted',
            description: 'The client and their associated cashbooks have been removed.',
            variant: 'destructive',
        });
        if (activeClient?.id === clientId) {
            setActiveClient(null);
        }
    } catch (error) {
        console.error("Error deleting client:", error);
        toast({ title: 'Error', description: 'Could not delete client.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: z.infer<typeof clientFormSchema>) => {
    if (!currentUser) return;

    const clientData = {
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      yearEnd: data.yearEnd ? Timestamp.fromDate(data.yearEnd) : null,
      isVatRegistered: data.isVatRegistered,
      vatCategory: data.vatCategory,
      vatRegistrationDate: data.vatRegistrationDate ? Timestamp.fromDate(data.vatRegistrationDate) : null,
      role: 'client' as const,
      source: 'Numera' as const,
    };

    try {
      if (selectedClient?.id) {
        const clientRef = doc(db, 'clients', selectedClient.id);
        await setDoc(clientRef, clientData, { merge: true });
        toast({
          title: 'Client Updated',
          description: 'The client details have been saved.',
        });
      } else {
        await addDoc(collection(db, "clients"), clientData);
        toast({
            title: 'Client Created',
            description: 'The new client has been added to the database.',
        });
      }
      fetchClients();
      setIsFormOpen(false);
      setSelectedClient(null);
    } catch (error) {
        console.error("Error saving client:", error);
        toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive'});
    }
  };
  
   const handleTBAccountClick = (accountNumber: string, fromDate: Date, toDate: Date) => {
    setActiveTab('reporting');
    setGlInitialValues({
      accounts: [accountNumber],
      fromDate,
      toDate,
    });
  };

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    if (date.toDate) {
      return format(date.toDate(), 'dd/MM/yyyy');
    }
    const d = new Date(date);
    if (d instanceof Date && !isNaN(d.getTime())) {
      return format(d, 'dd/MM/yyyy');
    }
    return 'Invalid Date';
  };

  const handleImport = () => {
    if (!selectedBankAccount || !importPreview || !selectedFile) {
        toast({ title: 'Import Error', description: 'No account or file selected for import.', variant: 'destructive' });
        return;
    }

    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
          const parsedTransactions = (results.data as { Date: string; Description: string; Amount: string }[])
              .map((row, index) => ({
                  id: `tx-${Date.now()}-${index}`,
                  date: row.Date,
                  description: row.Description,
                  amount: parseFloat(row.Amount) || 0,
                  bankAccountId: selectedBankAccount,
              }));

          setUnallocatedTransactions(prev => [...prev, ...parsedTransactions]);
          
          setBankBalances(prev => ({
              ...prev,
              [selectedBankAccount]: importPreview.balance
          }));
          
          toast({ title: 'Import Successful', description: `${importPreview.count} transactions have been added to the allocation list.` });
          
          setImportPreview(null);
          setSelectedFile(null);
          const fileInput = document.getElementById('transaction-file-input') as HTMLInputElement;
          if(fileInput) fileInput.value = '';
      },
      error: (error) => {
          console.error("CSV Parsing error on import:", error);
          toast({ title: 'File Read Error', description: 'Could not parse the selected file for import.', variant: 'destructive'});
      }
    });
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedBankAccount) {
      setImportPreview(null);
      return;
    };
    setSelectedFile(file);
    setIsParsing(true);
    setImportPreview(null);

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
            if (!results.meta.fields?.includes('Date') || !results.meta.fields?.includes('Description') || !results.meta.fields?.includes('Amount')) {
              toast({ title: 'Invalid CSV Format', description: 'File must contain Date, Description, and Amount columns.', variant: 'destructive'});
              setIsParsing(false);
              const fileInput = document.getElementById('transaction-file-input') as HTMLInputElement;
              if (fileInput) fileInput.value = '';
              return;
            }
            const transactions = results.data as { Date: string; Description: string; Amount: string }[];
            const count = transactions.length;
            const total = transactions.reduce((sum, row) => sum + (parseFloat(row.Amount) || 0), 0);
            
            const currentBalance = bankBalances[selectedBankAccount] || 0;
            const newBalance = currentBalance + total;

            setImportPreview({ count, total, balance: newBalance });
            setIsParsing(false);
        },
        error: (error) => {
            console.error("CSV Parsing error:", error);
            toast({ title: 'File Read Error', description: 'Could not parse the selected file. Please check the format.', variant: 'destructive'});
            setIsParsing(false);
        }
    });
  };

  const handleDownloadSample = () => {
    const csvContent = "Date,Description,Amount\n25/07/2024,Opening Balance,1000.00\n26/07/2024,Payment to Supplier,-250.50\n27/07/2024,Deposit from Client,500.00";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.href) {
      URL.revokeObjectURL(link.href);
    }
    link.href = URL.createObjectURL(blob);
    link.download = 'sample-transactions.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handleAllocate = (transactionId: string) => {
      const allocation = allocations[transactionId];
      if (!allocation) {
          toast({ title: 'Allocation Error', description: 'Please select an account to allocate to.', variant: 'destructive' });
          return;
      }
      
      const transactionToAllocate = unallocatedTransactions.find(tx => tx.id === transactionId);
      if (!transactionToAllocate) return;

      const newAllocatedTransaction: AllocatedTransaction = {
          ...transactionToAllocate,
          allocatedTo: allocation,
          allocatedAt: new Date(),
          vatType: vatTypes[transactionId] || 'no_vat',
          vatAmount: 0, // Placeholder for now
      };
      
      setAllocatedTransactions(prev => [...prev, newAllocatedTransaction]);
      setUnallocatedTransactions(prev => prev.filter(tx => tx.id !== transactionId));
      setAllocations(prev => {
          const newAllocations = { ...prev };
          delete newAllocations[transactionId];
          return newAllocations;
      });
      setVatTypes(prev => {
        const newVatTypes = { ...prev };
        delete newVatTypes[transactionId];
        return newVatTypes;
      });

      toast({ title: 'Transaction Allocated', description: 'The transaction has been successfully allocated.' });
  }
  
  const handleAllocationSelect = (transactionId: string, value: string, type: 'account'|'customer'|'supplier') => {
      setAllocations(prev => ({
          ...prev,
          [transactionId]: { value, type }
      }));
  }
  
  const handleVatTypeSelect = (transactionId: string, vatType: VatType) => {
      setVatTypes(prev => ({
          ...prev,
          [transactionId]: vatType
      }));
  }

  const handleBulkAllocate = (bulkAllocation: { value: string, type: 'account'|'customer'|'supplier' }, bulkVatType: VatType) => {
    const transactionsToAllocate = unallocatedTransactions.filter(tx => selectedTransactions.includes(tx.id));
    
    const newAllocatedTransactions: AllocatedTransaction[] = transactionsToAllocate.map(tx => ({
        ...tx,
        allocatedTo: bulkAllocation,
        allocatedAt: new Date(),
        vatType: bulkVatType,
        vatAmount: 0,
    }));
    
    setAllocatedTransactions(prev => [...prev, ...newAllocatedTransactions]);
    setUnallocatedTransactions(prev => prev.filter(tx => !newAllocatedTransactions.some(at => at.id === tx.id)));
    setSelectedTransactions([]);
    
    setAllocations(prev => {
        const newAllocations = { ...prev };
        newAllocatedTransactions.forEach(tx => delete newAllocations[tx.id]);
        return newAllocations;
    });
    setVatTypes(prev => {
        const newVatTypes = { ...prev };
        newAllocatedTransactions.forEach(tx => delete newVatTypes[tx.id]);
        return newVatTypes;
    });

    toast({ title: 'Bulk Allocation Successful', description: `${newAllocatedTransactions.length} transactions have been allocated.` });
    setIsBulkAllocateOpen(false);
  };
  
   const handleClearAllocations = () => {
    setAllocations({});
    setVatTypes({});
    setSelectedTransactions([]);
    toast({
      title: 'Allocations Cleared',
      description: 'All suggested allocations and selections have been reset.',
    });
  };

  const handleSelectionChange = (id: string, isSelected: boolean) => {
    setSelectedTransactions(prev => {
        const newSelection = new Set(prev);
        if (isSelected) {
            newSelection.add(id);
        } else {
            newSelection.delete(id);
        }
        return Array.from(newSelection);
    });
  };

 const handleSaveAllocation = (transactionId: string, newAllocation: {value: string, type: 'account'|'customer'|'supplier'}, newVatType: VatType) => {
    setAllocatedTransactions(prev => prev.map(tx => {
        if (tx.id === transactionId) {
            return {
                ...tx,
                allocatedTo: newAllocation,
                vatType: newVatType,
            };
        }
        return tx;
    }));
    toast({ title: 'Allocation Updated', description: 'The transaction allocation has been successfully saved.' });
  };

  const runAiAllocation = async (txns: ImportedTransaction[]) => {
    setIsAiAllocating(true);
    toast({ title: 'AI Allocation Started', description: `AI is analyzing ${txns.length} transaction(s).` });

    for (const tx of txns) {
        setProcessingTxId(tx.id);
        try {
            const result = await allocateTransaction({ description: tx.description });
            if (result.accountNumber && chartOfAccounts.some(acc => acc.accountNumber === result.accountNumber)) {
                handleAllocationSelect(tx.id, result.accountNumber, 'account');
                handleVatTypeSelect(tx.id, result.vatType);
            }
        } catch (error) {
            console.error(`AI allocation failed for transaction ${tx.id}:`, error);
        }
    }

    setProcessingTxId(null);
    setIsAiAllocating(false);
    toast({ title: 'AI Allocation Complete', description: `AI successfully suggested allocations for ${txns.length} transactions.` });
  }

  const handleAiAllocate = async () => {
    const transactionsToProcess = unallocatedTransactions.filter(tx => selectedTransactions.includes(tx.id));
    if (transactionsToProcess.length === 0) {
        toast({ title: 'No Transactions Selected', description: 'Please select one or more transactions to allocate with AI.', variant: 'destructive'});
        return;
    }
    await runAiAllocation(transactionsToProcess);
  };

  const handleFeedbackSubmit = async (feedbackData: {
    transaction: ImportedTransaction;
    correctAccount: string;
    correctVatType: VatType;
    rule: string;
  }) => {
    const { transaction, correctAccount, correctVatType, rule } = feedbackData;
    const incorrectAccount = allocations[transaction.id]?.value;
    const incorrectVatType = vatTypes[transaction.id];

    toast({ title: "Learning from feedback...", description: "Updating AI knowledge and re-allocating." });
    
    // Simulate updating knowledge. In a real app, this would update a persistent knowledge base.
    await refineAllocationKnowledge({
      transactionDescription: transaction.description,
      incorrectAllocation: `${incorrectAccount} (VAT: ${incorrectVatType})`,
      correctAllocation: `${correctAccount} (VAT: ${correctVatType})`,
      userProvidedRule: rule,
    });
    
    setFeedbackTransaction(null); // Close the dialog
    
    // Re-run AI allocation on the single transaction
    await runAiAllocation([transaction]);
  };


  const handleJournalFormSubmit = (data: Journal) => {
    if (selectedJournal) {
      setJournals(prev => prev.map(j => (j.id === data.id ? data : j)));
      toast({ title: "Journal Updated", description: "The journal entry has been saved." });
    } else {
      setJournals(prev => [...prev, data]);
      toast({ title: "Journal Created", description: "The new journal entry has been added." });
    }
    setIsJournalFormOpen(false);
    setSelectedJournal(null);
  };

  const handleAddJournal = () => {
    setSelectedJournal(null);
    setIsJournalFormOpen(true);
  };
  
  const handleEditJournal = (journal: Journal) => {
    setSelectedJournal(journal);
    setIsJournalFormOpen(true);
  };

  const handleCopyJournal = (journal: Journal) => {
    const newJournalData = {
        ...journal,
        id: '', // Remove ID to indicate it's a new entry
        date: new Date(), // Set to current date
    };
    setSelectedJournal(newJournalData as unknown as Journal); // Cast because id is temporarily empty
    setIsJournalFormOpen(true);
  };

  const handleDeleteJournal = (journalId: string) => {
    setJournals(prev => prev.filter(j => j.id !== journalId));
    toast({ title: "Journal Deleted", variant: "destructive" });
  };


  const clientBankAccounts = activeClient
    ? chartOfAccounts.filter(acc => acc.description.startsWith(activeClient.name))
    : [];

  const incomeTransactions = useMemo(() => {
    const filtered = unallocatedTransactions.filter(tx => tx.amount >= 0);
    if (!unallocatedSearch) return filtered;
    return filtered.filter(tx => 
        tx.description.toLowerCase().includes(unallocatedSearch.toLowerCase()) ||
        tx.amount.toString().includes(unallocatedSearch)
    );
  }, [unallocatedTransactions, unallocatedSearch]);

  const expenseTransactions = useMemo(() => {
    const filtered = unallocatedTransactions.filter(tx => tx.amount < 0);
     if (!unallocatedSearch) return filtered;
    return filtered.filter(tx => 
        tx.description.toLowerCase().includes(unallocatedSearch.toLowerCase()) ||
        tx.amount.toString().includes(unallocatedSearch)
    );
  }, [unallocatedTransactions, unallocatedSearch]);
  
  const allocatedIncome = useMemo(() => allocatedTransactions.filter(tx => tx.amount >= 0), [allocatedTransactions]);
  const allocatedExpenses = useMemo(() => allocatedTransactions.filter(tx => tx.amount < 0), [allocatedTransactions]);

  const [_, forceUpdate] = useState({});

  return (
    <div className="space-y-8">
        <style jsx global>{`
            @media print {
              body * {
                visibility: hidden;
              }
              .printable-area, .printable-area * {
                visibility: visible;
              }
              .printable-area {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
              }
            }
        `}</style>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Numera Accounting</h1>
        {!activeClient && (
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Client
                    </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{selectedClient ? 'Edit Client' : 'Create New Client'}</DialogTitle>
                        <DialogDescription>
                            {selectedClient ? 'Update the details for this client.' : 'Enter the details for a new Numera client.'}
                        </DialogDescription>
                    </DialogHeader>
                    <ClientForm 
                        client={selectedClient} 
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                    />
            </DialogContent>
            </Dialog>
        )}
      </div>
      
        {activeClient ? (
             <div className="space-y-6">
                <Card className="bg-primary/10 border-primary/20">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                                <CardDescription>Currently working on:</CardDescription>
                                <CardTitle>{activeClient.name}</CardTitle>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setActiveClient(null)}>
                                <X className="h-5 w-5" />
                            </Button>
                        </div>
                    </CardHeader>
                </Card>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                    <TabsList>
                        <TabsTrigger value="reporting">Reporting</TabsTrigger>
                        <TabsTrigger value="banking">Banking</TabsTrigger>
                        <TabsTrigger value="journals">Journals</TabsTrigger>
                        <TabsTrigger value="vat">VAT</TabsTrigger>
                        <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                        <TabsTrigger value="customers">Customers</TabsTrigger>
                        <TabsTrigger value="train-ai">Train AI</TabsTrigger>
                    </TabsList>
                    <TabsContent value="reporting" className="space-y-4">
                        <TrialBalanceCard activeClient={activeClient} onAccountClick={handleTBAccountClick} allocatedTransactions={allocatedTransactions} unallocatedTransactions={unallocatedTransactions} />
                        <GeneralLedgerCard activeClient={activeClient} initialValues={glInitialValues} allocatedTransactions={allocatedTransactions} />
                    </TabsContent>
                    <TabsContent value="banking" className="space-y-4">
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Bank Account List</CardTitle>
                                    <CardDescription>Manage this client's bank accounts.</CardDescription>
                                </div>
                                <AddBankAccountForm activeClient={activeClient} onAccountAdded={() => forceUpdate({})} />
                            </CardHeader>
                            <CardContent>
                                {clientBankAccounts.length > 0 ? (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Account Number</TableHead>
                                                <TableHead>Account Name</TableHead>
                                                <TableHead>Last Import</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {clientBankAccounts.map(acc => (
                                                <TableRow key={acc.id}>
                                                    <TableCell className="font-mono">{acc.accountNumber}</TableCell>
                                                    <TableCell>{acc.description}</TableCell>
                                                    <TableCell>{unallocatedTransactions.some(t => t.bankAccountId === acc.accountNumber) ? format(new Date(), 'dd/MM/yyyy') : 'N/A'}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNumber(bankBalances[acc.accountNumber] || 0)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-muted-foreground text-center py-10">No bank accounts found for this client.</p>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>Import Bank Transactions</CardTitle>
                                <CardDescription>Import a CSV file of transactions into a selected bank account.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                               <Form {...importForm}>
                                <form className="space-y-4" onSubmit={e => e.preventDefault()}>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormItem>
                                            <FormLabel>Select Bank Account</FormLabel>
                                            <Select onValueChange={setSelectedBankAccount}>
                                                <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select an account..." />
                                                </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {clientBankAccounts.map(acc => (
                                                        <SelectItem key={acc.id} value={acc.accountNumber}>{acc.description}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                        <FormItem>
                                            <FormLabel>Transaction File (.csv)</FormLabel>
                                            <FormControl>
                                            <Input id="transaction-file-input" type="file" accept=".csv" onChange={handleFileChange} />
                                            </FormControl>
                                        </FormItem>
                                    </div>
                                    <Button type="button" variant="secondary" size="sm" onClick={handleDownloadSample}>
                                        <Download className="mr-2 h-4 w-4" /> Download Sample CSV
                                    </Button>
                                    {isParsing && (
                                        <div className="flex items-center text-sm text-muted-foreground">
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Analyzing file...
                                        </div>
                                    )}
                                    {importPreview && (
                                        <Alert>
                                            <ScanLine className="h-4 w-4" />
                                            <AlertTitle>Import Preview</AlertTitle>
                                            <AlertDescription className="space-y-2">
                                                <p>File: <span className="font-semibold">{selectedFile?.name}</span></p>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs">Transactions Found</p>
                                                        <p className="font-bold">{importPreview.count}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs">Projected New Balance</p>
                                                        <p className="font-bold">{formatNumber(importPreview.balance)}</p>
                                                    </div>
                                                </div>
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                    <Button type="button" onClick={handleImport} disabled={!selectedBankAccount || !importPreview || isParsing}>
                                        <Upload className="mr-2 h-4 w-4" /> Import Transactions
                                    </Button>
                                </form>
                               </Form>
                            </CardContent>
                        </Card>
                        
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row justify-between gap-4">
                                    <div>
                                        <CardTitle>Transaction Processing</CardTitle>
                                        <CardDescription>Allocate imported transactions to your Chart of Accounts.</CardDescription>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                         <Button variant="outline" size="sm" onClick={handleClearAllocations}>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Clear Allocations
                                        </Button>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="search"
                                                placeholder="Search transactions..."
                                                className="w-full sm:w-[250px] pl-8"
                                                value={unallocatedSearch}
                                                onChange={(e) => setUnallocatedSearch(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {unallocatedTransactions.length > 0 || allocatedTransactions.length > 0 ? (
                                    <Tabs defaultValue="unallocated-income">
                                        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto">
                                            <TabsTrigger value="unallocated-income">Unallocated Income ({incomeTransactions.length})</TabsTrigger>
                                            <TabsTrigger value="unallocated-expenses">Unallocated Expenses ({expenseTransactions.length})</TabsTrigger>
                                            <TabsTrigger value="allocated-income">Allocated Income ({allocatedIncome.length})</TabsTrigger>
                                            <TabsTrigger value="allocated-expenses">Allocated Expenses ({allocatedExpenses.length})</TabsTrigger>
                                        </TabsList>
                                        {(selectedTransactions.length > 0 && !isAiAllocating) && (
                                            <div className="flex flex-wrap items-center gap-4 p-4 border-t border-b bg-muted/50">
                                                <p className="text-sm font-semibold">{selectedTransactions.length} selected</p>
                                                <Button size="sm" onClick={() => setIsBulkAllocateOpen(true)}>Allocate Selected</Button>
                                                <Button size="sm" variant="outline" onClick={handleAiAllocate} disabled={isAiAllocating}>
                                                    {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                                     Allocate with AI
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setSelectedTransactions([])}>Clear Selection</Button>
                                            </div>
                                        )}
                                        {isAiAllocating && (
                                            <div className="flex items-center gap-2 p-4 border-t border-b bg-muted/50 text-sm">
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                AI is analyzing transactions... Please wait.
                                            </div>
                                        )}
                                        <TabsContent value="unallocated-income">
                                            {incomeTransactions.length > 0 ? (
                                                <AllocationTable transactions={incomeTransactions} onAllocate={handleAllocate} selectedTransactions={selectedTransactions} onSelectionChange={handleSelectionChange} onAllocationSelect={handleAllocationSelect} allocations={allocations} onVatTypeSelect={handleVatTypeSelect} vatTypes={vatTypes} onFeedback={setFeedbackTransaction} processingTxId={processingTxId} />
                                            ) : (
                                                <p className="text-muted-foreground text-center py-10">No unallocated income transactions to display.</p>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="unallocated-expenses">
                                             {expenseTransactions.length > 0 ? (
                                                 <AllocationTable transactions={expenseTransactions} onAllocate={handleAllocate} selectedTransactions={selectedTransactions} onSelectionChange={handleSelectionChange} onAllocationSelect={handleAllocationSelect} allocations={allocations} onVatTypeSelect={handleVatTypeSelect} vatTypes={vatTypes} onFeedback={setFeedbackTransaction} processingTxId={processingTxId} />
                                             ) : (
                                                <p className="text-muted-foreground text-center py-10">No unallocated expense transactions to display.</p>
                                             )}
                                        </TabsContent>
                                        <TabsContent value="allocated-income">
                                            {allocatedIncome.length > 0 ? (
                                                <AllocatedTransactionTable transactions={allocatedIncome} onSaveAllocation={handleSaveAllocation} />
                                            ) : (
                                                <p className="text-muted-foreground text-center py-10">No allocated income transactions to display.</p>
                                            )}
                                        </TabsContent>
                                         <TabsContent value="allocated-expenses">
                                            {allocatedExpenses.length > 0 ? (
                                                <AllocatedTransactionTable transactions={allocatedExpenses} onSaveAllocation={handleSaveAllocation} />
                                            ) : (
                                                <p className="text-muted-foreground text-center py-10">No allocated expense transactions to display.</p>
                                            )}
                                        </TabsContent>
                                    </Tabs>
                                ) : (
                                    <p className="text-muted-foreground text-center py-10">No transactions to process. Please import a bank statement.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="journals">
                         <Card>
                             <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Manage Journals</CardTitle>
                                    <CardDescription>Create and manage manual journal entries for adjustments and accruals.</CardDescription>
                                </div>
                                <Button onClick={handleAddJournal}><PlusCircle className="mr-2 h-4 w-4" /> Create Journal</Button>
                            </CardHeader>
                            <CardContent>
                                {journals.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Journal ID</TableHead>
                                            <TableHead>Narrative</TableHead>
                                            <TableHead className="text-right">Amount</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {journals.map(j => (
                                            <TableRow key={j.id}>
                                                <TableCell>{format(j.date, 'dd/MM/yyyy')}</TableCell>
                                                <TableCell className="font-mono">{j.id}</TableCell>
                                                <TableCell>{j.narrative}</TableCell>
                                                <TableCell className="text-right font-mono">{formatNumber(j.lines.reduce((acc, l) => acc + l.debit, 0))}</TableCell>
                                                <TableCell className="text-right">
                                                     <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Open menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleEditJournal(j)}><Edit className="mr-2 h-4 w-4" />Edit</DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => handleCopyJournal(j)}><Copy className="mr-2 h-4 w-4" />Copy</DropdownMenuItem>
                                                            <DropdownMenuSeparator />
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem className="text-destructive"><X className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                                        <AlertDialogDescription>This will permanently delete journal {j.id}.</AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => handleDeleteJournal(j.id)}>Delete</AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                ) : (
                                <p className="text-muted-foreground text-center py-10">No journals created yet.</p>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="vat">
                        <VatReportCard allocatedTransactions={allocatedTransactions} activeClient={activeClient} />
                    </TabsContent>
                     <TabsContent value="suppliers">
                         <Card>
                            <CardHeader><CardTitle>Manage Suppliers</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Supplier creation and management will be built here.</p></CardContent>
                        </Card>
                    </TabsContent>
                     <TabsContent value="customers">
                         <Card>
                            <CardHeader><CardTitle>Manage Customers</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Customer creation and management will be built here.</p></CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="train-ai">
                         <Card>
                            <CardHeader>
                                <CardTitle>Train Allocation AI</CardTitle>
                                <CardDescription>Provide more context to help the AI make better allocation decisions.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="ai-text-input">Provide Contextual Information</Label>
                                    <Textarea id="ai-text-input" placeholder="e.g., 'All transactions from Pick n Pay should be allocated to General Expenses.' or 'Supplier XYZ is for raw materials.'" rows={4}/>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="ai-doc-upload">Upload Sample Documents</Label>
                                    <Input id="ai-doc-upload" type="file" />
                                    <p className="text-xs text-muted-foreground">Upload documents like supplier invoices or bank statements to give the AI more context.</p>
                                </div>
                                <Button>
                                    <BrainCircuit className="mr-2 h-4 w-4" />
                                    Submit for Training
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>
             </div>
        ) : (
            <Card>
                <CardHeader>
                <CardTitle>Numera Clients</CardTitle>
                <CardDescription>Select a client to start working, or create a new client.</CardDescription>
                </CardHeader>
                <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    clients.length === 0 ? (
                        <div className="text-center py-10">
                            <p className="text-muted-foreground">No clients have been added to Numera yet.</p>
                            <Button onClick={handleAdd} className="mt-4">
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create Your First Client
                            </Button>
                        </div>
                    ) : (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Client</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Financial Year End</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {clients.map(client => (
                        <TableRow key={client.id}>
                        <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${client.name}`} alt={client.name} />
                                    <AvatarFallback>{client.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span>{client.name}</span>
                            </div>
                        </TableCell>
                        <TableCell>{client.contactPerson}</TableCell>
                        <TableCell>{client.email}</TableCell>
                        <TableCell>{formatDate(client.yearEnd)}</TableCell>
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                <Button size="sm" onClick={() => setActiveClient(client)}>Select</Button>
                                <AlertDialog>
                                    <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Open menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => handleEdit(client)}>
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive">
                                                Delete
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete the client account for:
                                            <span className="font-semibold"> {client.name}</span>. This will also remove their related cashbooks.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(client.id)}>
                                                Continue
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                    )
                )}
                </CardContent>
            </Card>
        )}
        <Dialog open={isJournalFormOpen} onOpenChange={setIsJournalFormOpen}>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{selectedJournal?.id ? 'Edit Journal' : 'Create New Journal'}</DialogTitle>
                    <DialogDescription>
                        {selectedJournal?.id ? `Editing Journal ${selectedJournal.id}` : 'Create a new manual journal entry. Debits must equal credits.'}
                    </DialogDescription>
                </DialogHeader>
                 <JournalForm 
                    journal={selectedJournal}
                    onSubmit={handleJournalFormSubmit}
                    onCancel={() => { setIsJournalFormOpen(false); setSelectedJournal(null); }}
                 />
            </DialogContent>
        </Dialog>
         <AIFeedbackDialog
            transaction={feedbackTransaction}
            allocations={allocations}
            vatTypes={vatTypes}
            onClose={() => setFeedbackTransaction(null)}
            onSubmit={handleFeedbackSubmit}
        />
        <BulkAllocateDialog
            isOpen={isBulkAllocateOpen}
            onClose={() => setIsBulkAllocateOpen(false)}
            onBulkAllocate={handleBulkAllocate}
            count={selectedTransactions.length}
        />
    </div>
  );
}

const feedbackSchema = z.object({
    correctAccount: z.string().min(1, "Please select the correct account."),
    correctVatType: z.custom<VatType>(),
    rule: z.string().min(10, "Please provide a simple rule for the AI to learn."),
});

function AIFeedbackDialog({
    transaction,
    allocations,
    vatTypes,
    onClose,
    onSubmit,
}: {
    transaction: ImportedTransaction | null;
    allocations: { [key: string]: { value: string, type: 'account'|'customer'|'supplier' } };
    vatTypes: { [key: string]: VatType };
    onClose: () => void;
    onSubmit: (data: {
        transaction: ImportedTransaction;
        correctAccount: string;
        correctVatType: VatType;
        rule: string;
    }) => void;
}) {
    const form = useForm<z.infer<typeof feedbackSchema>>({
        resolver: zodResolver(feedbackSchema),
        defaultValues: {
            correctAccount: '',
            correctVatType: 'no_vat',
            rule: '',
        }
    });

    useEffect(() => {
        form.reset();
    }, [transaction]);

    if (!transaction) return null;
    
    const currentAllocation = allocations[transaction.id];
    const currentVatType = vatTypes[transaction.id];

    const handleSubmit = (values: z.infer<typeof feedbackSchema>) => {
        onSubmit({
            transaction,
            ...values,
        });
    }

    return (
        <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Provide AI Feedback</DialogTitle>
                    <DialogDescription>
                        Help the AI learn by correcting this allocation.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <p className="text-sm">
                        <strong>Transaction:</strong> {transaction.description}
                    </p>
                    <p className="text-sm">
                        <strong>AI Suggestion:</strong>{' '}
                        {currentAllocation ? `${chartOfAccounts.find(c => c.accountNumber === currentAllocation.value)?.description} (VAT: ${currentVatType})` : 'None'}
                    </p>
                    <Separator />
                     <Form {...form}>
                        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="correctAccount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Correct Account</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Select correct account..." /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                {chartOfAccounts.map(acc => <SelectItem key={acc.accountNumber} value={acc.accountNumber}>{acc.accountNumber} - {acc.description}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="correctVatType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Correct VAT Type</FormLabel>
                                        <FormControl>
                                            <VatTypeCombobox value={field.value} onSelect={field.onChange} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="rule"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Explain the rule</FormLabel>
                                        <FormControl>
                                            <Textarea {...field} placeholder="e.g., 'Transactions with TELKOM should go to Telephone & Fax'" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                                <Button type="submit">Submit Feedback & Re-allocate</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </div>
            </DialogContent>
        </Dialog>
    );
}

const bulkAllocateSchema = z.object({
    allocation: z.object({
        value: z.string().min(1, 'Account is required'),
        type: z.enum(['account', 'customer', 'supplier'])
    }),
    vatType: z.custom<VatType>()
});

function BulkAllocateDialog({ isOpen, onClose, onBulkAllocate, count }: { isOpen: boolean, onClose: () => void, onBulkAllocate: (alloc: { value: string, type: 'account'|'customer'|'supplier' }, vat: VatType) => void, count: number }) {
    const form = useForm<z.infer<typeof bulkAllocateSchema>>({
        resolver: zodResolver(bulkAllocateSchema),
        defaultValues: {
            allocation: undefined,
            vatType: 'no_vat'
        }
    });

    const handleSubmit = (values: z.infer<typeof bulkAllocateSchema>) => {
        onBulkAllocate(values.allocation, values.vatType);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bulk Allocate Transactions</DialogTitle>
                    <DialogDescription>
                        Select an account and VAT type to apply to all {count} selected transactions.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 py-4">
                         <FormField
                            control={form.control}
                            name="allocation"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Allocate To</FormLabel>
                                    <FormControl>
                                        <AllocationCombobox
                                            value={field.value}
                                            onSelect={(value, type) => field.onChange({ value, type })}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField
                            control={form.control}
                            name="vatType"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>VAT Type</FormLabel>
                                    <FormControl>
                                        <VatTypeCombobox value={field.value} onSelect={field.onChange} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button type="submit">Allocate All</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

    
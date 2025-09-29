

'use client';
import { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, CalendarIcon, X, Printer, Download, Upload, FileCheck2, ScanLine, Sprout, Search, ArrowUpDown, Edit, Sparkles, BrainCircuit, Copy, MessageSquare, RefreshCw, ChevronDown, Trash2, ListOrdered, HardHat, Feather, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, ChartOfAccount, VatType, Supplier, ImportedTransaction, AllocationRule } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch, Timestamp, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, add, sub, getMonth, getYear, startOfYear, endOfYear, startOfMonth, endOfMonth, addMonths, parse } from 'date-fns';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { allocationRules as initialAllocationRules } from '@/lib/allocation-rules';
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
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { getAISuggestions } from '@/ai/flows/get-ai-suggestions';
import { allVatTypes as allVatTypesData } from '@/lib/vat-types';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

const db = getFirestore(firebaseApp);

const formatNumber = (value: number) => {
    return value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

type AllocatedTransaction = Omit<ImportedTransaction, 'id'> & {
    id: string; // Keep id optional for creation
    allocatedTo: {
        value: string; // Account number, customer id, or supplier id
        type: 'account' | 'customer' | 'supplier';
    };
    vatType: VatType;
    vatAmount: number;
    allocatedAt: Timestamp;
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
                                        captionLayout="dropdown"
                                        fromYear={2015}
                                        toYear={new Date().getFullYear()}
                                    />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
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

function AddBankAccountForm({ activeClient, onAccountAdded, chartOfAccounts }: { activeClient: User; onAccountAdded: (newAccount: ChartOfAccount) => void; chartOfAccounts: ChartOfAccount[]; }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof bankAccountFormSchema>>({
    resolver: zodResolver(bankAccountFormSchema),
    defaultValues: { name: '' },
  });

  const handleSubmit = async (values: z.infer<typeof bankAccountFormSchema>>) => {
    if (!activeClient) return;
    setIsSaving(true);
    try {
        let nextAccountNumberIndex = 1;
        const cashbooks = chartOfAccounts.filter(a => a.accountNumber.startsWith('8400/'));
        if (cashbooks.length > 0) {
            const lastCashbookNumber = cashbooks
                .map(a => parseInt(a.accountNumber.split('/')[1]))
                .filter(n => !isNaN(n))
                .sort((a,b) => a - b)
                .pop() || 0;
            nextAccountNumberIndex = lastCashbookNumber + 1;
        }

        const newAccountNum = `8400/${(nextAccountNumberIndex).toString().padStart(3, '0')}`;
        const newAccount: ChartOfAccount = {
            id: newAccountNum,
            accountNumber: newAccountNum,
            description: values.name,
            section: 'Balance Sheet',
        };
        
        onAccountAdded(newAccount);

        toast({
            title: 'Cashbook Added',
            description: `New cashbook account ${newAccountNum} has been added for ${values.name}.`,
        });
        form.reset();
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

function TrialBalanceCard({ activeClient, onAccountClick, allocatedTransactions, unallocatedTransactions, chartOfAccounts }: { activeClient: User; onAccountClick: (accountNumber: string, from: Date, to: Date) => void; allocatedTransactions: AllocatedTransaction[]; unallocatedTransactions: ImportedTransaction[], chartOfAccounts: ChartOfAccount[] }) {
    
    const [reportData, setReportData] = useState<TrialBalanceReportData | null>(null);
    const reportRef = useRef(null);

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

    const handleDownloadPdf = () => {
        const input = reportRef.current;
        if (!input) return;
        html2canvas(input).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            const width = pdfWidth;
            const height = width / ratio;
            pdf.addImage(imgData, 'PNG', 0, 0, width, height > pdfHeight ? pdfHeight : height);
            pdf.save(`Trial-Balance-${activeClient.name}-${reportData?.fromDate}-to-${reportData?.toDate}.pdf`);
        });
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
                    <div className="max-h-[70vh] overflow-y-auto">
                        <div ref={reportRef} className="printable-area p-2 bg-white">
                            <Card className="w-full shadow-none border-none">
                                <CardHeader className="text-center">
                                    <CardTitle className="text-2xl">{reportData.clientName}</CardTitle>
                                    <CardDescription className="text-lg">Trial Balance</CardDescription>
                                    <CardDescription>
                                        For the period: {reportData.fromDate} to {reportData.toDate}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
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
                    </div>
                 )}
                <DialogFooter className="print:hidden">
                    <Button variant="outline" onClick={handleDownloadPdf}>
                        <Download className="mr-2 h-4 w-4" />
                        Download PDF
                    </Button>
                    <Button variant="outline" onClick={handleDownloadExcel}>
                        <Download className="mr-2 h-4 w-4" />
                        Download Excel
                    </Button>
                    <Button variant="outline" onClick={() => window.print()}>
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                </DialogFooter>
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

function GeneralLedgerCard({ activeClient, initialValues, allocatedTransactions, chartOfAccounts }: { activeClient: User, initialValues?: Partial<z.infer<typeof generalLedgerFormSchema>>, allocatedTransactions: AllocatedTransaction[], chartOfAccounts: ChartOfAccount[] }) {
  
  const [reportData, setReportData] = useState<GeneralLedgerReportData | null>(null);
  const reportRef = useRef(null);
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
                debit = -exclusiveAmount > 0 ? -exclusiveAmount : 0;
                credit = -exclusiveAmount < 0 ? Math.abs(-exclusiveAmount) : 0;
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

  const handleDownloadPdf = () => {
    const input = reportRef.current;
    if (!input) return;
    html2canvas(input).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;
        const ratio = canvasWidth / canvasHeight;
        const width = pdfWidth;
        const height = width / ratio;
        pdf.addImage(imgData, 'PNG', 0, 0, width, height > pdfHeight ? pdfHeight : height);
        pdf.save(`General-Ledger-${activeClient.name}-${reportData?.fromDate}-to-${reportData?.toDate}.pdf`);
    });
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
            <div className="max-h-[70vh] overflow-y-auto">
              <div ref={reportRef} className="printable-area p-2 bg-white">
                <Card className="w-full shadow-none border-none">
                  <CardHeader className="text-center">
                    <CardTitle className="text-2xl">{reportData.clientName}</CardTitle>
                    <CardDescription className="text-lg">General Ledger</CardDescription>
                    <CardDescription>
                      For the period: {reportData.fromDate} to {reportData.toDate}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
            </div>
          )}
          <DialogFooter className="print:hidden">
              <Button variant="outline" onClick={handleDownloadPdf}>
                  <Download className="mr-2 h-4 w-4" /> Download PDF
              </Button>
              <Button variant="outline" onClick={handleDownloadExcel}>
                  <Download className="mr-2 h-4 w-4" /> Download Excel
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" /> Print Report
              </Button>
          </DialogFooter>
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

const allVatTypes: { name: VatType, label: string, category: 'Output Tax' | 'Input Tax' | 'Other' }[] = allVatTypesData;

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

function AllocationCombobox({ value, onSelect, customers, suppliers, chartOfAccounts }: { value?: { value: string, type: string }, onSelect: (value: string, type: 'account'|'customer'|'supplier') => void, customers: User[], suppliers: Supplier[], chartOfAccounts: ChartOfAccount[] }) {
    const [open, setOpen] = useState(false);
    
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
                        </CommandGroup>
                        <CommandGroup heading="Customers">
                             {customers.map(customer => (
                                <CommandItem key={`cust-${customer.id}`} onSelect={() => { onSelect(customer.id, 'customer'); setOpen(false); }}>
                                    {customer.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        <CommandGroup heading="Suppliers">
                             {suppliers.map(supplier => (
                                <CommandItem key={`supp-${supplier.id}`} onSelect={() => { onSelect(supplier.id, 'supplier'); setOpen(false); }}>
                                    {supplier.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

type SortableField = 'date' | 'description' | 'amount';
type SortDirection = 'asc' | 'desc';

function AllocationTable({ transactions, onAllocate, onEdit, onDelete, selectedTransactions, onSelectionChange, onAllocationSelect, allocations, onVatTypeSelect, vatTypes, onCreateRule, processingTxId, customers, suppliers, chartOfAccounts }: { 
    transactions: (ImportedTransaction | AllocatedTransaction)[], 
    onAllocate: (transactionId: string) => void, 
    onEdit: (transaction: ImportedTransaction) => void,
    onDelete: (transactionId: string) => void,
    selectedTransactions: string[], 
    onSelectionChange: (id: string, isSelected: boolean) => void,
    onAllocationSelect: (transactionId: string, value: string, type: 'account'|'customer'|'supplier') => void,
    allocations: { [key: string]: { value: string, type: 'account'|'customer'|'supplier' } },
    onVatTypeSelect: (transactionId: string, vatType: VatType) => void,
    vatTypes: { [key: string]: VatType },
    onCreateRule: (transaction: ImportedTransaction | AllocatedTransaction) => void,
    processingTxId?: string | null;
    customers: User[];
    suppliers: Supplier[];
    chartOfAccounts: ChartOfAccount[];
}) {
    const [sortConfig, setSortConfig] = useState<{ key: SortableField, direction: SortDirection } | null>({ key: 'date', direction: 'asc'});

    const handleSelectAll = (checked: boolean) => {
        transactions.forEach(tx => onSelectionChange(tx.id, checked));
    };

    const requestSort = (key: SortableField) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
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
                    bValue = new Date(yearB, monthB - 1, dayB).getTime();
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
                            <AllocationCombobox value={allocations[tx.id]} onSelect={(value, type) => onAllocationSelect(tx.id, value, type)} customers={customers} suppliers={suppliers} chartOfAccounts={chartOfAccounts} />
                        </TableCell>
                        <TableCell className="w-[300px]">
                            <VatTypeCombobox value={vatTypes[tx.id]} onSelect={(value) => onVatTypeSelect(tx.id, value)} />
                        </TableCell>
                        <TableCell className="text-right">
                             <AlertDialog>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => onAllocate(tx.id)} disabled={!allocations[tx.id] || processingTxId === tx.id}>Allocate</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onEdit(tx as ImportedTransaction)}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onCreateRule(tx)}>Create AI Rule</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                 <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently delete this transaction. This action cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(tx.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function AllocatedTransactionTable({ transactions, onSaveAllocation, onDelete, onCreateRule, selectedTransactions, onSelectionChange, customers, suppliers, chartOfAccounts }: { 
    transactions: AllocatedTransaction[], 
    onSaveAllocation: (transactionId: string, newAllocation: {value: string, type: 'account'|'customer'|'supplier'}, newVatType: VatType) => void,
    onDelete: (transactionId: string) => void,
    onCreateRule: (transaction: AllocatedTransaction) => void,
    selectedTransactions: string[],
    onSelectionChange: (id: string, isSelected: boolean) => void,
    customers: User[];
    suppliers: Supplier[];
    chartOfAccounts: ChartOfAccount[];
 }) {
    
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
    
    const handleSelectAll = (checked: boolean) => {
        transactions.forEach(tx => onSelectionChange(tx.id, checked));
    };
    
    const areAllSelected = transactions.length > 0 && transactions.every(tx => selectedTransactions.includes(tx.id));

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
                        <TableCell>
                           <AllocationCombobox value={editableAllocations[tx.id]} onSelect={(value, type) => setEditableAllocations(prev => ({ ...prev, [tx.id]: { value, type } }))} customers={customers} suppliers={suppliers} chartOfAccounts={chartOfAccounts} />
                        </TableCell>
                         <TableCell>
                            <VatTypeCombobox value={editableVatTypes[tx.id]} onSelect={(value) => setEditableVatTypes(prev => ({...prev, [tx.id]: value}))} />
                        </TableCell>
                        <TableCell className="text-right">
                             <AlertDialog>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => onSaveAllocation(tx.id, editableAllocations[tx.id], editableVatTypes[tx.id])}>Save Changes</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onCreateRule(tx)}>Create AI Rule</DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently delete this allocated transaction. This action cannot be undone.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(tx.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                             </AlertDialog>
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


function JournalForm({ journal, onSubmit, onCancel, chartOfAccounts }: { journal: Journal | null, onSubmit: (data: Journal) => void, onCancel: () => void, chartOfAccounts: ChartOfAccount[] }) {
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
  fromDate: z.date(),
  toDate: z.date(),
});

type VatTransaction = {
    date: string;
    description: string;
    grossAmount: number;
    vatAmount: number;
};

type VatReportData = {
    fromDate: string;
    toDate: string;
    totalSales: number;
    outputVat: number;
    totalPurchases: number;
    inputVat: number;
    vatPayable: number;
    transactions: {
        inputs: VatTransaction[];
        outputs: VatTransaction[];
    }
};

type ReportType = 'summary' | 'transactions';

function VatReportCard({ allocatedTransactions, activeClient }: { allocatedTransactions: AllocatedTransaction[], activeClient: User }) {
    const [reportData, setReportData] = useState<VatReportData | null>(null);
    const [reportType, setReportType] = useState<ReportType | null>(null);
    const reportRef = useRef(null);

    const getFinancialYear = (yearEnd: any) => {
        const toDate = yearEnd?.toDate ? yearEnd.toDate() : new Date(yearEnd);
        const endDate = toDate;
        const startDate = add(sub(endDate, { years: 1 }), { days: 1 });
        return { startDate, endDate };
    }

    const { startDate, endDate } = getFinancialYear(activeClient.yearEnd);

    const form = useForm<z.infer<typeof vatReportFormSchema>>({
        resolver: zodResolver(vatReportFormSchema),
        defaultValues: { 
            fromDate: startDate,
            toDate: endDate,
        }
    });

    const handleGenerateVat = (values: z.infer<typeof vatReportFormSchema>, type: ReportType) => {
        if (!activeClient.isVatRegistered || !activeClient.vatRegistrationDate) {
            toast({ title: "VAT Not Configured", description: "This client is not set up for VAT reporting.", variant: "destructive"});
            return;
        }

        const { fromDate, toDate } = values;
        const registrationDate = activeClient.vatRegistrationDate.toDate ? activeClient.vatRegistrationDate.toDate() : new Date(activeClient.vatRegistrationDate);

        const VAT_RATE = 0.15;
        let totalSales = 0;
        let totalPurchases = 0;
        let outputVat = 0;
        let inputVat = 0;
        let outputTransactions: VatTransaction[] = [];
        let inputTransactions: VatTransaction[] = [];

        const filteredTxs = allocatedTransactions.filter(tx => {
            const txDate = new Date(tx.date.split('/').reverse().join('-'));
            return txDate >= fromDate && txDate <= toDate && txDate >= registrationDate;
        });

        filteredTxs.forEach(tx => {
            const isStandardSale = tx.vatType === 'standard_rated_sales';
            const isStandardPurchase = tx.vatType === 'standard_rated_purchases' || tx.vatType === 'capital_goods_purchases';
            
            if (isStandardSale || isStandardPurchase) {
                const grossAmount = tx.amount;
                const exclusiveAmount = grossAmount / (1 + VAT_RATE);
                const vatAmount = grossAmount - exclusiveAmount;

                if (isStandardSale) {
                    totalSales += exclusiveAmount;
                    outputVat += vatAmount;
                    outputTransactions.push({ date: tx.date, description: tx.description, grossAmount: tx.amount, vatAmount });
                } else {
                    const absExclusive = Math.abs(tx.amount) / (1 + VAT_RATE);
                    const absVat = Math.abs(tx.amount) - absExclusive;
                    totalPurchases += absExclusive;
                    inputVat += absVat;
                    inputTransactions.push({ date: tx.date, description: tx.description, grossAmount: tx.amount, vatAmount: absVat });
                }
            } else if (tx.vatType === 'zero_rated_sales') {
                totalSales += tx.amount;
            } else if (tx.vatType === 'zero_rated_purchases') {
                totalPurchases += Math.abs(tx.amount);
            }
        });

        setReportData({
            fromDate: format(fromDate, 'dd MMMM yyyy'),
            toDate: format(toDate, 'dd MMMM yyyy'),
            totalSales,
            outputVat,
            totalPurchases,
            inputVat,
            vatPayable: outputVat - inputVat,
            transactions: { inputs: inputTransactions, outputs: outputTransactions }
        });
        setReportType(type);
    };

    const handleDownloadExcel = () => {
        if (!reportData) return;
        const wb = XLSX.utils.book_new();

        if (reportType === 'summary') {
            const summaryData = [
                { 'Box': '[4] Standard-rated sales (excl. VAT)', 'Amount': reportData.totalSales },
                { 'Box': '[5] Output VAT on sales', 'Amount': reportData.outputVat },
                {},
                { 'Box': '[14] Standard-rated purchases (excl. VAT)', 'Amount': reportData.totalPurchases },
                { 'Box': '[15] Input VAT on purchases', 'Amount': reportData.inputVat },
                {},
                { 'Box': '[12] VAT Payable / (Refundable)', 'Amount': reportData.vatPayable },
            ];
            const ws = XLSX.utils.json_to_sheet(summaryData);
            ws['!cols'] = [{wch: 40}, {wch: 20}];
            XLSX.utils.book_append_sheet(wb, ws, "VAT201 Summary");
        }
        
        if (reportType === 'transactions') {
            const outputData = reportData.transactions.outputs.map(tx => ({
                'Date': tx.date, 'Description': tx.description, 'Gross Amount': tx.grossAmount, 'VAT Amount': tx.vatAmount
            }));
             const inputData = reportData.transactions.inputs.map(tx => ({
                'Date': tx.date, 'Description': tx.description, 'Gross Amount': tx.grossAmount, 'VAT Amount': tx.vatAmount
            }));

            const wsOut = XLSX.utils.json_to_sheet(outputData);
            const wsIn = XLSX.utils.json_to_sheet(inputData);
            wsOut['!cols'] = [{wch: 15}, {wch: 40}, {wch: 15}, {wch: 15}];
            wsIn['!cols'] = [{wch: 15}, {wch: 40}, {wch: 15}, {wch: 15}];
            
            XLSX.utils.book_append_sheet(wb, wsOut, "Output VAT Transactions");
            XLSX.utils.book_append_sheet(wb, wsIn, "Input VAT Transactions");
        }

        XLSX.writeFile(wb, `VAT-Report-${activeClient.name}-${reportData.fromDate}-to-${reportData.toDate}.xlsx`);
    };

    return (
        <>
        <Dialog open={!!reportData} onOpenChange={(isOpen) => !isOpen && setReportData(null)}>
            <DialogContent className="sm:max-w-4xl">
                 <DialogHeader>
                   <DialogTitle>
                        {reportType === 'summary' ? 'VAT201 Summary Report' : 'VAT Transaction Report'}
                   </DialogTitle>
                   <DialogDescription>
                       VAT calculation for {activeClient.name} for the period {reportData?.fromDate} to {reportData?.toDate}.
                   </DialogDescription>
                </DialogHeader>
                {reportData && (
                    <div ref={reportRef} className="printable-area bg-white p-2">
                        {reportType === 'summary' && (
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
                                    <p>[Box 14] Standard-rated purchases (excl. VAT)</p>
                                    <p className="font-mono">{formatNumber(reportData.totalPurchases)}</p>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p>[Box 15] Input VAT on purchases</p>
                                    <p className="font-mono">{formatNumber(reportData.inputVat)}</p>
                                </div>
                                <Separator />
                                <div className="flex justify-between items-center font-bold text-lg">
                                    <p>[Box 12] VAT Payable / (Refundable)</p>
                                    <p className="font-mono">{formatNumber(reportData.vatPayable)}</p>
                                </div>
                            </div>
                        )}
                        {reportType === 'transactions' && (
                             <div className="max-h-[50vh] overflow-y-auto space-y-6">
                                <div>
                                    <h4 className="font-semibold mb-2">Output VAT Transactions ({reportData.transactions.outputs.length})</h4>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Gross Amount</TableHead><TableHead className="text-right">VAT Amount</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {reportData.transactions.outputs.map((tx, i) => (
                                                <TableRow key={`out-${i}`}><TableCell>{tx.date}</TableCell><TableCell>{tx.description}</TableCell><TableCell className="text-right font-mono">{formatNumber(tx.grossAmount)}</TableCell><TableCell className="text-right font-mono">{formatNumber(tx.vatAmount)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                         <TableFooter><TableRow><TableCell colSpan={3} className="text-right font-bold">Total Output VAT</TableCell><TableCell className="text-right font-bold font-mono">{formatNumber(reportData.outputVat)}</TableCell></TableRow></TableFooter>
                                    </Table>
                                </div>
                                <div>
                                    <h4 className="font-semibold mb-2">Input VAT Transactions ({reportData.transactions.inputs.length})</h4>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Gross Amount</TableHead><TableHead className="text-right">VAT Amount</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {reportData.transactions.inputs.map((tx, i) => (
                                                <TableRow key={`in-${i}`}><TableCell>{tx.date}</TableCell><TableCell>{tx.description}</TableCell><TableCell className="text-right font-mono">{formatNumber(tx.grossAmount)}</TableCell><TableCell className="text-right font-mono">{formatNumber(tx.vatAmount)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                        <TableFooter><TableRow><TableCell colSpan={3} className="text-right font-bold">Total Input VAT</TableCell><TableCell className="text-right font-bold font-mono">{formatNumber(reportData.inputVat)}</TableCell></TableRow></TableFooter>
                                    </Table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                <DialogFooter className="print:hidden">
                     <Button variant="outline" onClick={handleDownloadExcel}><Download className="mr-2 h-4 w-4"/>Download Excel</Button>
                    <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        <Card>
            <CardHeader>
                <CardTitle>VAT Report</CardTitle>
                <CardDescription>Generate a VAT calculation based on allocated transactions for a selected period.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {!activeClient.isVatRegistered ? (
                     <Alert variant="destructive">
                        <AlertTitle>VAT Not Enabled</AlertTitle>
                        <AlertDescription>This client is not marked as VAT registered. Please update their profile in the main Client Management screen to enable VAT reporting.</AlertDescription>
                    </Alert>
                ) : (
                <Form {...form}>
                    <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField control={form.control} name="fromDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>From Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd/MM/yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="toDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>To Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? (format(field.value, "dd/MM/yyyy")) : (<span>Pick a date</span>)}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )} />
                        </div>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button type="button">Generate Report <ChevronDown className="ml-2 h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={form.handleSubmit((values) => handleGenerateVat(values, 'summary'))}>
                                    Generate VAT201 Summary
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={form.handleSubmit((values) => handleGenerateVat(values, 'transactions'))}>
                                    Generate VAT Transactions Report
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </form>
                </Form>
                )}
            </CardContent>
        </Card>
        </>
    );
}

const supplierFormSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(2, 'Supplier name is required.'),
    contactPerson: z.string().optional(),
    email: z.string().email('A valid email is required.').optional().or(z.literal('')),
    phone: z.string().optional(),
});

function SupplierForm({ supplier, onSubmit, onCancel }: { supplier: Supplier | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof supplierFormSchema>>({
        resolver: zodResolver(supplierFormSchema),
        defaultValues: supplier || { name: '', contactPerson: '', email: '', phone: '' },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Supplier Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Supplier</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

const customerFormSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(2, 'Customer name is required.'),
    contactPerson: z.string().optional(),
    email: z.string().email('A valid email is required.').optional().or(z.literal('')),
    phone: z.string().optional(),
});

function CustomerForm({ customer, onSubmit, onCancel }: { customer: User | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof customerFormSchema>>({
        resolver: zodResolver(customerFormSchema),
        defaultValues: customer ? {
            id: customer.id,
            name: customer.name,
            contactPerson: customer.contactPerson,
            email: customer.email,
            phone: customer.contactNumber
        } : { name: '', contactPerson: '', email: '', phone: '' },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Customer Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="contactPerson" render={({ field }) => (<FormItem><FormLabel>Contact Person</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="phone" render={({ field }) => (<FormItem><FormLabel>Phone Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Customer</Button>
                </DialogFooter>
            </form>
        </Form>
    )
}

const transactionSchema = z.object({
  id: z.string(),
  date: z.string().min(1, "Date is required."),
  description: z.string().min(3, "Description is required."),
  amount: z.preprocess(v => parseFloat(v as string || '0'), z.number()),
});

function EditTransactionDialog({ transaction, isOpen, onClose, onSave }: { transaction: ImportedTransaction | null, isOpen: boolean, onClose: () => void, onSave: (data: ImportedTransaction) => void }) {
    
    const form = useForm<z.infer<typeof transactionSchema>>({
        resolver: zodResolver(transactionSchema),
        defaultValues: {
            id: transaction?.id,
            date: transaction?.date,
            description: transaction?.description,
            amount: transaction?.amount,
        }
    });

    useEffect(() => {
        if (transaction) {
            form.reset(transaction);
        }
    }, [transaction, form]);

    const handleSubmit = (values: z.infer<typeof transactionSchema>) => {
        onSave(values);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Transaction</DialogTitle>
                    <DialogDescription>Update the details of this transaction.</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel>Date</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <FormField control={form.control} name="amount" render={({ field }) => (<FormItem><FormLabel>Amount</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>)} />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

const editBankAccountFormSchema = z.object({
    id: z.string(),
    description: z.string().min(3, "Bank account name is required."),
});

function EditBankAccountForm({
    account,
    isOpen,
    onClose,
    onSave,
    onClearTransactions
}: {
    account: ChartOfAccount | null,
    isOpen: boolean,
    onClose: () => void,
    onSave: (id: string, newDescription: string) => void,
    onClearTransactions: (accountId: string) => void,
}) {
    const form = useForm<z.infer<typeof editBankAccountFormSchema>>({
        resolver: zodResolver(editBankAccountFormSchema),
        defaultValues: {
            id: account?.id || '',
            description: account?.description || '',
        }
    });

    useEffect(() => {
        if (account) {
            form.reset(account);
        }
    }, [account, form]);

    const handleSubmit = (values: z.infer<typeof editBankAccountFormSchema>) => {
        onSave(values.id, values.description);
        onClose();
    }

    if (!account) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Bank Account</DialogTitle>
                    <DialogDescription>
                        Update the name for account {account.accountNumber}.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Account Name</FormLabel>
                                    <FormControl><Input {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter className="justify-between">
                            <Button type="submit">Save Name</Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive">
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Clear Transactions
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete all
                                            transactions associated with this bank account.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onClearTransactions(account.accountNumber)}>
                                            Continue
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    )
}

const accountSections: ChartOfAccount['section'][] = ['Income Statement', 'Balance Sheet'];
const coaFormSchema = z.object({
  id: z.string().optional(),
  accountNumber: z.string().regex(/^\d{4}\/\d{3}$/, 'Account number must be in XXXX/XXX format.'),
  description: z.string().min(3, 'Description is required.'),
  section: z.enum(accountSections),
});

function AccountForm({ account, onSubmit, onCancel }: { account: ChartOfAccount | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof coaFormSchema>>({
        resolver: zodResolver(coaFormSchema),
        defaultValues: {
            id: account?.id || '',
            accountNumber: account?.accountNumber || '',
            description: account?.description || '',
            section: account?.section || 'Income Statement',
        },
    });

    useEffect(() => {
        form.reset(account || { accountNumber: '', description: '', section: 'Income Statement' });
    }, [account, form]);

    const handleSubmit = (values: z.infer<typeof coaFormSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="e.g. 1000/000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{accountSections.map(section => <SelectItem key={section} value={section}>{section}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Account</Button>
                </div>
            </form>
        </Form>
    )
}

const ruleFormSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['hard', 'soft']).default('hard'),
  description: z.string().min(5, 'Description is required.'),
  keywords: z.string().optional(),
  accountId: z.string().min(1, 'Please select an account.'),
  vatType: z.custom<VatType>(),
});

function RuleForm({ rule, onSubmit, onCancel, chartOfAccounts }: { rule: Omit<AllocationRule, 'keywords'> & { keywords: string } | null, onSubmit: (data: any) => void, onCancel: () => void, chartOfAccounts: ChartOfAccount[] }) {
    const form = useForm<z.infer<typeof ruleFormSchema>>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: {
            id: rule?.id || '',
            type: rule?.type || 'hard',
            description: rule?.description || '',
            keywords: rule?.keywords || '',
            accountId: rule?.accountId || '',
            vatType: rule?.vatType || 'no_vat',
        },
    });

    const ruleType = form.watch('type');

    const handleSubmit = (values: z.infer<typeof ruleFormSchema>) => {
        const keywords = values.type === 'hard' ? values.keywords?.split(',').map(k => k.trim()).filter(Boolean) : [];
        onSubmit({ ...values, keywords });
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rule Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a rule type" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="hard">
                                        <div className="flex items-center gap-2"><HardHat className="h-4 w-4"/> Hard Rule (Keywords)</div>
                                    </SelectItem>
                                    <SelectItem value="soft">
                                        <div className="flex items-center gap-2"><Feather className="h-4 w-4"/> Soft Rule (Conceptual)</div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder={ruleType === 'hard' ? "e.g. Catches all bank fees" : "e.g. All fast food purchases"} {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                {ruleType === 'hard' && (
                    <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Input placeholder="e.g., Telkom, Bank Fee, Fees" {...field} /></FormControl><FormMessage /></FormItem>)} />
                )}
                
                <FormField control={form.control} name="accountId" render={({ field }) => ( <FormItem><FormLabel>Allocate to Account</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl><SelectContent>{chartOfAccounts.map(account => <SelectItem key={account.id} value={account.accountNumber}>{account.accountNumber} - {account.description}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypesData.map(vat => <SelectItem key={vat.name} value={vat.name}>{vat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Rule</Button>
                </div>
            </form>
        </Form>
    )
}

type TabName = 'unallocated-income' | 'unallocated-expenses' | 'processing' | 'review' | 'allocated-income' | 'allocated-expenses';

export default function NumeraPage() {
  const [clients, setClients] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClientFormOpen, setIsClientFormOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<User | null>(null);
  const [activeClient, setActiveClient] = useState<User | null>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('reporting');
  const [activeProcessingTab, setActiveProcessingTab] = useState<TabName>('unallocated-income');
  const [glInitialValues, setGlInitialValues] = useState<Partial<z.infer<typeof generalLedgerFormSchema>>>();
  const [selectedBankAccount, setSelectedBankAccount] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [importPreview, setImportPreview] = useState<{ count: number; total: number; balance: number; } | null>(null);
  const [bankBalances, setBankBalances] = useState<{ [accountNumber: string]: number }>({});
  
  const [allUnallocated, setAllUnallocated] = useState<ImportedTransaction[]>([]);
  const [allAllocated, setAllAllocated] = useState<AllocatedTransaction[]>([]);

  const [allProcessing, setAllProcessing] = useState<ImportedTransaction[]>([]);
  const [allReviewing, setAllReviewing] = useState<ImportedTransaction[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnallocated, setSelectedUnallocated] = useState<string[]>([]);
  const [selectedAllocated, setSelectedAllocated] = useState<string[]>([]);
  const [selectedForReview, setSelectedForReview] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<{ [key: string]: { value: string, type: 'account'|'customer'|'supplier' } }>({});
  const [vatTypes, setVatTypes] = useState<{ [key: string]: VatType }>({});
  const [isAiAllocating, setIsAiAllocating] = useState(false);
  const [processingTxId, setProcessingTxId] = useState<string | null>(null);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [isJournalFormOpen, setIsJournalFormOpen] = useState(false);
  const [selectedJournal, setSelectedJournal] = useState<Journal | null>(null);
  const [feedbackTransaction, setFeedbackTransaction] = useState<ImportedTransaction | AllocatedTransaction | null>(null);
  const [isBulkAllocateOpen, setIsBulkAllocateOpen] = useState(false);
  const [customers, setCustomers] = useState<User[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isSupplierFormOpen, setIsSupplierFormOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<User | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<ImportedTransaction | null>(null);
  const [isEditTxOpen, setIsEditTxOpen] = useState(false);
  
  const [chartOfAccountsData, setChartOfAccountsData] = useState<ChartOfAccount[]>(initialChartOfAccounts);
  const [editingBankAccount, setEditingBankAccount] = useState<ChartOfAccount | null>(null);

  const [isCoaFormOpen, setIsCoaFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);

  const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AllocationRule | null>(null);
  const [allocationRules, setAllocationRules] = useState<AllocationRule[]>([]);


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
  
  const fetchClientSubCollections = async (clientId: string) => {
    try {
        const customersQuery = query(collection(db, "clients", clientId, "customers"));
        const suppliersQuery = query(collection(db, "clients", clientId, "suppliers"));

        const [customersSnapshot, suppliersSnapshot] = await Promise.all([
            getDocs(customersQuery),
            getDocs(suppliersQuery),
        ]);
        
        const fetchedCustomers = customersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        const fetchedSuppliers = suppliersSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Supplier));

        setCustomers(fetchedCustomers);
        setSuppliers(fetchedSuppliers);
    } catch (error) {
        console.error("Error fetching sub-collections:", error);
        toast({ title: 'Error', description: 'Could not fetch customers and suppliers for this client.', variant: 'destructive'});
    }
  };


  useEffect(() => {
    fetchClients();
  }, []);

  const fetchTransactions = async (clientId: string) => {
    try {
        const unallocatedQ = query(collection(db, 'unallocatedTransactions'), where('clientId', '==', clientId));
        const allocatedQ = query(collection(db, 'allocatedTransactions'), where('clientId', '==', clientId));

        const [unallocatedSnapshot, allocatedSnapshot] = await Promise.all([
            getDocs(unallocatedQ),
            getDocs(allocatedQ),
        ]);

        const unallocated = unallocatedSnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as ImportedTransaction));
        const allocated = allocatedSnapshot.docs.map(doc => ({...doc.data(), id: doc.id} as AllocatedTransaction));

        setAllUnallocated(unallocated);
        setAllAllocated(allocated);
        
        const allTx = [...unallocated, ...allocated];
        const balances = allTx.reduce((acc, tx) => {
            acc[tx.bankAccountId] = (acc[tx.bankAccountId] || 0) + tx.amount;
            return acc;
        }, {} as { [key: string]: number });
        setBankBalances(balances);

    } catch (error) {
        console.error("Error fetching transactions:", error);
        toast({ title: 'Error', description: 'Could not fetch transactions for this client.', variant: 'destructive'});
    }
  }
  
  useEffect(() => {
    setAllUnallocated([]);
    setAllAllocated([]);
    setAllProcessing([]);
    setAllReviewing([]);
    setBankBalances({});
    setSelectedBankAccount('');
    setCustomers([]);
    setSuppliers([]);
    setAllocationRules([]);

    if (activeClient) {
        fetchTransactions(activeClient.id);
        fetchClientSubCollections(activeClient.id);
        const clientCOA = activeClient.chartOfAccounts || initialChartOfAccounts;
        setChartOfAccountsData(clientCOA);
        const clientRules = activeClient.allocationRules || initialAllocationRules;
        setAllocationRules(clientRules);
    }
  }, [activeClient]);

  useEffect(() => {
    // When selectedBankAccount changes, we don't clear local state.
    // The filtering logic in useMemo hooks will handle displaying the correct data.
  }, [selectedBankAccount]);
  

  const handleAddClient = () => {
    setSelectedClient(null);
    setIsClientFormOpen(true);
  };

  const handleEditClient = (client: User) => {
    setSelectedClient(client);
    setIsClientFormOpen(true);
  };
  
  const handleDeleteClient = async (clientId: string) => {
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
    } finally {
        setIsLoading(false);
    }
  };

  const handleClientFormSubmit = async (data: z.infer<typeof clientFormSchema>) => {
    if (!currentUser) return;

    const isNewClient = !selectedClient?.id;

    const clientData: Partial<User> = {
      name: data.name,
      contactPerson: data.contactPerson,
      email: data.email,
      yearEnd: data.yearEnd ? Timestamp.fromDate(data.yearEnd) : null,
      isVatRegistered: data.isVatRegistered,
      vatCategory: data.isVatRegistered ? 'B' : undefined,
      vatRegistrationDate: data.vatRegistrationDate ? Timestamp.fromDate(data.vatRegistrationDate) : null,
      role: 'client' as const,
      source: 'Numera' as const,
    };
    
     if (isNewClient) {
      clientData.chartOfAccounts = chartOfAccountsData;
      clientData.allocationRules = initialAllocationRules;
    }


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
      setIsClientFormOpen(false);
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

  const handleImport = async () => {
    if (!selectedBankAccount || !importPreview || !selectedFile || !activeClient) {
        toast({ title: 'Import Error', description: 'No account or file selected for import.', variant: 'destructive' });
        return;
    }

    setIsParsing(true);

    const parsedTxns = await new Promise<(any)[]>((resolve, reject) => {
        Papa.parse(selectedFile, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => resolve(results.data as any[]),
            error: (error) => reject(error),
        });
    });

    const batch = writeBatch(db);
    let autoAllocatedCount = 0;

    for (const row of parsedTxns) {
        const description = row.Description || '';
        const lowerCaseDescription = description.toLowerCase();
        let matchedRule = null;
        
        for (const rule of allocationRules) {
            if (rule.type === 'hard') {
                for (const keyword of rule.keywords) {
                    if (lowerCaseDescription.includes(keyword.toLowerCase())) {
                        matchedRule = rule;
                        break;
                    }
                }
            }
            if (matchedRule) break;
        }

        const transactionData = {
            clientId: activeClient.id,
            date: row.Date,
            description: description,
            amount: parseFloat(row.Amount) || 0,
            bankAccountId: selectedBankAccount,
        };

        if (matchedRule) {
            // Automatically allocate
            const allocatedTx = {
                ...transactionData,
                allocatedTo: { value: matchedRule.accountId, type: 'account' as const },
                vatType: matchedRule.vatType,
                vatAmount: 0, // Placeholder
                allocatedAt: Timestamp.now(),
            };
            const allocatedDocRef = doc(collection(db, 'allocatedTransactions'));
            batch.set(allocatedDocRef, allocatedTx);
            autoAllocatedCount++;
        } else {
            // Add to unallocated
            const unallocatedDocRef = doc(collection(db, 'unallocatedTransactions'));
            batch.set(unallocatedDocRef, transactionData);
        }
    }
    
    await batch.commit();
    await fetchTransactions(activeClient.id);

    toast({ title: 'Import Successful', description: `${parsedTxns.length} transactions imported. ${autoAllocatedCount} were automatically allocated.` });

    setImportPreview(null);
    setSelectedFile(null);
    setIsParsing(false);
    const fileInput = document.getElementById('transaction-file-input') as HTMLInputElement;
    if(fileInput) fileInput.value = '';
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
  
   const handleAllocate = async (transactionId: string) => {
      const allocation = allocations[transactionId];
      if (!allocation || !activeClient) {
          toast({ title: 'Allocation Error', description: 'Please select an account to allocate to.', variant: 'destructive' });
          return;
      }
      
      let transactionToAllocate: ImportedTransaction | undefined;
      
      if (allUnallocated.some(tx => tx.id === transactionId)) {
        transactionToAllocate = allUnallocated.find(tx => tx.id === transactionId);
      } else {
        transactionToAllocate = allReviewing.find(tx => tx.id === transactionId);
      }
      
      if (!transactionToAllocate) return;
      
      const { id, ...restOfTx } = transactionToAllocate;

      const newAllocatedTransaction: Omit<AllocatedTransaction, 'id'> = {
          ...restOfTx,
          allocatedTo: allocation,
          allocatedAt: Timestamp.now(),
          vatType: vatTypes[transactionId] || 'no_vat',
          vatAmount: 0, // Placeholder
      };
      
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'allocatedTransactions')), newAllocatedTransaction);
      
      // Determine which collection to delete from
      if (allUnallocated.some(tx => tx.id === id)) {
          batch.delete(doc(db, 'unallocatedTransactions', transactionId));
      }
      
      await batch.commit();

      await fetchTransactions(activeClient.id);
      setAllReviewing(prev => prev.filter(tx => tx.id !== transactionId));
      setSelectedForReview(prev => prev.filter(id => id !== transactionId));


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

  const handleBulkAllocate = async (bulkAllocation: { value: string, type: 'account'|'customer'|'supplier' }, bulkVatType: VatType) => {
    if (!activeClient) return;

    const transactionsToAllocate = unallocatedTransactions.filter(tx => selectedUnallocated.includes(tx.id));
    
    const batch = writeBatch(db);
    
    transactionsToAllocate.forEach(tx => {
        const { id, ...restOfTx } = tx;
        const newAllocated: Omit<AllocatedTransaction, 'id'> = {
            ...restOfTx,
            allocatedTo: bulkAllocation,
            allocatedAt: Timestamp.now(),
            vatType: bulkVatType,
            vatAmount: 0,
        };
        batch.set(doc(collection(db, 'allocatedTransactions')), newAllocated);
        batch.delete(doc(db, 'unallocatedTransactions', id));
    });
    
    await batch.commit();
    await fetchTransactions(activeClient.id);

    toast({ title: 'Bulk Allocation Successful', description: `${transactionsToAllocate.length} transactions have been allocated.` });
    setIsBulkAllocateOpen(false);
    setSelectedUnallocated([]);
  };
  
   const handleClearAllocations = () => {
    setAllocations({});
    setVatTypes({});
    setSelectedUnallocated([]);
    toast({
      title: 'Allocations Cleared',
      description: 'All suggested allocations and selections have been reset.',
    });
  };

  const handleSelectionChange = (id: string, isSelected: boolean, type: 'unallocated' | 'allocated' | 'review') => {
    if (type === 'unallocated') {
        setSelectedUnallocated(prev => {
            const newSelection = new Set(prev);
            if (isSelected) newSelection.add(id);
            else newSelection.delete(id);
            return Array.from(newSelection);
        });
    } else if (type === 'allocated') {
        setSelectedAllocated(prev => {
            const newSelection = new Set(prev);
            if (isSelected) newSelection.add(id);
            else newSelection.delete(id);
            return Array.from(newSelection);
        });
    } else if (type === 'review') {
        setSelectedForReview(prev => {
            const newSelection = new Set(prev);
            if (isSelected) newSelection.add(id);
            else newSelection.delete(id);
            return Array.from(newSelection);
        });
    }
  };

 const handleSaveAllocation = async (transactionId: string, newAllocation: {value: string, type: 'account'|'customer'|'supplier'}, newVatType: VatType) => {
    if(!activeClient) return;
    try {
        const docRef = doc(db, "allocatedTransactions", transactionId);
        await setDoc(docRef, { 
            allocatedTo: newAllocation,
            vatType: newVatType
        }, { merge: true });

        await fetchTransactions(activeClient.id);
        toast({ title: 'Allocation Updated', description: 'The transaction allocation has been successfully saved.' });
    } catch (error) {
        console.error("Error saving allocation:", error);
        toast({ title: 'Error', description: 'Could not save the allocation.', variant: 'destructive'});
    }
  };

  const handleAiAllocate = async () => {
    if (isAiAllocating || !activeClient) return;
    
    const transactionsToProcess = unallocatedTransactions.filter(tx => selectedUnallocated.includes(tx.id));
    if (transactionsToProcess.length === 0) {
        toast({ title: 'No Transactions Selected', description: 'Please select one or more transactions to allocate with AI.', variant: 'destructive' });
        return;
    }

    setIsAiAllocating(true);
    // Move from unallocated to processing state
    setAllUnallocated(prev => prev.filter(tx => !selectedUnallocated.includes(tx.id)));
    setAllProcessing(prev => [...prev, ...transactionsToProcess]);
    setSelectedUnallocated([]);

    toast({
        title: 'AI Allocation Started',
        description: `The AI is generating suggestions for ${transactionsToProcess.length} transactions.`,
    });

    try {
        const suggestions = await getAISuggestions({ transactions: transactionsToProcess });
        
        // Move from processing to review state
        setAllProcessing(prev => prev.filter(tx => !transactionsToProcess.map(p => p.id).includes(tx.id)));
        setAllReviewing(prev => [...prev, ...transactionsToProcess]);
        
        const newAllocations: typeof allocations = {};
        const newVatTypes: typeof vatTypes = {};

        suggestions.forEach(suggestion => {
            if (suggestion.accountNumber) {
                newAllocations[suggestion.transactionId] = { value: suggestion.accountNumber, type: 'account' };
            }
            if (suggestion.vatType) {
                newVatTypes[suggestion.transactionId] = suggestion.vatType;
            }
        });

        setAllocations(prev => ({...prev, ...newAllocations}));
        setVatTypes(prev => ({...prev, ...newVatTypes}));
        
        toast({ title: 'AI Suggestions Ready', description: 'Transactions have been moved to the Review tab with AI suggestions.' });

    } catch (error) {
        console.error('Error triggering AI allocation batch:', error);
        toast({ title: 'Error', description: 'Could not get AI suggestions.', variant: 'destructive' });
        // Since processing is final, don't move them back. The user must resolve them from the processing tab.
    } finally {
        setIsAiAllocating(false);
    }
};

 const handleRuleCreationAndAutoAllocate = async (feedbackData: {
    transaction: ImportedTransaction | AllocatedTransaction;
    description: string;
    correctAccount: string;
    correctVatType: VatType;
    ruleScope: 'client' | 'global';
  }) => {
    if (!activeClient) return;

    const { transaction, description, correctAccount, correctVatType, ruleScope } = feedbackData;

    toast({ title: "Learning from feedback...", description: "Updating AI knowledge and re-allocating." });

    try {
      const newRule: Omit<AllocationRule, 'id' | 'keywords'> = {
          type: 'soft',
          description: description,
          accountId: correctAccount,
          vatType: correctVatType,
      };
      
      const newRuleWithKeywords: Omit<AllocationRule, 'id'> = {
        ...newRule,
        keywords: []
      };

      if (ruleScope === 'client') {
          const updatedRules = [...allocationRules, {...newRuleWithKeywords, id: `rule-${Date.now()}`}];
          const clientRef = doc(db, "clients", activeClient.id);
          await setDoc(clientRef, { allocationRules: updatedRules }, { merge: true });
          setAllocationRules(updatedRules);
          toast({ title: "Client-specific AI Rule Created", description: "The new rule has been saved for this client." });
      } else { // Global
          // In a real app, this would be an API call to a secure backend to update a shared ruleset.
          // For this demo, we'll just log it.
          console.log("Saving new GLOBAL rule to master database:", newRuleWithKeywords);
          toast({ title: "Global AI Rule Submitted", description: "The new rule has been submitted for global use." });
      }

      setFeedbackTransaction(null);

      const lowerCaseDescKeywords = description.toLowerCase().split(' ').filter(w => w.length > 3);
      
      const transactionsToAllocate = allUnallocated.filter(tx => {
         const lowerCaseTxDesc = tx.description.toLowerCase();
         return lowerCaseDescKeywords.some(keyword => lowerCaseTxDesc.includes(keyword));
      });
      
      if (transactionsToAllocate.length > 0) {
          const batch = writeBatch(db);
          transactionsToAllocate.forEach(txToAllocate => {
              const { id, ...restOfTx } = txToAllocate;
              const newAllocatedTransaction: Omit<AllocatedTransaction, 'id'> = {
                  ...restOfTx,
                  allocatedTo: { value: correctAccount, type: 'account' },
                  allocatedAt: Timestamp.now(),
                  vatType: correctVatType,
                  vatAmount: 0,
              };
              batch.set(doc(collection(db, 'allocatedTransactions')), newAllocatedTransaction);
              batch.delete(doc(db, 'unallocatedTransactions', id));
          });

          await batch.commit();
          await fetchTransactions(activeClient.id);
          toast({ title: 'Auto-Allocation Complete', description: `${transactionsToAllocate.length} transactions were allocated based on the new rule.` });
      }

    } catch (error) {
        console.error("Feedback and re-allocation error:", error);
        toast({ title: 'Error', description: 'Could not process feedback.', variant: 'destructive' });
    }
  };

  const handleAcceptReviewed = async () => {
    if (!activeClient) return;

    const transactionsToAllocate = allReviewing.filter(tx => selectedForReview.includes(tx.id));
    if (transactionsToAllocate.length === 0) return;

    const batch = writeBatch(db);
    
    transactionsToAllocate.forEach(tx => {
        const { id, ...restOfTx } = tx;
        const allocation = allocations[id];
        const vatType = vatTypes[id] || 'no_vat';
        
        if (allocation) {
            const newAllocated: Omit<AllocatedTransaction, 'id'> = {
                ...restOfTx,
                allocatedTo: allocation,
                allocatedAt: Timestamp.now(),
                vatType: vatType,
                vatAmount: 0,
            };
            batch.set(doc(collection(db, 'allocatedTransactions')), newAllocated);
            // This is the key fix: delete the original document from the unallocated collection.
            batch.delete(doc(db, 'unallocatedTransactions', id));
        }
    });
    
    try {
        await batch.commit();

        const allocatedIds = transactionsToAllocate.map(tx => tx.id);
        setAllReviewing(prev => prev.filter(tx => !allocatedIds.includes(tx.id)));
        setSelectedForReview([]);
        
        await fetchTransactions(activeClient.id);

        toast({ title: 'Transactions Finalized', description: `${transactionsToAllocate.length} reviewed transactions have been allocated.` });
    } catch (error) {
        console.error("Error finalizing reviewed transactions:", error);
        toast({ title: "Error", description: "Could not finalize transactions.", variant: "destructive" });
    }
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
        id: '', 
        date: new Date(), 
    };
    setSelectedJournal(newJournalData as unknown as Journal); 
    setIsJournalFormOpen(true);
  };

  const handleDeleteJournal = (journalId: string) => {
    setJournals(prev => prev.filter(j => j.id !== journalId));
    toast({ title: "Journal Deleted", variant: "destructive" });
  };

  const handleAddSupplier = () => {
    setSelectedSupplier(null);
    setIsSupplierFormOpen(true);
  };
  
  const handleEditSupplier = (supplier: Supplier) => {
      setSelectedSupplier(supplier);
      setIsSupplierFormOpen(true);
  };
  
  const handleDeleteSupplier = (supplierId: string) => {
      setSuppliers(prev => prev.filter(s => s.id !== supplierId));
      toast({ title: 'Supplier Deleted', variant: 'destructive'});
  };
  
  const handleSupplierFormSubmit = (data: Omit<Supplier, 'id'>) => {
      if (selectedSupplier) {
          setSuppliers(prev => prev.map(s => s.id === selectedSupplier.id ? { ...s, ...data } : s));
          toast({ title: 'Supplier Updated', description: 'The supplier details have been saved.' });
      } else {
          const newSupplier: Supplier = { ...data, id: `supp-${Date.now()}`, };
          setSuppliers(prev => [...prev, newSupplier]);
          toast({ title: 'Supplier Created', description: 'The new supplier has been added.' });
      }
      setIsSupplierFormOpen(false);
      setSelectedSupplier(null);
  };

    const handleAddCustomer = () => {
    setSelectedCustomer(null);
    setIsCustomerFormOpen(true);
  };

  const handleEditCustomer = (customer: User) => {
      setSelectedCustomer(customer);
      setIsCustomerFormOpen(true);
  };
  
  const handleDeleteCustomer = (customerId: string) => {
      setCustomers(prev => prev.filter(s => s.id !== customerId));
      toast({ title: 'Customer Deleted', variant: 'destructive'});
  };
  
  const handleCustomerFormSubmit = (data: Omit<User, 'id' | 'role'>) => {
      if (selectedCustomer) {
          setCustomers(prev => prev.map(s => s.id === selectedCustomer.id ? { ...s, ...data, role: 'client' } : s));
          toast({ title: 'Customer Updated', description: 'The customer details have been saved.' });
      } else {
          const newCustomer: User = { ...data, id: `cust-${Date.now()}`, role: 'client' };
          setCustomers(prev => [...prev, newCustomer]);
          toast({ title: 'Customer Created', description: 'The new customer has been added.' });
      }
      setIsCustomerFormOpen(false);
      setSelectedCustomer(null);
  };
  
  const handleEditTransaction = (transaction: ImportedTransaction) => {
    setEditingTransaction(transaction);
    setIsEditTxOpen(true);
  };

  const handleDeleteTransaction = async (transactionId: string, type: 'unallocated' | 'allocated' | 'processing' | 'review') => {
    if (!activeClient) return;

    if (type === 'allocated') {
        const collectionName = 'allocatedTransactions';
        try {
            await deleteDoc(doc(db, collectionName, transactionId));
            await fetchTransactions(activeClient.id);
            toast({ title: 'Transaction Deleted', variant: 'destructive' });
        } catch (error) {
            console.error(`Error deleting ${type} transaction:`, error);
            toast({ title: 'Error', description: 'Could not delete the transaction.', variant: 'destructive' });
        }
    } else {
        setAllUnallocated(prev => prev.filter(tx => tx.id !== transactionId));
        setAllProcessing(prev => prev.filter(tx => tx.id !== transactionId));
        setAllReviewing(prev => prev.filter(tx => tx.id !== transactionId));
        toast({ title: 'Transaction Removed', description: 'The transaction has been removed from the current view.' });
    }
};

  const handleSaveTransaction = async (data: ImportedTransaction) => {
    if (!activeClient) return;
    try {
        const docRef = doc(db, 'unallocatedTransactions', data.id);
        await setDoc(docRef, data, { merge: true });
        await fetchTransactions(activeClient.id);
        toast({ title: 'Transaction Updated', description: 'The transaction details have been saved.' });
    } catch (error) {
        console.error('Error saving transaction:', error);
        toast({ title: 'Error', description: 'Could not save the transaction.', variant: 'destructive' });
    }
  };
  
  const handleBulkDeleteAllocated = async () => {
    if (!activeClient || selectedAllocated.length === 0) return;
    const batch = writeBatch(db);
    selectedAllocated.forEach(id => {
        batch.delete(doc(db, 'allocatedTransactions', id));
    });
    try {
        await fetchTransactions(activeClient.id);
        toast({ title: `${selectedAllocated.length} Transactions Deleted`, description: 'The selected allocated transactions have been removed.' });
        setSelectedAllocated([]);
    } catch (error) {
        console.error('Error bulk deleting allocated transactions:', error);
        toast({ title: 'Error', description: 'Could not delete the selected transactions.', variant: 'destructive' });
    }
  };
  
  const handleSaveBankAccount = async (accountId: string, newDescription: string) => {
    if (!activeClient) return;
    const clientRef = doc(db, 'clients', activeClient.id);
    const updatedChartOfAccounts = chartOfAccountsData.map(acc => 
      acc.id === accountId ? { ...acc, description: newDescription } : acc
    );
    try {
      await setDoc(clientRef, { chartOfAccounts: updatedChartOfAccounts }, { merge: true });
      setChartOfAccountsData(updatedChartOfAccounts);
      toast({ title: 'Bank Account Updated', description: 'The account name has been saved.' });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not update bank account.', variant: 'destructive' });
    }
  };

  const handleClearTransactions = async (accountId: string) => {
    if (!activeClient) return;
    toast({ title: 'Clearing Transactions...', description: 'Please wait.' });

    const unallocatedQuery = query(collection(db, 'unallocatedTransactions'), where('clientId', '==', activeClient.id), where('bankAccountId', '==', accountId));
    const allocatedQuery = query(collection(db, 'allocatedTransactions'), where('clientId', '==', activeClient.id), where('bankAccountId', '==', accountId));

    try {
      const [unallocatedSnapshot, allocatedSnapshot] = await Promise.all([
        getDocs(unallocatedQuery),
        getDocs(allocatedQuery)
      ]);

      const batch = writeBatch(db);
      unallocatedSnapshot.forEach(doc => batch.delete(doc.ref));
      allocatedSnapshot.forEach(doc => batch.delete(doc.ref));
      await batch.commit();
      
      await fetchTransactions(activeClient.id);
      
      toast({ title: 'Transactions Cleared', description: `All transactions for account ${accountId} have been cleared.` });
      setEditingBankAccount(null);
    } catch (error) {
      console.error('Error clearing transactions:', error);
      toast({ title: 'Error', description: 'Could not clear transactions.', variant: 'destructive' });
    }
  };

   const handleCoaFormSubmit = async (data: Omit<ChartOfAccount, 'id'> & { id?: string }) => {
    if (!activeClient) return;
    
    let updatedCoa;
    if (selectedAccount) {
      // Update
      updatedCoa = chartOfAccountsData.map(a => 
        (a.id === selectedAccount.id) ? { ...a, ...data, id: data.accountNumber } : a
      );
      toast({ title: 'Account Updated', description: 'The account details have been saved.' });
    } else {
      // Add
      const newAccount = { ...data, id: data.accountNumber };
      updatedCoa = [...chartOfAccountsData, newAccount].sort((a,b) => a.accountNumber.localeCompare(b.accountNumber));
      toast({ title: 'Account Created', description: 'The new account has been added.' });
    }
    
    try {
      const clientRef = doc(db, 'clients', activeClient.id);
      await setDoc(clientRef, { chartOfAccounts: updatedCoa }, { merge: true });
      setChartOfAccountsData(updatedCoa);
      setIsCoaFormOpen(false);
      setSelectedAccount(null);
    } catch (e) {
      toast({ title: 'Error', description: 'Could not save Chart of Accounts.', variant: 'destructive' });
    }
  };

  const handleCoaDelete = async (accountId: string) => {
    if (!activeClient) return;
    const updatedCoa = chartOfAccountsData.filter(a => a.id !== accountId);

    try {
      const clientRef = doc(db, 'clients', activeClient.id);
      await setDoc(clientRef, { chartOfAccounts: updatedCoa }, { merge: true });
      setChartOfAccountsData(updatedCoa);
      toast({ title: 'Account Deleted', description: 'The account has been removed.', variant: 'destructive' });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not delete account.', variant: 'destructive' });
    }
  };

  const handleAddCoa = () => {
    setSelectedAccount(null);
    setIsCoaFormOpen(true);
  };

  const handleEditCoa = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setIsCoaFormOpen(true);
  };

  const handleRuleFormSubmit = async (data: Omit<AllocationRule, 'id'> & { id?: string }) => {
    if (!activeClient) return;
    
    let updatedRules;
    if (selectedRule) { // Update
      updatedRules = allocationRules.map(r => r.id === selectedRule.id ? { ...r, ...data } : r);
      toast({ title: 'Rule Updated' });
    } else { // Create
      const newRule: AllocationRule = { ...data, id: `rule-${Date.now()}` };
      updatedRules = [...allocationRules, newRule];
      toast({ title: 'Rule Created' });
    }

    try {
        const clientRef = doc(db, 'clients', activeClient.id);
        await setDoc(clientRef, { allocationRules: updatedRules }, { merge: true });
        setAllocationRules(updatedRules);
        setIsRuleFormOpen(false);
        setSelectedRule(null);
    } catch(e) {
        toast({ title: 'Error', description: 'Could not save rule.', variant: 'destructive'});
    }
  };
  
  const handleRuleDelete = async (ruleId: string) => {
      if (!activeClient) return;
      const updatedRules = allocationRules.filter(r => r.id !== ruleId);
      try {
          const clientRef = doc(db, 'clients', activeClient.id);
          await setDoc(clientRef, { allocationRules: updatedRules }, { merge: true });
          setAllocationRules(updatedRules);
          toast({ title: 'Rule Deleted', variant: 'destructive' });
      } catch (e) {
          toast({ title: 'Error', description: 'Could not delete rule.', variant: 'destructive' });
      }
  };
  
  const exportToExcel = (data: any[], fileName: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  };


  const clientBankAccounts = useMemo(() => {
    return activeClient ? chartOfAccountsData.filter(acc => acc.accountNumber.startsWith('8400')) : [];
  }, [activeClient, chartOfAccountsData]);


  const unallocatedTransactions = useMemo(() => {
    return allUnallocated.filter(tx => tx.bankAccountId === selectedBankAccount);
  }, [allUnallocated, selectedBankAccount]);
  
  const allocatedTransactions = useMemo(() => {
      return allAllocated.filter(tx => tx.bankAccountId === selectedBankAccount);
  }, [allAllocated, selectedBankAccount]);
  
  const processingTransactions = useMemo(() => {
    return allProcessing.filter(tx => tx.bankAccountId === selectedBankAccount);
  }, [allProcessing, selectedBankAccount]);

  const reviewTransactions = useMemo(() => {
    return allReviewing.filter(tx => tx.bankAccountId === selectedBankAccount);
  }, [allReviewing, selectedBankAccount]);
  
    const getLastImportDate = (accountId: string) => {
        const accountTransactions = [...allUnallocated, ...allAllocated].filter(
            (tx) => tx.bankAccountId === accountId
        );
        if (accountTransactions.length === 0) return 'N/A';

        const latestDate = accountTransactions.reduce((latest, tx) => {
            const txDate = parse(tx.date, 'dd/MM/yyyy', new Date());
            return txDate > latest ? txDate : latest;
        }, new Date(0));

        return format(latestDate, 'dd/MM/yyyy');
    };

    const filteredTransactions = (transactions: (ImportedTransaction | AllocatedTransaction)[]) => {
        if (!searchQuery) return transactions;
        const lowercasedQuery = searchQuery.toLowerCase();

        return transactions.filter(tx => {
            if (tx.description.toLowerCase().includes(lowercasedQuery) || tx.amount.toString().includes(lowercasedQuery)) {
                return true;
            }

            const allocation = allocations[tx.id] || (tx as AllocatedTransaction).allocatedTo;
            if (allocation?.type === 'account') {
                const account = chartOfAccountsData.find(a => a.accountNumber === allocation.value);
                if (account?.description.toLowerCase().includes(lowercasedQuery)) {
                    return true;
                }
            }
            
            const vatType = vatTypes[tx.id] || (tx as AllocatedTransaction).vatType;
            if(vatType) {
                const vatLabel = allVatTypesData.find(v => v.name === vatType)?.label;
                if(vatLabel?.toLowerCase().includes(lowercasedQuery)){
                    return true;
                }
            }

            return false;
        });
    };
  
  const incomeTransactions = useMemo(() => filteredTransactions(unallocatedTransactions.filter(tx => tx.amount >= 0)), [unallocatedTransactions, searchQuery, activeProcessingTab, allocations, vatTypes]);
  const expenseTransactions = useMemo(() => filteredTransactions(unallocatedTransactions.filter(tx => tx.amount < 0)), [unallocatedTransactions, searchQuery, activeProcessingTab, allocations, vatTypes]);
  const allocatedIncome = useMemo(() => filteredTransactions(allocatedTransactions.filter(tx => tx.amount >= 0)), [allocatedTransactions, searchQuery, activeProcessingTab, allocations, vatTypes]);
  const allocatedExpenses = useMemo(() => filteredTransactions(allocatedTransactions.filter(tx => tx.amount < 0)), [allocatedTransactions, searchQuery, activeProcessingTab, allocations, vatTypes]);
  const filteredReviewTransactions = useMemo(() => filteredTransactions(reviewTransactions), [reviewTransactions, searchQuery, activeProcessingTab, allocations, vatTypes]);


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
                height: 100%;
              }
              .no-print {
                display: none;
              }
            }
        `}</style>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Numera Accounting</h1>
        {!activeClient && (
            <Dialog open={isClientFormOpen} onOpenChange={setIsClientFormOpen}>
            <DialogTrigger asChild>
                    <Button onClick={handleAddClient}>
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
                        onSubmit={handleClientFormSubmit}
                        onCancel={() => setIsClientFormOpen(false)}
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
                        <TabsTrigger value="chart-of-accounts">Chart of Accounts</TabsTrigger>
                        <TabsTrigger value="allocation-rules">Allocation Rules</TabsTrigger>
                    </TabsList>
                    <TabsContent value="reporting" className="space-y-4">
                        <TrialBalanceCard activeClient={activeClient} onAccountClick={handleTBAccountClick} allocatedTransactions={allAllocated} unallocatedTransactions={allUnallocated} chartOfAccounts={chartOfAccountsData} />
                        <GeneralLedgerCard activeClient={activeClient} initialValues={glInitialValues} allocatedTransactions={allAllocated} chartOfAccounts={chartOfAccountsData} />
                    </TabsContent>
                    <TabsContent value="banking" className="space-y-4">
                        <Card>
                             <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Bank Account List</CardTitle>
                                    <CardDescription>Manage this client's bank accounts.</CardDescription>
                                </div>
                                <AddBankAccountForm
                                    activeClient={activeClient}
                                    chartOfAccounts={chartOfAccountsData}
                                    onAccountAdded={async (newAccount) => {
                                        if (!chartOfAccountsData.some(a => a.accountNumber === newAccount.accountNumber)) {
                                            const newChartOfAccounts = [...chartOfAccountsData, newAccount].sort((a,b) => a.accountNumber.localeCompare(b.accountNumber));
                                            const clientRef = doc(db, "clients", activeClient.id);
                                            try {
                                                await setDoc(clientRef, { chartOfAccounts: newChartOfAccounts }, { merge: true });
                                                setChartOfAccountsData(newChartOfAccounts);
                                                setBankBalances(prev => ({...prev, [newAccount.accountNumber]: 0}));
                                                setSelectedBankAccount(newAccount.accountNumber);
                                            } catch (e) {
                                                toast({ title: "Error", description: "Could not save new bank account.", variant: "destructive"});
                                            }
                                        }
                                    }}
                                />
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
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {clientBankAccounts.map(acc => (
                                                <TableRow key={acc.id} onClick={() => setSelectedBankAccount(acc.accountNumber)} className="cursor-pointer" data-state={selectedBankAccount === acc.accountNumber ? 'selected' : ''}>
                                                    <TableCell className="font-mono">{acc.accountNumber}</TableCell>
                                                    <TableCell>{acc.description}</TableCell>
                                                    <TableCell>{getLastImportDate(acc.accountNumber)}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatNumber(bankBalances[acc.accountNumber] || 0)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingBankAccount(acc); }}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                ) : (
                                    <p className="text-muted-foreground text-center py-10">No bank accounts found for this client.</p>
                                )}
                            </CardContent>
                        </Card>
                        { selectedBankAccount && (
                        <>
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
                                            <FormLabel>Selected Bank Account</FormLabel>
                                            <Select value={selectedBankAccount} onValueChange={setSelectedBankAccount}>
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
                                            <Input type="file" accept=".csv" onChange={handleFileChange} id="transaction-file-input" />
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
                                        <CardDescription>Allocate imported transactions for: <span className="font-bold">{chartOfAccountsData.find(a => a.accountNumber === selectedBankAccount)?.description}</span></CardDescription>
                                    </div>
                                    <div className="flex flex-wrap gap-2 items-center">
                                         <Button variant="outline" size="sm" onClick={handleClearAllocations}>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Clear
                                        </Button>
                                        <div className="relative">
                                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                            <Input
                                                type="search"
                                                placeholder="Search transactions..."
                                                className="w-full sm:w-[250px] pl-8"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {(unallocatedTransactions.length + allocatedTransactions.length + processingTransactions.length + reviewTransactions.length) > 0 ? (
                                    <Tabs value={activeProcessingTab} onValueChange={(value) => setActiveProcessingTab(value as TabName)} className="w-full">
                                        <TabsList className="grid w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-6 h-auto">
                                            <TabsTrigger value="unallocated-income">Unallocated Income ({incomeTransactions.length})</TabsTrigger>
                                            <TabsTrigger value="unallocated-expenses">Unallocated Expenses ({expenseTransactions.length})</TabsTrigger>
                                            <TabsTrigger value="processing">Processing ({processingTransactions.length})</TabsTrigger>
                                            <TabsTrigger value="review">Review ({filteredReviewTransactions.length})</TabsTrigger>
                                            <TabsTrigger value="allocated-income">Allocated Income ({allocatedIncome.length})</TabsTrigger>
                                            <TabsTrigger value="allocated-expenses">Allocated Expenses ({allocatedExpenses.length})</TabsTrigger>
                                        </TabsList>
                                        {(selectedUnallocated.length > 0 && (activeProcessingTab === 'unallocated-income' || activeProcessingTab === 'unallocated-expenses')) && (
                                            <div className="flex flex-wrap items-center gap-4 p-4 border-t border-b bg-muted/50">
                                                <p className="text-sm font-semibold">{selectedUnallocated.length} selected</p>
                                                <Button size="sm" onClick={() => setIsBulkAllocateOpen(true)}>Allocate Selected</Button>
                                                <Button size="sm" variant="outline" onClick={handleAiAllocate} disabled={isAiAllocating}>
                                                    {isAiAllocating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                                     Allocate with AI
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => setSelectedUnallocated([])}>Clear Selection</Button>
                                            </div>
                                        )}
                                        {selectedAllocated.length > 0 && (activeProcessingTab === 'allocated-income' || activeProcessingTab === 'allocated-expenses') && (
                                            <div className="flex flex-wrap items-center gap-4 p-4 border-t border-b bg-muted/50">
                                                <p className="text-sm font-semibold">{selectedAllocated.length} selected</p>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" variant="destructive">Delete Selected</Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                            <AlertDialogDescription>This will permanently delete {selectedAllocated.length} allocated transactions. This action cannot be undone.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={handleBulkDeleteAllocated}>Delete</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                                <Button size="sm" variant="ghost" onClick={() => setSelectedAllocated([])}>Clear Selection</Button>
                                            </div>
                                        )}
                                         {selectedForReview.length > 0 && activeProcessingTab === 'review' && (
                                            <div className="flex flex-wrap items-center gap-4 p-4 border-t border-b bg-muted/50">
                                                <p className="text-sm font-semibold">{selectedForReview.length} selected</p>
                                                <Button size="sm" onClick={handleAcceptReviewed}>
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                    Accept Selected
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => exportToExcel(reviewTransactions.filter(tx => selectedForReview.includes(tx.id)), 'review-transactions')}><Download className="mr-2 h-4 w-4"/>Export Selected</Button>
                                                <Button size="sm" variant="ghost" onClick={() => setSelectedForReview([])}>Clear Selection</Button>
                                            </div>
                                        )}
                                        <TabsContent value="unallocated-income">
                                            {incomeTransactions.length > 0 ? (
                                                <AllocationTable transactions={incomeTransactions} onAllocate={handleAllocate} onEdit={handleEditTransaction} onDelete={(id) => handleDeleteTransaction(id, 'unallocated')} selectedTransactions={selectedUnallocated} onSelectionChange={(id, checked) => handleSelectionChange(id, checked, 'unallocated')} onAllocationSelect={handleAllocationSelect} allocations={allocations} onVatTypeSelect={handleVatTypeSelect} vatTypes={vatTypes} onCreateRule={setFeedbackTransaction} processingTxId={processingTxId} customers={customers} suppliers={suppliers} chartOfAccounts={chartOfAccountsData} />
                                            ) : (
                                                <p className="text-muted-foreground text-center py-10">No unallocated income transactions to display.</p>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="unallocated-expenses">
                                             {expenseTransactions.length > 0 ? (
                                                 <AllocationTable transactions={expenseTransactions} onAllocate={handleAllocate} onEdit={handleEditTransaction} onDelete={(id) => handleDeleteTransaction(id, 'unallocated')} selectedTransactions={selectedUnallocated} onSelectionChange={(id, checked) => handleSelectionChange(id, checked, 'unallocated')} onAllocationSelect={handleAllocationSelect} allocations={allocations} onVatTypeSelect={handleVatTypeSelect} vatTypes={vatTypes} onCreateRule={setFeedbackTransaction} processingTxId={processingTxId} customers={customers} suppliers={suppliers} chartOfAccounts={chartOfAccountsData} />
                                             ) : (
                                                <p className="text-muted-foreground text-center py-10">No unallocated expense transactions to display.</p>
                                             )}
                                        </TabsContent>
                                        <TabsContent value="processing">
                                            {processingTransactions.length > 0 ? (
                                                <Table>
                                                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {processingTransactions.map(tx => (
                                                            <TableRow key={tx.id}><TableCell>{tx.date}</TableCell><TableCell>{tx.description}</TableCell><TableCell className="text-right">{formatNumber(tx.amount)}</TableCell></TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            ) : (
                                                <p className="text-muted-foreground text-center py-10">No transactions are currently being processed.</p>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="review">
                                            {filteredReviewTransactions.length > 0 ? (
                                                <AllocationTable transactions={filteredReviewTransactions} onAllocate={handleAllocate} onEdit={handleEditTransaction} onDelete={(id) => handleDeleteTransaction(id, 'review')} selectedTransactions={selectedForReview} onSelectionChange={(id, checked) => handleSelectionChange(id, checked, 'review')} onAllocationSelect={handleAllocationSelect} allocations={allocations} onVatTypeSelect={handleVatTypeSelect} vatTypes={vatTypes} onCreateRule={setFeedbackTransaction} processingTxId={processingTxId} customers={customers} suppliers={suppliers} chartOfAccounts={chartOfAccountsData} />
                                            ) : (
                                                <p className="text-muted-foreground text-center py-10">No transactions to review.</p>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="allocated-income">
                                            {allocatedIncome.length > 0 ? (
                                                <>
                                                <div className="flex justify-end p-2">
                                                    <Button variant="outline" size="sm" onClick={() => exportToExcel(allocatedIncome, 'allocated-income')}><Download className="mr-2 h-4 w-4"/>Export to Excel</Button>
                                                </div>
                                                <AllocatedTransactionTable transactions={allocatedIncome} onSaveAllocation={handleSaveAllocation} onDelete={(id) => handleDeleteTransaction(id, 'allocated')} onCreateRule={setFeedbackTransaction} selectedTransactions={selectedAllocated} onSelectionChange={(id, checked) => handleSelectionChange(id, checked, 'allocated')} customers={customers} suppliers={suppliers} chartOfAccounts={chartOfAccountsData} />
                                                </>
                                            ) : (
                                                <p className="text-muted-foreground text-center py-10">No allocated income transactions to display.</p>
                                            )}
                                        </TabsContent>
                                         <TabsContent value="allocated-expenses">
                                            {allocatedExpenses.length > 0 ? (
                                                <>
                                                <div className="flex justify-end p-2">
                                                    <Button variant="outline" size="sm" onClick={() => exportToExcel(allocatedExpenses, 'allocated-expenses')}><Download className="mr-2 h-4 w-4"/>Export to Excel</Button>
                                                </div>
                                                <AllocatedTransactionTable transactions={allocatedExpenses} onSaveAllocation={handleSaveAllocation} onDelete={(id) => handleDeleteTransaction(id, 'allocated')} onCreateRule={setFeedbackTransaction} selectedTransactions={selectedAllocated} onSelectionChange={(id, checked) => handleSelectionChange(id, checked, 'allocated')} customers={customers} suppliers={suppliers} chartOfAccounts={chartOfAccountsData} />
                                                </>
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
                        </>
                        )}
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
                        <VatReportCard allocatedTransactions={allAllocated} activeClient={activeClient} />
                    </TabsContent>
                     <TabsContent value="suppliers">
                        <Card>
                           <CardHeader className="flex flex-row items-center justify-between">
                              <div>
                                  <CardTitle>Manage Suppliers</CardTitle>
                                  <CardDescription>Create, edit, and manage your suppliers.</CardDescription>
                              </div>
                              <Button onClick={handleAddSupplier}><PlusCircle className="mr-2 h-4 w-4" /> Create Supplier</Button>
                           </CardHeader>
                          <CardContent>
                              {customers.length > 0 ? (
                                  <Table>
                                      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact Person</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {suppliers.map(s => (
                                              <TableRow key={s.id}>
                                                  <TableCell>{s.name}</TableCell>
                                                  <TableCell>{s.contactPerson}</TableCell>
                                                  <TableCell>{s.email}</TableCell>
                                                  <TableCell>{s.phone}</TableCell>
                                                  <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => handleEditSupplier(s)}>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteSupplier(s.id)}>Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                  </TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              ) : <p className="text-muted-foreground text-center py-10">No suppliers created yet.</p>}
                          </CardContent>
                      </Card>
                    </TabsContent>
                     <TabsContent value="customers">
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                              <div>
                                  <CardTitle>Manage Customers</CardTitle>
                                  <CardDescription>Create, edit, and manage your customers.</CardDescription>
                              </div>
                              <Button onClick={handleAddCustomer}><PlusCircle className="mr-2 h-4 w-4" /> Create Customer</Button>
                           </CardHeader>
                           <CardContent>
                              {customers.length > 0 ? (
                                  <Table>
                                      <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact Person</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                      <TableBody>
                                          {customers.map(c => (
                                              <TableRow key={c.id}>
                                                  <TableCell>{c.name}</TableCell>
                                                  <TableCell>{c.contactPerson}</TableCell>
                                                  <TableCell>{c.email}</TableCell>
                                                  <TableCell>{c.contactNumber}</TableCell>
                                                  <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuItem onClick={() => handleEditCustomer(c)}>Edit</DropdownMenuItem>
                                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteCustomer(c.id)}>Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                  </TableCell>
                                              </TableRow>
                                          ))}
                                      </TableBody>
                                  </Table>
                              ) : <p className="text-muted-foreground text-center py-10">No customers created yet.</p>}
                           </CardContent>
                        </Card>
                    </TabsContent>
                    <TabsContent value="chart-of-accounts">
                       <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Chart of Accounts for {activeClient.name}</CardTitle>
                                    <CardDescription>Manage the general ledger accounts for this client.</CardDescription>
                                </div>
                                <Button onClick={handleAddCoa}><PlusCircle className="mr-2 h-4 w-4" /> Add Account</Button>
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
                                        {chartOfAccountsData.map(account => (
                                            <TableRow key={account.id}>
                                            <TableCell className="font-mono">{account.accountNumber}</TableCell>
                                            <TableCell className="font-medium">{account.description}</TableCell>
                                            <TableCell>{account.section}</TableCell>
                                            <TableCell className="text-right">
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
                                                        <DropdownMenuItem onClick={() => handleEditCoa(account)}>
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
                                                            This action cannot be undone. This will permanently delete the account:
                                                            <span className="font-semibold"> {account.description}</span> for this client.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleCoaDelete(account.id)}>
                                                                Continue
                                                            </AlertDialogAction>
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
                    </TabsContent>
                    <TabsContent value="allocation-rules">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                <CardTitle>Allocation Rules for {activeClient.name}</CardTitle>
                                <CardDescription>Manage the AI allocation rules for this specific client.</CardDescription>
                                </div>
                                <Button onClick={() => { setSelectedRule(null); setIsRuleFormOpen(true); }}><PlusCircle className="mr-2 h-4 w-4" /> Add Rule</Button>
                            </CardHeader>
                            <CardContent>
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead>Rule</TableHead>
                                    <TableHead>Allocated Account</TableHead>
                                    <TableHead>VAT Type</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allocationRules.map(rule => (
                                    <TableRow key={rule.id}>
                                        <TableCell className="font-semibold max-w-xs">
                                        <div className="flex items-center gap-2">
                                            {rule.type === 'hard' ? <HardHat className="h-4 w-4 text-muted-foreground" /> : <Feather className="h-4 w-4 text-muted-foreground" />}
                                            <span className="capitalize">{rule.type} Rule</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                                        {rule.type === 'hard' && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                            {rule.keywords.map(kw => <Badge key={kw} variant="secondary">{kw}</Badge>)}
                                            </div>
                                        )}
                                        </TableCell>
                                        <TableCell>{chartOfAccountsData.find(a => a.accountNumber === rule.accountId)?.description || 'N/A'}</TableCell>
                                        <TableCell>{allVatTypesData.find(v => v.name === rule.vatType)?.label || 'N/A'}</TableCell>
                                        <TableCell className="text-right">
                                        <AlertDialog>
                                            <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                <span className="sr-only">Open menu</span>
                                                <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => { setSelectedRule(rule); setIsRuleFormOpen(true); }}>Edit</DropdownMenuItem>
                                                <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem></AlertDialogTrigger>
                                            </DropdownMenuContent>
                                            </DropdownMenu>
                                            <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete this rule for this client.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleRuleDelete(rule.id)}>Continue</AlertDialogAction>
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
                            <Button onClick={handleAddClient} className="mt-4">
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
                                        <DropdownMenuItem onClick={() => handleEditClient(client)}>
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
                                            <AlertDialogAction onClick={() => handleDeleteClient(client.id)}>
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
                    chartOfAccounts={chartOfAccountsData}
                 />
            </DialogContent>
        </Dialog>
         <AIFeedbackDialog
            transaction={feedbackTransaction}
            onClose={() => setFeedbackTransaction(null)}
            onSubmit={handleRuleCreationAndAutoAllocate}
            chartOfAccounts={chartOfAccountsData}
        />
        <BulkAllocateDialog
            isOpen={isBulkAllocateOpen}
            onClose={() => setIsBulkAllocateOpen(false)}
            onBulkAllocate={handleBulkAllocate}
            count={selectedUnallocated.length}
            customers={customers}
            suppliers={suppliers}
            chartOfAccounts={chartOfAccountsData}
        />
         <Dialog open={isSupplierFormOpen} onOpenChange={setIsSupplierFormOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{selectedSupplier ? 'Edit Supplier' : 'Create Supplier'}</DialogTitle>
                </DialogHeader>
                <SupplierForm supplier={selectedSupplier} onSubmit={handleSupplierFormSubmit} onCancel={() => setIsSupplierFormOpen(false)} />
            </DialogContent>
        </Dialog>
        <Dialog open={isCustomerFormOpen} onOpenChange={setIsCustomerFormOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{selectedCustomer ? 'Edit Customer' : 'Create Customer'}</DialogTitle>
                </DialogHeader>
                <CustomerForm customer={selectedCustomer} onSubmit={handleCustomerFormSubmit} onCancel={() => setIsCustomerFormOpen(false)} />
            </DialogContent>
        </Dialog>
        <EditTransactionDialog 
            transaction={editingTransaction}
            isOpen={isEditTxOpen}
            onClose={() => setIsEditTxOpen(false)}
            onSave={handleSaveTransaction}
        />
        <Dialog open={isRuleFormOpen} onOpenChange={setIsRuleFormOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{selectedRule ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
                    <DialogDescription>
                        {selectedRule ? 'Update this allocation rule for this client.' : 'Create a rule for this client.'}
                    </DialogDescription>
                </DialogHeader>
                <RuleForm 
                    rule={selectedRule ? { ...selectedRule, keywords: selectedRule.keywords.join(', ') } : null}
                    onSubmit={handleRuleFormSubmit}
                    onCancel={() => setIsRuleFormOpen(false)}
                    chartOfAccounts={chartOfAccountsData}
                />
            </DialogContent>
        </Dialog>
        <EditBankAccountForm 
            account={editingBankAccount}
            isOpen={!!editingBankAccount}
            onClose={() => setEditingBankAccount(null)}
            onSave={handleSaveBankAccount}
            onClearTransactions={handleClearTransactions}
        />
        <Dialog open={isCoaFormOpen} onOpenChange={setIsCoaFormOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{selectedAccount ? 'Edit Account' : 'Create New Account'}</DialogTitle>
                    <DialogDescription>
                        {selectedAccount ? 'Update the details for this account.' : 'Enter the details for a new account.'}
                    </DialogDescription>
                </DialogHeader>
                <AccountForm 
                    account={selectedAccount} 
                    onSubmit={handleCoaFormSubmit}
                    onCancel={() => setIsCoaFormOpen(false)}
                />
            </DialogContent>
        </Dialog>
    </div>
  );
}

const feedbackSchema = z.object({
    description: z.string().min(5, "A descriptive rule is required."),
    correctAccount: z.string().min(1, "Please select the correct account."),
    correctVatType: z.custom<VatType>(),
    ruleScope: z.enum(['client', 'global']).default('client'),
});

function AIFeedbackDialog({
    transaction,
    onClose,
    onSubmit,
    chartOfAccounts,
}: {
    transaction: ImportedTransaction | AllocatedTransaction | null;
    onClose: () => void;
    onSubmit: (data: {
        transaction: ImportedTransaction | AllocatedTransaction;
        description: string;
        correctAccount: string;
        correctVatType: VatType;
        ruleScope: 'client' | 'global';
    }) => void;
    chartOfAccounts: ChartOfAccount[];
}) {
    const form = useForm<z.infer<typeof feedbackSchema>>({
        resolver: zodResolver(feedbackSchema),
        defaultValues: {
            description: '',
            correctAccount: '',
            correctVatType: 'no_vat',
            ruleScope: 'client',
        }
    });

    useEffect(() => {
        if (transaction) {
            form.reset({
                description: transaction.description,
                correctAccount: '',
                correctVatType: 'no_vat',
                ruleScope: 'client',
            });
        }
    }, [transaction, form]);

    if (!transaction) return null;

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
                    <DialogTitle>Create New AI Rule</DialogTitle>
                    <DialogDescription>
                        Teach the AI how to handle similar transactions. This rule will be applied to all matching unallocated transactions.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 pt-4">
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Rule Description (Editable)</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} placeholder="e.g., 'Payment from Client for services'" />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
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
                            name="ruleScope"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Rule Scope</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        className="flex flex-col space-y-1"
                                        >
                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                            <FormControl>
                                            <RadioGroupItem value="client" />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                            Client-specific (only for this client)
                                            </FormLabel>
                                        </FormItem>
                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                            <FormControl>
                                            <RadioGroupItem value="global" />
                                            </FormControl>
                                            <FormLabel className="font-normal">
                                            Global (for all future clients)
                                            </FormLabel>
                                        </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                         />
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button type="submit">Create Rule & Auto-Allocate</Button>
                        </DialogFooter>
                    </form>
                </Form>
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

function BulkAllocateDialog({ isOpen, onClose, onBulkAllocate, count, customers, suppliers, chartOfAccounts }: { isOpen: boolean, onClose: () => void, onBulkAllocate: (alloc: { value: string, type: 'account'|'customer'|'supplier' }, vat: VatType) => void, count: number, customers: User[], suppliers: Supplier[], chartOfAccounts: ChartOfAccount[] }) {
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
                                            customers={customers}
                                            suppliers={suppliers}
                                            chartOfAccounts={chartOfAccounts}
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



'use client';
import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, CalendarIcon, X, Printer, Download, Upload, FileCheck2, ScanLine, Sprout, Search, ArrowUpDown, Edit, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { User, ChartOfAccount } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, add, sub } from 'date-fns';
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

const bankAccountSchema = z.object({
  name: z.string().min(1, 'Bank name is required.'),
});

const formSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Client name is required.'),
  yearEnd: z.date({ required_error: 'Financial year end is required.'}),
  bankAccounts: z.array(bankAccountSchema).optional(),
});



function ClientForm({ client, onSubmit, onCancel }: { client: User | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: client?.id || '',
            name: client?.name || '',
            yearEnd: client?.yearEnd ? (client.yearEnd.toDate ? client.yearEnd.toDate() : new Date(client.yearEnd)) : undefined,
            bankAccounts: client?.id ? chartOfAccounts.filter(acc => acc.id.startsWith(`cashbook-${client.id}`)).map(acc => ({ name: acc.description.split(' - ')[1] })) : [],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: 'bankAccounts',
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Client / Company Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                
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

                <div>
                    <FormLabel>Bank Accounts</FormLabel>
                    <div className="space-y-2 mt-2">
                        {fields.map((item, index) => (
                            <div key={item.id} className="flex items-center gap-2">
                                <FormField
                                    control={form.control}
                                    name={`bankAccounts.${index}.name`}
                                    render={({ field }) => (
                                        <FormItem className="flex-grow">
                                            <FormControl><Input placeholder={`e.g., FNB, ABSA...`} {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="button" variant="destructive" size="sm" onClick={() => remove(index)}>Remove</Button>
                            </div>
                        ))}
                    </div>
                     <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => append({ name: '' })}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Bank Account
                    </Button>
                </div>
                
                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Client</Button>
                </div>
            </form>
        </Form>
    )
}

const trialBalanceFormSchema = z.object({
    fromDate: z.date(),
    toDate: z.date(),
    showZeroItems: z.boolean().default(true),
});

function TrialBalanceCard({ activeClient, onAccountClick }: { activeClient: User; onAccountClick: (accountNumber: string, from: Date, to: Date) => void; }) {
    
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
        let mockData = chartOfAccounts.map(account => {
            let debit = 0;
            let credit = 0;
            if (account.accountNumber.startsWith('1')) { // Sales
                credit = Math.random() * 100000;
            } else if (account.accountNumber.startsWith('3') || account.accountNumber.startsWith('4')) { // Expenses
                debit = Math.random() * 20000;
            } else if (account.accountNumber.startsWith('8400')) { // Bank
                debit = Math.random() * 50000;
            }
            if (Math.random() > 0.7) {
                return { accountNumber: account.accountNumber, description: account.description, debit, credit };
            }
            return { accountNumber: account.accountNumber, description: account.description, debit: 0, credit: 0 };
        });

        const totalDebits = mockData.reduce((acc, item) => acc + item.debit, 0);
        const totalCredits = mockData.reduce((acc, item) => acc + item.credit, 0);
        const difference = totalDebits - totalCredits;

        const suspenseAccountIndex = mockData.findIndex(acc => acc.accountNumber === '9990/000');
        if (suspenseAccountIndex !== -1) {
            if (difference > 0) {
                mockData[suspenseAccountIndex].credit += difference;
            } else {
                mockData[suspenseAccountIndex].debit -= difference;
            }
        }

        const filteredData = values.showZeroItems ? mockData : mockData.filter(d => d.debit !== 0 || d.credit !== 0);
        
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
          const openingBalance = (Math.random() - 0.5) * 10000; // Mock opening balance
          let runningBalance = openingBalance;

          const accountTransactions = allocatedTransactions.filter(
              tx => tx.allocatedTo.type === 'account' && tx.allocatedTo.value === accNum
          );

          const transactions: GLTransaction[] = accountTransactions.map(tx => {
              const amount = tx.amount;
              const isDebit = amount >= 0; // Assuming positive is debit for GL
              runningBalance += amount; // This might need refinement based on account type
              return {
                  date: tx.date,
                  description: tx.description,
                  reference: tx.id.substring(0, 8),
                  debit: isDebit ? amount : 0,
                  credit: !isDebit ? Math.abs(amount) : 0,
                  balance: runningBalance,
              };
          });

          return {
              accountNumber: accNum,
              description: accountInfo.description,
              transactions,
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
    const stringifiedAccounts = JSON.stringify(initialValues?.accounts);
    if (initialValues && initialValues.accounts && initialValues.accounts.length > 0) {
      const newValues = {
        fromDate: initialValues.fromDate || startDate,
        toDate: initialValues.toDate || endDate,
        accounts: initialValues.accounts,
      };
      form.reset(newValues);
      handleGenerate(newValues as z.infer<typeof generalLedgerFormSchema>);
    }
  }, [JSON.stringify(initialValues?.accounts), initialValues?.fromDate, initialValues?.toDate]);


  const handleDownloadExcel = () => {
    if (!reportData) return;

    let worksheetData: any[] = [];
    
    reportData.accounts.forEach(account => {
        if (worksheetData.length > 0) {
            worksheetData.push({}); // Add a blank row between accounts
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
          rowIndex++; // Skip blank row
        }
        rowIndex++; // Account header row
        if (worksheet[`A${rowIndex}`]) worksheet[`A${rowIndex}`].s = { font: { bold: true } };

        rowIndex++; // Column headers row
        
        rowIndex++; // Opening Balance row
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
        
        rowIndex++; // Closing Balance row
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

function AllocationTable({ transactions, onAllocate, selectedTransactions, onSelectionChange, onAllocationSelect, allocations }: { 
    transactions: ImportedTransaction[], 
    onAllocate: (transactionId: string) => void, 
    selectedTransactions: string[], 
    onSelectionChange: (id: string, isSelected: boolean) => void,
    onAllocationSelect: (transactionId: string, value: string, type: 'account'|'customer'|'supplier') => void,
    allocations: { [key: string]: { value: string, type: string } }
}) {
    const [sortConfig, setSortConfig] = useState<{ key: SortableField, direction: SortDirection } | null>({ key: 'date', direction: 'asc'});

    const handleSelectAll = (checked: boolean) => {
        transactions.forEach(tx => onSelectionChange(tx.id, checked));
    };

    const sortedTransactions = useMemo(() => {
        let sortableItems = [...transactions];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue = a[sortConfig.key];
                let bValue = b[sortConfig.key];
                
                // Handle date strings
                if (sortConfig.key === 'date') {
                    const [dayA, monthA, yearA] = aValue.split('/').map(Number);
                    const [dayB, monthB, yearB] = bValue.split('/').map(Number);
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

    const requestSort = (key: SortableField) => {
        let direction: SortDirection = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

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
                        <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                                <Button size="sm" onClick={() => onAllocate(tx.id)} disabled={!allocations[tx.id]}>Allocate</Button>
                                <Button size="sm" variant="outline" disabled>Split</Button>
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

function AllocatedTransactionTable({ transactions, onEditAllocation }: { transactions: AllocatedTransaction[], onEditAllocation: (transaction: AllocatedTransaction) => void }) {
    
    const getDisplayValue = (allocatedTo: { value: string, type: string }) => {
        if (allocatedTo.type === 'account') {
            return chartOfAccounts.find(a => a.accountNumber === allocatedTo.value)?.description || "N/A";
        }
        if (allocatedTo.type === 'customer') {
            return customers.find(c => c.id === allocatedTo.value)?.name || "N/A";
        }
        if (allocatedTo.type === 'supplier') {
            return suppliers.find(s => s.id === allocatedTo.value)?.name || "N/A";
        }
        return "N/A";
    };
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Allocated To</TableHead>
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
                             <div className="flex flex-col">
                                <span className="font-semibold">{getDisplayValue(tx.allocatedTo)}</span>
                                <span className="text-xs text-muted-foreground">{tx.allocatedTo.type}</span>
                             </div>
                        </TableCell>
                        <TableCell className="text-right">
                           <Button variant="outline" size="sm" onClick={() => onEditAllocation(tx)}>
                               <Edit className="mr-2 h-3 w-3" />
                               Edit Allocation
                           </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
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
  const [isAiAllocating, setIsAiAllocating] = useState(false);
  
  const importForm = useForm();
  
  const fetchClients = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "clients"), where('source', '==', 'Numera'));
        const querySnapshot = await getDocs(q);
        let fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        
        const testClientExists = fetchedClients.some(c => c.id === 'client-numera-test');
        if (!testClientExists) {
            const testClient = allUsers.find(u => u.id === 'client-numera-test');
            if(testClient) {
                fetchedClients.push(testClient);
            }
        }
        
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
        const batch = writeBatch(db);
        
        const clientRef = doc(db, "clients", clientId);
        batch.delete(clientRef);

        const associatedAccounts = chartOfAccounts.filter(acc => acc.id.startsWith(`cashbook-${clientId}`));
        associatedAccounts.forEach(acc => {
            const index = chartOfAccounts.findIndex(a => a.id === acc.id);
            if (index > -1) {
                chartOfAccounts.splice(index, 1);
            }
        });

        await batch.commit();

        fetchClients();
        toast({
            title: 'Client Deleted',
            description: 'The client and their associated cashbooks have been removed.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting client:", error);
        toast({ title: 'Error', description: 'Could not delete client.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!currentUser) return;

    const clientData = {
      name: data.name,
      yearEnd: data.yearEnd,
      role: 'client' as const,
      source: 'Numera' as const,
      email: `${data.name.toLowerCase().replace(/\s/g, '.')}@numera.local`,
    };

    try {
      if (selectedClient?.id) {
        const clientRef = doc(db, 'clients', selectedClient.id);
        await setDoc(clientRef, clientData, { merge: true });
        
        const existingBankAccounts = chartOfAccounts
          .filter(acc => acc.id.startsWith(`cashbook-${selectedClient.id}`))
          .map(acc => acc.description.split(' - ')[1]);
        
        const newBankAccounts = (data.bankAccounts || []).filter(
          bank => !existingBankAccounts.includes(bank.name)
        );

        if (newBankAccounts.length > 0) {
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

            newBankAccounts.forEach((bank, index) => {
                const newAccountNum = `8400/${(nextAccountNumberIndex + index).toString().padStart(3, '0')}`;
                const newAccount: ChartOfAccount = {
                    id: `cashbook-${selectedClient.id!}-${Date.now() + index}`,
                    accountNumber: newAccountNum,
                    description: `${data.name} - ${bank.name}`,
                    section: 'Balance Sheet',
                };
                if (!chartOfAccounts.some(a => a.accountNumber === newAccount.accountNumber)) {
                    chartOfAccounts.push(newAccount);
                }
            });

            toast({
                title: 'Cashbooks Added',
                description: `${newBankAccounts.length} new cashbook accounts have been added.`,
            });
        }

        toast({
          title: 'Client Updated',
          description: 'The client details have been saved.',
        });

      } else {
        const clientRef = doc(collection(db, "clients"));
        await setDoc(clientRef, { ...clientData, id: clientRef.id });
            
            if (data.bankAccounts && data.bankAccounts.length > 0) {
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

              data.bankAccounts.forEach((bank, index) => {
                  const newAccountNum = `8400/${(nextAccountNumberIndex + index).toString().padStart(3, '0')}`;
                  const newAccount: ChartOfAccount = {
                      id: `cashbook-${clientRef.id}-${index}`,
                      accountNumber: newAccountNum,
                      description: `${data.name} - ${bank.name}`,
                      section: 'Balance Sheet',
                  };
                  if (!chartOfAccounts.some(a => a.accountNumber === newAccount.accountNumber)) {
                      chartOfAccounts.push(newAccount);
                  }
              });
               toast({
                title: 'Cashbooks Created',
                description: `${data.bankAccounts.length} new cashbook accounts added to the Chart of Accounts.`,
              });
            }

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
      toast({ title: 'Error', description: 'Could not save the client.', variant: 'destructive' });
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
      };
      
      setAllocatedTransactions(prev => [...prev, newAllocatedTransaction]);
      setUnallocatedTransactions(prev => prev.filter(tx => tx.id !== transactionId));
      setAllocations(prev => {
          const newAllocations = { ...prev };
          delete newAllocations[transactionId];
          return newAllocations;
      });

      toast({ title: 'Transaction Allocated', description: 'The transaction has been successfully allocated.' });
  }
  
  const handleAllocationSelect = (transactionId: string, value: string, type: 'account'|'customer'|'supplier') => {
      setAllocations(prev => ({
          ...prev,
          [transactionId]: { value, type }
      }));
  }

  const handleBulkAllocate = () => {
    const bulkAllocation = allocations['bulk'];
     if (!bulkAllocation) {
        toast({ title: 'Allocation Error', description: 'Please select an account for bulk allocation.', variant: 'destructive' });
        return;
    }

    const transactionsToAllocate = unallocatedTransactions.filter(tx => selectedTransactions.includes(tx.id));
    
    const newAllocatedTransactions: AllocatedTransaction[] = transactionsToAllocate.map(tx => ({
        ...tx,
        allocatedTo: bulkAllocation,
        allocatedAt: new Date(),
    }));

    setAllocatedTransactions(prev => [...prev, ...newAllocatedTransactions]);
    setUnallocatedTransactions(prev => prev.filter(tx => !selectedTransactions.includes(tx.id)));
    setSelectedTransactions([]);
    setAllocations(prev => {
        const newAllocations = { ...prev };
        delete newAllocations['bulk'];
        selectedTransactions.forEach(id => delete newAllocations[id]);
        return newAllocations;
    });
    toast({ title: 'Bulk Allocation Successful', description: `${selectedTransactions.length} transactions have been allocated.` });
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

  const handleEditAllocation = (transaction: AllocatedTransaction) => {
    setAllocatedTransactions(prev => prev.filter(tx => tx.id !== transaction.id));
    setUnallocatedTransactions(prev => [transaction, ...prev]);
    toast({
        title: 'Transaction Un-allocated',
        description: 'The transaction has been moved back to the unallocated list for editing.',
    });
  };

  const handleAiAllocate = async () => {
    const transactionsToProcess = unallocatedTransactions.filter(tx => selectedTransactions.includes(tx.id));
    if (transactionsToProcess.length === 0) {
        toast({ title: 'No Transactions Selected', description: 'Please select one or more transactions to allocate with AI.', variant: 'destructive'});
        return;
    }
    
    setIsAiAllocating(true);
    toast({ title: 'AI Allocation Started', description: `AI is analyzing ${transactionsToProcess.length} transaction(s).`});

    let successCount = 0;
    const allocationPromises = transactionsToProcess.map(async (tx) => {
        try {
            const result = await allocateTransaction({ description: tx.description });
            if (result.accountNumber && chartOfAccounts.some(acc => acc.accountNumber === result.accountNumber)) {
                 handleAllocationSelect(tx.id, result.accountNumber, 'account');
                 successCount++;
            }
        } catch (error) {
            console.error(`AI allocation failed for transaction ${tx.id}:`, error);
        }
    });

    await Promise.all(allocationPromises);

    setIsAiAllocating(false);
    toast({ title: 'AI Allocation Complete', description: `AI successfully suggested allocations for ${successCount} of ${transactionsToProcess.length} transactions.`});
  };


  const clientBankAccounts = activeClient
    ? chartOfAccounts.filter(acc => acc.id.startsWith(`cashbook-${activeClient.id}`))
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
                        <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
                        <TabsTrigger value="customers">Customers</TabsTrigger>
                    </TabsList>
                    <TabsContent value="reporting" className="space-y-4">
                        <TrialBalanceCard activeClient={activeClient} onAccountClick={handleTBAccountClick} />
                        <GeneralLedgerCard activeClient={activeClient} initialValues={glInitialValues} allocatedTransactions={allocatedTransactions} />
                    </TabsContent>
                    <TabsContent value="banking" className="space-y-4">
                        <Card>
                            <CardHeader><CardTitle>Bank Account List</CardTitle></CardHeader>
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
                                <div className="flex flex-col sm:flex-row justify-between gap-2">
                                    <div>
                                        <CardTitle>Transaction Processing</CardTitle>
                                        <CardDescription>Allocate imported transactions to your Chart of Accounts.</CardDescription>
                                    </div>
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
                                                <AllocationCombobox value={allocations['bulk']} onSelect={(value, type) => handleAllocationSelect('bulk', value, type)}/>
                                                <Button size="sm" onClick={handleBulkAllocate} disabled={!allocations['bulk']}>Allocate Selected</Button>
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
                                                <AllocationTable transactions={incomeTransactions} onAllocate={handleAllocate} selectedTransactions={selectedTransactions} onSelectionChange={handleSelectionChange} onAllocationSelect={handleAllocationSelect} allocations={allocations} />
                                            ) : (
                                                <p className="text-muted-foreground text-center py-10">No unallocated income transactions to display.</p>
                                            )}
                                        </TabsContent>
                                        <TabsContent value="unallocated-expenses">
                                             {expenseTransactions.length > 0 ? (
                                                 <AllocationTable transactions={expenseTransactions} onAllocate={handleAllocate} selectedTransactions={selectedTransactions} onSelectionChange={handleSelectionChange} onAllocationSelect={handleAllocationSelect} allocations={allocations} />
                                             ) : (
                                                <p className="text-muted-foreground text-center py-10">No unallocated expense transactions to display.</p>
                                             )}
                                        </TabsContent>
                                        <TabsContent value="allocated-income">
                                            {allocatedIncome.length > 0 ? (
                                                <AllocatedTransactionTable transactions={allocatedIncome} onEditAllocation={handleEditAllocation} />
                                            ) : (
                                                <p className="text-muted-foreground text-center py-10">No allocated income transactions to display.</p>
                                            )}
                                        </TabsContent>
                                         <TabsContent value="allocated-expenses">
                                            {allocatedExpenses.length > 0 ? (
                                                <AllocatedTransactionTable transactions={allocatedExpenses} onEditAllocation={handleEditAllocation} />
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
                            <CardHeader><CardTitle>Manage Journals</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Journal creation and management will be built here.</p></CardContent>
                        </Card>
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
    </div>
  );
}




'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, CalendarIcon, X, Printer, Download } from 'lucide-react';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Check } from 'lucide-react';

const db = getFirestore(firebaseApp);

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
    
     const formatNumber = (value: number) => {
        return value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

function GeneralLedgerCard({ activeClient, initialValues }: { activeClient: User, initialValues?: Partial<z.infer<typeof generalLedgerFormSchema>> }) {
  
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
          const openingBalance = (Math.random() - 0.5) * 10000;
          let runningBalance = openingBalance;
          const transactions: GLTransaction[] = Array.from({ length: Math.floor(Math.random() * 10) + 1 }).map((_, i) => {
              const isDebit = Math.random() > 0.5;
              const amount = Math.random() * 1000;
              runningBalance += isDebit ? amount : -amount;
              return {
                  date: format(add(values.fromDate, { days: i * 10 }), 'dd/MM/yyyy'),
                  description: `Mock transaction ${i + 1}`,
                  reference: `REF-${Math.floor(Math.random() * 10000)}`,
                  debit: isDebit ? amount : 0,
                  credit: !isDebit ? amount : 0,
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
    if (initialValues && initialValues.accounts && initialValues.accounts.length > 0) {
      const newFromDate = initialValues.fromDate || startDate;
      const newToDate = initialValues.toDate || endDate;
      
      form.reset({
        fromDate: newFromDate,
        toDate: newToDate,
        accounts: initialValues.accounts,
      });

      handleGenerate({
        fromDate: newFromDate,
        toDate: newToDate,
        accounts: initialValues.accounts,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues?.accounts?.join(','), initialValues?.fromDate?.getTime(), initialValues?.toDate?.getTime()]);


  const formatNumber = (value: number) => {
    return value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const handleDownloadExcel = () => {
    if (!reportData) return;

    let worksheetData: any[] = [];
    
    worksheetData.push({ A: reportData.clientName });
    worksheetData.push({ A: 'General Ledger' });
    worksheetData.push({ A: `For the period: ${reportData.fromDate} to ${reportData.toDate}` });
    worksheetData.push({});

    reportData.accounts.forEach(account => {
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
        worksheetData.push({});
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData, { skipHeader: true });
    
    worksheet['!cols'] = [
        { wch: 15 }, { wch: 40 }, { wch: 15 },
        { wch: 15 }, { wch: 15 }, { wch: 15 }
    ];

    let rowIndex = 1;
    reportData.accounts.forEach(account => {
        rowIndex += 2; // for account header and transaction headers
        worksheet[`F${rowIndex}`] = { t: 'n', v: account.openingBalance, z: '#,##0.00' };
        rowIndex++;
        account.transactions.forEach(() => {
             worksheet[`D${rowIndex}`] = { t: 'n', v: worksheetData[rowIndex-1].D, z: '#,##0.00' };
             worksheet[`E${rowIndex}`] = { t: 'n', v: worksheetData[rowIndex-1].E, z: '#,##0.00' };
             worksheet[`F${rowIndex}`] = { t: 'n', v: worksheetData[rowIndex-1].F, z: '#,##0.00' };
            rowIndex++;
        });
        worksheet[`F${rowIndex}`] = { t: 'n', v: account.closingBalance, z: '#,##0.00' };
        rowIndex +=2; // for closing balance and spacer row
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
  
  const fetchClients = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "clients"), where('source', '==', 'Numera'));
        const querySnapshot = await getDocs(q);
        const fetchedClients = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        
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
        
        // Handle new bank accounts on edit
        const existingBankAccounts = chartOfAccounts
          .filter(acc => acc.id.startsWith(`cashbook-${selectedClient.id}`))
          .map(acc => acc.description.split(' - ')[1]);
        
        const newBankAccounts = (data.bankAccounts || []).filter(
          bank => !existingBankAccounts.includes(bank.name)
        );

        if (newBankAccounts.length > 0) {
            let nextAccountNumberIndex = 1;
            const lastCashbook = chartOfAccounts
                .filter(a => a.accountNumber.startsWith('8400/'))
                .sort((a,b) => a.accountNumber.localeCompare(b.accountNumber))
                .pop();
            if (lastCashbook) {
                const lastNum = parseInt(lastCashbook.accountNumber.split('/')[1]);
                if (!isNaN(lastNum)) {
                    nextAccountNumberIndex = lastNum + 1;
                }
            }

            newBankAccounts.forEach((bank, index) => {
                const newAccountNum = `8400/${(nextAccountNumberIndex + index).toString().padStart(3, '0')}`;
                const newAccount: ChartOfAccount = {
                    id: `cashbook-${selectedClient.id}-${Date.now() + index}`,
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
        await setDoc(clientRef, clientData);
            
            if (data.bankAccounts && data.bankAccounts.length > 0) {
              const lastCashbook = chartOfAccounts
                  .filter(a => a.accountNumber.startsWith('8400/'))
                  .sort((a,b) => a.accountNumber.localeCompare(b.accountNumber))
                  .pop();
              
              let nextAccountNumberIndex = 1;
              if (lastCashbook) {
                  const lastNum = parseInt(lastCashbook.accountNumber.split('/')[1]);
                  if (!isNaN(lastNum)) {
                     nextAccountNumberIndex = lastNum + 1;
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
      return format(date.toDate(), 'dd MMMM yyyy');
    }
    const d = new Date(date);
    if (d instanceof Date && !isNaN(d.getTime())) {
      return format(d, 'dd MMMM yyyy');
    }
    return 'Invalid Date';
  };

  const clientBankAccounts = activeClient
    ? chartOfAccounts.filter(acc => acc.id.startsWith(`cashbook-${activeClient.id}`))
    : [];

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
                        <GeneralLedgerCard activeClient={activeClient} initialValues={glInitialValues} />
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
                                                <TableHead className="text-right">Balance</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {clientBankAccounts.map(acc => (
                                                <TableRow key={acc.id}>
                                                    <TableCell className="font-mono">{acc.accountNumber}</TableCell>
                                                    <TableCell>{acc.description}</TableCell>
                                                    <TableCell className="text-right font-mono">R 0.00</TableCell>
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
                            <CardHeader><CardTitle>Bank Transactions</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Bank transactions functionality will be built here.</p></CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Bank Reconciliation</CardTitle></CardHeader>
                            <CardContent><p className="text-muted-foreground text-center py-10">Bank reconciliation functionality will be built here.</p></CardContent>
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




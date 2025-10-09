
'use client';

import * as React from "react"
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, AllocatedTransaction, ImportedTransaction, ChartOfAccount } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { format, startOfDay } from 'date-fns';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import * as XLSX from 'xlsx';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return '';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

function getFinancialYearStart(date: Date, endMonthName?: string) {
    const endMonth = endMonthName ? new Date(`${endMonthName} 1, 2000`).getMonth() : 1; // Default to Feb if not provided
    const currentMonth = date.getMonth();
    let year = date.getFullYear();

    if (currentMonth > endMonth) {
        return new Date(year, endMonth + 1, 1);
    } else {
        return new Date(year - 1, endMonth + 1, 1);
    }
}

function TrialBalanceReport({ client, dateRange }: { client: User, dateRange?: DateRange }) {
    
    const accountBalances = useMemo(() => {
        const balances = new Map<string, number>();
        const allTransactions: (AllocatedTransaction | ImportedTransaction)[] = [
            ...(client.allocatedTransactions || []),
            ...(client.importedTransactions || []),
        ];
        
        client.chartOfAccounts?.forEach(acc => {
            balances.set(acc.id, 0);
        });

        const reportStartDate = dateRange?.from ? startOfDay(dateRange.from) : getFinancialYearStart(new Date(), client.yearEnd);
        const reportEndDate = dateRange?.to;

        const retainedIncomeAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '5200/000');
        const suspenseAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '9950/000')?.id;
        const vatControlAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '9500/000')?.id;

        let priorPeriodNetIncome = 0;

        // 1. Calculate opening balances from transactions BEFORE the report start date
        allTransactions.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate < reportStartDate) {
                const processTransaction = (accountId: string, amount: number) => {
                    const account = client.chartOfAccounts?.find(a => a.id === accountId);
                    if (account) {
                        if (account.section === 'Balance Sheet') {
                            balances.set(accountId, (balances.get(accountId) || 0) + amount);
                        } else { // Income Statement
                            priorPeriodNetIncome += amount;
                        }
                    }
                };
                
                const isAllocated = 'allocatedTo' in tx;
                // Bank entries are always Balance Sheet
                if(tx.bankAccountId && balances.has(tx.bankAccountId)) {
                    processTransaction(tx.bankAccountId, tx.amount);
                }

                if (isAllocated) {
                    const allocatedTx = tx as AllocatedTransaction;
                    const vatAmount = allocatedTx.vatAmount || 0;
                    const exclusiveAmount = allocatedTx.amount - vatAmount;
                    processTransaction(allocatedTx.allocatedTo.value, -exclusiveAmount);
                    if (vatControlAccountId && vatAmount !== 0) {
                        processTransaction(vatControlAccountId, -vatAmount);
                    }
                } else {
                     if (suspenseAccountId) {
                        processTransaction(suspenseAccountId, -tx.amount);
                    }
                }
            }
        });
        
        if (retainedIncomeAccount) {
            // A profit (income > expenses) results in a negative priorPeriodNetIncome.
            // This should increase the credit balance of Retained Income.
            // A loss (expenses > income) results in a positive priorPeriodNetIncome.
            // This should decrease the credit balance (i.e., add a debit).
            balances.set(retainedIncomeAccount.id, (balances.get(retainedIncomeAccount.id) || 0) - priorPeriodNetIncome);
        }

        // 2. Process transactions within the current period
        allTransactions.forEach(tx => {
            const txDate = new Date(tx.date);
            if (txDate >= reportStartDate && (!reportEndDate || txDate <= reportEndDate)) {
                 const processTransaction = (accountId: string, amount: number) => {
                    balances.set(accountId, (balances.get(accountId) || 0) + amount);
                };
                
                const isAllocated = 'allocatedTo' in tx;
                 if(tx.bankAccountId && balances.has(tx.bankAccountId)) {
                    processTransaction(tx.bankAccountId, tx.amount);
                }
                
                 if (isAllocated) {
                    const allocatedTx = tx as AllocatedTransaction;
                    const vatAmount = allocatedTx.vatAmount || 0;
                    const exclusiveAmount = allocatedTx.amount - vatAmount;
                    processTransaction(allocatedTx.allocatedTo.value, -exclusiveAmount);
                    if (vatControlAccountId && vatAmount !== 0) {
                        processTransaction(vatControlAccountId, -vatAmount);
                    }
                } else {
                     if (suspenseAccountId) {
                        processTransaction(suspenseAccountId, -tx.amount);
                    }
                }
            }
        });

        return balances;
    }, [client, dateRange]);

    const trialBalanceData = useMemo(() => {
        return client.chartOfAccounts
          ?.map(account => ({
              ...account,
              balance: accountBalances.get(account.id) || 0
          }))
          .filter(account => account.balance !== 0) // Only show accounts with activity
          .sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
    }, [client.chartOfAccounts, accountBalances]);

    const totals = useMemo(() => {
        let debit = 0;
        let credit = 0;
        trialBalanceData?.forEach(item => {
            if (item.balance > 0) {
              debit += item.balance;
            } else {
              credit += -item.balance;
            }
        });
        return { debit, credit };
    }, [trialBalanceData]);

    const handleDownloadExcel = () => {
        const dataToExport = trialBalanceData?.map(item => ({
            Account: `${item.accountNumber} - ${item.description}`,
            Debit: item.balance > 0 ? item.balance : 0,
            Credit: item.balance < 0 ? -item.balance : 0
        }));

        if (!dataToExport) return;
        
        // Add totals row
        dataToExport.push({
            Account: 'Totals',
            Debit: totals.debit,
            Credit: totals.credit
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Trial Balance");

        // Format columns as currency
        worksheet['!cols'] = [{ wch: 40 }, { wch: 15 }, { wch: 15 }];
        Object.keys(worksheet).forEach(key => {
            if (key.startsWith('B') && key !== 'B1' || key.startsWith('C') && key !== 'C1') {
                const cell = worksheet[key];
                if (cell.v !== null && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = 'R #,##0.00';
                }
            }
        });

        const today = new Date().toISOString().split('T')[0];
        const fileName = `${client.companyName || client.name}-Trial-Balance-${today}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };
    
    return (
        <>
            <div className="max-h-[70vh] overflow-y-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Account</TableHead>
                            <TableHead className="text-right">Debit</TableHead>
                            <TableHead className="text-right">Credit</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {trialBalanceData?.map(item => {
                            const debitAmount = item.balance > 0 ? item.balance : 0;
                            const creditAmount = item.balance < 0 ? -item.balance : 0;
                            
                            return (
                                <TableRow key={item.id}>
                                    <TableCell>{item.accountNumber} - {item.description}</TableCell>
                                    <TableCell className="text-right font-mono">
                                        {formatPrice(debitAmount)}
                                    </TableCell>
                                    <TableCell className="text-right font-mono">
                                        {formatPrice(creditAmount)}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                    <TableFooter>
                        <TableRow>
                            <TableCell className="font-bold">Totals</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatPrice(totals.debit)}</TableCell>
                            <TableCell className="text-right font-bold font-mono">{formatPrice(totals.credit)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
            <DialogFooter className="mt-4">
                <Button variant="outline" onClick={handleDownloadExcel}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Excel
                </Button>
            </DialogFooter>
        </>
    );
}

export default function TrialBalancePage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>(undefined);
    
    useEffect(() => {
        const fetchClient = async () => {
            setIsLoading(true);
            try {
                const docRef = doc(db, 'numeraClients', clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClient({ id: docSnap.id, ...docSnap.data() } as User);
                }
            } catch (error) {
                console.error("Error fetching client:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (clientId) {
            fetchClient();
        }
    }, [clientId]);
    
    const getReportDateString = () => {
        if (!dateRange || (!dateRange.from && !dateRange.to)) {
            return `as at ${format(new Date(), "dd MMMM yyyy")}`;
        }
        if (dateRange.from && dateRange.to) {
            return `for the period ${format(dateRange.from, "dd MMMM yyyy")} to ${format(dateRange.to, "dd MMMM yyyy")}`;
        }
        if (dateRange.from) {
            return `from ${format(dateRange.from, "dd MMMM yyyy")}`;
        }
        if (dateRange.to) {
            return `up to ${format(dateRange.to, "dd MMMM yyyy")}`;
        }
        return `as at ${format(new Date(), "dd MMMM yyyy")}`;
    }

    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Trial Balance Report</CardTitle>
                    <CardDescription>
                        Generate a trial balance for the selected period based on processed transactions.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <DateRangePicker onDateChange={setDateRange} financialYearEnd={client?.yearEnd} />
                    {isLoading ? (
                        <Loader2 className="animate-spin" />
                    ) : client ? (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button>View Trial Balance</Button>
                            </DialogTrigger>
                             <DialogContent className="sm:max-w-3xl">
                                <DialogHeader className="text-center mb-4">
                                    <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                    <DialogDescription>
                                        Trial Balance {getReportDateString()}
                                    </DialogDescription>
                                </DialogHeader>
                                <TrialBalanceReport client={client} dateRange={dateRange} />
                            </DialogContent>
                        </Dialog>
                    ) : (
                        <p>Client data could not be loaded.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

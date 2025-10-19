
'use client';

import * as React from "react"
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
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

function TrialBalanceReport({ client, transactions, dateRange }: { client: User, transactions: (ImportedTransaction | AllocatedTransaction)[], dateRange?: DateRange }) {
    
    const accountBalances = useMemo(() => {
        const balances = new Map<string, number>();
        client.chartOfAccounts?.forEach(acc => balances.set(acc.id, 0));

        const reportStartDate = dateRange?.from ? startOfDay(dateRange.from) : getFinancialYearStart(new Date(), client.yearEnd);
        const reportEndDate = dateRange?.to;

        const retainedIncomeAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '9000-004');
        const suspenseAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '9500-001')?.id;
        const vatControlAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008')?.id;

        let priorPeriodNetIncome = 0;

        // Process all transactions
        transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            const isAllocated = 'allocatedTo' in tx;

            // Determine if transaction falls in prior period or current period
            const isPriorPeriod = txDate < reportStartDate;

            const processEntry = (accountId: string, amount: number) => {
                if (isPriorPeriod) {
                    const account = client.chartOfAccounts?.find(a => a.id === accountId);
                    if (account?.section === 'Income Statement') {
                        priorPeriodNetIncome += amount;
                    } else if (balances.has(accountId)) {
                        balances.set(accountId, (balances.get(accountId) || 0) + amount);
                    }
                } else if (!reportEndDate || txDate <= reportEndDate) {
                    if (balances.has(accountId)) {
                        balances.set(accountId, (balances.get(accountId) || 0) + amount);
                    }
                }
            };
            
            // Entry 1: Bank Account
            if (tx.bankAccountId && tx.bankAccountId !== 'JOURNAL') {
                processEntry(tx.bankAccountId, tx.amount);
            }

            // Entry 2: Contra-entry
            if (isAllocated) {
                const allocatedTx = tx as AllocatedTransaction;
                const vatAmount = allocatedTx.vatAmount || 0;
                const exclusiveAmount = allocatedTx.amount - vatAmount;
                
                processEntry(allocatedTx.allocatedTo.value, -exclusiveAmount);

                if (vatControlAccountId && vatAmount !== 0) {
                    processEntry(vatControlAccountId, -vatAmount);
                }
            } else { // Unallocated or Journal
                if (tx.bankAccountId === 'JOURNAL') {
                    // For manual journals, the contra entry is already handled by another line
                } else if (suspenseAccountId) {
                    processEntry(suspenseAccountId, -tx.amount);
                }
            }
        });
        
        if (retainedIncomeAccount) {
            balances.set(retainedIncomeAccount.id, (balances.get(retainedIncomeAccount.id) || 0) - priorPeriodNetIncome);
        }

        return balances;
    }, [client, dateRange, transactions]);


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
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [date, setDate] = React.useState<DateRange | undefined>(undefined);
    
    useEffect(() => {
        const fetchClientAndTransactions = async () => {
            setIsLoading(true);
            try {
                const docRef = doc(db, 'aiAccountantClients', clientId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setClient({ id: docSnap.id, ...docSnap.data() } as User);
                }

                const transactionsRef = collection(db, 'aiAccountantClients', clientId, 'transactions');
                const transactionsSnap = await getDocs(transactionsRef);
                const fetchedTransactions = transactionsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
                setTransactions(fetchedTransactions);

            } catch (error) {
                console.error("Error fetching client data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (clientId) {
            fetchClientAndTransactions();
        }
    }, [clientId]);
    
    const getReportDateString = () => {
        if (!date || (!date.from && !date.to)) {
            return `as at ${format(new Date(), "dd MMMM yyyy")}`;
        }
        if (date.from && date.to) {
            return `for the period ${format(date.from, "dd MMMM yyyy")} to ${format(date.to, "dd MMMM yyyy")}`;
        }
        if (date.from) {
            return `from ${format(date.from, "dd MMMM yyyy")}`;
        }
        if (date.to) {
            return `up to ${format(date.to, "dd MMMM yyyy")}`;
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
                     <DateRangePicker onDateChange={setDate} financialYearEnd={client?.yearEnd} />
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
                                <TrialBalanceReport client={client} transactions={transactions} dateRange={date} />
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

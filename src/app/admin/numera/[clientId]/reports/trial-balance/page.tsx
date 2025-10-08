

'use client';

import * as React from "react"
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, AllocatedTransaction, ImportedTransaction } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { format } from 'date-fns';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker"

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

function TrialBalanceReport({ client, dateRange }: { client: User, dateRange?: DateRange }) {
    
    const filterByDate = (transactions: (AllocatedTransaction | ImportedTransaction)[]) => {
        if (!dateRange || (!dateRange.from && !dateRange.to)) {
            return transactions;
        }
        return transactions.filter(tx => {
            const txDate = new Date(tx.date);
            if (dateRange.from && dateRange.to) {
                return txDate >= dateRange.from && txDate <= dateRange.to;
            }
            if (dateRange.from) {
                return txDate >= dateRange.from;
            }
            if (dateRange.to) {
                return txDate <= dateRange.to;
            }
            return true;
        });
    }

    const accountBalances = useMemo(() => {
        const balances = new Map<string, number>();

        // Initialize all accounts from master chart with 0 balance
        client.chartOfAccounts?.forEach(acc => {
            balances.set(acc.id, 0);
        });

        const suspenseAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '9950/000')?.id;
        const vatControlAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '9500/000')?.id;

        const filteredAllocated = filterByDate(client.allocatedTransactions || []) as AllocatedTransaction[];
        const filteredImported = filterByDate(client.importedTransactions || []) as ImportedTransaction[];
        
        // Process allocated transactions
        filteredAllocated.forEach(tx => {
            balances.set(tx.bankAccountId, (balances.get(tx.bankAccountId) || 0) + tx.amount);
            const vatAmount = tx.vatAmount || 0;
            const exclusiveAmount = tx.amount - vatAmount;
            
            // The expense/income account gets the exclusive amount
            balances.set(tx.allocatedTo.value, (balances.get(tx.allocatedTo.value) || 0) - exclusiveAmount);

            // The VAT portion goes to the VAT control account
            if (vatControlAccountId && vatAmount !== 0) {
                 balances.set(vatControlAccountId, (balances.get(vatControlAccountId) || 0) - vatAmount);
            }
        });

        // Process unallocated (imported) transactions
        filteredImported.forEach(tx => {
            balances.set(tx.bankAccountId, (balances.get(tx.bankAccountId) || 0) + tx.amount);
            if (suspenseAccountId) {
                balances.set(suspenseAccountId, (balances.get(suspenseAccountId) || 0) - tx.amount);
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
    
    return (
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
                const docRef = doc(db, 'clients', clientId);
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
                     <DateRangePicker onDateChange={setDateRange} />
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

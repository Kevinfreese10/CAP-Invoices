
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2 } from "lucide-react";
import { useParams } from 'next/navigation';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { User, ChartOfAccount } from '@/lib/types';
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

// Function to determine if an account typically has a Debit or Credit balance
const getAccountType = (accountNumber: string): 'debit' | 'credit' => {
  const num = parseInt(accountNumber.split('/')[0]);
  // Expenses (3000-4999), Assets (6000-8999) are typically Debit
  if ((num >= 3000 && num < 5000) || (num >= 6000 && num < 9000)) {
    return 'debit';
  }
  // Income (1000-2999), Liabilities (5000-5999, 9000-9999), Equity (5000-5999) are typically Credit
  return 'credit';
};

function TrialBalanceReport({ client }: { client: User }) {
    const reportDate = format(new Date(), "dd MMMM yyyy");

    const accountBalances = useMemo(() => {
        const balances = new Map<string, number>();

        // Initialize all accounts from master chart with 0 balance
        client.chartOfAccounts?.forEach(acc => {
            balances.set(acc.id, 0);
        });
        
        // Process allocated transactions
        client.allocatedTransactions?.forEach(tx => {
            const accountId = tx.allocatedTo.value;
            balances.set(accountId, (balances.get(accountId) || 0) + tx.amount);
        });

        // Process unallocated (imported) transactions
        const unallocatedSuspenseAccountId = '9950/000';
        let unallocatedTotal = 0;
        client.importedTransactions?.forEach(tx => {
            unallocatedTotal += tx.amount;
        });

        const suspenseAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === unallocatedSuspenseAccountId);
        if (suspenseAccount) {
            balances.set(suspenseAccount.id, (balances.get(suspenseAccount.id) || 0) + unallocatedTotal);
        }

        return balances;
    }, [client]);

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
            if (getAccountType(item.accountNumber) === 'debit') {
                debit += item.balance;
            } else {
                credit += item.balance;
            }
        });
        // For credit balance accounts, income is usually negative. We show it as positive in credit column.
        return { debit: debit, credit: -credit };
    }, [trialBalanceData]);

    return (
        <div className="max-h-[70vh] overflow-y-auto">
            <div className="text-center my-4">
                <h3 className="font-bold text-lg">{client.companyName || client.name}</h3>
                <p className="font-medium">Trial Balance</p>
                <p className="text-sm text-muted-foreground">As at {reportDate}</p>
            </div>
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
                        const type = getAccountType(item.accountNumber);
                        // For credit balance accounts, income is usually negative. We show it as positive in credit column.
                        const displayBalance = type === 'credit' ? -item.balance : item.balance;

                        return (
                            <TableRow key={item.id}>
                                <TableCell>{item.accountNumber} - {item.description}</TableCell>
                                <TableCell className="text-right font-mono">
                                    {type === 'debit' ? formatPrice(displayBalance) : ''}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                    {type === 'credit' ? formatPrice(displayBalance) : ''}
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

    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Trial Balance Report</CardTitle>
                    <CardDescription>
                        Generate a trial balance for the selected period based on processed transactions.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <Loader2 className="animate-spin" />
                    ) : client ? (
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button>View Trial Balance</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-2xl">
                                <TrialBalanceReport client={client} />
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

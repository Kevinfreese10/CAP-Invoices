

'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, ChartOfAccount, AllocatedTransaction, ImportedTransaction } from "@/lib/types";
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download } from "lucide-react";
import { useParams } from 'next/navigation';
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    if (price === 0) return '';
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

function GeneralLedgerReport({ client, dateRange, fromAccount, toAccount }: { client: User, dateRange?: DateRange, fromAccount?: string, toAccount?: string }) {
    
    const transactions = useMemo(() => {
        let allTransactions: (AllocatedTransaction | ImportedTransaction)[] = [
            ...(client.allocatedTransactions || []),
            ...(client.importedTransactions || [])
        ];

        if (dateRange?.from) {
            allTransactions = allTransactions.filter(tx => new Date(tx.date) >= dateRange.from!);
        }
        if (dateRange?.to) {
            allTransactions = allTransactions.filter(tx => new Date(tx.date) <= dateRange.to!);
        }

        return allTransactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [client, dateRange]);
    
    const accountsToDisplay = useMemo(() => {
        let accounts = client.chartOfAccounts || [];

        if (fromAccount) {
            const from = accounts.find(a => a.id === fromAccount);
            if(from) accounts = accounts.filter(acc => acc.accountNumber >= from.accountNumber);
        }
        if (toAccount) {
            const to = accounts.find(a => a.id === toAccount);
            if(to) accounts = accounts.filter(acc => acc.accountNumber <= to.accountNumber);
        }

        return accounts.sort((a,b) => a.accountNumber.localeCompare(b.accountNumber));
    }, [client.chartOfAccounts, fromAccount, toAccount]);


    const groupedTransactions = useMemo(() => {
        const suspenseAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '9950/000')?.id;
        const vatControlAccountId = client.chartOfAccounts?.find(acc => acc.accountNumber === '9500/000')?.id;

        const grouped = new Map<string, { account: ChartOfAccount; transactions: any[], totalDebit: number; totalCredit: number }>();

        accountsToDisplay.forEach(acc => {
            grouped.set(acc.id, { account: acc, transactions: [], totalDebit: 0, totalCredit: 0 });
        });

        transactions.forEach(tx => {
            const txDate = new Date(tx.date);
            const isAllocated = 'allocatedTo' in tx;
            
            // Debit bank account if amount is negative (payment), Credit if positive (income)
            const bankEntry = grouped.get(tx.bankAccountId);
            if (bankEntry) {
                 bankEntry.transactions.push({
                    date: txDate,
                    description: isAllocated ? `Contra to ${tx.allocatedTo.value}` : 'Unallocated Transaction',
                    ref: tx.description,
                    debit: tx.amount > 0 ? tx.amount : 0,
                    credit: tx.amount < 0 ? -tx.amount : 0,
                 });
            }

            if (isAllocated) {
                const allocatedTx = tx as AllocatedTransaction;
                const exclusiveAmount = allocatedTx.amount - (allocatedTx.vatAmount || 0);

                // Post exclusive amount to allocated account
                const allocatedAccountEntry = grouped.get(allocatedTx.allocatedTo.value);
                if (allocatedAccountEntry) {
                    allocatedAccountEntry.transactions.push({
                        date: txDate,
                        description: `Bank: ${tx.description}`,
                        ref: tx.bankAccountId,
                        debit: exclusiveAmount < 0 ? -exclusiveAmount : 0,
                        credit: exclusiveAmount > 0 ? exclusiveAmount : 0,
                    });
                }
                
                // Post VAT amount
                if (vatControlAccountId && allocatedTx.vatAmount !== 0) {
                     const vatAccountEntry = grouped.get(vatControlAccountId);
                     if (vatAccountEntry) {
                        vatAccountEntry.transactions.push({
                            date: txDate,
                            description: `VAT from: ${tx.description}`,
                            ref: allocatedTx.allocatedTo.value,
                            debit: allocatedTx.vatAmount < 0 ? -allocatedTx.vatAmount : 0,
                            credit: allocatedTx.vatAmount > 0 ? allocatedTx.vatAmount : 0,
                        });
                     }
                }

            } else { // Unallocated
                if (suspenseAccountId) {
                    const suspenseEntry = grouped.get(suspenseAccountId);
                    if (suspenseEntry) {
                        suspenseEntry.transactions.push({
                            date: txDate,
                            description: `Suspense: ${tx.description}`,
                            ref: tx.bankAccountId,
                            debit: tx.amount < 0 ? -tx.amount : 0,
                            credit: tx.amount > 0 ? tx.amount : 0,
                        });
                    }
                }
            }
        });
        
        grouped.forEach(group => {
            group.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
            let runningBalance = 0;
            group.transactions = group.transactions.map(tx => {
                runningBalance += tx.debit - tx.credit;
                return { ...tx, balance: runningBalance };
            });
            group.totalDebit = group.transactions.reduce((sum, tx) => sum + tx.debit, 0);
            group.totalCredit = group.transactions.reduce((sum, tx) => sum + tx.credit, 0);
        });

        return Array.from(grouped.values()).filter(g => g.transactions.length > 0);

    }, [transactions, accountsToDisplay, client.chartOfAccounts]);

    const handleDownloadExcel = () => {
        let excelData: any[] = [];
        
        groupedTransactions.forEach(group => {
            excelData.push({
                Date: `${group.account.accountNumber} - ${group.account.description}`,
            });

            excelData.push({
                Date: "Date",
                Description: "Description",
                Debit: "Debit",
                Credit: "Credit",
                Balance: "Balance",
            });

            group.transactions.forEach(tx => {
                excelData.push({
                    Date: format(tx.date, 'dd/MM/yyyy'),
                    Description: tx.description,
                    Debit: tx.debit,
                    Credit: tx.credit,
                    Balance: tx.balance,
                });
            });

            excelData.push({
                Date: "Totals",
                Description: "",
                Debit: group.totalDebit,
                Credit: group.totalCredit,
                Balance: "",
            });
            
            excelData.push({}); // Add a blank row for spacing
        });

        const worksheet = XLSX.utils.json_to_sheet(excelData, { skipHeader: true });
        worksheet['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
        Object.keys(worksheet).forEach(key => {
            if (key.startsWith('C') || key.startsWith('D') || key.startsWith('E')) {
                const cell = worksheet[key];
                if (cell.v !== null && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = 'R #,##0.00';
                }
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "General Ledger");

        const today = new Date().toISOString().split('T')[0];
        const fileName = `${client.companyName || client.name}-General-Ledger-${today}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    return (
        <>
            <div className="max-h-[70vh] overflow-y-auto space-y-6">
                {groupedTransactions.map(group => (
                    <div key={group.account.id}>
                        <h3 className="font-bold text-lg mb-2">{group.account.accountNumber} - {group.account.description}</h3>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Debit</TableHead>
                                    <TableHead className="text-right">Credit</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {group.transactions.map((tx, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{format(tx.date, 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(tx.debit)}</TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(tx.credit)}</TableCell>
                                        <TableCell className="text-right font-mono">{formatPrice(tx.balance)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={2} className="font-bold">Totals</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{formatPrice(group.totalDebit)}</TableCell>
                                    <TableCell className="text-right font-bold font-mono">{formatPrice(group.totalCredit)}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                ))}
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

export default function GeneralLedgerPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [fromAccount, setFromAccount] = useState<string | undefined>();
    const [toAccount, setToAccount] = useState<string | undefined>();


    useEffect(() => {
        const fetchClientData = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'numeraClients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
                    setClient(clientData);
                    setAccounts(clientData.chartOfAccounts?.sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)) || []);
                }
            } catch (error) {
                console.error("Error fetching client data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchClientData();
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
                    <CardTitle>General Ledger Report</CardTitle>
                    <CardDescription>
                        Filter and view the general ledger for a specific period.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                            <Label>Date Range</Label>
                            <DateRangePicker onDateChange={setDateRange} />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-[150px_1fr] items-center gap-4">
                            <Label>Account</Label>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <Select value={fromAccount} onValueChange={setFromAccount}>
                                    <SelectTrigger><SelectValue placeholder="(From Account)" /></SelectTrigger>
                                    <SelectContent>
                                        {isLoading ? <Loader2 className="animate-spin" /> : accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.accountNumber} - {acc.description}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Select value={toAccount} onValueChange={setToAccount}>
                                    <SelectTrigger><SelectValue placeholder="(To Account)" /></SelectTrigger>
                                    <SelectContent>
                                          {isLoading ? <Loader2 className="animate-spin" /> : accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.accountNumber} - {acc.description}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-start pt-4">
                             {isLoading ? (
                                <Loader2 className="animate-spin" />
                            ) : client ? (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button>View Report</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-4xl">
                                        <DialogHeader className="text-center mb-4">
                                            <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                            <DialogDescription>
                                                General Ledger {getReportDateString()}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <GeneralLedgerReport client={client} dateRange={dateRange} fromAccount={fromAccount} toAccount={toAccount} />
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <p>Client data could not be loaded.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


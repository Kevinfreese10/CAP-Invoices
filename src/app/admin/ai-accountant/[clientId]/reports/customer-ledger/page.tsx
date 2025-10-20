
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useState, useEffect, useMemo } from "react";
import { User, AllocatedTransaction, ImportedTransaction, ClientCustomer } from "@/lib/types";
import { getFirestore, doc, getDoc, collection, query, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, Download, Eye } from "lucide-react";
import { useParams } from 'next/navigation';
import { DateRange } from "react-day-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const db = getFirestore(firebaseApp);

const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
    }).format(price);
};

function CustomerLedgerReport({ 
    client, 
    customer, 
    transactions, 
    dateRange 
}: { 
    client: User;
    customer: ClientCustomer | undefined;
    transactions: (ImportedTransaction | AllocatedTransaction)[];
    dateRange?: DateRange;
}) {
    
    const customerTransactions = useMemo(() => {
        if (!customer) return [];
        let filtered = transactions.filter(tx => {
            const isInvoice = tx.reference?.startsWith('INV-') && tx.bankAccountId === 'JOURNAL' && tx.amount > 0;
            // This is a simplified check. A robust solution might need a direct customer link on transactions.
            // Here, we assume the description of the customer control account debit matches the invoice.
            return isInvoice && tx.description?.includes(customer.name);
        });

        if (dateRange?.from) {
            filtered = filtered.filter(tx => new Date(tx.date) >= dateRange.from!);
        }
        if (dateRange?.to) {
            filtered = filtered.filter(tx => new Date(tx.date) <= dateRange.to!);
        }
        return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, customer, dateRange]);

    const reportData = useMemo(() => {
        let runningBalance = 0;
        return customerTransactions.map(tx => {
            runningBalance += tx.amount;
            return {
                ...tx,
                balance: runningBalance
            };
        });
    }, [customerTransactions]);

    const totals = useMemo(() => {
        const totalDebits = reportData.reduce((sum, tx) => sum + (tx.amount > 0 ? tx.amount : 0), 0);
        const totalCredits = reportData.reduce((sum, tx) => sum + (tx.amount < 0 ? -tx.amount : 0), 0);
        return { totalDebits, totalCredits };
    }, [reportData]);

    const handleDownloadExcel = () => {
        const dataToExport = reportData.map(tx => ({
            'Date': format(new Date(tx.date), 'dd/MM/yyyy'),
            'Reference': tx.reference,
            'Description': tx.description,
            'Debit': tx.amount > 0 ? tx.amount : '',
            'Credit': tx.amount < 0 ? -tx.amount : '',
            'Balance': tx.balance,
        }));

        dataToExport.push({
            Date: 'Totals',
            Reference: '',
            Description: '',
            Debit: totals.totalDebits,
            Credit: totals.totalCredits,
            Balance: '',
        });

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        worksheet['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
        
        Object.keys(worksheet).forEach(key => {
             if (/[D-F]\d+/.test(key)) { // Debit, Credit, Balance columns
                const cell = worksheet[key];
                if (cell.v !== null && typeof cell.v === 'number') {
                    cell.t = 'n';
                    cell.z = 'R #,##0.00';
                }
            }
        });

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Customer Ledger");
        XLSX.writeFile(workbook, `${customer?.name}-Ledger.xlsx`);
    };

    return (
        <>
        <div className="max-h-[70vh] overflow-y-auto space-y-6">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Debit</TableHead>
                        <TableHead className="text-right">Credit</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {reportData.map((tx, index) => (
                        <TableRow key={index}>
                            <TableCell>{format(new Date(tx.date), 'dd/MM/yyyy')}</TableCell>
                            <TableCell>{tx.reference}</TableCell>
                            <TableCell>{tx.description}</TableCell>
                            <TableCell className="text-right font-mono">{formatPrice(tx.amount > 0 ? tx.amount : 0)}</TableCell>
                            <TableCell className="text-right font-mono">{formatPrice(tx.amount < 0 ? -tx.amount : 0)}</TableCell>
                            <TableCell className="text-right font-mono">{formatPrice(tx.balance)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                 <TableFooter>
                    <TableRow>
                        <TableCell colSpan={3} className="font-bold">Totals</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatPrice(totals.totalDebits)}</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatPrice(totals.totalCredits)}</TableCell>
                        <TableCell></TableCell>
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


export default function CustomerLedgerPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [transactions, setTransactions] = useState<(ImportedTransaction | AllocatedTransaction)[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();

    useEffect(() => {
        const fetchInitialData = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'aiAccountantClients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) setClient(clientSnap.data() as User);

                const customersQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`), orderBy("name"));
                const customersSnapshot = await getDocs(customersQuery);
                setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientCustomer)));
            } catch (error) {
                console.error("Error fetching initial data:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
        
        const transUnsubscribe = onSnapshot(query(collection(db, 'aiAccountantClients', clientId, 'transactions')), snapshot => {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as (ImportedTransaction | AllocatedTransaction)));
            setTransactions(fetched);
        });
        
        return () => transUnsubscribe();
    }, [clientId]);

    const selectedCustomer = useMemo(() => customers.find(c => c.id === selectedCustomerId), [customers, selectedCustomerId]);
    
    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Customer Ledger Report</CardTitle>
                    <CardDescription>View a detailed transaction history for a specific customer.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-6 max-w-4xl">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="grid gap-1.5">
                                <Label>Date Range</Label>
                                <DateRangePicker onDateChange={setDateRange} />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Customer</Label>
                                <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                                    <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
                                    <SelectContent>
                                        {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex justify-start pt-4">
                            {isLoading ? (
                                <Loader2 className="animate-spin" />
                            ) : client && selectedCustomer ? (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button disabled={!selectedCustomerId}><Eye className="mr-2 h-4 w-4"/>View Report</Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-4xl">
                                        <DialogHeader className="text-center mb-4">
                                            <DialogTitle className="text-lg">{client.companyName || client.name}</DialogTitle>
                                            <DialogDescription>Customer Ledger for {selectedCustomer.name}</DialogDescription>
                                        </DialogHeader>
                                        <CustomerLedgerReport 
                                            client={client} 
                                            customer={selectedCustomer}
                                            transactions={transactions} 
                                            dateRange={dateRange}
                                        />
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <p>Please select a customer to view the report.</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

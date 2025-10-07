
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
import { User, ChartOfAccount, VatType, Supplier, ImportedTransaction, AllocationRule, AllocatedTransaction } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch, Timestamp, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, add, sub, getMonth, getYear, startOfYear, endOfYear, startOfMonth, endOfMonth, addMonths, parse } from 'date-fns';
import { chartOfAccounts as initialChartOfAccounts } from '@/lib/chart-of-accounts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import * as XLSX from 'xlsx';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Papa from 'papaparse';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getAISuggestions } from '@/ai/flows/get-ai-suggestions';
import { allVatTypes as allVatTypesData } from '@/lib/vat-types';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Switch } from '@/components/ui/switch';
import { useRouter } from 'next/navigation';

const db = getFirestore(firebaseApp);

export default function NumeraWorkspacePage() {
    const [activeClient, setActiveClient] = useState<User | null>(null);
    const router = useRouter();
    const [allocatedTransactions, setAllocatedTransactions] = useState<AllocatedTransaction[]>([]);
    const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
     const [fromDate, setFromDate] = useState<Date | undefined>(startOfMonth(new Date()));
    const [toDate, setToDate] = useState<Date | undefined>(endOfMonth(new Date()));


    useEffect(() => {
        const clientData = sessionStorage.getItem('numera-active-client');
        if (clientData) {
            const client = JSON.parse(clientData);
            setActiveClient(client);
            if (client.chartOfAccounts) {
                setChartOfAccounts(client.chartOfAccounts);
            }
        } else {
            router.push('/admin/numera');
        }
    }, [router]);
    
    useEffect(() => {
        const fetchAllocatedTransactions = async () => {
            if (activeClient) {
                const q = query(collection(db, `clients/${activeClient.id}/allocatedTransactions`), orderBy('date'));
                const querySnapshot = await getDocs(q);
                const transactions = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: (doc.data().date.toDate ? doc.data().date.toDate() : new Date(doc.data().date)).toISOString(),
                } as AllocatedTransaction));
                setAllocatedTransactions(transactions);
            }
        };

        fetchAllocatedTransactions();
    }, [activeClient]);

    const handleGenerateTrialBalance = () => {
        if (!fromDate || !toDate) {
            alert('Please select a valid date range.');
            return;
        }

        const filteredTransactions = allocatedTransactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= fromDate && transactionDate <= toDate;
        });

        const accountBalances: { [key: string]: { debit: number, credit: number, description: string } } = {};

        filteredTransactions.forEach(t => {
            const account = chartOfAccounts.find(a => a.accountNumber === t.allocatedTo.value);
            if (!account) return;

            if (!accountBalances[account.accountNumber]) {
                accountBalances[account.accountNumber] = { debit: 0, credit: 0, description: account.description };
            }

            if (t.amount > 0) { // Assume income/credit
                 accountBalances[account.accountNumber].credit += t.amount;
            } else { // Assume expense/debit
                 accountBalances[account.accountNumber].debit += Math.abs(t.amount);
            }
        });
        
        const reportData = {
            clientName: activeClient?.name || 'N/A',
            fromDate: format(fromDate, 'dd MMM yyyy'),
            toDate: format(toDate, 'dd MMM yyyy'),
            data: Object.entries(accountBalances).map(([accountNumber, { debit, credit, description }]) => ({
                accountNumber,
                description,
                debit,
                credit,
            })).sort((a, b) => a.accountNumber.localeCompare(b.accountNumber)),
        };

        sessionStorage.setItem('trialBalanceReportData', JSON.stringify(reportData));
        window.open('/admin/numera/trial-balance-report', '_blank');
    };
    
    const handleGenerateGeneralLedger = () => {
        if (!fromDate || !toDate) {
            alert('Please select a valid date range.');
            return;
        }

        const filteredTransactions = allocatedTransactions.filter(t => {
            const transactionDate = new Date(t.date);
            return transactionDate >= fromDate && transactionDate <= toDate;
        });

        const generalLedgerData = filteredTransactions.map(t => {
            const account = chartOfAccounts.find(a => a.accountNumber === t.allocatedTo.value);
            const debit = t.amount < 0 ? Math.abs(t.amount) : 0;
            const credit = t.amount > 0 ? t.amount : 0;
            
            return {
                'Date': format(new Date(t.date), 'yyyy-MM-dd'),
                'Account Number': account?.accountNumber || 'N/A',
                'Account Description': account?.description || 'N/A',
                'Transaction Description': t.description,
                'Debit': debit,
                'Credit': credit,
                'VAT Type': t.vatType,
            };
        });
        
        const worksheet = XLSX.utils.json_to_sheet(generalLedgerData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'General Ledger');
        XLSX.writeFile(workbook, `General_Ledger_${activeClient?.name}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };


    if (!activeClient) {
        return (
            <div className="flex justify-center items-center h-screen">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }
    
    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{activeClient.name}</h1>
                    <p className="text-muted-foreground">Numera Workspace</p>
                </div>
                 <Button variant="outline" onClick={() => router.push('/admin/numera')}>Change Client</Button>
            </div>
            
             <Tabs defaultValue="transactions">
                <TabsList>
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="charts-of-accounts">Chart of Accounts</TabsTrigger>
                    <TabsTrigger value="allocation-rules">Allocation Rules</TabsTrigger>
                    <TabsTrigger value="reports">Reports</TabsTrigger>
                </TabsList>
                 <TabsContent value="transactions">
                     <Card>
                        <CardHeader>
                            <CardTitle>Import & Allocate</CardTitle>
                            <CardDescription>Upload a bank statement (CSV) and allocate your transactions.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="text-center py-10">
                                <p className="text-muted-foreground">The transaction workspace is under construction.</p>
                            </div>
                        </CardContent>
                    </Card>
                 </TabsContent>
                 <TabsContent value="charts-of-accounts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Chart of Accounts</CardTitle>
                            <CardDescription>Manage the general ledger accounts for this client.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">Chart of accounts management is under construction.</p>
                        </CardContent>
                    </Card>
                 </TabsContent>
                 <TabsContent value="allocation-rules">
                     <Card>
                        <CardHeader>
                            <CardTitle>Allocation Rules</CardTitle>
                            <CardDescription>Manage transaction allocation rules for this client.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <p className="text-muted-foreground">Allocation rules management is under construction.</p>
                        </CardContent>
                    </Card>
                 </TabsContent>
                  <TabsContent value="reports">
                     <Card>
                        <CardHeader>
                            <CardTitle>Financial Reports</CardTitle>
                            <CardDescription>Generate financial reports for this client.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                    <div className="space-y-2">
                                        <Label>From Date</Label>
                                         <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fromDate && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {fromDate ? format(fromDate, "dd MMMM yyyy") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={fromDate} onSelect={setFromDate} initialFocus /></PopoverContent>
                                        </Popover>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>To Date</Label>
                                         <Popover>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !toDate && "text-muted-foreground")}>
                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                    {toDate ? format(toDate, "dd MMMM yyyy") : <span>Pick a date</span>}
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={toDate} onSelect={setToDate} initialFocus /></PopoverContent>
                                        </Popover>
                                    </div>
                                </div>
                                <Separator />
                                <div className="flex gap-4">
                                    <Button onClick={handleGenerateTrialBalance}>
                                        <Printer className="mr-2 h-4 w-4" />
                                        Generate Trial Balance
                                    </Button>
                                    <Button onClick={handleGenerateGeneralLedger} variant="secondary">
                                         <Download className="mr-2 h-4 w-4" />
                                        Export General Ledger (CSV)
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                 </TabsContent>
            </Tabs>
        </div>
    )
}

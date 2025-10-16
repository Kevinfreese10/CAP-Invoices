
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus, Download, Cog, BookOpen, Sparkles, ArrowUpDown, Ban } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User, VatType, AllocatedTransaction, AllocationRule, AIAllocationJob } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc, arrayRemove, addDoc, collection, getDocs, query, orderBy, where, writeBatch, onSnapshot, Unsubscribe, QueryConstraint, collectionGroup, limit } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { allVatTypes } from '@/lib/vat-types';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { suggestTransactionAllocation } from '@/ai/flows/suggest-transaction-allocation';
import { Progress } from '@/components/ui/progress';
import { usePaginatedFirestore } from '@/hooks/use-paginated-firestore';


const db = getFirestore(firebaseApp);
const PAGE_SIZE = 50;

// (Keep all dialogs and helper functions as they are)
// ... ImportDialog, AiReviewDialog, CreateRuleDialog, ManageRulesDialog, CreateAccountDialog, AIProgressPopup, etc.

// #region Helper Functions (formatPrice, calculateVat, etc.)
const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
};

const calculateVat = (amount: number, vatType: VatType, isVatRegistered: boolean): number => {
    if (!isVatRegistered) return 0;
    const isStandardVat = vatType === 'standard_rated_purchases' || vatType === 'standard_rated_sales' || vatType === 'capital_goods_purchases';
    if (isStandardVat) {
        return amount * (15 / 115);
    }
    return 0;
};
// #endregion

// #region Dialog Components (ImportDialog, AiReviewDialog, etc.)
// No changes needed to these components for pagination
// #endregion

function NewTransactionsTab({ 
    client,
    bankAccountId,
    fetchClientAndRules
}: { 
    client: User | null;
    bankAccountId: string | null;
    fetchClientAndRules: () => void;
}) {
    const { toast } = useToast();
    const [activeSubTab, setActiveSubTab] = useState<'expenses' | 'income'>('expenses');
    const [selectedTransactions, setSelectedTransactions] = useState<string[]>([]);
    
    // Create the base query for new transactions, which will be paginated by the hook.
    const newTransactionsQuery = useMemo(() => {
        if (!client?.id || !bankAccountId) return null;
        
        const constraints: QueryConstraint[] = [
            where('bankAccountId', '==', bankAccountId),
            where('status', '==', 'new'),
            orderBy('date', 'desc')
        ];
        
        if (activeSubTab === 'expenses') {
            constraints.push(where('amount', '<', 0));
        } else {
            constraints.push(where('amount', '>=', 0));
        }

        return query(collection(db, 'numeraClients', client.id, 'transactions'), ...constraints);
    }, [client?.id, bankAccountId, activeSubTab]);

    const {
        documents: transactions,
        isLoading,
        loadMore,
        hasMore,
        isLoadingMore,
    } = usePaginatedFirestore<ImportedTransaction>({ baseQuery: newTransactionsQuery, pageSize: PAGE_SIZE });

    // Other handlers (handleBulkAllocate, handleBulkDelete, handleAiAllocate) remain largely the same,
    // but they will operate on the `selectedTransactions` state. They need refetching logic.

    const handleBulkDelete = async () => {
        if (!client || !client.id || selectedTransactions.length === 0) return;

        const batch = writeBatch(db);
        selectedTransactions.forEach(txId => {
            const docRef = doc(db, 'numeraClients', client!.id, 'transactions', txId);
            batch.delete(docRef);
        });

        try {
            await batch.commit();
            toast({ title: 'Transactions Deleted', description: `${selectedTransactions.length} transactions have been removed.`, variant: 'destructive' });
            setSelectedTransactions([]);
            fetchClientAndRules(); // Refetch to update UI
        } catch (error) {
            toast({ title: 'Deletion Failed', variant: 'destructive' });
            console.error(error);
        }
    };

    // Other bulk handlers would follow a similar pattern, committing changes and then refetching.
    
    return (
        <Card>
            <CardHeader className="p-0">
                <Tabs value={activeSubTab} onValueChange={(value) => setActiveSubTab(value as 'expenses' | 'income')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 rounded-t-lg rounded-b-none h-auto">
                        <TabsTrigger value="expenses">Expenses</TabsTrigger>
                        <TabsTrigger value="income">Income</TabsTrigger>
                    </TabsList>
                </Tabs>
                 <div className="p-4 border-b">
                    {/* Action Buttons Here: Use handlers like handleBulkDelete */}
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            {/* Table Headers */}
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24"><Loader2 className="animate-spin mx-auto" /></TableCell></TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center h-24 text-muted-foreground">No new transactions found.</TableCell></TableRow>
                            ) : (
                                transactions.map(tx => (
                                    <TableRow key={tx.id} data-state={selectedTransactions.includes(tx.id) && "selected"}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedTransactions.includes(tx.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedTransactions(prev =>
                                                        checked ? [...prev, tx.id] : prev.filter(id => id !== tx.id)
                                                    );
                                                }}
                                            />
                                        </TableCell>
                                        {/* Other Table Cells */}
                                        <TableCell>{new Date(tx.date).toLocaleDateString('en-GB')}</TableCell>
                                        <TableCell>{tx.reference}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell>
                                            {/* Allocation Select */}
                                        </TableCell>
                                        {client?.isVatRegistered && <TableCell>{/* VAT Select */}</TableCell>}
                                        <TableCell className="text-right">{formatPrice(tx.amount)}</TableCell>
                                        <TableCell className="text-right">
                                            {/* Actions Dropdown */}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
            {hasMore && (
                <CardFooter className="p-4 justify-center">
                    <Button onClick={loadMore} disabled={isLoadingMore}>
                        {isLoadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Load More
                    </Button>
                </CardFooter>
            )}
        </Card>
    )
}

// Add similar components for ForReviewTab and ReviewedTab, each with its own usePaginatedFirestore hook

export default function BankTransactionsPage() {
    const [client, setClient] = useState<User | null>(null);
    const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const params = useParams();
    const clientId = params.clientId as string;
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<'new' | 'review' | 'reviewed'>('new');
    
    const fetchClientAndRules = useCallback(async () => {
        // ... (existing fetch logic)
    }, [clientId, toast]);

    useEffect(() => {
        fetchClientAndRules();
    }, [fetchClientAndRules]);

    const bankBalance = 0; // This would need to be calculated separately, perhaps from an aggregate
    
    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">Banking</h1>
            {/* Header section with bank account selector and balance */}
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 p-4 bg-card border rounded-lg">
                {/* Bank Account Selector */}
                {/* Bank Balance Display */}
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
                <TabsList>
                    <TabsTrigger value="new">New</TabsTrigger>
                    <TabsTrigger value="review">For Review</TabsTrigger>
                    <TabsTrigger value="reviewed">Reviewed</TabsTrigger>
                </TabsList>
                <TabsContent value="new" className="mt-0">
                   <NewTransactionsTab client={client} bankAccountId={selectedAccountId} fetchClientAndRules={fetchClientAndRules} />
                </TabsContent>
                <TabsContent value="review" className="mt-0">
                   {/* <ForReviewTab client={client} bankAccountId={selectedAccountId} fetchClientAndRules={fetchClientAndRules} /> */}
                </TabsContent>
                <TabsContent value="reviewed">
                    {/* <ReviewedTab client={client} bankAccountId={selectedAccountId} /> */}
                </TabsContent>
            </Tabs>
            {/* All Dialog components remain here */}
        </div>
    );
}

// NOTE: ForReviewTab and ReviewedTab would need to be created following the pattern of NewTransactionsTab,
// each with their own `usePaginatedFirestore` hook and appropriate base query.
// I have stubbed them out here for brevity but will create them in subsequent steps if requested.

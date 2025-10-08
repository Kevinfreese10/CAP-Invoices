
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Banknote, FileUp, Loader2, PlusCircle, Search, Settings, Trash2, Edit, List, ArrowRightLeft, Paperclip, X, Plus, Minus } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { ImportedTransaction, ChartOfAccount, User } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Label } from '@/components/ui/label';


const db = getFirestore(firebaseApp);


const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
};

export default function BankTransactionsPage() {
  const [client, setClient] = useState<User | null>(null);
  const [bankAccounts, setBankAccounts] = useState<ChartOfAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const params = useParams();
  const clientId = params.clientId as string;
  const { toast } = useToast();

  const fetchClient = async () => {
    if (!clientId) return;
    setIsLoading(true);
    try {
        const clientRef = doc(db, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
            const clientData = { id: clientSnap.id, ...clientSnap.data() } as User;
            setClient(clientData);
            const cashbookAccounts = clientData.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('8400/')) || [];
            setBankAccounts(cashbookAccounts);
            if (cashbookAccounts.length > 0 && !selectedAccountId) {
                setSelectedAccountId(cashbookAccounts[0].id);
            }
        } else { toast({ title: 'Error', description: 'Client not found.', variant: 'destructive'}); }
    } catch (e) { toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive'});
    } finally { setIsLoading(false); }
  }
  
  useEffect(() => { fetchClient(); }, [clientId]);

  const transactions = useMemo(() => {
    if (!client || !selectedAccountId) return [];
    return client.importedTransactions?.filter(t => t.bankAccountId === selectedAccountId) || [];
  }, [client, selectedAccountId]);

  const bankBalance = useMemo(() => {
    if (!client || !selectedAccountId) return 0;
    return transactions.reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);
  
  const lastImportDate = useMemo(() => {
    if (!transactions || transactions.length === 0) return null;
    const latestTransaction = transactions.reduce((latest, current) => {
      return new Date(current.date) > new Date(latest.date) ? current : latest;
    });
    return new Date(latestTransaction.date).toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [transactions]);


  return (
    <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Banking</h1>
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8 p-4 bg-card border rounded-lg">
            <div className="flex items-center gap-2">
                <Label>Bank or Credit Card</Label>
                <Select value={selectedAccountId || ''} onValueChange={setSelectedAccountId}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="(None)" />
                    </SelectTrigger>
                    <SelectContent>
                        {bankAccounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>
                        ))}
                        <Separator />
                        <SelectItem value="create-new">Create new account...</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="text-center md:text-left">
                <p className="text-xl font-bold">{formatPrice(bankBalance)}</p>
                <p className="text-xs text-muted-foreground">Bank Balance</p>
            </div>
            <div className="text-center md:text-left">
                <p className="text-xl font-bold">{transactions.length}</p>
                <p className="text-xs text-muted-foreground">To be Reviewed</p>
                {lastImportDate && <p className="text-xs text-muted-foreground">Last import: {lastImportDate}</p>}
            </div>
        </div>

        <Tabs defaultValue="new">
            <TabsList>
                <TabsTrigger value="new">New Transactions</TabsTrigger>
                <TabsTrigger value="reviewed">Reviewed Transactions</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="mt-0">
                <Card>
                    <CardHeader className="p-4 border-b">
                        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                            <div className="flex items-center gap-2 flex-wrap">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Actions</Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem>Mark as Reviewed</DropdownMenuItem>
                                        <DropdownMenuItem>Delete</DropdownMenuItem>
                                        <DropdownMenuItem>Keep Duplicates</DropdownMenuItem>
                                        <DropdownMenuItem>Batch Edit</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <Button variant="ghost" size="sm" disabled>Mark as Reviewed</Button>
                                <Button variant="ghost" size="sm" disabled>Delete</Button>
                                <Button variant="ghost" size="sm" disabled>Keep Duplicates</Button>
                                <Button variant="ghost" size="sm" disabled>Batch Edit</Button>
                                <Button variant="default" size="sm">Import Bank Statements</Button>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link href="#" className="text-sm text-primary hover:underline">Shortcut Keys</Link>
                                <div className="relative">
                                    <Input placeholder="Search..." className="h-8 w-40 pr-8" />
                                    <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8"><Settings className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12 p-2"><Checkbox /></TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Selection</TableHead>
                                    <TableHead>Reference</TableHead>
                                    <TableHead>VAT</TableHead>
                                    <TableHead>Spent</TableHead>
                                    <TableHead>Received</TableHead>
                                    <TableHead>Rec.</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow><TableCell colSpan={11} className="text-center h-24"><Loader2 className="animate-spin" /></TableCell></TableRow>
                                ) : transactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center text-muted-foreground py-4">
                                            You have no new Bank Statement transactions to review. Import your Bank Statements or manually enter banking transactions below.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    transactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell className="p-2"><Checkbox/></TableCell>
                                            <TableCell>{tx.date}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell></TableCell>
                                            <TableCell>
                                                <Select>
                                                    <SelectTrigger className="h-8">
                                                        <SelectValue placeholder="Select account" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {client?.chartOfAccounts?.map(acc => (
                                                            <SelectItem key={acc.id} value={acc.id}>
                                                                {acc.accountNumber} - {acc.description}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </TableCell>
                                            <TableCell></TableCell>
                                            <TableCell></TableCell>
                                            <TableCell className="text-right">{tx.amount < 0 ? formatPrice(Math.abs(tx.amount)) : ''}</TableCell>
                                            <TableCell className="text-right">{tx.amount >= 0 ? formatPrice(tx.amount) : ''}</TableCell>
                                            <TableCell className="p-2"><Checkbox /></TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><List className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><ArrowRightLeft className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><Paperclip className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><X className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6"><Minus className="h-4 w-4" /></Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                                 <TableRow>
                                    <TableCell className="p-2"><Checkbox/></TableCell>
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell>
                                        <Select>
                                            <SelectTrigger className="h-8">
                                                <SelectValue placeholder="Select account" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {client?.chartOfAccounts?.map(acc => (
                                                    <SelectItem key={acc.id} value={acc.id}>
                                                        {acc.accountNumber} - {acc.description}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell><Input className="h-8" /></TableCell>
                                    <TableCell><Input className="h-8" placeholder="R" /></TableCell>
                                    <TableCell><Input className="h-8" placeholder="R" /></TableCell>
                                    <TableCell className="p-2"><Checkbox /></TableCell>
                                    <TableCell>
                                         <div className="flex items-center gap-1">
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><List className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><ArrowRightLeft className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><Paperclip className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><X className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="icon" className="h-6 w-6"><Minus className="h-4 w-4" /></Button>
                                        </div>
                                    </TableCell>
                                 </TableRow>
                            </TableBody>
                        </Table>
                        </div>
                    </CardContent>
                    <CardFooter className="p-4 border-t flex-wrap gap-2">
                        <Button>Save Changes</Button>
                        <Button variant="outline">Mark Selected as Reviewed</Button>
                        <Button variant="outline">Mark All as Reviewed</Button>
                    </CardFooter>
                </Card>
            </TabsContent>
            <TabsContent value="reviewed">
                <Card>
                    <CardContent className="p-6">
                        <p className="text-center text-muted-foreground">Reviewed transactions will appear here.</p>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
    </div>
  );
}


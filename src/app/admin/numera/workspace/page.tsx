
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
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, deleteDoc, query, where, writeBatch, Timestamp, orderBy, updateDoc } from 'firebase/firestore';
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

const accountSections: ChartOfAccount['section'][] = ['Income Statement', 'Balance Sheet'];

const accountFormSchema = z.object({
  id: z.string().optional(),
  accountNumber: z.string().regex(/^\d{4}\/\d{3}$/, 'Account number must be in XXXX/XXX format.'),
  description: z.string().min(3, 'Description is required.'),
  section: z.enum(accountSections),
});

function AccountForm({ account, onSubmit, onCancel }: { account: ChartOfAccount | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof accountFormSchema>>({
        resolver: zodResolver(accountFormSchema),
        defaultValues: {
            id: account?.id || '',
            accountNumber: account?.accountNumber || '',
            description: account?.description || '',
            section: account?.section || 'Income Statement',
        },
    });

    const handleSubmit = (values: z.infer<typeof accountFormSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="e.g. 1000/000" {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent>{accountSections.map(section => <SelectItem key={section} value={section}>{section}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Account</Button>
                </div>
            </form>
        </Form>
    )
}

function ChartOfAccountsTab({ client, onUpdate }: { client: User, onUpdate: (updatedData: Partial<User>) => Promise<void>}) {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>(client.chartOfAccounts || []);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartOfAccount | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setAccounts(client.chartOfAccounts || []);
  }, [client.chartOfAccounts]);

  const handleAdd = () => {
    setSelectedAccount(null);
    setIsFormOpen(true);
  };

  const handleEdit = (account: ChartOfAccount) => {
    setSelectedAccount(account);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (accountId: string) => {
    const updatedAccounts = accounts.filter(a => a.id !== accountId);
    try {
        await onUpdate({ chartOfAccounts: updatedAccounts });
        setAccounts(updatedAccounts);
        toast({ title: 'Account Deleted', variant: 'destructive' });
    } catch(e) {
        toast({ title: 'Error', description: 'Could not delete the account.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: Omit<ChartOfAccount, 'id'> & {id?: string}) => {
    let updatedAccounts;
    if (selectedAccount) {
      updatedAccounts = accounts.map(a => (a.id === selectedAccount.id ? { ...a, ...data, id: data.accountNumber } : a));
    } else {
      const newAccount = { ...data, id: data.accountNumber };
      updatedAccounts = [...accounts, newAccount].sort((a,b) => a.accountNumber.localeCompare(b.accountNumber));
    }
    
    try {
        await onUpdate({ chartOfAccounts: updatedAccounts });
        setAccounts(updatedAccounts);
        toast({ title: selectedAccount ? 'Account Updated' : 'Account Created' });
        setIsFormOpen(false);
        setSelectedAccount(null);
    } catch (e) {
        toast({ title: 'Error', description: 'Could not save the account.', variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    try {
        await onUpdate({ chartOfAccounts: initialChartOfAccounts });
        setAccounts(initialChartOfAccounts);
        toast({ title: 'Import Successful', description: 'Standard chart of accounts has been imported.' });
    } catch (e) {
        toast({ title: 'Error', description: 'Could not import the standard chart of accounts.', variant: 'destructive' });
    }
  };

    return (
    <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle>Chart of Accounts</CardTitle>
                    <CardDescription>Manage the general ledger accounts for this client.</CardDescription>
                </div>
                 <div className="flex gap-2">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Import Standard</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will replace this client's current chart of accounts with the standard template. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleImport}>Continue</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                        <DialogTrigger asChild><Button onClick={handleAdd}><PlusCircle className="mr-2 h-4 w-4" /> Add Account</Button></DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader><DialogTitle>{selectedAccount ? 'Edit Account' : 'Create Account'}</DialogTitle></DialogHeader>
                            <AccountForm account={selectedAccount} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} />
                        </DialogContent>
                    </Dialog>
                 </div>
            </div>
        </CardHeader>
        <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Account Number</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {accounts.map(account => (
                        <TableRow key={account.id}>
                            <TableCell className="font-mono">{account.accountNumber}</TableCell>
                            <TableCell className="font-medium">{account.description}</TableCell>
                            <TableCell>{account.section}</TableCell>
                            <TableCell className="text-right">
                                <AlertDialog>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => handleEdit(account)}>Edit</DropdownMenuItem>
                                            <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem></AlertDialogTrigger>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete the account: {account.description}.</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(account.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </CardContent>
    </Card>
    );
}


const ruleFormSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['hard', 'soft']).default('hard'),
  description: z.string().min(5, 'Description is required.'),
  keywords: z.string().optional(),
  accountId: z.string().min(1, 'Please select an account.'),
  vatType: z.custom<VatType>(),
});

function RuleForm({ rule, allAccounts, onSubmit, onCancel }: { rule: AllocationRule | null, allAccounts: ChartOfAccount[], onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof ruleFormSchema>>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: {
            id: rule?.id || '',
            type: rule?.type || 'hard',
            description: rule?.description || '',
            keywords: rule?.keywords.join(', ') || '',
            accountId: rule?.accountId || '',
            vatType: rule?.vatType || 'no_vat',
        },
    });

    const ruleType = form.watch('type');

    const handleSubmit = (values: z.infer<typeof ruleFormSchema>) => {
        const keywords = values.type === 'hard' ? values.keywords?.split(',').map(k => k.trim()).filter(Boolean) : [];
        onSubmit({ ...values, keywords });
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="type" render={({ field }) => ( <FormItem> <FormLabel>Rule Type</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}> <FormControl> <SelectTrigger> <SelectValue placeholder="Select a rule type" /> </SelectTrigger> </FormControl> <SelectContent> <SelectItem value="hard"> <div className="flex items-center gap-2"><HardHat className="h-4 w-4"/> Hard Rule (Keywords)</div> </SelectItem> <SelectItem value="soft"> <div className="flex items-center gap-2"><Feather className="h-4 w-4"/> Soft Rule (Conceptual)</div> </SelectItem> </SelectContent> </Select> <FormMessage /> </FormItem> )} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder={ruleType === 'hard' ? "e.g. Catches all bank fees" : "e.g. All fast food purchases"} {...field} /></FormControl><FormMessage /></FormItem>)} />
                {ruleType === 'hard' && ( <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Input placeholder="e.g., Telkom, Bank Fee, Fees" {...field} /></FormControl><FormMessage /></FormItem>)} /> )}
                <FormField control={form.control} name="accountId" render={({ field }) => ( <FormItem><FormLabel>Allocate to Account</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl><SelectContent>{allAccounts.map(account => <SelectItem key={account.id} value={account.accountNumber}>{account.accountNumber} - {account.description}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypesData.map(vat => <SelectItem key={vat.name} value={vat.name}>{vat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Rule</Button>
                </div>
            </form>
        </Form>
    )
}

function AllocationRulesTab({ client, onUpdate }: { client: User, onUpdate: (updatedData: Partial<User>) => Promise<void>}) {
    const [rules, setRules] = useState<AllocationRule[]>(client.allocationRules || []);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedRule, setSelectedRule] = useState<AllocationRule | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        setRules(client.allocationRules || []);
    }, [client.allocationRules]);

    const handleAdd = () => {
        setSelectedRule(null);
        setIsFormOpen(true);
    };

    const handleEdit = (rule: AllocationRule) => {
        setSelectedRule(rule);
        setIsFormOpen(true);
    };

    const handleDelete = async (ruleId: string) => {
        const updatedRules = rules.filter(r => r.id !== ruleId);
        try {
            await onUpdate({ allocationRules: updatedRules });
            setRules(updatedRules);
            toast({ title: 'Rule Deleted', variant: 'destructive' });
        } catch (e) {
            toast({ title: 'Error', description: 'Could not delete the rule.', variant: 'destructive' });
        }
    };

    const handleFormSubmit = async (data: Omit<AllocationRule, 'id'> & { id?: string }) => {
        let updatedRules;
        if (selectedRule) {
            updatedRules = rules.map(r => (r.id === selectedRule.id ? { ...r, ...data, id: selectedRule.id } : r));
        } else {
            const newRule = { ...data, id: `rule-${Date.now()}` };
            updatedRules = [...rules, newRule];
        }

        try {
            await onUpdate({ allocationRules: updatedRules });
            setRules(updatedRules);
            toast({ title: selectedRule ? 'Rule Updated' : 'Rule Created' });
            setIsFormOpen(false);
            setSelectedRule(null);
        } catch (e) {
            toast({ title: 'Error', description: 'Could not save the rule.', variant: 'destructive' });
        }
    };
    
    const handleImportMaster = async () => {
        try {
            const masterRulesSnapshot = await getDocs(collection(db, "allocationRules"));
            const masterRules = masterRulesSnapshot.docs.map(doc => doc.data() as AllocationRule);
            await onUpdate({ allocationRules: masterRules });
            setRules(masterRules);
            toast({ title: 'Master Rules Imported', description: 'The client\'s allocation rules have been reset to the master list.' });
        } catch (error) {
            console.error("Error importing master rules:", error);
            toast({ title: 'Error', description: 'Could not import master rules.', variant: 'destructive' });
        }
    };

    const getAccountDescription = (accountId: string) => client.chartOfAccounts?.find(a => a.accountNumber === accountId)?.description || 'N/A';
    const getVatLabel = (vatType: VatType) => allVatTypesData.find(v => v.name === vatType)?.label || 'N/A';

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Allocation Rules</CardTitle>
                        <CardDescription>Manage transaction allocation rules for this client.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Import Master</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will replace this client's current allocation rules with the master template. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleImportMaster}>Continue</AlertDialogAction></AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                            <DialogTrigger asChild><Button onClick={handleAdd}><PlusCircle className="mr-2 h-4 w-4" /> Add Rule</Button></DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader><DialogTitle>{selectedRule ? 'Edit Rule' : 'Create New Rule'}</DialogTitle></DialogHeader>
                                <RuleForm rule={selectedRule} allAccounts={client.chartOfAccounts || []} onSubmit={handleFormSubmit} onCancel={() => setIsFormOpen(false)} />
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Rule</TableHead>
                            <TableHead>Allocated Account</TableHead>
                            <TableHead>VAT Type</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map(rule => (
                            <TableRow key={rule.id}>
                                <TableCell className="font-semibold max-w-xs">
                                    <div className="flex items-center gap-2">
                                        {rule.type === 'hard' ? <HardHat className="h-4 w-4 text-muted-foreground" /> : <Feather className="h-4 w-4 text-muted-foreground" />}
                                        <span className="capitalize">{rule.type} Rule</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>
                                    {rule.type === 'hard' && rule.keywords && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {rule.keywords.map(kw => <Badge key={kw} variant="secondary">{kw}</Badge>)}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>{getAccountDescription(rule.accountId)}</TableCell>
                                <TableCell>{getVatLabel(rule.vatType)}</TableCell>
                                <TableCell className="text-right">
                                    <AlertDialog>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onClick={() => handleEdit(rule)}>Edit</DropdownMenuItem>
                                                <AlertDialogTrigger asChild><DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem></AlertDialogTrigger>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this rule.</AlertDialogDescription></AlertDialogHeader>
                                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(rule.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

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

type GeneralLedgerReportData = {
    'Date': string;
    'Account Number': string;
    'Account Description': string;
    'Transaction Description': string;
    'Debit': number;
    'Credit': number;
    'VAT Type': VatType;
}[];

export default function NumeraWorkspacePage() {
    const [activeClient, setActiveClient] = useState<User | null>(null);
    const router = useRouter();
    const [allocatedTransactions, setAllocatedTransactions] = useState<AllocatedTransaction[]>([]);
    const [chartOfAccounts, setChartOfAccounts] = useState<ChartOfAccount[]>([]);
    const [fromDate, setFromDate] = useState<Date | undefined>(startOfMonth(new Date()));
    const [toDate, setToDate] = useState<Date | undefined>(endOfMonth(new Date()));
    const [trialBalanceData, setTrialBalanceData] = useState<TrialBalanceReportData | null>(null);
    const [generalLedgerData, setGeneralLedgerData] = useState<GeneralLedgerReportData | null>(null);
    const [isTrialBalanceOpen, setIsTrialBalanceOpen] = useState(false);
    const [isGeneralLedgerOpen, setIsGeneralLedgerOpen] = useState(false);
    const { toast } = useToast();

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
    
    useEffect(() => {
        fetchAllocatedTransactions();
    }, [activeClient]);

    const updateClientData = async (updatedData: Partial<User>) => {
        if (!activeClient) return;
        const clientRef = doc(db, 'clients', activeClient.id);
        await updateDoc(clientRef, updatedData);
        
        const newActiveClient = { ...activeClient, ...updatedData };
        setActiveClient(newActiveClient);
        sessionStorage.setItem('numera-active-client', JSON.stringify(newActiveClient));
    };

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

        setTrialBalanceData(reportData);
        setIsTrialBalanceOpen(true);
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

        const ledgerData = filteredTransactions.map(t => {
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
        
        setGeneralLedgerData(ledgerData);
        setIsGeneralLedgerOpen(true);
    };
    
    const handleDownloadGeneralLedger = () => {
        if (!generalLedgerData) return;
        const worksheet = XLSX.utils.json_to_sheet(generalLedgerData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'General Ledger');
        XLSX.writeFile(workbook, `General_Ledger_${activeClient?.name}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    };

    const formatCurrency = (value: number) => {
        return value.toLocaleString('en-ZA', { style: 'currency', currency: 'ZAR' });
    }

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
                    <ChartOfAccountsTab client={activeClient} onUpdate={updateClientData} />
                 </TabsContent>
                 <TabsContent value="allocation-rules">
                    <AllocationRulesTab client={activeClient} onUpdate={updateClientData} />
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
                                        Generate General Ledger
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                 </TabsContent>
            </Tabs>
            
            <Dialog open={isTrialBalanceOpen} onOpenChange={setIsTrialBalanceOpen}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Trial Balance: {trialBalanceData?.clientName}</DialogTitle>
                        <DialogDescription>
                            For the period: {trialBalanceData?.fromDate} to {trialBalanceData?.toDate}
                        </DialogDescription>
                    </DialogHeader>
                     {trialBalanceData && (
                        <div className="max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Account</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Debit</TableHead>
                                        <TableHead className="text-right">Credit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {trialBalanceData.data.map(item => (
                                        <TableRow key={item.accountNumber}>
                                            <TableCell className="font-mono">{item.accountNumber}</TableCell>
                                            <TableCell>{item.description}</TableCell>
                                            <TableCell className="text-right font-mono">{item.debit > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                            <TableCell className="text-right font-mono">{item.credit > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={2} className="font-bold text-base">Totals</TableCell>
                                        <TableCell className="text-right font-bold font-mono text-base">{formatCurrency(trialBalanceData.data.reduce((acc, item) => acc + item.debit, 0))}</TableCell>
                                        <TableCell className="text-right font-bold font-mono text-base">{formatCurrency(trialBalanceData.data.reduce((acc, item) => acc + item.credit, 0))}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                     )}
                     <DialogFooter>
                        <Button variant="outline" onClick={() => window.print()}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                     </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isGeneralLedgerOpen} onOpenChange={setIsGeneralLedgerOpen}>
                <DialogContent className="max-w-6xl">
                    <DialogHeader>
                        <DialogTitle>General Ledger</DialogTitle>
                        <DialogDescription>
                             For the period: {fromDate ? format(fromDate, 'dd MMM yyyy') : ''} to {toDate ? format(toDate, 'dd MMM yyyy') : ''}
                        </DialogDescription>
                    </DialogHeader>
                     {generalLedgerData && (
                        <div className="max-h-[60vh] overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Account</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Debit</TableHead>
                                        <TableHead className="text-right">Credit</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {generalLedgerData.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{item['Date']}</TableCell>
                                            <TableCell className="font-mono">{item['Account Number']}</TableCell>
                                            <TableCell>{item['Transaction Description']}</TableCell>
                                            <TableCell className="text-right font-mono">{item.Debit > 0 ? formatCurrency(item.Debit) : '-'}</TableCell>
                                            <TableCell className="text-right font-mono">{item.Credit > 0 ? formatCurrency(item.Credit) : '-'}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                     )}
                     <DialogFooter>
                        <Button onClick={handleDownloadGeneralLedger}>
                            <Download className="mr-2 h-4 w-4" /> Download as Excel
                        </Button>
                     </DialogFooter>
                </DialogContent>
            </Dialog>
            <style jsx global>{\`
                @media print {
                  body > *:not(.print-container *) {
                    display: none;
                  }
                  .print-container {
                    display: block;
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                  }
                }
            \`}</style>
        </div>
    )
}

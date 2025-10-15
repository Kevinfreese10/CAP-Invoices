
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { chartOfAccounts as masterChartOfAccounts, setMasterChartOfAccounts } from "@/lib/chart-of-accounts";
import { Input } from "@/components/ui/input";
import { useState, useMemo, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { ArrowLeft, PlusCircle, Edit, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getFirestore, collection, getDocs, query, orderBy, doc, setDoc, addDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { firebaseApp } from "@/lib/firebase";
import { AllocationRule, ChartOfAccount } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { allVatTypes } from "@/lib/vat-types";

const db = getFirestore(firebaseApp);

const ruleFormSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(3, "Description is required"),
  keywords: z.string().min(3, "At least one keyword is required"),
  accountId: z.string().min(1, "Please select an account to allocate to."),
  vatType: z.enum(allVatTypes.map(v => v.name) as [string, ...string[]]),
});

const accountFormSchema = z.object({
  accountNumber: z.string().min(1, "Account number is required."),
  description: z.string().min(3, "Description is required."),
  section: z.enum(['Income Statement', 'Balance Sheet']),
});
type AccountFormValues = z.infer<typeof accountFormSchema>;

function AccountForm({ onSave, onCancel }: { onSave: (data: AccountFormValues) => void, onCancel: () => void }) {
    const form = useForm<AccountFormValues>({
        resolver: zodResolver(accountFormSchema),
        defaultValues: {
            accountNumber: '',
            description: '',
            section: 'Income Statement',
        },
    });

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                <FormField control={form.control} name="accountNumber" render={({ field }) => ( <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="section" render={({ field }) => ( <FormItem><FormLabel>Section</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a section" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Income Statement">Income Statement</SelectItem><SelectItem value="Balance Sheet">Balance Sheet</SelectItem></SelectContent></Select><FormMessage /></FormItem> )} />
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Create Account</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

function RuleForm({ rule, onSave, onCancel, onCreateAccount }: {
    rule: Partial<AllocationRule> | null;
    onSave: (values: z.infer<typeof ruleFormSchema>) => void;
    onCancel: () => void;
    onCreateAccount: (account: ChartOfAccount) => void;
}) {
    const [isCreateAccountOpen, setIsCreateAccountOpen] = useState(false);
    const form = useForm<z.infer<typeof ruleFormSchema>>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: {
            id: rule?.id || '',
            description: rule?.description || '',
            keywords: rule?.keywords?.join(', ') || '',
            accountId: rule?.accountId || '',
            vatType: rule?.vatType || 'no_vat',
        }
    });
    
    const handleAccountSelect = (value: string) => {
        if (value === 'create-new') {
            setIsCreateAccountOpen(true);
        } else {
            form.setValue('accountId', value);
        }
    }

    const handleCreateAccount = (values: AccountFormValues) => {
        const newAccount = { ...values, id: values.accountNumber };
        onCreateAccount(newAccount);
        form.setValue('accountId', newAccount.id);
        setIsCreateAccountOpen(false);
    }

    return (
        <>
            <Dialog open={isCreateAccountOpen} onOpenChange={setIsCreateAccountOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Master Account</DialogTitle>
                    </DialogHeader>
                    <AccountForm onSave={handleCreateAccount} onCancel={() => setIsCreateAccountOpen(false)} />
                </DialogContent>
            </Dialog>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
                    <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Rule Description</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )}/>
                    <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem> )}/>
                    <FormField control={form.control} name="accountId" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Allocate To Account</FormLabel>
                            <Select onValueChange={handleAccountSelect} value={field.value}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="create-new" className="text-primary font-semibold">Create new account...</SelectItem>
                                    <Separator />
                                    {masterChartOfAccounts.map(acc => ( <SelectItem key={acc.id} value={acc.id}>{acc.accountNumber} - {acc.description}</SelectItem>))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}/>
                    <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                        <Button type="submit">Save Rule</Button>
                    </DialogFooter>
                </form>
            </Form>
        </>
    )
}

export default function NumeraSettingsPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [isRuleFormOpen, setIsRuleFormOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<Partial<AllocationRule> | null>(null);

    const fetchGlobalRules = async () => {
        setIsLoading(true);
        try {
            const rulesQuery = query(collection(db, "allocationRules"), orderBy("description"));
            const rulesSnapshot = await getDocs(rulesQuery);
            const fetchedRules = rulesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AllocationRule));
            setGlobalRules(fetchedRules);
        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch global allocation rules.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchGlobalRules();
    }, []);

    const filteredAccounts = useMemo(() => {
        if (!searchTerm) {
            return masterChartOfAccounts;
        }
        return masterChartOfAccounts.filter(account =>
            account.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            account.accountNumber.includes(searchTerm)
        );
    }, [searchTerm]);

    const getAccountDescription = (accountId: string) => {
        const account = masterChartOfAccounts.find(acc => acc.id === accountId);
        return account ? `${account.accountNumber} - ${account.description}` : accountId;
    }

    const handleOpenRuleForm = (rule: Partial<AllocationRule> | null) => {
        setEditingRule(rule);
        setIsRuleFormOpen(true);
    };

    const handleSaveRule = async (values: z.infer<typeof ruleFormSchema>) => {
        const ruleData = {
            description: values.description,
            keywords: values.keywords.split(',').map(k => k.trim().toLowerCase()),
            accountId: values.accountId,
            vatType: values.vatType,
            type: 'hard' as 'hard', // All user-created global rules are 'hard'
        };

        try {
            if (values.id) { // Editing existing rule
                const ruleRef = doc(db, 'allocationRules', values.id);
                await updateDoc(ruleRef, ruleData);
                toast({ title: 'Rule Updated' });
            } else { // Creating new rule
                await addDoc(collection(db, 'allocationRules'), ruleData);
                toast({ title: 'Rule Created' });
            }
            setIsRuleFormOpen(false);
            setEditingRule(null);
            fetchGlobalRules();
        } catch (error) {
            toast({ title: 'Save Failed', description: 'Could not save the rule.', variant: 'destructive'});
            console.error(error);
        }
    };
    
    const handleDeleteRule = async (ruleId: string) => {
        try {
            await deleteDoc(doc(db, "allocationRules", ruleId));
            toast({ title: 'Rule Deleted', variant: 'destructive' });
            fetchGlobalRules();
        } catch (error) {
            toast({ title: 'Delete Failed', description: 'Could not delete the rule.', variant: 'destructive'});
            console.error(error);
        }
    }

    const handleCreateMasterAccount = (newAccount: ChartOfAccount) => {
        setMasterChartOfAccounts([...masterChartOfAccounts, newAccount].sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)));
        toast({ title: "Account Created", description: `Account ${newAccount.description} has been added to the master list.`})
    }

    return (
        <div className="space-y-8">
             <div className="flex items-center justify-between">
                <div>
                     <h1 className="text-3xl font-bold tracking-tight">Numera Settings</h1>
                     <p className="text-muted-foreground">Manage the master data for the Numera module.</p>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/admin/numera">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Numera
                    </Link>
                </Button>
            </div>

            <Dialog open={isRuleFormOpen} onOpenChange={setIsRuleFormOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{editingRule?.id ? 'Edit' : 'Create'} Global Rule</DialogTitle>
                        <DialogDescription>This rule will be applied as a default to all new clients.</DialogDescription>
                    </DialogHeader>
                    <RuleForm 
                        rule={editingRule} 
                        onSave={handleSaveRule}
                        onCancel={() => setIsRuleFormOpen(false)} 
                        onCreateAccount={handleCreateMasterAccount}
                    />
                </DialogContent>
            </Dialog>

            <Tabs defaultValue="chart-of-accounts">
                <TabsList>
                    <TabsTrigger value="chart-of-accounts">Master Chart of Accounts</TabsTrigger>
                    <TabsTrigger value="allocation-rules">Global Allocation Rules</TabsTrigger>
                </TabsList>
                <TabsContent value="chart-of-accounts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Master Chart of Accounts</CardTitle>
                            <CardDescription>
                                This is the default chart of accounts used for all new Numera client profiles.
                            </CardDescription>
                            <Input
                                placeholder="Search by account name or number..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-sm mt-4"
                            />
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Account Number</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Section</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredAccounts.map((account) => (
                                        <TableRow key={account.id}>
                                            <TableCell className="font-mono">{account.accountNumber}</TableCell>
                                            <TableCell>{account.description}</TableCell>
                                            <TableCell>{account.section}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="allocation-rules">
                     <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>Global Allocation Rules</CardTitle>
                                    <CardDescription>
                                        These are the default rules applied to all new Numera clients for automatic transaction allocation.
                                    </CardDescription>
                                </div>
                                <Button size="sm" onClick={() => handleOpenRuleForm(null)}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Rule
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <Loader2 className="animate-spin mx-auto"/>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Description</TableHead>
                                            <TableHead>Keywords</TableHead>
                                            <TableHead>Allocated Account</TableHead>
                                            <TableHead>VAT Type</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {globalRules.map((rule) => (
                                            <TableRow key={rule.id}>
                                                <TableCell className="font-medium">{rule.description}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                                        {rule.keywords.map(kw => <Badge key={kw} variant="secondary">{kw}</Badge>)}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs">{getAccountDescription(rule.accountId)}</TableCell>
                                                <TableCell>{rule.vatType}</TableCell>
                                                <TableCell className="text-right">
                                                     <div className="flex items-center justify-end gap-1">
                                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpenRuleForm(rule)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the rule: "{rule.description}".</AlertDialogDescription></AlertDialogHeader>
                                                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteRule(rule.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

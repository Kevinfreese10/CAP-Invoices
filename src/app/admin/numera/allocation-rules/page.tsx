
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Loader2, HardHat, Feather } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AllocationRule, VatType, ChartOfAccount } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { chartOfAccounts } from '@/lib/chart-of-accounts';
import { allVatTypes } from '@/lib/vat-types';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const db = getFirestore(firebaseApp);


const formSchema = z.object({
  id: z.string().optional(),
  type: z.enum(['hard', 'soft']).default('hard'),
  description: z.string().min(5, 'Description is required.'),
  keywords: z.string().optional(),
  accountId: z.string().min(1, 'Please select an account.'),
  vatType: z.custom<VatType>(),
});

function RuleForm({ rule, onSubmit, onCancel }: { rule: AllocationRule | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
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

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        const keywords = values.type === 'hard' ? values.keywords?.split(',').map(k => k.trim()).filter(Boolean) : [];
        onSubmit({ ...values, keywords });
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Rule Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a rule type" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="hard">
                                        <div className="flex items-center gap-2"><HardHat className="h-4 w-4"/> Hard Rule (Keywords)</div>
                                    </SelectItem>
                                    <SelectItem value="soft">
                                        <div className="flex items-center gap-2"><Feather className="h-4 w-4"/> Soft Rule (Conceptual)</div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Input placeholder={ruleType === 'hard' ? "e.g. Catches all bank fees" : "e.g. All fast food purchases"} {...field} /></FormControl><FormMessage /></FormItem>)} />
                
                {ruleType === 'hard' && (
                    <FormField control={form.control} name="keywords" render={({ field }) => ( <FormItem><FormLabel>Keywords (comma-separated)</FormLabel><FormControl><Input placeholder="e.g., Telkom, Bank Fee, Fees" {...field} /></FormControl><FormMessage /></FormItem>)} />
                )}
                
                <FormField control={form.control} name="accountId" render={({ field }) => ( <FormItem><FormLabel>Allocate to Account</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl><SelectContent>{chartOfAccounts.map(account => <SelectItem key={account.id} value={account.accountNumber}>{account.accountNumber} - {account.description}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="vatType" render={({ field }) => ( <FormItem><FormLabel>VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select a VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vat => <SelectItem key={vat.name} value={vat.name}>{vat.label}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Rule</Button>
                </div>
            </form>
        </Form>
    )
}

export default function MasterAllocationRulesPage() {
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AllocationRule | null>(null);
  const { toast } = useToast();
  
  const fetchRules = async () => {
    setIsLoading(true);
    try {
        const querySnapshot = await getDocs(collection(db, "allocationRules"));
        const fetchedRules = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AllocationRule));
        setRules(fetchedRules);
    } catch (error) {
        console.error("Error fetching rules:", error);
        toast({ title: 'Error', description: 'Could not fetch allocation rules from the database.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleAdd = () => {
    setSelectedRule(null);
    setIsFormOpen(true);
  };

  const handleEdit = (rule: AllocationRule) => {
    setSelectedRule(rule);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (ruleId: string) => {
    try {
        await deleteDoc(doc(db, "allocationRules", ruleId));
        fetchRules();
        toast({
            title: 'Rule Deleted',
            description: 'The master allocation rule has been removed.',
            variant: 'destructive',
        });
    } catch (error) {
        console.error("Error deleting rule:", error);
        toast({ title: 'Error', description: 'Could not delete master rule.', variant: 'destructive' });
    }
  };

  const handleFormSubmit = async (data: Omit<AllocationRule, 'id'> & { id?: string }) => {
    const { id, ...ruleData } = data;
    try {
        if (id) {
            const ruleRef = doc(db, "allocationRules", id);
            await setDoc(ruleRef, ruleData, { merge: true });
            toast({ title: 'Rule Updated', description: 'The master rule has been successfully saved.'});
        } else {
            await addDoc(collection(db, "allocationRules"), ruleData);
            toast({ title: 'Rule Created', description: 'The new master allocation rule has been added.'});
        }
        fetchRules();
        setIsFormOpen(false);
        setSelectedRule(null);
    } catch (error) {
        console.error("Error saving rule:", error);
        toast({ title: 'Error', description: 'Could not save the master rule.', variant: 'destructive'});
    }
  };
  
  const getAccountDescription = (accountId: string) => {
      return chartOfAccounts.find(a => a.accountNumber === accountId)?.description || 'N/A';
  }
  
  const getVatLabel = (vatType: VatType) => {
      return allVatTypes.find(v => v.name === vatType)?.label || 'N/A';
  }

  return (
    <div className="space-y-8">
        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Master Allocation Rules</h1>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                    <Button onClick={handleAdd}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create New Rule
                    </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{selectedRule ? 'Edit Rule' : 'Create New Rule'}</DialogTitle>
                        <DialogDescription>
                            {selectedRule ? 'Update this master allocation rule.' : 'Create a master rule to automatically categorize transactions for new clients.'}
                        </DialogDescription>
                    </DialogHeader>
                    <RuleForm 
                        rule={selectedRule} 
                        onSubmit={handleFormSubmit}
                        onCancel={() => setIsFormOpen(false)}
                    />
            </DialogContent>
            </Dialog>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Master Transaction Allocation Rules</CardTitle>
                <CardDescription>These rules are copied to new clients in Numera upon creation.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                 ) : (
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
                                {rule.type === 'hard' && (
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
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                        <span className="sr-only">Open menu</span>
                                        <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onClick={() => handleEdit(rule)}>
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem className="text-destructive">
                                                Delete
                                            </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                    </DropdownMenuContent>
                                    </DropdownMenu>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This will permanently delete the master rule for keywords <span className="font-semibold">"{rule.keywords.join(', ')}"</span>.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(rule.id)}>
                                                Continue
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                 )}
            </CardContent>
        </Card>
    </div>
  );
}


'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, CalendarIcon } from 'lucide-react';
import { getFirestore, doc, addDoc, getDoc, collection, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ChartOfAccount, ClientCustomer, Supplier } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { allVatTypes } from '@/lib/vat-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const db = getFirestore(firebaseApp);

const journalLineSchema = z.object({
    date: z.date(),
    effect: z.enum(['Increase', 'Decrease']),
    customerId: z.string().optional(),
    supplierId: z.string().optional(),
    reference: z.string().optional(),
    description: z.string().min(1, "Description is required."),
    vatType: z.string(),
    exclusiveAmount: z.number().min(0, "Amount must be positive."),
    vatAmount: z.number(),
    inclusiveAmount: z.number(),
    affectingAccountId: z.string().min(1, "Affecting account is required."),
});

const formSchema = z.object({
  lines: z.array(journalLineSchema).min(1, "At least one journal line is required."),
});

type JournalFormValues = z.infer<typeof formSchema>;

export default function JournalsPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const clientId = params.clientId as string;
    const customerId = searchParams.get('customer');
    const supplierId = searchParams.get('supplier');
    const [client, setClient] = useState<User | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            lines: [{
                date: new Date(),
                effect: 'Increase',
                description: '',
                vatType: 'no_vat',
                exclusiveAmount: 0,
                vatAmount: 0,
                inclusiveAmount: 0,
                affectingAccountId: '',
                ...(customerId && { customerId: customerId }),
                ...(supplierId && { supplierId: supplierId }),
            }],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    });

    const watchedLines = form.watch("lines");

    useEffect(() => {
        const fetchRelatedData = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'aiAccountantClients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    setClient(clientSnap.data() as User);
                }

                const customersQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`));
                const customersSnapshot = await getDocs(customersQuery);
                setCustomers(customersSnapshot.docs.map(d => ({id: d.id, ...d.data()} as ClientCustomer)));

                const suppliersQuery = query(collection(db, `aiAccountantClients/${clientId}/suppliers`));
                const suppliersSnapshot = await getDocs(suppliersQuery);
                setSuppliers(suppliersSnapshot.docs.map(d => ({id: d.id, ...d.data()} as Supplier)));

            } catch (e) {
                toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchRelatedData();
    }, [clientId, toast]);
    
     const updateLineAmounts = (index: number) => {
        const line = form.getValues(`lines.${index}`);
        const vatRate = line.vatType === 'standard_rated_sales' || line.vatType === 'standard_rated_purchases' ? 0.15 : 0;
        const vatAmount = line.exclusiveAmount * vatRate;
        const inclusiveAmount = line.exclusiveAmount + vatAmount;
        form.setValue(`lines.${index}.vatAmount`, vatAmount);
        form.setValue(`lines.${index}.inclusiveAmount`, inclusiveAmount);
    };

    const onSubmit = async (data: JournalFormValues) => {
        if (!client) return;
        setIsLoading(true);
        
        try {
            const batch = writeBatch(db);
            const journalRef = `JNL-${Date.now()}`;

            const customerControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '8000-001')?.id;
            const supplierControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-000')?.id;
            
            if (!customerControlAccount || !supplierControlAccount) {
                toast({ title: 'Error', description: 'Customer or Supplier control account not found.', variant: 'destructive' });
                setIsLoading(false);
                return;
            }

            data.lines.forEach((line) => {
                let primaryAmount = line.inclusiveAmount;
                if (line.effect === 'Decrease') {
                    primaryAmount = -primaryAmount;
                }

                const primaryAccountId = line.customerId ? customerControlAccount : supplierControlAccount;
                const primaryActorName = line.customerId ? customers.find(c => c.id === line.customerId)?.name : suppliers.find(s => s.id === line.supplierId)?.name;

                // Entry for the Customer/Supplier control account
                const primaryRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(primaryRef, {
                    clientId: client.id,
                    date: line.date.toISOString(),
                    reference: line.reference || journalRef,
                    description: `Journal for ${primaryActorName}: ${line.description}`,
                    amount: primaryAmount,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: primaryAccountId, type: 'account' },
                    vatType: 'no_vat',
                    status: 'allocated',
                    allocatedAt: new Date(),
                });

                // Contra Entry
                const contraRef = doc(collection(db, 'aiAccountantClients', client.id, 'transactions'));
                batch.set(contraRef, {
                    clientId: client.id,
                    date: line.date.toISOString(),
                    reference: line.reference || journalRef,
                    description: line.description,
                    amount: -primaryAmount,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: line.affectingAccountId, type: 'account' },
                    vatType: line.vatType,
                    status: 'allocated',
                    allocatedAt: new Date(),
                });
            });

            await batch.commit();

            toast({ title: 'Journal Posted', description: 'The journal entry has been successfully recorded.' });
            form.reset({
                lines: [{
                    date: new Date(),
                    effect: 'Increase',
                    description: '',
                    vatType: 'no_vat',
                    exclusiveAmount: 0,
                    vatAmount: 0,
                    inclusiveAmount: 0,
                    affectingAccountId: '',
                    ...(customerId && { customerId: customerId }),
                    ...(supplierId && { supplierId: supplierId }),
                }],
            });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to post journal entry.', variant: 'destructive' });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Post Journals</CardTitle>
                        <CardDescription>Create manual journal entries. Each line represents a distinct entry.</CardDescription>
                    </div>
                    <Button>Import</Button>
                </div>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                         <div className="border rounded-lg overflow-x-auto">
                           <table className="min-w-full divide-y divide-gray-200">
                             <thead className="bg-gray-50">
                               <tr>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Effect</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{supplierId ? 'Supplier' : 'Customer'}</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reference</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VAT %</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Excl. VAT</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VAT</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Incl. VAT</th>
                                 <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Affecting Acc.</th>
                                 <th className="px-3 py-2"></th>
                               </tr>
                             </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                {fields.map((field, index) => (
                                   <tr key={field.id}>
                                        <td className="px-2 py-1 whitespace-nowrap">
                                            <FormField control={form.control} name={`lines.${index}.date`} render={({ field }) => ( <FormItem><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} size="sm" className="w-[150px] justify-start text-left font-normal h-8"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "dd/MM/yyyy") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover></FormItem> )}/>
                                        </td>
                                         <td className="px-2 py-1 whitespace-nowrap">
                                            <FormField control={form.control} name={`lines.${index}.effect`} render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-8 w-[120px]"><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="Increase">Increase</SelectItem><SelectItem value="Decrease">Decrease</SelectItem></SelectContent></Select></FormItem> )}/>
                                        </td>
                                         <td className="px-2 py-1 whitespace-nowrap">
                                             <FormField control={form.control} name={supplierId ? `lines.${index}.supplierId` : `lines.${index}.customerId`} render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Select..." /></SelectTrigger></FormControl><SelectContent>{(supplierId ? suppliers : customers).map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></FormItem> )}/>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.reference`} render={({ field }) => ( <Input className="h-8" {...field} /> )}/></td>
                                        <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.description`} render={({ field }) => ( <Input className="h-8" {...field} /> )}/></td>
                                        <td className="px-2 py-1 whitespace-nowrap">
                                            <FormField control={form.control} name={`lines.${index}.vatType`} render={({ field }) => ( <FormItem><Select onValueChange={(value) => { field.onChange(value); updateLineAmounts(index); }} defaultValue={field.value}><FormControl><SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select></FormItem> )}/>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.exclusiveAmount`} render={({ field }) => ( <Input type="number" className="h-8" {...field} onChange={(e) => {field.onChange(parseFloat(e.target.value) || 0); updateLineAmounts(index); }} /> )}/></td>
                                        <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.vatAmount`} render={({ field }) => ( <Input type="number" className="h-8 bg-muted" readOnly {...field} /> )}/></td>
                                        <td className="px-2 py-1 whitespace-nowrap"><FormField control={form.control} name={`lines.${index}.inclusiveAmount`} render={({ field }) => ( <Input type="number" className="h-8 bg-muted" readOnly {...field} /> )}/></td>
                                        <td className="px-2 py-1 whitespace-nowrap">
                                            <FormField control={form.control} name={`lines.${index}.affectingAccountId`} render={({ field }) => ( <FormItem><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Select account..." /></SelectTrigger></FormControl><SelectContent>{client?.chartOfAccounts?.filter(a => a.section === 'Income Statement').map(acc => ( <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>))}</SelectContent></Select></FormItem> )}/>
                                        </td>
                                        <td className="px-2 py-1 whitespace-nowrap">
                                            <Button type="button" size="icon" variant="ghost" onClick={() => append({ date: new Date(), effect: 'Increase', description: '', vatType: 'no_vat', exclusiveAmount: 0, vatAmount: 0, inclusiveAmount: 0, affectingAccountId: '', ...(customerId && { customerId: customerId }), ...(supplierId && { supplierId: supplierId })})}><Plus className="h-4 w-4 text-green-600" /></Button>
                                            <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)} disabled={fields.length <= 1}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                                        </td>
                                  </tr>
                                ))}
                             </tbody>
                           </table>
                         </div>
                         <CardFooter className="p-4 bg-muted rounded-b-lg mt-4 flex justify-end">
                             <Button type="submit" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Post Journals
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

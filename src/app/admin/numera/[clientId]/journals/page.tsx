
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
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { getFirestore, doc, updateDoc, arrayUnion, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, ChartOfAccount, AllocatedTransaction } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const db = getFirestore(firebaseApp);

const journalLineSchema = z.object({
    accountId: z.string().min(1, "Account is required."),
    debit: z.number().min(0).optional(),
    credit: z.number().min(0).optional(),
});

const journalFormSchema = z.object({
    date: z.date({ required_error: "A date is required." }),
    description: z.string().min(3, "Description is required."),
    lines: z.array(journalLineSchema).min(2, "At least two lines are required."),
}).refine(data => {
    const totalDebits = data.lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredits = data.lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    return Math.abs(totalDebits - totalCredits) < 0.01; // Allow for floating point inaccuracies
}, {
    message: "Total debits must equal total credits.",
    path: ["lines"],
});

type JournalFormValues = z.infer<typeof journalFormSchema>;

export default function JournalsPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const form = useForm<JournalFormValues>({
        resolver: zodResolver(journalFormSchema),
        defaultValues: {
            date: new Date(),
            description: '',
            lines: [
                { accountId: '', debit: 0, credit: 0 },
                { accountId: '', debit: 0, credit: 0 },
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lines",
    });
    
    const watchedLines = form.watch("lines");

    const totals = useMemo(() => {
        const totalDebits = watchedLines.reduce((sum, line) => sum + (Number(line.debit) || 0), 0);
        const totalCredits = watchedLines.reduce((sum, line) => sum + (Number(line.credit) || 0), 0);
        return { totalDebits, totalCredits, difference: totalDebits - totalCredits };
    }, [watchedLines]);

    useEffect(() => {
        const fetchClient = async () => {
            if (!clientId) return;
            setIsLoading(true);
            try {
                const clientRef = doc(db, 'numeraClients', clientId);
                const clientSnap = await getDoc(clientRef);
                if (clientSnap.exists()) {
                    setClient({ id: clientSnap.id, ...clientSnap.data() } as User);
                }
            } catch (e) {
                toast({ title: 'Error', description: 'Failed to fetch client data.', variant: 'destructive' });
            } finally {
                setIsLoading(false);
            }
        };
        fetchClient();
    }, [clientId, toast]);

    const onSubmit = async (data: JournalFormValues) => {
        if (!client) return;
        setIsLoading(true);
        
        try {
            const journalTransactions: AllocatedTransaction[] = data.lines.map((line, index) => ({
                id: `journal-${Date.now()}-${index}`,
                clientId: client.id,
                date: data.date.toISOString(),
                reference: 'MANUAL_JOURNAL',
                description: data.description,
                amount: (line.debit || 0) - (line.credit || 0),
                bankAccountId: 'JOURNAL', // Special identifier for journals
                allocatedTo: { value: line.accountId, type: 'account' },
                vatType: 'no_vat',
                vatAmount: 0,
                allocatedAt: new Date(),
            }));
            
            const clientRef = doc(db, 'numeraClients', client.id);
            await updateDoc(clientRef, {
                allocatedTransactions: arrayUnion(...journalTransactions)
            });

            toast({ title: 'Journal Posted', description: 'The journal entry has been successfully recorded.' });
            form.reset({
                date: new Date(),
                description: '',
                lines: [
                    { accountId: '', debit: 0, credit: 0 },
                    { accountId: '', debit: 0, credit: 0 },
                ],
            });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to post journal entry.', variant: 'destructive' });
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const formatPrice = (price: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Post a Journal</CardTitle>
                <CardDescription>Create a manual journal entry for {client?.name || 'this client'}.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField control={form.control} name="date" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} disabled={(date) => date > new Date() || date < new Date("1900-01-01")} initialFocus/></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                            <div className="md:col-span-2">
                                <FormField control={form.control} name="description" render={({ field }) => ( <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} placeholder="e.g., To record monthly salaries" /></FormControl><FormMessage /></FormItem> )}/>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {fields.map((field, index) => (
                                <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                                    <div className="col-span-6">
                                        <FormField control={form.control} name={`lines.${index}.accountId`} render={({ field }) => ( <FormItem><FormLabel className={index > 0 ? "hidden" : ""}>Account</FormLabel><FormControl><AccountSelector client={client} field={field} /></FormControl><FormMessage /></FormItem> )}/>
                                    </div>
                                    <div className="col-span-2">
                                        <FormField control={form.control} name={`lines.${index}.debit`} render={({ field }) => ( <FormItem><FormLabel className={index > 0 ? "hidden" : ""}>Debit</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)} /></FormControl><FormMessage /></FormItem> )}/>
                                    </div>
                                    <div className="col-span-2">
                                        <FormField control={form.control} name={`lines.${index}.credit`} render={({ field }) => ( <FormItem><FormLabel className={index > 0 ? "hidden" : ""}>Credit</FormLabel><FormControl><Input type="number" step="0.01" {...field} onChange={e => field.onChange(parseFloat(e.target.value) || 0)}/></FormControl><FormMessage /></FormItem> )}/>
                                    </div>
                                    <div className="col-span-2 flex justify-end">
                                        <Button type="button" variant="destructive" size="icon" onClick={() => remove(index)} disabled={fields.length <= 2}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', debit: 0, credit: 0 })}>
                            <Plus className="mr-2 h-4 w-4" /> Add Line
                        </Button>

                         {form.formState.errors.lines?.root && (
                            <FormMessage>{form.formState.errors.lines.root.message}</FormMessage>
                        )}
                        
                        <CardFooter className="p-4 bg-muted rounded-lg mt-4 flex justify-between items-center">
                            <div className="flex gap-8">
                                <div>
                                    <p className="text-sm">Total Debits</p>
                                    <p className="font-mono font-semibold">{formatPrice(totals.totalDebits)}</p>
                                </div>
                                 <div>
                                    <p className="text-sm">Total Credits</p>
                                    <p className="font-mono font-semibold">{formatPrice(totals.totalCredits)}</p>
                                </div>
                                 <div>
                                    <p className="text-sm">Difference</p>
                                    <p className={cn("font-mono font-semibold", totals.difference !== 0 && "text-destructive")}>{formatPrice(totals.difference)}</p>
                                </div>
                            </div>
                             <Button type="submit" disabled={isLoading || totals.difference !== 0}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Post Journal
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

function AccountSelector({ client, field }: { client: User | null; field: any }) {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                    {field.value ? client?.chartOfAccounts?.find(acc => acc.id === field.value)?.description : "Select account..."}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0">
                <Command>
                    <CommandInput placeholder="Search account..." />
                    <CommandEmpty>No account found.</CommandEmpty>
                    <CommandList>
                        {client?.chartOfAccounts?.map(acc => (
                            <CommandItem
                                key={acc.id}
                                value={`${acc.accountNumber} ${acc.description}`}
                                onSelect={() => {
                                    field.onChange(acc.id);
                                    setOpen(false);
                                }}
                            >
                                {acc.accountNumber} - {acc.description}
                            </CommandItem>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

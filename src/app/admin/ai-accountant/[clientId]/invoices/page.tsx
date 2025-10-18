
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
import { Loader2, Plus, Trash2, PlusCircle } from 'lucide-react';
import { getFirestore, doc, addDoc, getDoc, collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, Invoice, ClientCustomer } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const lineItemSchema = z.object({
    description: z.string().min(1, "Description is required."),
    quantity: z.preprocess((val) => Number(val), z.number().min(1)),
    rate: z.preprocess((val) => Number(val), z.number().min(0)),
});

const invoiceFormSchema = z.object({
    customerId: z.string().min(1, "Please select a customer."),
    invoiceDate: z.date({ required_error: "Invoice date is required." }),
    dueDate: z.date({ required_error: "Due date is required." }),
    lineItems: z.array(lineItemSchema).min(1, "At least one line item is required."),
    notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

export default function InvoicesPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceFormSchema),
        defaultValues: {
            invoiceDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            lineItems: [{ description: '', quantity: 1, rate: 0 }],
            notes: '',
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lineItems",
    });

    const watchedLines = form.watch("lineItems");
    
    const totals = useMemo(() => {
        const subtotal = watchedLines.reduce((sum, line) => sum + (line.quantity * line.rate), 0);
        const vat = subtotal * 0.15;
        const total = subtotal + vat;
        return { subtotal, vat, total };
    }, [watchedLines]);

    const fetchData = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                setClient({ id: clientSnap.id, ...clientSnap.data() } as User);
            }
            
            const customersQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`), orderBy("name"));
            const customersSnapshot = await getDocs(customersQuery);
            setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientCustomer)));
            
            const invoicesQuery = query(collection(db, `aiAccountantClients/${clientId}/invoices`), orderBy("invoiceDate", "desc"));
            const invoicesSnapshot = await getDocs(invoicesQuery);
            setInvoices(invoicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [clientId, toast]);

    const onSubmit = async (data: InvoiceFormValues) => {
        if (!client) return;
        
        try {
            const invoiceData: Omit<Invoice, 'id'> = {
                ...data,
                status: 'draft',
                subtotal: totals.subtotal,
                vat: totals.vat,
                total: totals.total,
                createdAt: new Date(),
            }
            await addDoc(collection(db, `aiAccountantClients/${clientId}/invoices`), invoiceData);

            toast({ title: 'Invoice Created', description: 'The new invoice has been saved as a draft.' });
            form.reset();
            fetchData(); // Refetch invoices after creating a new one
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to create invoice.', variant: 'destructive' });
            console.error(error);
        }
    };
    
    const formatPrice = (price: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Invoices</CardTitle>
                        <CardDescription>A list of invoices created for {client?.name}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         {isLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                         ) : (
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Customer</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Due Date</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                                No invoices created yet.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        invoices.map((invoice) => (
                                            <TableRow key={invoice.id}>
                                                <TableCell>{customers.find(c => c.id === invoice.customerId)?.name}</TableCell>
                                                <TableCell>{format(invoice.invoiceDate, "dd/MM/yyyy")}</TableCell>
                                                <TableCell>{format(invoice.dueDate, "dd/MM/yyyy")}</TableCell>
                                                <TableCell>{invoice.status}</TableCell>
                                                <TableCell className="text-right">{formatPrice(invoice.total)}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                             </Table>
                         )}
                    </CardContent>
                </Card>
            </div>
             <Card>
                <CardHeader>
                    <CardTitle>Create New Invoice</CardTitle>
                    <CardDescription>Generate a new invoice for a customer.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="customerId"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                    <FormLabel>Customer</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                            variant="outline"
                                            role="combobox"
                                            className={cn("w-full justify-between", !field.value && "text-muted-foreground")}
                                            >
                                            {field.value ? customers.find(c => c.id === field.value)?.name : "Select a customer"}
                                            </Button>
                                        </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0">
                                            <Command>
                                                <CommandInput placeholder="Search customer..."/>
                                                <CommandList>
                                                    <CommandEmpty>No customers found.</CommandEmpty>
                                                    {customers.map(c => (
                                                        <CommandItem key={c.id} onSelect={() => { form.setValue("customerId", c.id) }}>{c.name}</CommandItem>
                                                    ))}
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField control={form.control} name="invoiceDate" render={({ field }) => ( <FormItem><FormLabel>Invoice Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                                <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem><FormLabel>Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                            </div>

                            <div className="space-y-2">
                                <FormLabel>Line Items</FormLabel>
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-12 gap-2 items-start border p-2 rounded-md">
                                        <div className="col-span-12"><FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => ( <FormItem><FormControl><Textarea placeholder="Description" {...field} rows={1} className="text-xs"/></FormControl><FormMessage /></FormItem> )}/></div>
                                        <div className="col-span-4"><FormField control={form.control} name={`lineItems.${index}.quantity`} render={({ field }) => ( <FormItem><FormControl><Input type="number" placeholder="Qty" {...field} className="text-xs" /></FormControl><FormMessage /></FormItem> )}/></div>
                                        <div className="col-span-5"><FormField control={form.control} name={`lineItems.${index}.rate`} render={({ field }) => ( <FormItem><FormControl><Input type="number" step="0.01" placeholder="Rate" {...field} className="text-xs" /></FormControl><FormMessage /></FormItem> )}/></div>
                                        <div className="col-span-3 flex justify-end items-center h-full">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </div>
                                    </div>
                                ))}
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', quantity: 1, rate: 0 })}>
                                    <Plus className="mr-2 h-4 w-4" /> Add Line
                                </Button>
                            </div>
                            
                            <CardFooter className="p-4 bg-muted rounded-lg mt-4 flex flex-col items-end gap-2">
                                <div className="flex justify-between w-full text-sm"><span className="text-muted-foreground">Subtotal:</span><span>{formatPrice(totals.subtotal)}</span></div>
                                <div className="flex justify-between w-full text-sm"><span className="text-muted-foreground">VAT (15%):</span><span>{formatPrice(totals.vat)}</span></div>
                                <div className="flex justify-between w-full font-bold text-lg"><span >Total:</span><span>{formatPrice(totals.total)}</span></div>
                            </CardFooter>

                             <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} placeholder="Optional notes to appear on the invoice" /></FormControl><FormMessage /></FormItem> )}/>
                            
                             <Button type="submit" disabled={isLoading} className="w-full">
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4"/>}
                                Create Invoice
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

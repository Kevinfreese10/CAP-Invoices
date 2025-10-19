
'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash2, CalendarIcon, PlusCircle, MoreHorizontal, Eye, Copy, FileText, Mail, Download, CheckCircle } from 'lucide-react';
import { getFirestore, doc, addDoc, getDoc, collection, query, orderBy, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { User, Invoice, ClientCustomer, ChartOfAccount, AllocatedTransaction } from '@/lib/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { allVatTypes } from '@/lib/vat-types';
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import InvoicePreview from '@/components/admin/InvoicePreview';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { createRoot } from 'react-dom/client';

const lineItemSchema = z.object({
    accountId: z.string().min(1, "Please select an account."),
    description: z.string().min(1, "Description is required."),
    quantity: z.preprocess((val) => Number(val), z.number().min(1)),
    rate: z.preprocess((val) => Number(val), z.number().min(0)),
    vatType: z.string().default('standard_rated_sales'),
});

const invoiceFormSchema = z.object({
    customerId: z.string().min(1, "Please select a customer."),
    invoiceDate: z.date({ required_error: "Invoice date is required." }),
    dueDate: z.date({ required_error: "Due date is required." }),
    lineItems: z.array(lineItemSchema).min(1, "At least one line item is required."),
    notes: z.string().optional(),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

const formatPrice = (price: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);

export default function InvoicesPage() {
    const params = useParams();
    const clientId = params.clientId as string;
    const [client, setClient] = useState<User | null>(null);
    const [customers, setCustomers] = useState<ClientCustomer[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
    const invoicePreviewRef = useRef<HTMLDivElement>(null);


    const handleDownloadPdf = async (invoiceToDownload: Invoice) => {
        const customer = customers.find(c => c.id === invoiceToDownload.customerId);
        if (!client || !customer) {
            toast({ title: "Error", description: "Cannot generate PDF without client or customer data.", variant: "destructive" });
            return;
        }

        const element = document.createElement("div");
        element.style.position = 'absolute';
        element.style.left = '-9999px';
        document.body.appendChild(element);
        
        const root = createRoot(element);
        root.render(<InvoicePreview invoice={invoiceToDownload} client={client} customer={customer} />);

        await new Promise(resolve => setTimeout(resolve, 500)); 

        const canvas = await html2canvas(element.children[0] as HTMLElement, { scale: 2 });
        const data = canvas.toDataURL('image/png');
        
        const report = new jsPDF('portrait','pt','a4');
        const pdfWidth = report.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        report.addImage(data, 'PNG', 0, 0, pdfWidth, pdfHeight);
        report.save(`Invoice-${invoiceToDownload.id}.pdf`);
        
        root.unmount();
        document.body.removeChild(element);
    };

    const form = useForm<InvoiceFormValues>({
        resolver: zodResolver(invoiceFormSchema),
        defaultValues: {
            invoiceDate: new Date(),
            dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
            lineItems: [{ accountId: '', description: '', quantity: 1, rate: 0, vatType: 'standard_rated_sales' }],
            notes: '',
        },
    });

    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "lineItems",
    });

    const watchedLines = form.watch("lineItems");
    
    const totals = useMemo(() => {
        let subtotal = 0;
        let vat = 0;
        watchedLines.forEach(line => {
            const lineSubtotal = (line.quantity || 0) * (line.rate || 0);
            subtotal += lineSubtotal;
            if (line.vatType === 'standard_rated_sales') {
                vat += lineSubtotal * 0.15;
            }
        });
        const total = subtotal + vat;
        return { subtotal, vat, total };
    }, [watchedLines]);
    
    const handleAccountChange = (value: string, index: number) => {
        const selectedAccount = accounts.find(acc => acc.id === value);
        if (selectedAccount) {
            const currentLine = form.getValues(`lineItems.${index}`);
            const newVatType = selectedAccount.accountNumber === '1000-001' ? 'zero_rated_sales' : 'standard_rated_sales';
            update(index, {
                ...currentLine,
                accountId: value,
                description: currentLine.description || selectedAccount.description,
                vatType: newVatType
            });
        }
    };

    const fetchData = async () => {
        if (!clientId) return;
        setIsLoading(true);
        try {
            const clientRef = doc(db, 'aiAccountantClients', clientId);
            const clientSnap = await getDoc(clientRef);
            if (clientSnap.exists()) {
                const clientData = clientSnap.data() as User;
                setClient(clientData);
                setAccounts(clientData.chartOfAccounts?.filter(acc => acc.accountNumber.startsWith('1000-')).sort((a,b) => a.accountNumber.localeCompare(b.accountNumber)) || []);
            }
            
            const customersQuery = query(collection(db, `aiAccountantClients/${clientId}/customers`), orderBy("name"));
            const customersSnapshot = await getDocs(customersQuery);
            setCustomers(customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClientCustomer)));
            
            const invoicesQuery = query(collection(db, `aiAccountantClients/${clientId}/invoices`), orderBy("invoiceDate", "desc"));
            const invoicesSnapshot = await getDocs(invoicesQuery);
            setInvoices(invoicesSnapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return { 
                    id: docSnap.id, 
                    ...data,
                    invoiceDate: data.invoiceDate.toDate(),
                    dueDate: data.dueDate.toDate(),
                } as Invoice
            }));

        } catch (e) {
            toast({ title: 'Error', description: 'Failed to fetch data.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [clientId, toast]);

    const handleUpdateStatus = async (invoiceId: string, status: 'final') => {
        if (!client || !client.id) return;

        const invoiceToUpdate = invoices.find(inv => inv.id === invoiceId);
        if (!invoiceToUpdate) {
            toast({ title: 'Error', description: 'Invoice not found.', variant: 'destructive' });
            return;
        }

        try {
            // Update invoice status
            const invoiceRef = doc(db, 'aiAccountantClients', client.id, 'invoices', invoiceId);
            await updateDoc(invoiceRef, { status: status });

            // Post to GL if marking as final
            if (status === 'final') {
                const customerControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '8000-001')?.id;
                const vatControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008')?.id;

                if (!customerControlAccount || !vatControlAccount) {
                    throw new Error("Control accounts not found. Cannot post to GL.");
                }

                const transactions: Omit<AllocatedTransaction, 'id'>[] = [];
                transactions.push({
                    clientId: client.id,
                    date: invoiceToUpdate.invoiceDate.toISOString(),
                    reference: `INV-${invoiceId}`,
                    description: `Invoice to ${customers.find(c => c.id === invoiceToUpdate.customerId)?.name}`,
                    amount: invoiceToUpdate.total,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: customerControlAccount, type: 'account' },
                    vatType: 'no_vat',
                    vatAmount: 0,
                    allocatedAt: new Date(),
                });

                invoiceToUpdate.lineItems.forEach(line => {
                    const lineTotal = line.quantity * line.rate;
                    const vatAmount = line.vatType === 'standard_rated_sales' ? lineTotal * 0.15 : 0;
                    
                    transactions.push({
                        clientId: client.id!,
                        date: invoiceToUpdate.invoiceDate.toISOString(),
                        reference: `INV-${invoiceId}`,
                        description: line.description,
                        amount: -lineTotal,
                        bankAccountId: 'JOURNAL',
                        allocatedTo: { value: line.accountId, type: 'account' },
                        vatType: line.vatType as any,
                        vatAmount: 0,
                        allocatedAt: new Date(),
                    });

                    if (vatAmount > 0) {
                        transactions.push({
                            clientId: client.id!,
                            date: invoiceToUpdate.invoiceDate.toISOString(),
                            reference: `INV-${invoiceId}`,
                            description: `VAT on ${line.description}`,
                            amount: -vatAmount,
                            bankAccountId: 'JOURNAL',
                            allocatedTo: { value: vatControlAccount, type: 'account' },
                            vatType: 'no_vat',
                            vatAmount: 0,
                            allocatedAt: new Date(),
                        });
                    }
                });

                const clientRef = doc(db, 'aiAccountantClients', client.id);
                await updateDoc(clientRef, {
                    allocatedTransactions: arrayUnion(...transactions)
                });
            }

            toast({ title: 'Invoice Status Updated', description: 'The invoice is now final and posted.' });
            fetchData();
        } catch (error: any) {
            console.error("Error updating invoice:", error);
            toast({ title: 'Error', description: error.message || 'Failed to update invoice status.', variant: 'destructive' });
        }
    }

    const onSubmit = async (data: InvoiceFormValues) => {
        if (!client || !client.id) return;
        
        try {
            const invoiceRef = await addDoc(collection(db, `aiAccountantClients/${clientId}/invoices`), {
                ...data,
                status: 'final',
                subtotal: totals.subtotal,
                vat: totals.vat,
                total: totals.total,
                createdAt: new Date(),
            });

            const customerControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '8000-001')?.id;
            const vatControlAccount = client.chartOfAccounts?.find(acc => acc.accountNumber === '7000-008')?.id;

            if (!customerControlAccount || !vatControlAccount) {
                throw new Error("Control accounts not found in Chart of Accounts.");
            }

            // Create transactions for GL
            const transactions: Omit<AllocatedTransaction, 'id'>[] = [];

            // 1. Debit Customer Control
            transactions.push({
                clientId: client.id,
                date: data.invoiceDate.toISOString(),
                reference: `INV-${invoiceRef.id}`,
                description: `Invoice to ${customers.find(c => c.id === data.customerId)?.name}`,
                amount: totals.total,
                bankAccountId: 'JOURNAL',
                allocatedTo: { value: customerControlAccount, type: 'account' },
                vatType: 'no_vat',
                vatAmount: 0,
                allocatedAt: new Date(),
            });

            // 2. Credit Sales Accounts & VAT
            data.lineItems.forEach(line => {
                const lineTotal = line.quantity * line.rate;
                const vatAmount = line.vatType === 'standard_rated_sales' ? lineTotal * 0.15 : 0;

                // Credit Sales Account
                transactions.push({
                    clientId: client.id,
                    date: data.invoiceDate.toISOString(),
                    reference: `INV-${invoiceRef.id}`,
                    description: line.description,
                    amount: -lineTotal,
                    bankAccountId: 'JOURNAL',
                    allocatedTo: { value: line.accountId, type: 'account' },
                    vatType: line.vatType as any,
                    vatAmount: 0, // VAT is handled in a separate leg
                    allocatedAt: new Date(),
                });
                
                // Credit VAT Control
                if (vatAmount > 0) {
                    transactions.push({
                        clientId: client.id,
                        date: data.invoiceDate.toISOString(),
                        reference: `INV-${invoiceRef.id}`,
                        description: `VAT on ${line.description}`,
                        amount: -vatAmount,
                        bankAccountId: 'JOURNAL',
                        allocatedTo: { value: vatControlAccount, type: 'account' },
                        vatType: 'no_vat',
                        vatAmount: 0,
                        allocatedAt: new Date(),
                    });
                }
            });
            
            const clientRef = doc(db, 'aiAccountantClients', client.id);
            await updateDoc(clientRef, {
                allocatedTransactions: arrayUnion(...transactions)
            });

            toast({ title: 'Invoice Finalized', description: 'The invoice has been created and posted to the general ledger.' });
            form.reset({
                 invoiceDate: new Date(),
                 dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
                 lineItems: [{ accountId: '', description: '', quantity: 1, rate: 0, vatType: 'standard_rated_sales' }],
                 notes: '',
            });
            fetchData();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to create invoice.', variant: 'destructive' });
            console.error(error);
        }
    };
    
    const vatTypes = allVatTypes.filter(vt => vt.category === 'Output Tax');
    const getVatLabel = (vatName: string) => vatTypes.find(v => v.name === vatName)?.label;
    const getVatPercentage = (vatName: string) => (getVatLabel(vatName) || '').includes('15%');


    return (
        <Dialog onOpenChange={(isOpen) => !isOpen && setViewingInvoice(null)}>
            <div className="space-y-8">
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
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {invoices.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
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
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={() => setViewingInvoice(invoice)}>
                                                                    <Eye className="mr-2 h-4 w-4" />View
                                                                </DropdownMenuItem>
                                                            </DialogTrigger>
                                                            <DropdownMenuItem><Copy className="mr-2 h-4 w-4" />Duplicate</DropdownMenuItem>
                                                            <DropdownMenuItem><FileText className="mr-2 h-4 w-4" />Issue Credit Note</DropdownMenuItem>
                                                            <DropdownMenuItem><Mail className="mr-2 h-4 w-4" />Email to Client</DropdownMenuItem>
                                                            <DropdownMenuItem onSelect={() => handleDownloadPdf(invoice)}><Download className="mr-2 h-4 w-4" />Download as PDF</DropdownMenuItem>
                                                            {invoice.status !== 'final' && (
                                                                <DropdownMenuItem onSelect={() => handleUpdateStatus(invoice.id, 'final')}>
                                                                    <CheckCircle className="mr-2 h-4 w-4" /> Mark as Final
                                                                </DropdownMenuItem>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>

                <Separator />

                <Card>
                    <CardHeader>
                        <CardTitle>Create New Invoice</CardTitle>
                        <CardDescription>Generate a new invoice for a customer.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
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
                                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
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
                                        <FormField control={form.control} name="invoiceDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Invoice Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                                        <FormField control={form.control} name="dueDate" render={({ field }) => ( <FormItem className="flex flex-col"><FormLabel>Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem> )}/>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="hidden md:grid md:grid-cols-[2fr_3fr_1fr_1fr_1fr_1fr_1fr_0.5fr] gap-x-3 text-xs font-semibold px-2">
                                        <span className="text-left">Account</span>
                                        <span className="text-left">Description</span>
                                        <span className="text-center">Qty</span>
                                        <span className="text-center">Unit Price</span>
                                        <span className="text-center">Total</span>
                                        <span className="text-center">Tax Code</span>
                                        <span className="text-center">Tax</span>
                                        <span></span>
                                    </div>
                                    {fields.map((field, index) => {
                                        const line = watchedLines[index];
                                        const lineSubtotal = (line.quantity || 0) * (line.rate || 0);
                                        const taxAmount = getVatPercentage(line.vatType) ? lineSubtotal * 0.15 : 0;
                                        return (
                                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-[2fr_3fr_1fr_1fr_1fr_1fr_1fr_0.5fr] gap-x-3 gap-y-2 items-start p-2 border rounded-md">
                                                <FormField control={form.control} name={`lineItems.${index}.accountId`} render={({ field }) => ( <FormItem><FormLabel className="md:hidden">Account</FormLabel><Select onValueChange={(value) => handleAccountChange(value, index)} defaultValue={field.value}><FormControl><SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Account..." /></SelectTrigger></FormControl><SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.description}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem> )}/>
                                                <FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => ( <FormItem><FormLabel className="md:hidden">Description</FormLabel><FormControl><Input {...field} className="h-9 text-xs" /></FormControl><FormMessage /></FormItem> )}/>
                                                <FormField control={form.control} name={`lineItems.${index}.quantity`} render={({ field }) => ( <FormItem><FormLabel className="md:hidden">Qty</FormLabel><FormControl><Input type="number" {...field} className="h-9 text-xs text-center" /></FormControl><FormMessage /></FormItem> )}/>
                                                <FormField control={form.control} name={`lineItems.${index}.rate`} render={({ field }) => ( <FormItem><FormLabel className="md:hidden">Unit Price</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="h-9 text-xs text-right" /></FormControl><FormMessage /></FormItem> )}/>
                                                <FormItem><FormLabel className="md:hidden">Total</FormLabel><Input value={formatPrice(lineSubtotal)} readOnly className="h-9 text-xs text-right bg-muted" /></FormItem>
                                                <FormItem><FormLabel className="md:hidden">Tax Code</FormLabel><Input value={getVatLabel(line.vatType)} readOnly className="h-9 text-xs bg-muted text-center" /></FormItem>
                                                <FormItem><FormLabel className="md:hidden">Tax</FormLabel><Input value={formatPrice(taxAmount)} readOnly className="h-9 text-xs text-right bg-muted" /></FormItem>
                                                <div className="flex justify-end items-end h-9">
                                                    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    <Button type="button" variant="outline" size="sm" onClick={() => append({ accountId: '', description: '', quantity: 1, rate: 0, vatType: 'standard_rated_sales' })}>
                                        <Plus className="mr-2 h-4 w-4" /> Add Line
                                    </Button>
                                </div>
                                
                                <CardFooter className="p-4 bg-muted rounded-lg mt-4 flex flex-col items-end gap-2 max-w-sm ml-auto">
                                    <div className="flex justify-between w-full text-sm"><span className="text-muted-foreground">Subtotal:</span><span>{formatPrice(totals.subtotal)}</span></div>
                                    <div className="flex justify-between w-full text-sm"><span className="text-muted-foreground">VAT (15%):</span><span>{formatPrice(totals.vat)}</span></div>
                                    <div className="flex justify-between w-full font-bold text-lg"><span >Total:</span><span>{formatPrice(totals.total)}</span></div>
                                </CardFooter>

                                <FormField control={form.control} name="notes" render={({ field }) => ( <FormItem><FormLabel>Notes</FormLabel><FormControl><Textarea {...field} placeholder="Optional notes to appear on the invoice" /></FormControl><FormMessage /></FormItem> )}/>
                                
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4"/>}
                                    Create Invoice
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Tax Invoice Preview</DialogTitle>
                </DialogHeader>
                {viewingInvoice && (
                    <InvoicePreview 
                        ref={invoicePreviewRef}
                        invoice={viewingInvoice} 
                        client={client}
                        customer={customers.find(c => c.id === viewingInvoice.customerId)}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

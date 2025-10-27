

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where, addDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, Edit, Trash2, FileCheck2, Hourglass, CheckCircle2, Eye, Download, Sparkles } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { AllocationRule, ExtractedInvoice } from '@/lib/types';
import { allVatTypes } from '@/lib/vat-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const db = getFirestore(firebaseApp);

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  exclusiveAmount: z.preprocess((val) => Number(val), z.number()),
  vatAmount: z.preprocess((val) => Number(val), z.number()),
});

const formSchema = z.object({
  supplier: z.string().min(1, "Supplier name is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  commissionNumber: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  lineItems: z.array(lineItemSchema),
  invoiceTotal: z.preprocess((val) => Number(val), z.number()),
});

const ruleFormSchema = z.object({
  supplierName: z.string(),
  defaultVatType: z.enum(allVatTypes.map(v => v.name) as [string, ...string[]]),
});

function CreateRuleDialog({ open, onOpenChange, supplierName, onRuleCreated }: { open: boolean; onOpenChange: (open: boolean) => void; supplierName: string; onRuleCreated: () => void; }) {
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);
    const form = useForm<z.infer<typeof ruleFormSchema>>({
        resolver: zodResolver(ruleFormSchema),
        defaultValues: {
            supplierName: supplierName,
            defaultVatType: 'standard_rated_purchases',
        },
    });

    const handleSaveRule = async (values: z.infer<typeof ruleFormSchema>) => {
        setIsSaving(true);
        const newRule: Partial<AllocationRule> = {
            description: `Default VAT type for supplier: ${values.supplierName}`,
            keywords: [values.supplierName.toLowerCase()],
            // accountId is not strictly needed for this type of rule, but the type requires it
            // We can use a placeholder or a specific suspense account if needed
            accountId: 'supplier_vat_rule', 
            vatType: values.defaultVatType,
            type: 'hard',
            scope: 'global',
        };

        try {
            await addDoc(collection(db, 'allocationRules'), newRule);
            toast({ title: "Rule Created", description: `Default VAT type for ${values.supplierName} has been set.` });
            onRuleCreated();
            onOpenChange(false);
        } catch (error) {
            console.error("Error creating rule:", error);
            toast({ title: 'Error', description: 'Could not create the rule.', variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create Rule for {supplierName}</DialogTitle>
                    <DialogDescription>
                        Set a default VAT type for all future invoices from this supplier to improve processing accuracy.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSaveRule)} className="space-y-4">
                        <FormField control={form.control} name="supplierName" render={({ field }) => ( <FormItem><FormLabel>Supplier</FormLabel><FormControl><Input {...field} readOnly disabled /></FormControl></FormItem> )} />
                        <FormField control={form.control} name="defaultVatType" render={({ field }) => ( <FormItem><FormLabel>Default VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem>)}/>
                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Rule
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function EditInvoiceForm({ invoice, onSave, onCancel }: { invoice: ExtractedInvoice | null, onSave: (id: string, data: any) => void, onCancel: () => void }) {
    const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            supplier: invoice?.supplier || '',
            invoiceNumber: invoice?.invoiceNumber || '',
            commissionNumber: invoice?.commissionNumber || '',
            date: invoice?.date || '',
            lineItems: invoice?.lineItems || [],
            invoiceTotal: invoice?.invoiceTotal || 0,
        }
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "lineItems",
    });
    
    const watchedLineItems = useWatch({
        control: form.control,
        name: "lineItems",
    });

    const onSubmit = (data: z.infer<typeof formSchema>) => {
        if (invoice) {
            onSave(invoice.id, data);
        }
    };

    return (
        <>
            <CreateRuleDialog 
                open={isCreateRuleOpen}
                onOpenChange={setIsCreateRuleOpen}
                supplierName={invoice?.supplier || ''}
                onRuleCreated={() => { /* maybe refetch something if needed */ }}
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                    <div className="flex items-center justify-between gap-4">
                         <div className="grid grid-cols-2 gap-4 flex-grow">
                            <FormField control={form.control} name="supplier" render={({ field }) => ( <FormItem><FormLabel>Supplier</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                            <FormField control={form.control} name="invoiceNumber" render={({ field }) => ( <FormItem><FormLabel>Invoice Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        </div>
                        <Button type="button" variant="outline" size="sm" className="mt-8" onClick={() => setIsCreateRuleOpen(true)}>
                            <Sparkles className="mr-2 h-4 w-4" /> Create Rule
                        </Button>
                    </div>
                    <FormField control={form.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="commissionNumber" render={({ field }) => ( <FormItem><FormLabel>Commission Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    
                    <h4 className="font-medium">Line Items</h4>
                    <div className="space-y-2">
                        {fields.map((field, index) => {
                            const exclusive = watchedLineItems?.[index]?.exclusiveAmount || 0;
                            const vat = watchedLineItems?.[index]?.vatAmount || 0;
                            const inclusive = exclusive + vat;
                            return (
                            <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                                <FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => (<FormItem className="col-span-5"><FormLabel className={index > 0 ? "hidden": ""}>Description</FormLabel><FormControl><Textarea {...field} rows={1} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name={`lineItems.${index}.exclusiveAmount`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>Exclusive</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name={`lineItems.${index}.vatAmount`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>VAT</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                                <FormItem className="col-span-2">
                                    <FormLabel className={index > 0 ? "hidden": ""}>Inclusive</FormLabel>
                                    <Input type="number" value={inclusive.toFixed(2)} readOnly className="bg-muted" />
                                </FormItem>
                                <div className="col-span-1"><Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button></div>
                            </div>
                            )
                        })}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', exclusiveAmount: 0, vatAmount: 0 })}>Add Line</Button>
                    
                    <FormField control={form.control} name="invoiceTotal" render={({ field }) => ( <FormItem><FormLabel>Invoice Total</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
                    
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                        <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                </form>
            </Form>
        </>
    );
}

export default function ReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const { toast } = useToast();

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'pending_review'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            toast({ title: 'Error', description: 'Could not fetch invoices for review.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleSave = async (id: string, data: any) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, data);
            toast({ title: 'Invoice Updated', description: 'Your changes have been saved.' });
            setEditingInvoice(null);
            fetchInvoices();
        } catch (error) {
            console.error("Error updating invoice:", error);
            toast({ title: 'Error', description: 'Could not save changes.', variant: 'destructive'});
        }
    };
    
    const handleApprove = async (id: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'approved' });
            toast({ title: 'Invoice Approved', description: 'The invoice has been moved to the control sheet.' });
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not approve the invoice.', variant: 'destructive'});
        }
    };
    
    const handleDelete = async (id: string) => {
         try {
            await deleteDoc(doc(db, 'extractedInvoices', id));
            toast({ title: 'Invoice Deleted', description: 'The invoice has been removed.', variant: 'destructive'});
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the invoice.', variant: 'destructive'});
        }
    }

    const handleDownloadExcel = () => {
        const dataToExport = invoices.flatMap(invoice => 
            invoice.lineItems.map(item => ({
                'Invoice ID': invoice.id,
                'Supplier': invoice.supplier,
                'Invoice Number': invoice.invoiceNumber,
                'Commission Number': invoice.commissionNumber || '',
                'Invoice Date': invoice.date,
                'Line Item Description': item.description,
                'Exclusive Amount': item.exclusiveAmount,
                'VAT Amount': item.vatAmount,
                'Line Total': item.exclusiveAmount + item.vatAmount,
                'Invoice Total': invoice.invoiceTotal,
                'Status': invoice.status,
                'File Name': invoice.fileName,
            }))
        );

        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending Review Invoices');
        XLSX.writeFile(workbook, 'pending-review-invoices.xlsx');
    };

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Review Invoices</h1>
      <Card>
        <CardHeader>
            <div className="flex justify-between items-center">
                 <div>
                    <CardTitle>Extracted Invoices for Review</CardTitle>
                    <CardDescription>
                        Review, edit, and approve the data extracted from uploaded invoices. Approved invoices will be moved to the control sheet.
                    </CardDescription>
                </div>
                 <Button onClick={handleDownloadExcel} variant="outline" disabled={invoices.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Export to Excel
                </Button>
            </div>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No invoices are pending review.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Comm #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>File</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => (
                            <TableRow key={invoice.id}>
                                <TableCell>
                                    <Badge variant={'warning'}>
                                         <Hourglass className="mr-1 h-3 w-3" />
                                        {invoice.status.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                <TableCell>{invoice.invoiceNumber}</TableCell>
                                <TableCell>{invoice.commissionNumber}</TableCell>
                                <TableCell>{invoice.date}</TableCell>
                                <TableCell>
                                    <Button variant="link" className="p-0 h-auto" asChild>
                                        <Link href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                            {invoice.fileName}
                                        </Link>
                                    </Button>
                                </TableCell>
                                <TableCell className="text-right font-mono">R {invoice.invoiceTotal.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                     <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onSelect={() => handleApprove(invoice.id)}>
                                                <FileCheck2 className="mr-2 h-4 w-4" /> Approve
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                <Edit className="mr-2 h-4 w-4" /> Edit
                                            </DropdownMenuItem>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                    </DropdownMenuItem>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. This will permanently delete the invoice for {invoice.supplier}.</AlertDialogDescription></AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleDelete(invoice.id)}>Delete</AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>
      
      <Dialog open={!!editingInvoice} onOpenChange={(isOpen) => !isOpen && setEditingInvoice(null)}>
        <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
                <DialogTitle>Edit Invoice: {editingInvoice?.supplier}</DialogTitle>
                <DialogDescription>Review and correct the extracted data.</DialogDescription>
            </DialogHeader>
            <EditInvoiceForm 
                invoice={editingInvoice} 
                onSave={handleSave} 
                onCancel={() => setEditingInvoice(null)} 
            />
        </DialogContent>
      </Dialog>

    </div>
  );
}

    

    

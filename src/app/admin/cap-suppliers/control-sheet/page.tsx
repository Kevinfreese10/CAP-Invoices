

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, Edit, Trash2, CheckCircle2, FileCheck2, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { s38ChartOfAccounts, capChartOfAccounts } from '@/lib/cap-chart-of-accounts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import { render } from '@react-email/components';
import InvoiceRejectionEmail from '@/components/emails/InvoiceRejectionEmail';
import { ExtractedInvoice } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { format, nextFriday, addWeeks, addMonths, endOfMonth, isFriday, eachDayOfInterval, isLastDayOfMonth } from 'date-fns';


const db = getFirestore(firebaseApp);

type LineItem = {
    description: string;
    exclusiveAmount: number;
    vatAmount: number;
    accountId?: string;
    paye?: boolean;
}

const lineItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  exclusiveAmount: z.preprocess((val) => Number(val), z.number()),
  vatAmount: z.preprocess((val) => Number(val), z.number()),
  accountId: z.string().optional(),
  paye: z.boolean().optional(),
});

const formSchema = z.object({
  supplier: z.string().min(1, "Supplier name is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  commissionNumber: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  lineItems: z.array(lineItemSchema),
  invoiceTotal: z.preprocess((val) => Number(val), z.number()),
  expenseType: z.enum(['CAP', 'S38']).optional(),
  paymentBatch: z.string().optional(),
});

const rejectionFormSchema = z.object({
  rejectionReason: z.string().min(10, 'Please provide a detailed reason for rejection.'),
});


function getUpcomingFridays(): { value: string; label: string }[] {
    const fridays = [];
    const today = new Date();
    const nextMonthEnd = endOfMonth(addMonths(today, 1));
    
    const days = eachDayOfInterval({
        start: today,
        end: nextMonthEnd,
    });
    
    for (const day of days) {
        if (isFriday(day)) {
            const isMonthEndFriday = isLastDayOfMonth(day) || getMonth(addDays(day, 7)) !== getMonth(day);
            fridays.push({
                value: format(day, 'yyyy-MM-dd'),
                label: `${format(day, 'dd MMMM yyyy')}${isMonthEndFriday ? ' (Month End)' : ''}`,
            });
        }
    }

    // If today is a Friday, it might be missed by the loop starting "today".
    // Let's ensure it's included if it hasn't been already.
    if (isFriday(today) && !fridays.some(f => f.value === format(today, 'yyyy-MM-dd'))) {
        const isMonthEndFriday = isLastDayOfMonth(today) || getMonth(addDays(today, 7)) !== getMonth(today);
         fridays.unshift({
            value: format(today, 'yyyy-MM-dd'),
            label: `${format(today, 'dd MMMM yyyy')}${isMonthEndFriday ? ' (Month End)' : ''}`,
        });
    }

    return fridays;
}

function EditInvoiceForm({ invoice, onSave, onCancel }: { invoice: ExtractedInvoice | null, onSave: (id: string, data: any) => void, onCancel: () => void }) {
    const upcomingFridays = getUpcomingFridays();
    
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            supplier: invoice?.supplier || '',
            invoiceNumber: invoice?.invoiceNumber || '',
            commissionNumber: invoice?.commissionNumber || '',
            date: invoice?.date || '',
            lineItems: invoice?.lineItems.map(item => ({ ...item, paye: item.paye || false })) || [],
            invoiceTotal: invoice?.invoiceTotal || 0,
            expenseType: invoice?.expenseType || 'S38',
            paymentBatch: invoice?.paymentBatch || upcomingFridays[0]?.value,
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

    const invoiceTotal = useWatch({
        control: form.control,
        name: "invoiceTotal"
    });
    
    const expenseType = useWatch({
        control: form.control,
        name: 'expenseType',
    });

    const chartOfAccounts = expenseType === 'S38' ? s38ChartOfAccounts : capChartOfAccounts;
    
    const totals = useMemo(() => {
        const totalPayeDeduction = (watchedLineItems || []).reduce((acc, item) => {
            if (item.paye) {
                const inclusive = (item.exclusiveAmount || 0) + (item.vatAmount || 0);
                return acc + (inclusive * 0.25);
            }
            return acc;
        }, 0);

        const amountPayable = (invoiceTotal || 0) - totalPayeDeduction;

        return { totalPayeDeduction, amountPayable };
    }, [watchedLineItems, invoiceTotal]);


    const onSubmit = (data: z.infer<typeof formSchema>) => {
        if (invoice) {
            onSave(invoice.id, data);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-4">
                 <div className="grid grid-cols-2 gap-8">
                    <FormField
                        control={form.control}
                        name="expenseType"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                            <FormLabel>Expense Type</FormLabel>
                            <FormControl>
                                <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex items-center space-x-4"
                                >
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="CAP" /></FormControl>
                                    <FormLabel className="font-normal">CAP Expense</FormLabel>
                                </FormItem>
                                <FormItem className="flex items-center space-x-2 space-y-0">
                                    <FormControl><RadioGroupItem value="S38" /></FormControl>
                                    <FormLabel className="font-normal">S38 Expense</FormLabel>
                                </FormItem>
                                </RadioGroup>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                     <FormField
                        control={form.control}
                        name="paymentBatch"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                            <FormLabel>Payment Batch</FormLabel>
                            <FormControl>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select a payment date" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {upcomingFridays.map(friday => (
                                            <SelectItem key={friday.value} value={friday.value}>
                                                {friday.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                 </div>
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="supplier" render={({ field }) => ( <FormItem><FormLabel>Supplier</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    <FormField control={form.control} name="invoiceNumber" render={({ field }) => ( <FormItem><FormLabel>Invoice Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                 <FormField control={form.control} name="date" render={({ field }) => ( <FormItem><FormLabel>Date</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                 <FormField control={form.control} name="commissionNumber" render={({ field }) => ( <FormItem><FormLabel>Commission Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                
                <h4 className="font-medium">Line Items</h4>
                <div className="space-y-2">
                    {fields.map((field, index) => {
                        const lineItem = watchedLineItems?.[index];
                        const exclusive = lineItem?.exclusiveAmount || 0;
                        const vat = lineItem?.vatAmount || 0;
                        const inclusive = exclusive + vat;
                        const payeDeduction = lineItem?.paye ? inclusive * 0.25 : 0;
                        const lineTotal = inclusive - payeDeduction;

                        return (
                        <div key={field.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end border p-2 rounded-md">
                            <FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => (<FormItem className="md:col-span-12"><FormLabel className={index > 0 ? "hidden": ""}>Description</FormLabel><FormControl><Textarea {...field} rows={1} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name={`lineItems.${index}.exclusiveAmount`} render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>Exclusive</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                            <FormField control={form.control} name={`lineItems.${index}.vatAmount`} render={({ field }) => (<FormItem className="md:col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>VAT</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                            <FormItem className="md:col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>Inclusive</FormLabel><Input type="number" value={inclusive.toFixed(2)} readOnly className="bg-muted" /></FormItem>
                            <FormField control={form.control} name={`lineItems.${index}.paye`} render={({ field }) => ( <FormItem className="flex flex-col items-center justify-center h-full pb-1 md:col-span-1"><FormLabel className="text-xs">PAYE</FormLabel><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl></FormItem>)}/>
                            <FormItem className="md:col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>PAYE Deduction</FormLabel><Input type="number" value={payeDeduction.toFixed(2)} readOnly className="bg-muted text-red-600" /></FormItem>
                            <FormItem className="md:col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>Line Total</FormLabel><Input type="number" value={lineTotal.toFixed(2)} readOnly className="bg-muted font-semibold" /></FormItem>
                             <div className="md:col-span-1 flex justify-end"><Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button></div>
                            <FormField control={form.control} name={`lineItems.${index}.accountId`} render={({ field }) => (<FormItem className="md:col-span-12"><FormLabel className={index > 0 ? "hidden": ""}>Account</FormLabel> <Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select an account" /></SelectTrigger></FormControl><SelectContent>{chartOfAccounts.map((account) => (<SelectItem key={account.accountNumber} value={account.accountNumber}>{account.accountNumber} - {account.description}</SelectItem>))}</SelectContent></Select> <FormMessage /></FormItem>)} />
                        </div>
                        )
                    })}
                </div>
                 <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', exclusiveAmount: 0, vatAmount: 0, paye: false })}>Add Line</Button>
                
                <FormField control={form.control} name="invoiceTotal" render={({ field }) => ( <FormItem><FormLabel>Invoice Total</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem> )} />
                
                 <FormItem>
                    <FormLabel>Total PAYE Deductions</FormLabel>
                    <Input type="number" value={totals.totalPayeDeduction.toFixed(2)} readOnly className="bg-muted text-red-600 font-semibold" />
                </FormItem>

                <FormItem>
                    <FormLabel>Amount Payable</FormLabel>
                    <Input type="number" value={totals.amountPayable.toFixed(2)} readOnly className="bg-muted font-bold text-lg" />
                </FormItem>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                </DialogFooter>
            </form>
        </Form>
    );
}

export default function SecondReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const [rejectingInvoice, setRejectingInvoice] = useState<ExtractedInvoice | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();

     const rejectionForm = useForm<z.infer<typeof rejectionFormSchema>>({
        resolver: zodResolver(rejectionFormSchema),
        defaultValues: { rejectionReason: '' },
    });

    const fetchInvoices = async () => {
        setIsLoading(true);
        try {
            const q = query(collection(db, 'extractedInvoices'), where('status', '==', 'approved'), orderBy('createdAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
            setInvoices(fetchedInvoices);
        } catch (error) {
            console.error("Error fetching invoices:", error);
            toast({ title: 'Error', description: 'Could not fetch approved invoices.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        fetchInvoices();
    }, []);

    const handleSave = async (id: string, data: z.infer<typeof formSchema>) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            const dataToSave = {
                ...data,
                commissionNumber: data.commissionNumber || null,
                paymentBatch: data.paymentBatch || null,
                expenseType: data.expenseType || null,
            };
            await updateDoc(docRef, dataToSave);
            toast({ title: 'Invoice Updated', description: 'Your changes have been saved.' });
            setEditingInvoice(null);
            fetchInvoices();
        } catch (error) {
            console.error("Error updating invoice:", error);
            toast({ title: 'Error', description: 'Could not save changes.', variant: 'destructive'});
        }
    };
    
    const handleApproveForPayment = async (id: string) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'approved_for_payment' });
            toast({ title: 'Invoice Approved for Payment', description: 'The invoice has been moved to the payment control sheet.' });
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not approve for payment.', variant: 'destructive'});
        }
    };

     const handleReject = async (values: z.infer<typeof rejectionFormSchema>) => {
        if (!rejectingInvoice || !user) return;
        try {
            const docRef = doc(db, 'extractedInvoices', rejectingInvoice.id);
            await updateDoc(docRef, { 
                status: 'rejected',
                rejectionReason: values.rejectionReason 
            });
            
            const emailHtml = render(<InvoiceRejectionEmail invoice={rejectingInvoice} reason={values.rejectionReason} rejectedBy={user.name} />);

            await sendEmail({
                to: user.email,
                subject: `Invoice Rejected: ${rejectingInvoice.supplier} - #${rejectingInvoice.invoiceNumber}`,
                html: emailHtml,
            });

            toast({ title: 'Invoice Rejected', description: 'The invoice has been marked as rejected and an email sent.' });
            setRejectingInvoice(null);
            fetchInvoices();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not reject the invoice.', variant: 'destructive'});
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

    const getStatusBadge = (status: ExtractedInvoice['status']) => {
        switch(status) {
            case 'approved':
                return (
                    <Badge variant={'success'}>
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Approved
                    </Badge>
                );
            case 'approved_for_payment':
                 return (
                    <Badge variant={'payment'}>
                        <FileCheck2 className="mr-1 h-3 w-3" />
                        Approved for Payment
                    </Badge>
                );
             case 'rejected':
                return (
                    <Badge variant={'destructive'}>
                        <XCircle className="mr-1 h-3 w-3" />
                        Rejected
                    </Badge>
                );
            default:
                return <Badge>{status.replace('_', ' ')}</Badge>;
        }
    }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">2nd Review</h1>
      <Card>
        <CardHeader>
          <CardTitle>Approved Invoices</CardTitle>
          <CardDescription>
            These invoices have been reviewed and approved.
          </CardDescription>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No approved invoices yet.</p>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Payment Batch</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>File</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => {
                            const isApprovalDisabled = 
                                !invoice.paymentBatch || 
                                !invoice.expenseType || 
                                !invoice.lineItems.every(item => !!item.accountId) ||
                                invoice.status === 'approved_for_payment';

                            return (
                                <TableRow key={invoice.id}>
                                    <TableCell>
                                        {getStatusBadge(invoice.status)}
                                    </TableCell>
                                    <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                    <TableCell>{invoice.invoiceNumber}</TableCell>
                                    <TableCell>
                                        {invoice.paymentBatch ? (
                                            <Badge variant="outline">{format(new Date(invoice.paymentBatch), 'dd MMM yyyy')}</Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">Not set</span>
                                        )}
                                    </TableCell>
                                    <TableCell>{invoice.date}</TableCell>
                                    <TableCell>{invoice.fileName}</TableCell>
                                    <TableCell className="text-right font-mono">R {invoice.invoiceTotal.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent>
                                                <DropdownMenuItem onSelect={() => handleApproveForPayment(invoice.id)} disabled={isApprovalDisabled}>
                                                    <FileCheck2 className="mr-2 h-4 w-4" /> Approve for Payment
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                    <Edit className="mr-2 h-4 w-4" /> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onSelect={() => setRejectingInvoice(invoice)} className="text-destructive">
                                                    <XCircle className="mr-2 h-4 w-4" /> Reject
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
                            );
                        })}
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
      
      <Dialog open={!!rejectingInvoice} onOpenChange={(isOpen) => !isOpen && setRejectingInvoice(null)}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reject Invoice</DialogTitle>
                <DialogDescription>Provide a reason for rejecting this invoice from {rejectingInvoice?.supplier}. An email will be sent.</DialogDescription>
            </DialogHeader>
            <Form {...rejectionForm}>
                <form onSubmit={rejectionForm.handleSubmit(handleReject)} className="space-y-4">
                    <FormField
                        control={rejectionForm.control}
                        name="rejectionReason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reason for Rejection</FormLabel>
                                <FormControl><Textarea {...field} rows={4} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setRejectingInvoice(null)}>Cancel</Button>
                        <Button type="submit" variant="destructive">Reject Invoice</Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

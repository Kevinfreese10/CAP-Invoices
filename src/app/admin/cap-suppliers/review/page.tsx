
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where, addDoc, writeBatch, getDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, Edit, Trash2, FileCheck2, Hourglass, CheckCircle2, Eye, Download, Sparkles, Brain, AlertTriangle, AlertCircle, Mail, Archive, Paperclip, RefreshCw, Play, Lock, User as UserIcon, Upload } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
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
import { AllocationRule, ExtractedInvoice, FindStoryNameInput, FindStoryNameInputSchema, FindStoryNameOutput, FindStoryNameOutputSchema, User, Commission, VatType } from '@/lib/types';
import { reanalyzeInvoice } from '@/ai/flows/extract-invoice-data';
import { allVatTypes } from '@/lib/vat-types';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { sendEmail } from '@/lib/email';
import InvoiceRejectionEmail from '@/components/emails/InvoiceRejectionEmail';
import { render } from '@react-email/components';

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
  storyName: z.string().optional(),
});

const ruleFormSchema = z.object({
  supplierName: z.string(),
  defaultVatType: z.enum(allVatTypes.map(v => v.name) as [string, ...string[]]),
});

function CreateRuleDialog({ open, onOpenChange, supplierName, onRuleCreated }: { open: boolean; onOpenChange: (open: boolean) => void; supplierName: string; onRuleCreated: (vatType: z.infer<typeof ruleFormSchema>['defaultVatType']) => void; }) {
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
            accountId: 'supplier_vat_rule', 
            vatType: values.defaultVatType as VatType,
            type: 'hard',
            scope: 'global',
        };

        try {
            await addDoc(collection(db, 'allocationRules'), newRule);
            toast({ title: "Rule Created", description: 'Default VAT type for ' + values.supplierName + ' has been set.' });
            onRuleCreated(values.defaultVatType);
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
                        <FormField control={form.control} name="defaultVatType" render={({ field }) => ( <FormItem><FormLabel>Default VAT Type</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select VAT type" /></SelectTrigger></FormControl><SelectContent>{allVatTypes.map(vt => ( <SelectItem key={vt.name} value={vt.name}>{vt.label}</SelectItem>))}</SelectContent></Select><FormMessage /></FormItem> )}/>
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
            storyName: invoice?.storyName || '',
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

    const watchedInvoiceTotal = useWatch({
        control: form.control,
        name: "invoiceTotal"
    });

    const controlTotal = useMemo(() => {
        return (watchedLineItems || []).reduce((acc, item) => {
            return acc + (item.exclusiveAmount || 0) + (item.vatAmount || 0);
        }, 0);
    }, [watchedLineItems]);

    const difference = useMemo(() => {
        return Number(controlTotal) - (Number(watchedInvoiceTotal) || 0);
    }, [controlTotal, watchedInvoiceTotal]);


    const onSubmit = (data: z.infer<typeof formSchema>) => {
        if (invoice) {
            onSave(invoice.id, data);
        }
    };
    
    const handleRuleCreated = (vatType: z.infer<typeof ruleFormSchema>['defaultVatType']) => {
       const updatedLineItems = form.getValues('lineItems').map(item => {
           const isCapitalGoods = item.description.toLowerCase().includes('asset') || item.description.toLowerCase().includes('equipment');
           let newVatAmount = 0;
           
           if(vatType === 'standard_rated_purchases') {
                newVatAmount = isCapitalGoods ? 0 : (item.exclusiveAmount * 0.15);
           } else if (vatType === 'capital_goods_purchases') {
               newVatAmount = isCapitalGoods ? (item.exclusiveAmount * 0.15) : 0;
           }

           return {...item, vatAmount: newVatAmount };
       });

       form.setValue('lineItems', updatedLineItems);
    }

    return (
        <>
             <CreateRuleDialog
                open={isCreateRuleOpen}
                onOpenChange={setIsCreateRuleOpen}
                supplierName={invoice?.supplier || ''}
                onRuleCreated={handleRuleCreated}
            />
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto p-1 pr-4">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField control={form.control} name="commissionNumber" render={({ field }) => ( <FormItem><FormLabel>Commission Number</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                        <FormField control={form.control} name="storyName" render={({ field }) => ( <FormItem><FormLabel>Story Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                    </div>
                    
                    <h4 className="font-medium">Line Items</h4>
                    <div className="space-y-2">
                        {fields.map((field, index) => {
                            const lineItem = watchedLineItems?.[index];
                            const exclusive = lineItem?.exclusiveAmount || 0;
                            const vat = lineItem?.vatAmount || 0;
                            const inclusive = exclusive + vat;
                            return (
                                <div key={field.id} className="grid grid-cols-12 gap-2 items-end border p-2 rounded-md">
                                    <FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => (<FormItem className="col-span-5"><FormLabel className={index > 0 ? "hidden": ""}>Description</FormLabel><FormControl><Textarea {...field} rows={1} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name={`lineItems.${index}.exclusiveAmount`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>Exclusive</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                                    <FormField control={form.control} name={`lineItems.${index}.vatAmount`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>VAT</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                                    <FormItem className="col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>Line Total</FormLabel><Input type="number" value={Number(inclusive).toFixed(2)} readOnly className="bg-muted font-semibold" /></FormItem>
                                    <div className="col-span-1 flex justify-end"><Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button></div>
                                </div>
                            )
                        })}
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ description: '', exclusiveAmount: 0, vatAmount: 0 })}>Add Line</Button>
                    
                    <div className="grid grid-cols-3 gap-4 pt-4">
                        <FormItem>
                            <FormLabel>Control Total</FormLabel>
                            <Input type="number" value={Number(controlTotal).toFixed(2)} readOnly className="bg-muted font-semibold" />
                        </FormItem>
                         <FormField
                            control={form.control}
                            name="invoiceTotal"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Invoice Total</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormItem>
                            <FormLabel>Difference</FormLabel>
                             <Input 
                                type="number" 
                                value={difference.toFixed(2)} 
                                readOnly 
                                className={cn("font-bold", difference !== 0 ? 'text-destructive bg-destructive/10' : 'text-green-600 bg-green-50')}
                            />
                        </FormItem>
                    </div>

                    
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                        <Button type="submit">Save Changes</Button>
                    </DialogFooter>
                </form>
            </Form>
        </>
    );
}

function AnalyzeStoryDialog({ open, onOpenChange, invoices, onAnalyzeComplete }: { open: boolean; onOpenChange: (open: boolean) => void; invoices: ExtractedInvoice[]; onAnalyzeComplete: () => void; }) {
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [commissions, setCommissions] = useState<Commission[]>([]);
    const [isDataLoading, setIsDataLoading] = useState(true);

    useEffect(() => {
        if (open) {
            const fetchCommissions = async () => {
                setIsDataLoading(true);
                try {
                    const commsQuery = query(collection(db, 'commissions'), orderBy('commissionNumber', 'asc'));
                    const commsSnapshot = await getDocs(commsQuery);
                    const fetchedCommissions = commsSnapshot.docs.map(doc => doc.data() as Commission);
                    setCommissions(fetchedCommissions);
                } catch (error) {
                    console.error("Error fetching commissions:", error);
                    toast({ title: 'Error', description: 'Could not load the commission list.', variant: 'destructive' });
                } finally {
                    setIsDataLoading(false);
                }
            };
            fetchCommissions();
        }
    }, [open, toast]);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        toast({ title: `Analyzing ${invoices.length} invoice(s)...` });

        try {
            const batch = writeBatch(db);
            let updatedCount = 0;

            for (const invoice of invoices) {
                if (invoice.commissionNumber) {
                    const matchingCommission = commissions.find(
                        (c) => c.commissionNumber === invoice.commissionNumber
                    );

                    if (matchingCommission && matchingCommission.shortName) {
                        const invoiceRef = doc(db, 'extractedInvoices', invoice.id);
                        batch.update(invoiceRef, { storyName: matchingCommission.shortName });
                        updatedCount++;
                    }
                }
            }
            if (updatedCount > 0) {
                await batch.commit();
                toast({ title: 'Analysis Complete', description: `${updatedCount} invoice(s) were updated with a story name.` });
                onAnalyzeComplete();
            } else {
                 toast({ title: 'No Matches Found', description: 'No story names could be found for the selected invoices.', variant: 'default' });
            }
            onOpenChange(false);
        } catch (error) {
            console.error("Error analyzing story names:", error);
            toast({ title: 'Error', description: 'An error occurred during analysis.', variant: 'destructive' });
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Analyze Story Names</DialogTitle>
                    <DialogDescription>
                        This will automatically find the "Short Name" from your commissions list and update the "Story Name" for the {invoices.length} selected invoice(s).
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing || isDataLoading}>
                         {isAnalyzing || isDataLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
                        Analyze and Update
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function ReviewPage() {
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDownloading, setIsDownloading] = useState(false);
    const [editingInvoice, setEditingInvoice] = useState<ExtractedInvoice | null>(null);
    const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
    const [isAnalyzeDialogOpen, setIsAnalyzeDialogOpen] = useState(false);
    const [isReanalyzing, setIsReanalyzing] = useState(false);
    const [isApproving, setIsApproving] = useState(false);
    const [rejectingInvoice, setRejectingInvoice] = useState<ExtractedInvoice | null>(null);
    const [rejectionReason, setRejectionReason] = useState<string>('');
    const [deletingInvoice, setDeletingInvoice] = useState<ExtractedInvoice | null>(null);
    const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
    const { toast } = useToast();
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, User>>({});
    const { user } = useAuth();

    const getInvoiceOriginText = (invoice: ExtractedInvoice, uMap: Record<string, User>) => {
        if (invoice.isPrivate || invoice.paymentBatch === 'private' || invoice.uploadedBy === 'manual_ai_upload' || invoice.uploadedBy === 'manual_upload') {
            return 'Private upload';
        }
        if (invoice.uploadedBy === 'email_inbox' || (invoice.sourceEmailUid !== undefined && invoice.sourceEmailUid !== null)) {
            return 'Email';
        }
        const uploader = invoice.uploadedBy ? uMap[invoice.uploadedBy] : undefined;
        if (uploader) {
            if (uploader.role === 'supplier') {
                return 'Supplier upload';
            } else if (['admin', 'staff', 'cap_staff', 'cap_supervisor'].includes(uploader.role)) {
                return 'Admin upload';
            }
        }
        return 'Supplier upload';
    };

    const renderInvoiceOriginBadge = (invoice: ExtractedInvoice, uMap: Record<string, User>) => {
        const isPrivate = invoice.isPrivate || invoice.paymentBatch === 'private' || invoice.uploadedBy === 'manual_ai_upload' || invoice.uploadedBy === 'manual_upload';
        const isEmail = invoice.uploadedBy === 'email_inbox' || (invoice.sourceEmailUid !== undefined && invoice.sourceEmailUid !== null);
        const uploader = invoice.uploadedBy ? uMap[invoice.uploadedBy] : undefined;

        if (isPrivate) {
            return (
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 flex items-center gap-1 w-fit font-normal">
                    <Lock className="h-3 w-3" />
                    Private upload
                </Badge>
            );
        }

        if (isEmail) {
            return (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 w-fit font-normal">
                    <Mail className="h-3 w-3" />
                    Email
                </Badge>
            );
        }

        if (uploader) {
            const uploaderName = uploader.name || uploader.email || 'User';
            if (uploader.role === 'supplier') {
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit font-normal cursor-help">
                                    <UserIcon className="h-3 w-3" />
                                    Supplier upload
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Uploaded by {uploaderName}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            } else if (['admin', 'staff', 'cap_staff', 'cap_supervisor'].includes(uploader.role)) {
                return (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 flex items-center gap-1 w-fit font-normal cursor-help">
                                    <Upload className="h-3 w-3" />
                                    Admin upload
                                </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Uploaded by {uploaderName}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                );
            }
        }

        return (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 flex items-center gap-1 w-fit font-normal">
                <UserIcon className="h-3 w-3" />
                Supplier upload
            </Badge>
        );
    };

    const fetchInvoicesAndRules = async (showLoader = true) => {
        if (showLoader) setIsLoading(true);
        try {
            const [rulesSnapshot, usersSnapshot] = await Promise.all([
                getDocs(query(collection(db, "allocationRules"), orderBy("description"))),
                getDocs(collection(db, "users")),
            ]);
            const fetchedRules = rulesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AllocationRule));
            setGlobalRules(fetchedRules);

            const uMap: Record<string, User> = {};
            usersSnapshot.docs.forEach(doc => {
                uMap[doc.id] = { ...doc.data(), id: doc.id, uid: doc.id } as User;
            });
            setUsersMap(uMap);

            let invoicesQuery = query(collection(db, 'extractedInvoices'), where('status', 'in', ['pending_review', 'duplicate']));

            const querySnapshot = await getDocs(invoicesQuery);
            let fetchedInvoices = querySnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice))
                .sort((a, b) => {
                    const timeA = (a as any).createdAt?.toMillis?.() || ((a as any).createdAt?.seconds ? (a as any).createdAt.seconds * 1000 : 0) || (a.createdAt ? new Date(a.createdAt as any).getTime() : 0);
                    const timeB = (b as any).createdAt?.toMillis?.() || ((b as any).createdAt?.seconds ? (b as any).createdAt.seconds * 1000 : 0) || (b.createdAt ? new Date(b.createdAt as any).getTime() : 0);
                    return timeB - timeA;
                });

            if (user && user.role === 'cap_staff') {
                fetchedInvoices = fetchedInvoices.filter(inv => inv.assignedToEmail === user.email || !inv.assignedToEmail);
            }

            setInvoices(fetchedInvoices);

        } catch (error) {
            console.error("Error fetching invoices:", error);
            toast({ title: 'Error', description: 'Could not fetch invoices for review.', variant: 'destructive'});
        } finally {
            if (showLoader) setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if(user) {
            fetchInvoicesAndRules();
        }
    }, [user]);

    const handleSave = async (id: string, data: any) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
             const dataToSave = {
                ...data,
                commissionNumber: data.commissionNumber || null,
                paymentBatch: data.paymentBatch || null,
                expenseType: data.expenseType || null,
                note: data.note || null,
            };
            await updateDoc(docRef, dataToSave);

            const supplier = data.supplier;
            const supplierRule = globalRules.find(r => r.keywords.includes(supplier.toLowerCase()) && r.accountId === 'supplier_vat_rule');

            if (supplierRule) {
                const invoicesToUpdate = invoices.filter(invoice => 
                    invoice.supplier === supplier && invoice.id !== id && invoice.status === 'pending_review'
                );

                if(invoicesToUpdate.length > 0) {
                    const BATCH_SIZE = 400; // Firestore batch limit is 500 operations
                    for (let i = 0; i < invoicesToUpdate.length; i += BATCH_SIZE) {
                        const batch = writeBatch(db);
                        const chunk = invoicesToUpdate.slice(i, i + BATCH_SIZE);
                        
                        chunk.forEach(invoice => {
                             const updatedLineItems = invoice.lineItems.map(item => {
                                const isCapitalGoods = item.description.toLowerCase().includes('asset') || item.description.toLowerCase().includes('equipment');
                                let newVatAmount = 0;
                                
                                if(supplierRule.vatType === 'standard_rated_purchases') {
                                    newVatAmount = isCapitalGoods ? 0 : (item.exclusiveAmount * 0.15);
                                } else if (supplierRule.vatType === 'capital_goods_purchases') {
                                    newVatAmount = isCapitalGoods ? (item.exclusiveAmount * 0.15) : 0;
                                }
                                return {...item, vatAmount: newVatAmount };
                            });
                            
                            const invoiceRef = doc(db, 'extractedInvoices', invoice.id);
                            batch.update(invoiceRef, { lineItems: updatedLineItems });
                        });

                        await batch.commit();
                    }
                    
                    toast({ title: 'Batch Update', description: `${invoicesToUpdate.length} other invoice(s) for ${supplier} were updated with the new rule.`});
                }
            }


            toast({ title: 'Invoice Updated', description: 'Your changes have been saved.' });
            setEditingInvoice(null);
            fetchInvoicesAndRules(false);
        } catch (error) {
            console.error("Error updating invoice:", error);
            toast({ title: 'Error', description: 'Could not save changes.', variant: 'destructive'});
        }
    };
    
    const handleApprove = async (id: string) => {
        if (!user) return;
        const targetInv = invoices.find(inv => inv.id === id);
        if (targetInv) {
            const lineSum = (targetInv.lineItems || []).reduce((s, li) => s + (Number(li.exclusiveAmount) || 0) + (Number(li.vatAmount) || 0), 0);
            const invTotal = Number(targetInv.invoiceTotal) || 0;
            if (Math.abs(lineSum - invTotal) > 0.01) {
                toast({
                    title: 'Control Total Mismatch',
                    description: `Cannot approve: Sum of line items (${formatPrice(lineSum)}) does not equal Invoice Total (${formatPrice(invTotal)}). Difference: ${formatPrice(Math.abs(invTotal - lineSum))}. Please edit the invoice first.`,
                    variant: 'destructive'
                });
                return;
            }
        }
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'approved', approvedBy: user.uid });
            toast({ title: 'Invoice Approved', description: 'The invoice has been moved to 2nd Review.' });
            fetchInvoicesAndRules(false);
        } catch (error) {
            toast({ title: 'Error', description: 'Could not approve the invoice.', variant: 'destructive'});
        }
    };

    const handleApproveSelected = async () => {
        if (selectedInvoices.length === 0 || !user) return;

        // Check for any discrepancies in selected invoices
        const invalidInvoices = invoices.filter(inv => {
            if (!selectedInvoices.includes(inv.id)) return false;
            const lineSum = (inv.lineItems || []).reduce((s, li) => s + (Number(li.exclusiveAmount) || 0) + (Number(li.vatAmount) || 0), 0);
            const invTotal = Number(inv.invoiceTotal) || 0;
            return Math.abs(lineSum - invTotal) > 0.01;
        });

        if (invalidInvoices.length > 0) {
            toast({
                title: 'Cannot Approve Invoices With Total Mismatches',
                description: `${invalidInvoices.length} invoice(s) have Control Total discrepancies (e.g. ${invalidInvoices[0].supplier} #${invalidInvoices[0].invoiceNumber}). Please edit and balance them before approving.`,
                variant: 'destructive',
            });
            return;
        }

        setIsApproving(true);
        try {
            const BATCH_SIZE = 400;
            for (let i = 0; i < selectedInvoices.length; i += BATCH_SIZE) {
                const batch = writeBatch(db);
                const chunk = selectedInvoices.slice(i, i + BATCH_SIZE);
                chunk.forEach(id => {
                    const docRef = doc(db, 'extractedInvoices', id);
                    batch.update(docRef, { status: 'approved', approvedBy: user.uid });
                });
                await batch.commit();
            }
            toast({
                title: 'Invoices Approved',
                description: `${selectedInvoices.length} invoice(s) have been moved to 2nd Review.`,
            });
            setSelectedInvoices([]);
            fetchInvoicesAndRules(false);
        } catch (error) {
            console.error("Error approving selected invoices:", error);
            toast({
                title: 'Error',
                description: 'Could not approve the selected invoices.',
                variant: 'destructive',
            });
        } finally {
            setIsApproving(false);
        }
    };

    const handleReject = async (id: string, reason: string) => {
        if (!user) return;
        const invoice = invoices.find(inv => inv.id === id);
        if (!invoice) return;

        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'rejected', rejectionReason: reason, rejectedBy: user.uid });
            
            const uploader = invoice.uploadedBy ? await getDoc(doc(db, 'users', invoice.uploadedBy)) : null;

            if (uploader?.exists()) {
                const uploaderData = uploader.data() as User;
                const emailHtml = render(<InvoiceRejectionEmail invoice={invoice} reason={reason} rejectedBy={user.name} />);
                await sendEmail({
                    to: uploaderData.email,
                    subject: `Invoice Rejected: ${invoice.supplier} - #${invoice.invoiceNumber}`,
                    html: emailHtml,
                });
            }

            toast({ title: 'Invoice Rejected', description: 'The invoice has been marked as rejected.' });
            setRejectingInvoice(null);
            setRejectionReason('');
            fetchInvoicesAndRules(false);
        } catch (error) {
            toast({ title: 'Error', description: 'Could not reject the invoice or send notification.', variant: 'destructive'});
        }
    }
    
    const handleArchive = async (id: string) => {
        if (!user) return;
         try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, { status: 'archived', deletedBy: user.uid, deletedAt: serverTimestamp() });
            toast({ title: 'Invoice Deleted', description: 'The invoice has been moved to the deleted list.'});
            setDeletingInvoice(null);
            fetchInvoicesAndRules(false);
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the invoice.', variant: 'destructive'});
        }
    }

    const handleArchiveSelected = async () => {
        if (selectedInvoices.length === 0 || !user) return;
        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                batch.update(docRef, { status: 'archived', deletedBy: user.uid, deletedAt: serverTimestamp() });
            });
            await batch.commit();
            toast({ title: 'Invoices Deleted', description: `${selectedInvoices.length} invoices have been moved to the deleted list.`, variant: 'default'});
            setSelectedInvoices([]);
            fetchInvoicesAndRules(false);
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the selected invoices.', variant: 'destructive'});
        }
    }

    const handleReanalyzeSingle = async (id: string) => {
        setIsReanalyzing(true);
        toast({ title: 'Reanalyzing Invoice...', description: 'Please wait while AI re-extracts the data.' });
        try {
            await reanalyzeInvoice(id);
            toast({ title: 'Reanalysis Complete', description: 'The invoice data has been refreshed.' });
            fetchInvoicesAndRules(false);
        } catch (error) {
            console.error("Reanalysis error:", error);
            toast({ title: 'Reanalysis Failed', description: 'Could not reanalyze the invoice.', variant: 'destructive' });
        } finally {
            setIsReanalyzing(false);
        }
    };

    const handleReanalyzeSelected = async () => {
        if (selectedInvoices.length === 0) return;
        setIsReanalyzing(true);
        toast({ title: 'Starting Reanalysis...', description: `Reanalyzing ${selectedInvoices.length} selected invoice(s).` });
        
        try {
            let successCount = 0;
            for (let i = 0; i < selectedInvoices.length; i++) {
                const id = selectedInvoices[i];
                toast({ title: `Reanalyzing (${i + 1}/${selectedInvoices.length})`, description: 'Processing...' });
                try {
                    await reanalyzeInvoice(id);
                    successCount++;
                } catch (err) {
                    console.error(`Error reanalyzing invoice ${id}:`, err);
                }
            }
            toast({ title: 'Reanalysis Complete', description: `Successfully reanalyzed ${successCount} of ${selectedInvoices.length} invoice(s).` });
            setSelectedInvoices([]);
            fetchInvoicesAndRules(false);
        } catch (error) {
            console.error("Bulk reanalysis error:", error);
            toast({ title: 'Reanalysis Failed', description: 'An error occurred during bulk reanalysis.', variant: 'destructive' });
        } finally {
            setIsReanalyzing(false);
        }
    };;

    const handleDownloadAll = async () => {
        if (invoices.length === 0) {
            toast({ title: 'No Invoices', description: 'There are no invoices to download.' });
            return;
        }

        setIsDownloading(true);
        toast({ title: 'Preparing Download', description: `Starting download for ${invoices.length} invoices. This may take a moment.` });

        for (let i = 0; i < invoices.length; i++) {
            const invoice = invoices[i];
            try {
                // This workaround creates a temporary link to trigger the browser's download behavior, bypassing CORS.
                const link = document.createElement('a');
                link.href = invoice.fileUrl;
                link.setAttribute('download', `${invoice.supplier} - ${invoice.invoiceNumber}.pdf`); // You can customize the filename here
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                // A small delay to allow browsers to handle multiple downloads
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                console.error(`Failed to download ${invoice.fileName}:`, error);
                toast({ title: 'Download Failed', description: `Could not download ${invoice.fileName}.`, variant: 'destructive' });
            }
        }
        
        setIsDownloading(false);
        toast({ title: 'Download Complete', description: 'All invoices have been downloaded.' });
    };

    const handleDownloadExcel = () => {
        const sortedInvoices = [...invoices].sort((a, b) => {
            if (a.supplier.toLowerCase() < b.supplier.toLowerCase()) return -1;
            if (a.supplier.toLowerCase() > b.supplier.toLowerCase()) return 1;
            if (a.invoiceNumber < b.invoiceNumber) return -1;
            if (a.invoiceNumber > b.invoiceNumber) return 1;
            return 0;
        });

        let dataToExport: any[] = [];
        
        sortedInvoices.forEach(invoice => {
            const originStr = getInvoiceOriginText(invoice, usersMap);
            if (invoice.lineItems.length > 0) {
                invoice.lineItems.forEach((item, index) => {
                    dataToExport.push({
                        'Invoice Date': index === 0 ? invoice.date : '',
                        'Invoice Number': index === 0 ? invoice.invoiceNumber : '',
                        'Supplier': index === 0 ? invoice.supplier : '',
                        'Origin': index === 0 ? originStr : '',
                        'Commission #': index === 0 ? invoice.commissionNumber : '',
                        'Line Description': item.description,
                        'Exclusive Amount': item.exclusiveAmount,
                        'VAT Amount': item.vatAmount,
                        'Invoice Total': index === 0 ? invoice.invoiceTotal : '',
                    });
                });
            } else {
                 dataToExport.push({
                    'Invoice Date': invoice.date,
                    'Invoice Number': invoice.invoiceNumber,
                    'Supplier': invoice.supplier,
                    'Origin': originStr,
                    'Commission #': invoice.commissionNumber,
                    'Line Description': '',
                    'Exclusive Amount': 0,
                    'VAT Amount': 0,
                    'Invoice Total': invoice.invoiceTotal,
                });
            }
            
            // Add a blank row after each invoice group
            dataToExport.push({});
        });
    
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Pending Review Invoices');
        XLSX.writeFile(workbook, 'pending-review-invoices.xlsx');
    };

    const handleToggleSelect = (id: string) => {
        setSelectedInvoices(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    }
    
    const handleSelectAll = (checked: boolean) => {
        if(checked) {
            setSelectedInvoices(invoices.map(i => i.id));
        } else {
            setSelectedInvoices([]);
        }
    }
    
    const formatPrice = (price: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);

  return (
    <div className="space-y-4 md:space-y-8 pb-24 sm:pb-8">
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Review Invoices</h1>
      <Card>
        <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                 <div>
                    <CardTitle className="text-xl sm:text-2xl">Extracted Invoices for Review</CardTitle>
                    <CardDescription className="text-xs sm:text-sm mt-1">
                        Review, edit, and approve the data extracted from uploaded invoices. Approved invoices will be moved to the control sheet.
                    </CardDescription>
                </div>

                {/* Mobile Bulk Action Bar (Visible only on < md) */}
                <div className="flex md:hidden flex-col gap-2.5 w-full pt-1">
                    <div className="flex items-center justify-between bg-muted/40 p-2.5 rounded-lg border">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="select-all-mobile"
                                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                checked={invoices.length > 0 && selectedInvoices.length === invoices.length}
                                aria-label="Select all"
                            />
                            <label htmlFor="select-all-mobile" className="text-xs font-medium cursor-pointer">
                                Select All ({invoices.length})
                            </label>
                        </div>
                        {selectedInvoices.length > 0 && (
                            <Badge variant="secondary" className="text-xs font-normal">
                                {selectedInvoices.length} selected
                            </Badge>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button 
                                    disabled={selectedInvoices.length === 0 || isApproving} 
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 text-xs w-full"
                                >
                                    {isApproving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin"/> : <FileCheck2 className="mr-1.5 h-4 w-4"/>}
                                    Approve ({selectedInvoices.length})
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="w-[92vw] max-w-md rounded-xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Approve Selected Invoices?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will approve {selectedInvoices.length} selected invoice(s) and move them to 2nd Review (Control Sheet).
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleApproveSelected}>
                                        Yes, Approve Selected
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="h-10 text-xs w-full gap-1.5 justify-between">
                                    <span>More Actions</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Bulk Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                    disabled={selectedInvoices.length === 0}
                                    onSelect={() => setIsAnalyzeDialogOpen(true)}
                                >
                                    <Brain className="mr-2 h-4 w-4 text-primary" />
                                    Analyze Selected ({selectedInvoices.length})
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    disabled={selectedInvoices.length === 0 || isReanalyzing}
                                    onSelect={handleReanalyzeSelected}
                                >
                                    {isReanalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                                    Reanalyze Selected ({selectedInvoices.length})
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    disabled={selectedInvoices.length === 0}
                                    onSelect={() => setIsBulkDeleteDialogOpen(true)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Selected ({selectedInvoices.length})
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuLabel>Export & Downloads</DropdownMenuLabel>
                                <DropdownMenuItem 
                                    disabled={invoices.length === 0 || isDownloading}
                                    onSelect={handleDownloadAll}
                                >
                                    {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                    Download All
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                    disabled={invoices.length === 0}
                                    onSelect={handleDownloadExcel}
                                >
                                    <Download className="mr-2 h-4 w-4 text-emerald-600" />
                                    Export to Excel
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Desktop Bulk Action Bar (Hidden on mobile) */}
                 <div className="hidden md:flex items-center gap-2 flex-wrap">
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button disabled={selectedInvoices.length === 0 || isApproving} className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                                {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <FileCheck2 className="mr-2 h-4 w-4"/>}
                                Approve Selected ({selectedInvoices.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Approve Selected Invoices?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will approve {selectedInvoices.length} selected invoice(s) and move them to 2nd Review (Control Sheet).
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleApproveSelected}>
                                    Yes, Approve Selected
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    <AnalyzeStoryDialog
                        open={isAnalyzeDialogOpen}
                        onOpenChange={setIsAnalyzeDialogOpen}
                        invoices={invoices.filter(i => selectedInvoices.includes(i.id))}
                        onAnalyzeComplete={() => fetchInvoicesAndRules(false)}
                    />
                    <Button variant="destructive" disabled={selectedInvoices.length === 0} onClick={() => setIsBulkDeleteDialogOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4"/>
                        Delete ({selectedInvoices.length})
                    </Button>
                    <Button onClick={handleReanalyzeSelected} variant="outline" disabled={selectedInvoices.length === 0 || isReanalyzing}>
                        {isReanalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Reanalyze ({selectedInvoices.length})
                    </Button>
                    <Button onClick={() => setIsAnalyzeDialogOpen(true)} variant="outline" disabled={selectedInvoices.length === 0}>
                        <Brain className="mr-2 h-4 w-4"/>
                        Analyze ({selectedInvoices.length})
                    </Button>
                     <Button onClick={handleDownloadAll} variant="outline" disabled={invoices.length === 0 || isDownloading}>
                        {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                        Download All
                    </Button>
                    <Button onClick={handleDownloadExcel} variant="outline" disabled={invoices.length === 0}>
                        <Download className="mr-2 h-4 w-4" />
                        Export to Excel
                    </Button>
                 </div>
            </div>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : invoices.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">No invoices are pending review.</p>
            ) : (
                <>
                    {/* Mobile Card View (md:hidden) */}
                    <div className="md:hidden space-y-3">
                        {invoices.map((invoice) => {
                            const totalVat = (invoice.lineItems || []).reduce((sum, item) => sum + (Number(item.vatAmount) || 0), 0);
                            const exclusiveSum = (invoice.lineItems || []).reduce((sum, item) => sum + (Number(item.exclusiveAmount) || 0), 0);
                            const lineTotalSum = (invoice.lineItems || []).reduce((sum, item) => sum + (Number(item.exclusiveAmount) || 0) + (Number(item.vatAmount) || 0), 0);
                            const safeInvoiceTotal = Number(invoice.invoiceTotal) || 0;
                            const hasDiscrepancy = Math.abs(safeInvoiceTotal - lineTotalSum) > 0.01;
                            const isSelected = selectedInvoices.includes(invoice.id);

                            return (
                                <div 
                                    key={invoice.id} 
                                    className={cn(
                                        "rounded-xl border bg-card text-card-foreground shadow-sm p-3.5 space-y-3 transition-colors",
                                        isSelected ? "border-primary/60 bg-primary/[0.02]" : "border-border"
                                    )}
                                >
                                    {/* Top Row: Checkbox + Supplier + Status Badges */}
                                    <div className="flex items-start gap-2.5">
                                        <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => handleToggleSelect(invoice.id)}
                                            aria-label={`Select invoice ${invoice.id}`}
                                            className="mt-1 shrink-0"
                                        />
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="font-semibold text-base text-foreground leading-snug break-words">
                                                {invoice.supplier}
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                {invoice.status === 'duplicate' ? (
                                                    <Badge variant={'destructive'} className="text-[10px] px-1.5 py-0 whitespace-nowrap shrink-0">
                                                        <AlertTriangle className="mr-1 h-3 w-3" />
                                                        Duplicate
                                                    </Badge>
                                                ) : (
                                                    <Badge variant={'warning'} className="text-[10px] px-1.5 py-0 capitalize whitespace-nowrap shrink-0">
                                                        <Hourglass className="mr-1 h-3 w-3" />
                                                        {invoice.status.replace('_', ' ')}
                                                    </Badge>
                                                )}
                                                {invoice.isAudited && (
                                                    <Badge className="bg-green-100 hover:bg-green-100 text-green-800 border border-green-200 text-[10px] px-1.5 py-0 whitespace-nowrap shrink-0">
                                                        <FileCheck2 className="mr-1 h-3 w-3 text-green-600" />
                                                        Audited
                                                    </Badge>
                                                )}
                                                {renderInvoiceOriginBadge(invoice, usersMap)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Invoice Details Grid */}
                                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/60">
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Invoice #</span>
                                            <span className="font-mono font-medium text-foreground break-all">{invoice.invoiceNumber || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Invoice Date</span>
                                            <span className="font-medium text-foreground">{invoice.date || '—'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Commission #</span>
                                            <span className="font-medium text-foreground">{invoice.commissionNumber || 'N/A'}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-[11px]">Documents</span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <Button asChild variant="outline" size="sm" className="h-6 px-2 text-[11px] gap-1">
                                                    <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                        <Eye className="h-3 w-3" />
                                                        PDF
                                                    </a>
                                                </Button>
                                                {invoice.supportingDocuments && invoice.supportingDocuments.length > 0 && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                <Paperclip className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuLabel>Supporting Docs</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            {invoice.supportingDocuments.map((doc, i) => (
                                                                <DropdownMenuItem key={i} asChild>
                                                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">{doc.fileName}</a>
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Financial Breakdown Box */}
                                    <div className="rounded-lg bg-muted/40 p-3 border border-border/80 space-y-1.5">
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">Exclusive Amount</span>
                                            <span className="font-mono font-medium text-foreground">{formatPrice(exclusiveSum)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-xs">
                                            <span className="text-muted-foreground">VAT Amount</span>
                                            <span className="font-mono font-medium text-foreground">{formatPrice(totalVat)}</span>
                                        </div>
                                        <div className="border-t border-border/60 pt-1.5 flex justify-between items-baseline">
                                            <span className="text-xs font-semibold text-foreground">Total Payable</span>
                                            <span className={cn("text-base font-bold font-mono", hasDiscrepancy ? "text-destructive" : "text-foreground")}>
                                                {formatPrice(safeInvoiceTotal)}
                                            </span>
                                        </div>

                                        {hasDiscrepancy && (
                                            <div className="mt-2 rounded-md bg-red-50 dark:bg-red-950/40 p-2.5 text-xs border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 space-y-1">
                                                <div className="font-semibold flex items-center gap-1.5 text-red-700 dark:text-red-400">
                                                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                                    Control Total Mismatch
                                                </div>
                                                <div className="flex justify-between text-[11px]">
                                                    <span>Sum of Line Items:</span>
                                                    <span className="font-mono font-semibold">{formatPrice(lineTotalSum)}</span>
                                                </div>
                                                <div className="flex justify-between text-[11px]">
                                                    <span>Difference:</span>
                                                    <span className="font-mono font-bold text-red-600 dark:text-red-400">
                                                        {formatPrice(Math.abs(safeInvoiceTotal - lineTotalSum))}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-red-600 dark:text-red-400 italic pt-0.5">
                                                    Please edit line items before approving.
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 pt-1">
                                        <Button 
                                            onClick={() => handleApprove(invoice.id)}
                                            disabled={hasDiscrepancy}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-9 text-xs gap-1.5"
                                        >
                                            <FileCheck2 className="h-4 w-4" />
                                            Approve
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={() => setEditingInvoice(invoice)}
                                            className="h-9 px-3 text-xs gap-1.5"
                                        >
                                            <Edit className="h-3.5 w-3.5" />
                                            Edit
                                        </Button>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onSelect={() => handleReanalyzeSingle(invoice.id)} disabled={isReanalyzing}>
                                                    <RefreshCw className="mr-2 h-4 w-4" /> Reanalyze
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onSelect={() => {
                                                        setRejectingInvoice(invoice);
                                                        setRejectionReason('');
                                                    }} 
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Mail className="mr-2 h-4 w-4" /> Reject & Notify
                                                </DropdownMenuItem>
                                                <DropdownMenuItem 
                                                    onSelect={() => setDeletingInvoice(invoice)} 
                                                    className="text-destructive focus:text-destructive"
                                                >
                                                    <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop Table View (hidden md:block) */}
                    <div className="hidden md:block overflow-x-auto">
                        <Table className="min-w-[950px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10">
                                        <Checkbox
                                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                            checked={invoices.length > 0 && selectedInvoices.length === invoices.length}
                                            aria-label="Select all"
                                        />
                                    </TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Origin</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Commission #</TableHead>
                                    <TableHead>File</TableHead>
                                    <TableHead className="text-right">VAT Amount</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((invoice) => {
                                    const totalVat = (invoice.lineItems || []).reduce((sum, item) => sum + (Number(item.vatAmount) || 0), 0);
                                    const lineTotalSum = (invoice.lineItems || []).reduce((sum, item) => sum + (Number(item.exclusiveAmount) || 0) + (Number(item.vatAmount) || 0), 0);
                                    const safeInvoiceTotal = Number(invoice.invoiceTotal) || 0;
                                    const hasDiscrepancy = Math.abs(safeInvoiceTotal - lineTotalSum) > 0.01;

                                    return (
                                        <TableRow key={invoice.id}>
                                            <TableCell>
                                                <Checkbox
                                                    checked={selectedInvoices.includes(invoice.id)}
                                                    onCheckedChange={() => handleToggleSelect(invoice.id)}
                                                    aria-label={`Select invoice ${invoice.id}`}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {invoice.status === 'duplicate' ? (
                                                        <Badge variant={'destructive'}>
                                                            <AlertTriangle className="mr-1 h-3 w-3" />
                                                            Duplicate
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant={'warning'}>
                                                            <Hourglass className="mr-1 h-3 w-3" />
                                                            {invoice.status.replace('_', ' ')}
                                                        </Badge>
                                                    )}
                                                    {hasDiscrepancy && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Badge variant={'destructive'} className="bg-red-600 hover:bg-red-700 text-white font-semibold flex items-center gap-1 cursor-help animate-pulse text-[10px]">
                                                                        <AlertCircle className="h-3 w-3" />
                                                                        Total Mismatch
                                                                    </Badge>
                                                                </TooltipTrigger>
                                                                <TooltipContent className="max-w-xs text-xs">
                                                                    <p className="font-bold text-red-400">Control Total Mismatch</p>
                                                                    <p className="mt-1">
                                                                        Control Total (Line Items): <strong>{formatPrice(lineTotalSum)}</strong><br />
                                                                        Invoice Total: <strong>{formatPrice(safeInvoiceTotal)}</strong><br />
                                                                        Difference: <strong className="text-red-300">{formatPrice(safeInvoiceTotal - lineTotalSum)}</strong>
                                                                    </p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                    {invoice.isAudited && (
                                                        <Badge className="bg-green-100 hover:bg-green-100 text-green-800 border border-green-200">
                                                            <FileCheck2 className="mr-1 h-3.5 w-3.5 text-green-600" />
                                                            Audited
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {renderInvoiceOriginBadge(invoice, usersMap)}
                                            </TableCell>
                                            <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                            <TableCell>{invoice.invoiceNumber}</TableCell>
                                            <TableCell>{invoice.commissionNumber || 'N/A'}</TableCell>
                                            <TableCell className="flex items-center gap-2">
                                                <Button asChild variant="link" className="p-0 h-auto">
                                                  <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">View Invoice</a>
                                                </Button>
                                                {invoice.supportingDocuments && invoice.supportingDocuments.length > 0 && (
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6">
                                                                <Paperclip className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            <DropdownMenuLabel>Supporting Docs</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            {invoice.supportingDocuments.map((doc, i) => (
                                                                <DropdownMenuItem key={i} asChild>
                                                                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">{doc.fileName}</a>
                                                                </DropdownMenuItem>
                                                            ))}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right font-mono">{formatPrice(totalVat)}</TableCell>
                                            <TableCell className="text-right font-mono">
                                                <div className="flex flex-col items-end">
                                                    <span className={cn(hasDiscrepancy && "text-destructive font-bold")}>{formatPrice(invoice.invoiceTotal)}</span>
                                                    {hasDiscrepancy && (
                                                        <span className="text-[10px] text-destructive font-medium">
                                                            Lines: {formatPrice(lineTotalSum)}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onSelect={() => handleApprove(invoice.id)}>
                                                            <FileCheck2 className="mr-2 h-4 w-4" /> Approve
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleReanalyzeSingle(invoice.id)} disabled={isReanalyzing}>
                                                            <RefreshCw className="mr-2 h-4 w-4" /> Reanalyze
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => setEditingInvoice(invoice)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem 
                                                            onSelect={() => {
                                                                setRejectingInvoice(invoice);
                                                                setRejectionReason('');
                                                            }} 
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Mail className="mr-2 h-4 w-4" /> Reject & Notify
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem 
                                                            onSelect={() => setDeletingInvoice(invoice)} 
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </>
            )}
        </CardContent>
      </Card>
      
      {/* Edit Invoice Dialog */}
      <Dialog open={!!editingInvoice} onOpenChange={(isOpen) => !isOpen && setEditingInvoice(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
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

      {/* Reject & Notify Dialog */}
      <AlertDialog open={!!rejectingInvoice} onOpenChange={(open) => !open && setRejectingInvoice(null)}>
        <AlertDialogContent className="w-[92vw] max-w-md rounded-xl">
            <AlertDialogHeader>
                <AlertDialogTitle>Reject Invoice?</AlertDialogTitle>
                <AlertDialogDescription>
                    Please provide a reason for rejecting the invoice for {rejectingInvoice?.supplier}. This will be sent to the user who uploaded the invoice.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <Textarea 
                placeholder="e.g., Invoice is not legible, or incorrect VAT." 
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-[100px]"
            />
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setRejectingInvoice(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                    onClick={() => {
                        if (rejectingInvoice && rejectionReason.trim()) {
                            handleReject(rejectingInvoice.id, rejectionReason.trim());
                        } else {
                            toast({title: 'Reason Required', description: 'Please provide a reason for rejection.', variant: 'destructive'});
                        }
                    }}
                >
                    Reject
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingInvoice} onOpenChange={(open) => !open && setDeletingInvoice(null)}>
        <AlertDialogContent className="w-[92vw] max-w-md rounded-xl">
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will delete the invoice for {deletingInvoice?.supplier}. You can view it later in the Deleted page.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeletingInvoice(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deletingInvoice && handleArchive(deletingInvoice.id)}>
                    Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
        <AlertDialogContent className="w-[92vw] max-w-md rounded-xl">
            <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This will delete {selectedInvoices.length} selected invoice(s). You can view them later in the Deleted page.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setIsBulkDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => {
                    handleArchiveSelected();
                    setIsBulkDeleteDialogOpen(false);
                }}>
                    Yes, Delete
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

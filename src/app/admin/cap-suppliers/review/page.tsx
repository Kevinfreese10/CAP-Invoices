

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFirestore, collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, where, addDoc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Loader2, MoreHorizontal, Edit, Trash2, FileCheck2, Hourglass, CheckCircle2, Eye, Download, Sparkles, Brain, AlertTriangle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, toDate } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
import { AllocationRule, ExtractedInvoice, FindStoryNameInput, FindStoryNameInputSchema, FindStoryNameOutput, FindStoryNameOutputSchema } from '@/lib/types';
import { allVatTypes } from '@/lib/vat-types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { findStoryName } from '@/ai/flows/find-story-name';
import { commissionList as defaultCommissionList } from '@/lib/commission-list';
import { Checkbox } from '@/components/ui/checkbox';

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
            vatType: values.defaultVatType,
            type: 'hard',
            scope: 'global',
        };

        try {
            await addDoc(collection(db, 'allocationRules'), newRule);
            toast({ title: "Rule Created", description: `Default VAT type for ${values.supplierName} has been set.` });
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
                            const exclusive = Number(watchedLineItems?.[index]?.exclusiveAmount) || 0;
                            const vat = Number(watchedLineItems?.[index]?.vatAmount) || 0;
                            const inclusive = exclusive + vat;
                            return (
                            <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                                <FormField control={form.control} name={`lineItems.${index}.description`} render={({ field }) => (<FormItem className="col-span-6"><FormLabel className={index > 0 ? "hidden": ""}>Description</FormLabel><FormControl><Textarea {...field} rows={1} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name={`lineItems.${index}.exclusiveAmount`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>Exclusive</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                                <FormField control={form.control} name={`lineItems.${index}.vatAmount`} render={({ field }) => (<FormItem className="col-span-2"><FormLabel className={index > 0 ? "hidden": ""}>VAT</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl></FormItem>)} />
                                <FormItem className="col-span-2">
                                    <FormLabel className={index > 0 ? "hidden": ""}>Inclusive</FormLabel>
                                    <Input type="number" value={Number(inclusive).toFixed(2)} readOnly className="bg-muted" />
                                </FormItem>
                                <div className="col-span-12 flex justify-end"><Button type="button" variant="destructive" size="icon" onClick={() => remove(index)}><Trash2 className="h-4 w-4" /></Button></div>
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

function AnalyzeStoryDialog({ open, onOpenChange, invoices, onAnalyzeComplete }: { open: boolean; onOpenChange: (open: boolean) => void; invoices: ExtractedInvoice[]; onAnalyzeComplete: () => void; }) {
    const { toast } = useToast();
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [knowledgeBase, setKnowledgeBase] = useState(defaultCommissionList);

    const handleAnalyze = async () => {
        setIsAnalyzing(true);
        toast({ title: `Analyzing ${invoices.length} invoice(s)...` });

        try {
            const batch = writeBatch(db);
            let updatedCount = 0;

            for (const invoice of invoices) {
                if (invoice.commissionNumber) {
                    const result = await findStoryName({
                        commissionNumber: invoice.commissionNumber,
                        knowledgeBase: knowledgeBase,
                    });
                    if (result.storyName) {
                        const invoiceRef = doc(db, 'extractedInvoices', invoice.id);
                        batch.update(invoiceRef, { storyName: result.storyName });
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
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Analyze Story Names</DialogTitle>
                    <DialogDescription>Paste your commission list from Google Sheets below. The AI will match commission numbers to find the story name.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                     <Textarea
                        value={knowledgeBase}
                        onChange={(e) => setKnowledgeBase(e.target.value)}
                        rows={15}
                        placeholder="Paste your two-column data here (e.g., CM-123\tMy Story Name)"
                    />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                         {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Brain className="mr-2 h-4 w-4" />}
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
    const { toast } = useToast();
    const [globalRules, setGlobalRules] = useState<AllocationRule[]>([]);


    const fetchInvoicesAndRules = async () => {
        setIsLoading(true);
        try {
            const rulesQuery = query(collection(db, "allocationRules"), orderBy("description"));
            const rulesSnapshot = await getDocs(rulesQuery);
            const fetchedRules = rulesSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as AllocationRule));
            setGlobalRules(fetchedRules);
            
            const q = query(collection(db, 'extractedInvoices'), where('status', 'in', ['pending_review', 'duplicate']), orderBy('createdAt', 'desc'));
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
        fetchInvoicesAndRules();
    }, []);

    const handleSave = async (id: string, data: any) => {
        try {
            const docRef = doc(db, 'extractedInvoices', id);
            await updateDoc(docRef, data);

            const supplier = data.supplier;
            const supplierRule = globalRules.find(r => r.keywords.includes(supplier.toLowerCase()) && r.accountId === 'supplier_vat_rule');

            if (supplierRule) {
                const batch = writeBatch(db);
                let updatedCount = 0;
                
                invoices.forEach(invoice => {
                    if (invoice.supplier === supplier && invoice.id !== id && invoice.status === 'pending_review') {
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
                        updatedCount++;
                    }
                });

                if (updatedCount > 0) {
                    await batch.commit();
                    toast({ title: 'Batch Update', description: `${updatedCount} other invoice(s) for ${supplier} were updated with the new rule.`});
                }
            }


            toast({ title: 'Invoice Updated', description: 'Your changes have been saved.' });
            setEditingInvoice(null);
            fetchInvoicesAndRules();
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
            fetchInvoicesAndRules();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not approve the invoice.', variant: 'destructive'});
        }
    };
    
    const handleDelete = async (id: string) => {
         try {
            await deleteDoc(doc(db, 'extractedInvoices', id));
            toast({ title: 'Invoice Deleted', description: 'The invoice has been removed.', variant: 'destructive'});
            fetchInvoicesAndRules();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete the invoice.', variant: 'destructive'});
        }
    }

    const handleDeleteSelected = async () => {
        if (selectedInvoices.length === 0) return;
        try {
            const batch = writeBatch(db);
            selectedInvoices.forEach(id => {
                const docRef = doc(db, 'extractedInvoices', id);
                batch.delete(docRef);
            });
            await batch.commit();
            toast({ title: 'Invoices Deleted', description: `${selectedInvoices.length} invoices have been removed.`, variant: 'destructive'});
            setSelectedInvoices([]);
            fetchInvoicesAndRules();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete selected invoices.', variant: 'destructive'});
        }
    };

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
            if (invoice.lineItems.length > 0) {
                invoice.lineItems.forEach((item, index) => {
                    dataToExport.push({
                        'Invoice Date': index === 0 ? invoice.date : '',
                        'Supplier': index === 0 ? invoice.supplier : '',
                        'Invoice Number': index === 0 ? invoice.invoiceNumber : '',
                        'Line Description': item.description,
                        'Exclusive Amount': item.exclusiveAmount,
                        'VAT Amount': item.vatAmount,
                        'Invoice Total': index === 0 ? invoice.invoiceTotal : '',
                    });
                });
            } else {
                 dataToExport.push({
                    'Invoice Date': invoice.date,
                    'Supplier': invoice.supplier,
                    'Invoice Number': invoice.invoiceNumber,
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
    
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
        const target = e.target as HTMLInputElement;
        if(target.checked) {
            setSelectedInvoices(invoices.map(i => i.id));
        } else {
            setSelectedInvoices([]);
        }
    }
    
    const formatPrice = (price: number) => new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);

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
                 <div className="flex items-center gap-2">
                    <AnalyzeStoryDialog
                        open={isAnalyzeDialogOpen}
                        onOpenChange={setIsAnalyzeDialogOpen}
                        invoices={invoices.filter(i => selectedInvoices.includes(i.id))}
                        onAnalyzeComplete={fetchInvoicesAndRules}
                    />
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={selectedInvoices.length === 0}>
                                <Trash2 className="mr-2 h-4 w-4"/>
                                Delete ({selectedInvoices.length})
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete {selectedInvoices.length} invoice(s). This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelected}>
                                    Yes, Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
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
                            <TableHead className="w-10">
                                <Checkbox
                                    onChange={(e) => handleSelectAll(e as unknown as React.ChangeEvent<HTMLInputElement>)}
                                    checked={selectedInvoices.length === invoices.length && invoices.length > 0} 
                                    aria-label="Select all"
                                />
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Commission #</TableHead>
                            <TableHead>Story Name</TableHead>
                            <TableHead>File</TableHead>
                            <TableHead className="text-right">VAT Amount</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((invoice) => {
                            const totalVat = invoice.lineItems.reduce((sum, item) => sum + item.vatAmount, 0);
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
                                    </TableCell>
                                    <TableCell className="font-medium">{invoice.supplier}</TableCell>
                                    <TableCell>{invoice.commissionNumber || 'N/A'}</TableCell>
                                    <TableCell>{invoice.storyName || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Button asChild variant="link" className="p-0 h-auto">
                                            <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">View Invoice</a>
                                        </Button>
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(totalVat)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatPrice(invoice.invoiceTotal)}</TableCell>
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
                            )
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

    </div>
  );
}

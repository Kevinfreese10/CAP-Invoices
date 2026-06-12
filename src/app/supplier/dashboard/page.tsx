'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion, Timestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, firebaseApp } from '@/lib/firebase';
import { ExtractedInvoice, Commission, User, SecurityRuleContext } from '@/lib/types';
import { cn } from '@/lib/utils';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Sparkles, AlertTriangle, CheckCircle, FileCheck2, Hourglass, FileX2, Eye, Paperclip, X, Banknote, List, ChevronsUpDown, Check, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

const storage = getStorage(firebaseApp);

const approvalAllocations = [
    { label: "Per Diem - Crew", email: "nombuson@combinedartists.co.za" },
    { label: "Field Presenting", email: "nombuson@combinedartists.co.za" },
    { label: "Studio Presenting", email: "nombuson@combinedartists.co.za" },
    { label: "Voice Overs: Weekly Teasers & Promos (English)", email: "nombuson@combinedartists.co.za" },
    { label: "Voice Overs: Teasers (Afrikaans)", email: "nombuson@combinedartists.co.za" },
    { label: "Voice Overs: Throwforwards & Updates", email: "nombuson@combinedartists.co.za" },
    { label: "Voice Overs: Inserts (Guest Presenters)", email: "nombuson@combinedartists.co.za" },
    { label: "Shuttle Service", email: "nombuson@combinedartists.co.za" },
    { label: "Excess Baggage", email: "nombuson@combinedartists.co.za" },
    { label: "Accommodation Reimbursements", email: "nombuson@combinedartists.co.za" },
    { label: "Air Tickets: Inserts", email: "meinie@carteblanche.co.za" },
    { label: "Studio Director", email: "meinie@carteblanche.co.za" },
    { label: "Assistant Studio Director", email: "meinie@carteblanche.co.za" },
    { label: "Floor Manager", email: "meinie@carteblanche.co.za" },
    { label: "Autocue Operator", email: "meinie@carteblanche.co.za" },
    { label: "DOP (Gear & Assistant)", email: "meinie@carteblanche.co.za" },
    { label: "Stylist", email: "meinie@carteblanche.co.za" },
    { label: "Make-Up Artist", email: "meinie@carteblanche.co.za" },
    { label: "Location Fees", email: "meinie@carteblanche.co.za" },
    { label: "Studio Rental", email: "meinie@carteblanche.co.za" },
    { label: "Location Security", email: "meinie@carteblanche.co.za" },
    { label: "Parking", email: "meinie@carteblanche.co.za" },
    { label: "Toll Fees", email: "meinie@carteblanche.co.za" },
    { label: "Mileage & Fuel Claims", email: "meinie@carteblanche.co.za" },
    { label: "Studio Catering", email: "meinie@carteblanche.co.za" },
    { label: "Insert Transcripts", email: "meinie@carteblanche.co.za" },
    { label: "Final Mix: VO Recordings (Promos & Teasers)", email: "meinie@carteblanche.co.za" },
    { label: "Final Mix: Mix (Promos & Teasers)", email: "meinie@carteblanche.co.za" },
    { label: "Final Mix: VO Recordings (Inserts)", email: "meinie@carteblanche.co.za" },
    { label: "Final Mix: Mix (Inserts)", email: "meinie@carteblanche.co.za" },
    { label: "Final Mix: VO Recordings & Mix (Throwforwards & Updates)", email: "meinie@carteblanche.co.za" },
    { label: "External Hard Drives", email: "meinie@carteblanche.co.za" },
    { label: "IT Support", email: "meinie@carteblanche.co.za" },
    { label: "Server Storage", email: "meinie@carteblanche.co.za" },
    { label: "Drycleaning", email: "meinie@carteblanche.co.za" },
    { label: "Edit Suite: Internal Edits", email: "meinie@carteblanche.co.za" },
    { label: "Edit Suite: Weekly Deliveries", email: "meinie@carteblanche.co.za" },
    { label: "Insert Edit: Freelance", email: "meinie@carteblanche.co.za" },
    { label: "Insert Producers (Per Minute Rate)", email: "rudi@combinedartists.co.za" },
    { label: "Editorial Assistant", email: "rudi@combinedartists.co.za" },
    { label: "Viewer Panel Consultant", email: "rudi@combinedartists.co.za" },
    { label: "Research & Development", email: "rudi@combinedartists.co.za" },
    { label: "Investigative", email: "rudi@combinedartists.co.za" },
    { label: "Operational Manager", email: "rudi@combinedartists.co.za" },
    { label: "Production Co-Ordinator", email: "rudi@combinedartists.co.za" },
    { label: "Travel Agent Management", email: "rudi@combinedartists.co.za" },
    { label: "Per Diem - EP", email: "rudi@combinedartists.co.za" },
    { label: "Archive Material", email: "rudi@combinedartists.co.za" },
    { label: "Foreign Specials", email: "rudi@combinedartists.co.za" },
];

const formSchema = z.object({
  invoice: z.custom<FileList>().refine((files) => files && files.length > 0, 'An invoice file is required.'),
  commissionNumber: z.string().min(1, 'Please select a commission number.'),
  approvalAllocation: z.string().min(1, 'Please select what you are invoicing for.'),
});

const calculatePayableAmount = (invoice: ExtractedInvoice) => {
    return invoice.lineItems.reduce((acc, item) => {
        const lineValue = item.exclusiveAmount + item.vatAmount;
        const payeDeduction = item.paye ? lineValue * 0.25 : 0;
        return acc + (lineValue - payeDeduction);
    }, 0);
};

function SupportingDocumentsDialog({ invoice, onUploadComplete }: { invoice: ExtractedInvoice, onUploadComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const { user } = useAuth();
    const { toast } = useToast();

    const handleFileUpload = async () => {
        if (!file || !user) return;
        setIsUploading(true);
        const uniqueFileName = `${Date.now()}-${file.name}`;
        const storageRef = ref(storage, `supporting-documents/${invoice.id}/${uniqueFileName}`);
        
        try {
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);
            
            const newDocument = {
                fileName: file.name,
                fileUrl: downloadURL,
                uploadedBy: user.uid,
                uploadedAt: Timestamp.now(),
            };

            const invoiceRef = doc(db, "extractedInvoices", invoice.id);
            updateDoc(invoiceRef, {
                supportingDocuments: arrayUnion(newDocument)
            }).then(() => {
                toast({ title: "Upload Successful", description: "Your supporting document has been added." });
                setFile(null);
                onUploadComplete();
            }).catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: invoiceRef.path,
                    operation: 'update',
                    requestResourceData: { supportingDocuments: [newDocument] },
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
            });

        } catch (error) {
            console.error("Error uploading supporting document:", error);
            toast({ title: 'Upload Failed', variant: 'destructive' });
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Paperclip className="mr-2 h-4 w-4" />
                    Docs ({invoice.supportingDocuments?.length || 0})
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Supporting Documents for Invoice #{invoice.invoiceNumber}</DialogTitle>
                    <DialogDescription>Upload and manage supporting documents for this invoice.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {invoice.supportingDocuments && invoice.supportingDocuments.length > 0 && (
                        <div>
                            <h4 className="font-medium mb-2">Uploaded Documents:</h4>
                            <ul className="space-y-2">
                                {invoice.supportingDocuments.map((doc, index) => (
                                    <li key={index} className="flex items-center justify-between text-sm p-2 bg-muted rounded-md">
                                        <span className="truncate max-w-[200px]">{doc.fileName}</span>
                                        <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Eye className="h-4 w-4 text-muted-foreground" /></a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    <div className="space-y-2 pt-4">
                        <h4 className="font-medium">Upload New Document</h4>
                        <Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Close</Button>
                    <Button onClick={handleFileUpload} disabled={!file || isUploading}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        Upload File
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function SupplierDashboardPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [isCommissionsLoading, setIsCommissionsLoading] = useState(true);
  const [admins, setAdmins] = useState<User[]>([]);
  const [isAdminsLoading, setIsAdminsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [isCommissionPopoverOpen, setIsCommissionPopoverOpen] = useState(false);
  const [isApproverPopoverOpen, setIsApproverPopoverOpen] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        commissionNumber: '',
        approvalAllocation: '',
    }
  });
  
  const watchedInvoice = form.watch('invoice');

  useEffect(() => {
    if (watchedInvoice && watchedInvoice.length > 0) {
        const file = watchedInvoice[0];
        if (file.type === 'application/pdf') {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewUrl(null);
        }
    } else {
        setPreviewUrl(null);
    }
  }, [watchedInvoice]);

  const approvalAllocationValue = form.watch('approvalAllocation');
  const approver = useMemo(() => {
    if (!approvalAllocationValue || !admins.length) return null;
    const allocation = approvalAllocations.find(a => a.label === approvalAllocationValue);
    if (!allocation) return null;
    return admins.find(admin => admin.email === allocation.email);
  }, [approvalAllocationValue, admins]);
  
  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    setIsCommissionsLoading(true);
    setIsAdminsLoading(true);
    
    // Fetch commissions
    const commsQuery = query(collection(db, 'commissions'), orderBy('commissionNumber', 'asc'));
    getDocs(commsQuery).then(commsSnapshot => {
        const fetchedCommissions = commsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Commission));
        setCommissions(fetchedCommissions);
        setIsCommissionsLoading(false);
    }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: 'commissions',
            operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setIsCommissionsLoading(false);
    });

    // Fetch invoice history
    const historyQuery = query(collection(db, 'extractedInvoices'), where('uploadedBy', '==', user.uid), orderBy('createdAt', 'desc'));
    getDocs(historyQuery).then(querySnapshot => {
        const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
        setInvoices(fetchedInvoices);
        setIsLoadingHistory(false);
    }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: 'extractedInvoices',
            operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setIsLoadingHistory(false);
    });
    
    // Fetch admins/staff for approval mapping
    const adminsQuery = query(collection(db, 'users'), where('role', 'in', ['admin', 'staff', 'cap_supervisor', 'cap_staff']));
    getDocs(adminsQuery).then(adminsSnapshot => {
        const fetchedAdmins = adminsSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id } as User));
        setAdmins(fetchedAdmins);
        setIsAdminsLoading(false);
    }).catch(async (serverError) => {
        const permissionError = new FirestorePermissionError({
            path: 'users',
            operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
        setIsAdminsLoading(false);
    });
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user?.uid) {
      toast({ title: 'Error', description: 'You must be logged in to upload.', variant: 'destructive' });
      return;
    }
    const file = values.invoice[0];
    if (!file) {
      toast({ title: 'No file selected', variant: 'destructive' });
      return;
    }

    setIsUploading(true);

    try {
      const reader = new FileReader();
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const dataUrl = await dataUrlPromise;
      
      const storageRef = ref(storage, `invoices/supplier-uploads/${user.uid}/${Date.now()}-${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(uploadResult.ref);

      const result = await extractInvoiceData({ invoiceImage: dataUrl });

      if (!result || !result.supplier) {
        toast({
            title: 'Extraction Failed',
            description: 'The AI could not read the required details from the invoice. Please try a clearer image.',
            variant: 'destructive',
            duration: 9000,
        });
        setIsUploading(false);
        return;
      }
      
      const allocation = approvalAllocations.find(a => a.label === values.approvalAllocation);
      
      const invoiceData = {
          ...result,
          commissionNumber: values.commissionNumber,
          assignedToEmail: allocation?.email || null,
          fileName: file.name,
          fileUrl: downloadURL,
          status: 'pending_review' as const,
          uploadedBy: user.uid,
          createdAt: serverTimestamp(),
      };

      const collRef = collection(db, "extractedInvoices");
      addDoc(collRef, invoiceData).then(() => {
        toast({ title: 'Upload Successful', description: 'Your invoice has been submitted for review.' });
        form.reset();
        fetchDashboardData();
      }).catch(async (serverError) => {
          const permissionError = new FirestorePermissionError({
              path: collRef.path,
              operation: 'create',
              requestResourceData: invoiceData,
          } satisfies SecurityRuleContext);
          errorEmitter.emit('permission-error', permissionError);
      });

    } catch (error) {
      console.error("Invoice upload error:", error);
      toast({ title: 'Upload Failed', description: 'Could not process the invoice.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const getRejectedByName = (userId?: string) => {
    if (!userId) return 'System';
    const admin = admins.find(a => a.uid === userId || a.id === userId);
    return admin ? admin.name : 'Unknown User';
  }

  const getStatusBadge = (status: ExtractedInvoice['status']) => {
    switch (status) {
        case 'paid': return <Badge variant={'success'}><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>;
        case 'approved_for_payment': return <Badge variant={'payment'}><FileCheck2 className="mr-1 h-3 w-3" />Approved for Payment</Badge>;
        case 'batched_for_payment': return <Badge variant={'payment'}><FileCheck2 className="mr-1 h-3 w-3" />Batched</Badge>;
        case 'rejected': return <Badge variant={'destructive'}><FileX2 className="mr-1 h-3 w-3" />Rejected</Badge>;
        case 'duplicate': return <Badge variant={'destructive'}><AlertTriangle className="mr-1 h-3 w-3" />Duplicate</Badge>;
        default: return <Badge variant={'warning'}><Hourglass className="mr-1 h-3 w-3" />{status.replace(/_/g, ' ')}</Badge>;
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
  };

  const paymentBatches = useMemo(() => {
    const batches: { [key: string]: { invoices: ExtractedInvoice[], total: number, status: string } } = {};
    
    invoices.filter(inv => inv.paymentBatch && (inv.status === 'batched_for_payment' || inv.status === 'paid')).forEach(inv => {
        const batchKey = inv.paymentBatch!;
        if (!batches[batchKey]) {
            batches[batchKey] = { invoices: [], total: 0, status: 'batched' };
        }
        batches[batchKey].invoices.push(inv);
        batches[batchKey].total += calculatePayableAmount(inv);
        if (inv.status === 'paid') {
            batches[batchKey].status = 'paid';
        }
    });

    return Object.entries(batches).sort((a, b) => b[0].localeCompare(a[0]));
  }, [invoices]);


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Supplier Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.contactPerson || user?.name}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit New Invoice</CardTitle>
          <CardDescription>Upload an invoice in PDF format. You can review the file before submitting.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="commissionNumber"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>Commission Number</FormLabel>
                        <Popover open={isCommissionPopoverOpen} onOpenChange={setIsCommissionPopoverOpen}>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between font-normal text-left",
                                            !field.value && "text-muted-foreground"
                                        )}
                                        disabled={isCommissionsLoading}
                                    >
                                        <span className="truncate">
                                            {isCommissionsLoading ? "Loading commissions..." : 
                                             field.value
                                                ? `${field.value} - ${commissions.find((c) => c.commissionNumber === field.value)?.storyName || ''}`
                                                : "Select a commission..."}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search commission..." />
                                    <CommandList>
                                        <CommandEmpty>No commission found.</CommandEmpty>
                                        <CommandGroup>
                                            {commissions.map((c) => (
                                                <CommandItem
                                                    value={`${c.commissionNumber} ${c.storyName}`.toLowerCase()}
                                                    key={c.id}
                                                    onSelect={() => {
                                                        form.setValue("commissionNumber", c.commissionNumber);
                                                        setIsCommissionPopoverOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            c.commissionNumber === field.value ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {c.commissionNumber} - {c.storyName}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                 <FormField
                    control={form.control}
                    name="approvalAllocation"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                        <FormLabel>What are you invoicing for</FormLabel>
                        <Popover open={isApproverPopoverOpen} onOpenChange={setIsApproverPopoverOpen}>
                            <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                            "w-full justify-between font-normal text-left",
                                            !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        <span className="truncate">
                                            {field.value
                                                ? field.value
                                                : "Select what you are invoicing for..."}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                            </PopoverTrigger>
                            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search invoicing category..." />
                                    <CommandList>
                                        <CommandEmpty>No category found.</CommandEmpty>
                                        <CommandGroup>
                                            {approvalAllocations.map((acc) => (
                                                <CommandItem
                                                    value={acc.label.toLowerCase()}
                                                    key={acc.label}
                                                    onSelect={() => {
                                                        form.setValue("approvalAllocation", acc.label);
                                                        setIsApproverPopoverOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 h-4 w-4",
                                                            acc.label === field.value ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {acc.label}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {approver && (
                            <FormDescription>
                                Approver: {approver.name}
                            </FormDescription>
                        )}
                        <FormMessage />
                        </FormItem>
                    )}
                    />
              </div>
              <FormField
                control={form.control}
                name="invoice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice File (PDF)</FormLabel>
                    <FormControl>
                      <Input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => field.onChange(e.target.files)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {previewUrl && (
                <div className="mt-6 space-y-4">
                    <div className="flex items-center justify-between border-b pb-2">
                        <h4 className="font-semibold text-lg flex items-center gap-2">
                            <Eye className="h-5 w-5 text-primary" />
                            File Review
                        </h4>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => {
                                setPreviewUrl(null);
                                form.setValue('invoice', {} as FileList, { shouldValidate: true });
                            }}
                        >
                            <X className="h-4 w-4 mr-2" />
                            Clear File
                        </Button>
                    </div>
                    <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white shadow-inner h-[500px]">
                        <iframe src={previewUrl} className="w-full h-full" title="Invoice Preview" />
                    </div>
                    <p className="text-sm text-muted-foreground italic flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Please ensure the document is clear and all details are legible before submitting.
                    </p>
                </div>
              )}

              <Button type="submit" disabled={isUploading || !watchedInvoice || watchedInvoice.length === 0} size="lg" className="w-full sm:w-auto">
                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUploading ? 'Processing...' : 'Review Complete - Upload & Submit'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
      <Tabs defaultValue="history" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="history" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                Invoice History
            </TabsTrigger>
            <TabsTrigger value="batches" className="flex items-center gap-2">
                <Banknote className="h-4 w-4" />
                Payment Batches
            </TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="mt-6">
            <Card>
                <CardHeader>
                <CardTitle>My Invoice History</CardTitle>
                <CardDescription>Track the status of your submitted invoices.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingHistory ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : invoices.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">You have not submitted any invoices yet.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Invoice #</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Commission #</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Payment Batch</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {invoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                                        <TableCell>{invoice.date}</TableCell>
                                        <TableCell>{invoice.commissionNumber || 'N/A'}</TableCell>
                                        <TableCell>
                                            {getStatusBadge(invoice.status)}
                                            {invoice.status === 'rejected' && invoice.rejectionReason && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <p className="text-xs text-muted-foreground mt-1 cursor-pointer truncate max-w-[200px]">
                                                                Reason: {invoice.rejectionReason}
                                                            </p>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p className="max-w-sm">
                                                                <strong>Reason:</strong> {invoice.rejectionReason}<br />
                                                                <strong>By:</strong> {getRejectedByName(invoice.rejectedBy)}
                                                            </p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {invoice.paymentBatch && invoice.paymentBatch !== 'private' ? (
                                                <Badge variant="outline">{format(parseISO(invoice.paymentBatch), 'dd MMM yyyy')}</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-xs">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-mono">
                                            {['pending_review', 'duplicate', 'extraction_failed'].includes(invoice.status) ? (
                                                <span className="text-muted-foreground italic text-xs">Reviewing...</span>
                                            ) : (
                                                formatPrice(invoice.invoiceTotal)
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right space-x-1">
                                            <SupportingDocumentsDialog invoice={invoice} onUploadComplete={fetchDashboardData} />
                                            <Button asChild variant="ghost" size="icon">
                                                <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    <Eye className="h-4 w-4" />
                                                </a>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="batches" className="mt-6">
            <Card>
                <CardHeader>
                    <CardTitle>Payment Batches</CardTitle>
                    <CardDescription>View grouped invoice payments and upcoming batch totals.</CardDescription>
                </CardHeader>
                <CardContent>
                     {isLoadingHistory ? (
                        <div className="flex justify-center items-center h-40">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : paymentBatches.length === 0 ? (
                        <p className="text-center text-muted-foreground py-10">No payment batches have been scheduled yet.</p>
                    ) : (
                        <div className="space-y-6">
                            {paymentBatches.map(([date, data]) => (
                                <Card key={date} className="overflow-hidden border-primary/20">
                                    <CardHeader className="bg-primary/5 py-3">
                                        <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-2">
                                                <CardTitle className="text-lg">
                                                    {format(parseISO(date), 'dd MMMM yyyy')}
                                                </CardTitle>
                                                <Badge variant={data.status === 'paid' ? 'success' : 'payment'}>
                                                    {data.status === 'paid' ? 'Paid' : 'Scheduled'}
                                                </Badge>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-muted-foreground">Total Batch Payout (Net)</p>
                                                <p className="text-lg font-bold text-primary">{formatPrice(data.total)}</p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="pl-6">Invoice #</TableHead>
                                                    <TableHead>Invoice Date</TableHead>
                                                    <TableHead className="text-right pr-6">Net Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data.invoices.map((invoice) => {
                                                    const payable = calculatePayableAmount(invoice);
                                                    return (
                                                        <TableRow key={invoice.id}>
                                                            <TableCell className="pl-6 font-medium">{invoice.invoiceNumber}</TableCell>
                                                            <TableCell>{invoice.date}</TableCell>
                                                            <TableCell className="text-right pr-6 font-mono">{formatPrice(payable)}</TableCell>
                                                        </TableRow>
                                                    )
                                                })}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
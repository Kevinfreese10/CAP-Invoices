
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, firebaseApp } from '@/lib/firebase';
import { ExtractedInvoice, Commission } from '@/lib/types';
import { s39ChartOfAccounts } from '@/lib/cap-chart-of-accounts'; // Import s39 accounts

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Import Select components
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, Sparkles, AlertTriangle, CheckCircle, FileCheck2, Hourglass, FileX2, Eye } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';

const storage = getStorage(firebaseApp);

const formSchema = z.object({
  invoice: z.custom<FileList>().refine((files) => files && files.length > 0, 'An invoice file is required.'),
  commissionNumber: z.string().min(1, 'Please select a commission number.'),
  s39AccountId: z.string().min(1, 'Please select an S39 account to allocate to.'),
});

export default function SupplierDashboardPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
        commissionNumber: '',
        s39AccountId: '',
    }
  });
  
  const fetchInvoiceHistoryAndCommissions = useCallback(async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
        // Fetch commissions
        const commsQuery = query(collection(db, 'commissions'), orderBy('commissionNumber', 'asc'));
        const commsSnapshot = await getDocs(commsQuery);
        const fetchedCommissions = commsSnapshot.docs.map(doc => doc.data() as Commission);
        setCommissions(fetchedCommissions);

        // Fetch invoice history
        const q = query(collection(db, 'extractedInvoices'), where('uploadedBy', '==', user.uid), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
        setInvoices(fetchedInvoices);
    } catch (error) {
        console.error("Error fetching data:", error);
        toast({ title: 'Error', description: 'Could not load your data.', variant: 'destructive' });
    } finally {
        setIsLoadingHistory(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchInvoiceHistoryAndCommissions();
  }, [fetchInvoiceHistoryAndCommissions]);

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
    toast({ title: 'Uploading & Processing Invoice...', description: 'AI is extracting data. Please wait.' });

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
      
      const lineItemsWithAccount = result.lineItems.map(item => ({
        ...item,
        accountId: values.s39AccountId,
      }));

      const invoiceData = {
          ...result,
          lineItems: lineItemsWithAccount,
          commissionNumber: values.commissionNumber,
          fileName: file.name,
          fileUrl: downloadURL,
          status: 'pending_review' as const,
          uploadedBy: user.uid,
          createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "extractedInvoices"), invoiceData);

      toast({ title: 'Upload Successful', description: 'Your invoice has been submitted for review.' });
      form.reset();
      fetchInvoiceHistoryAndCommissions();

    } catch (error) {
      console.error("Invoice upload error:", error);
      toast({ title: 'Upload Failed', description: 'Could not process the invoice.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusBadge = (status: ExtractedInvoice['status']) => {
    switch (status) {
        case 'paid': return <Badge variant={'success'}><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>;
        case 'approved_for_payment': return <Badge variant={'payment'}><FileCheck2 className="mr-1 h-3 w-3" />Approved for Payment</Badge>;
        case 'batched_for_payment': return <Badge variant={'payment'}><FileCheck2 className="mr-1 h-3 w-3" />Batched for Payment</Badge>;
        case 'rejected': return <Badge variant={'destructive'}><FileX2 className="mr-1 h-3 w-3" />Rejected</Badge>;
        case 'duplicate': return <Badge variant={'destructive'}><AlertTriangle className="mr-1 h-3 w-3" />Duplicate</Badge>;
        default: return <Badge variant={'warning'}><Hourglass className="mr-1 h-3 w-3" />{status.replace(/_/g, ' ')}</Badge>;
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(price);
  };


  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Supplier Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {user?.contactPerson || user?.name}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Submit New Invoice</CardTitle>
          <CardDescription>Upload an invoice in PDF format. The system will automatically extract the details.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="commissionNumber"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Commission Number</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} disabled={commissions.length === 0}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select a commission..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {commissions.map(c => <SelectItem key={c.id} value={c.commissionNumber}>{c.commissionNumber} - {c.storyName}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                 <FormField
                    control={form.control}
                    name="s39AccountId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>S39 Account Allocation</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                            <SelectTrigger>
                                <SelectValue placeholder="Select an account..." />
                            </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                            {s39ChartOfAccounts.map(acc => <SelectItem key={acc.accountNumber} value={acc.accountNumber}>{acc.accountNumber} - {acc.description}</SelectItem>)}
                            </SelectContent>
                        </Select>
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
              <Button type="submit" disabled={isUploading}>
                {isUploading ? <Sparkles className="mr-2 h-4 w-4 animate-ping" /> : <Upload className="mr-2 h-4 w-4" />}
                {isUploading ? 'Processing...' : 'Upload & Submit Invoice'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
      
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
                                <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                                <TableCell className="text-right font-mono">{formatPrice(invoice.invoiceTotal)}</TableCell>
                                <TableCell className="text-right">
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
    </div>
  );
}

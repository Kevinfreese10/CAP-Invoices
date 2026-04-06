
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { getFirestore, collection, addDoc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, firebaseApp } from '@/lib/firebase';
import { ExtractedInvoice } from '@/lib/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
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
});

export default function SupplierDashboardPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });
  
  const fetchInvoiceHistory = useCallback(async () => {
    if (!user) return;
    setIsLoadingHistory(true);
    try {
        const q = query(collection(db, 'extractedInvoices'), where('uploadedBy', '==', user.uid), orderBy('createdAt', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedInvoices = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExtractedInvoice));
        setInvoices(fetchedInvoices);
    } catch (error) {
        console.error("Error fetching invoice history:", error);
        toast({ title: 'Error', description: 'Could not load your invoice history.', variant: 'destructive' });
    } finally {
        setIsLoadingHistory(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchInvoiceHistory();
  }, [fetchInvoiceHistory]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
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

      if (!result || !result.supplier || result.supplier.toLowerCase() !== user.companyName?.toLowerCase()) {
        toast({
            title: 'Extraction or Validation Failed',
            description: 'The AI could not read the invoice or the supplier name does not match your profile. Please ensure the invoice is for "' + user.companyName + '".',
            variant: 'destructive',
            duration: 9000,
        });
        setIsUploading(false);
        return;
      }
      
      const invoiceData = {
          ...result,
          fileName: file.name,
          fileUrl: downloadURL,
          status: 'pending_review' as const,
          uploadedBy: user.uid,
          createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "extractedInvoices"), invoiceData);

      toast({ title: 'Upload Successful', description: 'Your invoice has been submitted for review.' });
      form.reset();
      fetchInvoiceHistory();

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

    
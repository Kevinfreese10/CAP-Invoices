
'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Sparkles, FileText } from 'lucide-react';
import { extractInvoiceData, ExtractInvoiceDataOutput } from '@/ai/flows/extract-invoice-data';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getFirestore, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

const storage = getStorage(firebaseApp);
const db = getFirestore(firebaseApp);

const formSchema = z.object({
  invoice: z.custom<FileList>().refine((files) => files && files.length > 0, 'An invoice file is required.'),
});


export default function CAPSuppliersPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const file = values.invoice[0];
    if (!preview || !user?.uid) {
      toast({ title: 'Error', description: 'No file or user session available.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    toast({ title: 'Uploading Invoice...', description: 'Please wait while the file is being uploaded.' });
    
    const storageRef = ref(storage, `invoices/${user.uid}/${Date.now()}-${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed', 
        null, 
        (error) => {
            console.error('Upload failed:', error);
            toast({ title: 'Upload Failed', description: 'Could not upload the invoice file.', variant: 'destructive' });
            setIsUploading(false);
        }, 
        async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            setIsUploading(false);
            setIsExtracting(true);
            toast({ title: 'Upload Complete!', description: 'Now extracting data with AI...' });

            try {
                const result = await extractInvoiceData({ invoiceImage: preview });
                
                await addDoc(collection(db, "extractedInvoices"), {
                    ...result,
                    pdfUrl: downloadURL,
                    fileName: file.name,
                    status: 'pending_review',
                    uploadedBy: user.uid,
                    createdAt: serverTimestamp(),
                });

                toast({ title: 'Extraction Complete!', description: 'Data successfully extracted and saved.' });
                router.push('/admin/cap-suppliers/control-sheet');

            } catch (error) {
                console.error('Invoice extraction error:', error);
                toast({ title: 'Extraction Failed', description: 'Could not extract data from the invoice. Please try again.', variant: 'destructive' });
            } finally {
                setIsExtracting(false);
            }
        }
    );
  };

  const isLoading = isUploading || isExtracting;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">CAP Suppliers</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Upload Invoice</CardTitle>
            <CardDescription>Upload an invoice PDF to automatically extract its details using AI.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="invoice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice File</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="application/pdf"
                          onChange={(e) => {
                            field.onChange(e.target.files);
                            handleFileChange(e);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {preview && (
                  <div className="relative mt-4 aspect-auto w-full overflow-hidden rounded-md border h-[700px]">
                    <object data={preview} type="application/pdf" width="100%" height="100%">
                        <p>This browser does not support PDF previews. Please download the PDF to view it: <a href={preview}>Download PDF</a></p>
                    </object>
                  </div>
                )}
                <Button type="submit" disabled={isLoading || !preview}>
                  {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : isExtracting ? <Sparkles className="mr-2 h-4 w-4 animate-ping" /> : <Upload className="mr-2 h-4 w-4" />}
                  {isUploading ? 'Uploading...' : isExtracting ? 'Extracting Data...' : 'Upload & Extract'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>How it Works</CardTitle>
            <CardDescription>Follow these steps to process an invoice.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg p-4">
                <FileText className="h-10 w-10 mb-4" />
                <p className="font-semibold">Your extracted data will be displayed on the Control Sheet.</p>
                <p className="text-sm mt-2">1. Upload an invoice PDF.</p>
                <p className="text-sm">2. Click "Upload & Extract".</p>
                <p className="text-sm">3. You will be redirected to the Control Sheet to review.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

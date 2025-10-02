
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Sparkles, FileText } from 'lucide-react';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import { getAuth } from 'firebase/auth';
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

const auth = getAuth(firebaseApp);

const formSchema = z.object({
  invoice: z.custom<FileList>().refine((files) => files && files.length > 0, 'An invoice file is required.'),
});

const SESSION_STORAGE_KEY = 'cap-invoice-preview';

export default function CAPSuppliersPage() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    // On component mount, check if there's an invoice in session storage
    const savedInvoice = sessionStorage.getItem(SESSION_STORAGE_KEY);
    const savedFileName = sessionStorage.getItem(`${SESSION_STORAGE_KEY}_name`);
    if (savedInvoice) {
      setPreview(savedInvoice);
    }
    if (savedFileName) {
        setFileName(savedFileName);
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setPreview(dataUrl);
        setFileName(file.name);
        // Save the data URL to session storage
        sessionStorage.setItem(SESSION_STORAGE_KEY, dataUrl);
        sessionStorage.setItem(`${SESSION_STORAGE_KEY}_name`, file.name);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
      setFileName(null);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(`${SESSION_STORAGE_KEY}_name`);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const currentUser = auth.currentUser;

    if (!preview || !currentUser?.uid) {
      toast({ title: 'Error', description: 'No file selected or you are not logged in.', variant: 'destructive' });
      return;
    }

    setIsExtracting(true);
    toast({ title: 'Extracting Data with AI...', description: 'Please wait while the invoice is being processed.' });
    
    try {
        const result = await extractInvoiceData({ invoiceImage: preview });

        if (!result || !result.supplier) {
            toast({ title: 'Extraction Failed', description: 'AI could not extract valid data from the invoice. Please try a clearer image.', variant: 'destructive' });
            setIsExtracting(false);
            return;
        }
        
        const invoiceData = {
            ...result,
            fileName: fileName || 'N/A',
            status: 'pending_review' as const,
            uploadedBy: currentUser.uid,
            createdAt: serverTimestamp(),
        };
        
        const collRef = collection(db, "extractedInvoices");
        addDoc(collRef, invoiceData)
          .then(() => {
              toast({ title: 'Extraction Complete!', description: 'Data successfully extracted and saved for review.' });
              sessionStorage.removeItem(SESSION_STORAGE_KEY); // Clear storage on success
              sessionStorage.removeItem(`${SESSION_STORAGE_KEY}_name`);
              router.push('/admin/cap-suppliers/control-sheet');
          })
          .catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: collRef.path,
                operation: 'create',
                requestResourceData: invoiceData,
            } satisfies SecurityRuleContext);
            errorEmitter.emit('permission-error', permissionError);
            setIsExtracting(false);
          });

    } catch (error) {
        console.error('Invoice extraction error:', error);
        toast({ title: 'Extraction Failed', description: 'Could not extract data from the invoice. Please try again.', variant: 'destructive' });
        setIsExtracting(false);
    }
  };

  const isLoading = isExtracting;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">CAP Suppliers</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Upload Invoice</CardTitle>
            <CardDescription>Upload an invoice PDF or image to automatically extract its details using AI.</CardDescription>
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
                          accept="application/pdf,image/*"
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
                    <object data={preview} type={form.getValues('invoice')?.[0]?.type || 'application/pdf'} width="100%" height="100%">
                        <p>This browser does not support PDF previews. Please download the file to view it.</p>
                    </object>
                  </div>
                )}
                <Button type="submit" disabled={isLoading || !preview || !user}>
                  {isExtracting ? <Sparkles className="mr-2 h-4 w-4 animate-ping" /> : <Upload className="mr-2 h-4 w-4" />}
                  {isExtracting ? 'Extracting Data...' : 'Extract Invoice Data'}
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
                <p className="text-sm mt-2">1. Upload an invoice file.</p>
                <p className="text-sm">2. Click "Extract Invoice Data".</p>
                <p className="text-sm">3. You will be redirected to the Control Sheet to review.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

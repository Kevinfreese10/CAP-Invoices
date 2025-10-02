
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
import { Loader2, Upload, Sparkles, FileText, X } from 'lucide-react';
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
  invoices: z.custom<FileList>().refine((files) => files && files.length > 0, 'At least one invoice file is required.'),
});

const SESSION_STORAGE_KEY_PREVIEWS = 'cap-invoice-previews';
const SESSION_STORAGE_KEY_NAMES = 'cap-invoice-filenames';


export default function CAPSuppliersPage() {
  const [isExtracting, setIsExtracting] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const { toast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    // On component mount, check for invoices in session storage
    const savedPreviews = sessionStorage.getItem(SESSION_STORAGE_KEY_PREVIEWS);
    const savedFileNames = sessionStorage.getItem(SESSION_STORAGE_KEY_NAMES);
    if (savedPreviews) {
      setPreviews(JSON.parse(savedPreviews));
    }
    if (savedFileNames) {
      setFileNames(JSON.parse(savedFileNames));
    }
  }, []);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const newPreviews: string[] = [];
      const newFileNames: string[] = [];
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          newPreviews.push(reader.result as string);
          newFileNames.push(file.name);
          if (newPreviews.length === files.length) {
            setPreviews(newPreviews);
            setFileNames(newFileNames);
            sessionStorage.setItem(SESSION_STORAGE_KEY_PREVIEWS, JSON.stringify(newPreviews));
            sessionStorage.setItem(SESSION_STORAGE_KEY_NAMES, JSON.stringify(newFileNames));
          }
        };
        reader.readAsDataURL(file);
      });
    } else {
      setPreviews([]);
      setFileNames([]);
      sessionStorage.removeItem(SESSION_STORAGE_KEY_PREVIEWS);
      sessionStorage.removeItem(SESSION_STORAGE_KEY_NAMES);
    }
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    const currentUser = auth.currentUser;

    if (previews.length === 0 || !currentUser?.uid) {
      toast({ title: 'Error', description: 'No files selected or you are not logged in.', variant: 'destructive' });
      return;
    }

    setIsExtracting(true);
    toast({ title: 'Batch Extraction Started...', description: `Processing ${previews.length} invoice(s). You will be redirected when complete.` });
    
    let successCount = 0;

    for (let i = 0; i < previews.length; i++) {
        const preview = previews[i];
        const fileName = fileNames[i];
        
        toast({ title: `Processing Invoice ${i + 1} of ${previews.length}`, description: `${fileName}` });

        try {
            const result = await extractInvoiceData({ invoiceImage: preview });

            if (!result || !result.supplier) {
                 toast({ title: `Extraction Failed for ${fileName}`, description: 'AI could not extract valid data. Skipping this file.', variant: 'destructive' });
                continue;
            }
            
            const invoiceData = {
                ...result,
                fileName: fileName || 'N/A',
                status: 'pending_review' as const,
                uploadedBy: currentUser.uid,
                createdAt: serverTimestamp(),
            };
            
            const collRef = collection(db, "extractedInvoices");
            await addDoc(collRef, invoiceData).catch(async (serverError) => {
                const permissionError = new FirestorePermissionError({
                    path: collRef.path,
                    operation: 'create',
                    requestResourceData: invoiceData,
                } satisfies SecurityRuleContext);
                errorEmitter.emit('permission-error', permissionError);
                throw serverError; // Re-throw to be caught by outer catch
            });
            successCount++;

        } catch (error) {
            console.error(`Invoice extraction error for ${fileName}:`, error);
            toast({ title: `Extraction Failed for ${fileName}`, description: 'Could not extract data from this invoice. Skipping.', variant: 'destructive' });
        }
    }
    
    setIsExtracting(false);
    
    if (successCount > 0) {
        toast({ title: 'Batch Complete!', description: `${successCount} out of ${previews.length} invoices successfully extracted.` });
        sessionStorage.removeItem(SESSION_STORAGE_KEY_PREVIEWS);
        sessionStorage.removeItem(SESSION_STORAGE_KEY_NAMES);
        router.push('/admin/cap-suppliers/review');
    } else {
        toast({ title: 'Batch Failed', description: 'No invoices could be processed.', variant: 'destructive' });
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
            <CardTitle>Upload Invoices</CardTitle>
            <CardDescription>Upload one or more invoice PDFs or images to automatically extract their details using AI.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="invoices"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Invoice Files</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept="application/pdf,image/*"
                          multiple
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
                {previews.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Selected Files:</h3>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2">
                        {previews.map((previewUrl, index) => (
                           <div key={index} className="relative mt-4 aspect-video w-full overflow-hidden rounded-md border">
                                <object data={previewUrl} type="application/pdf" width="100%" height="100%">
                                  <div className="p-4 text-xs text-center text-muted-foreground">
                                    <p>{fileNames[index]}</p>
                                    <p>No preview available for this file type.</p>
                                  </div>
                                </object>
                                <div className="absolute top-1 right-1 bg-background/50 backdrop-blur-sm rounded-md p-1 text-xs">{fileNames[index]}</div>
                            </div>
                        ))}
                    </div>
                  </div>
                )}
                <Button type="submit" disabled={isLoading || previews.length === 0 || !user}>
                  {isExtracting ? <Sparkles className="mr-2 h-4 w-4 animate-ping" /> : <Upload className="mr-2 h-4 w-4" />}
                  {isExtracting ? `Extracting ${previews.length} Invoices...` : `Extract ${previews.length} Invoices`}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card className="sticky top-24">
          <CardHeader>
            <CardTitle>How it Works</CardTitle>
            <CardDescription>Follow these steps to process invoices.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground border-2 border-dashed rounded-lg p-4">
                <FileText className="h-10 w-10 mb-4" />
                <p className="font-semibold">Extracted data will appear on the Review page.</p>
                <p className="text-sm mt-2">1. Upload one or more invoice files.</p>
                <p className="text-sm">2. Click "Extract Invoices".</p>
                <p className="text-sm">3. You will be redirected to the Review page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

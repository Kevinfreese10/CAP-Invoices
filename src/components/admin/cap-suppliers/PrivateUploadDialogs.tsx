'use client';

import React, { useState } from 'react';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { extractInvoiceData } from '@/ai/flows/extract-invoice-data';
import ManualInvoiceForm from '@/components/admin/cap-suppliers/ManualInvoiceForm';
import { Loader2, PlusCircle } from 'lucide-react';

const db = getFirestore(firebaseApp);
const storage = getStorage(firebaseApp);

export function AIExtractPrivateUploadDialog({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleUploadAndExtract = async () => {
        if (!file) {
            toast({ title: 'No file selected', variant: 'destructive' });
            return;
        }

        setIsExtracting(true);
        toast({ title: 'Processing Invoice...', description: 'AI is extracting data. Please wait.' });

        try {
            // 1. Upload file to storage
            const storageRef = ref(storage, `invoices/manual-ai-private/${Date.now()}-${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            // 2. Convert file to data URL for AI
            const reader = new FileReader();
            const dataUrlPromise = new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
            });
            reader.readAsDataURL(file);
            const dataUrl = await dataUrlPromise;

            // 3. Extract data using AI
            const result = await extractInvoiceData({ invoiceImage: dataUrl });

             if (!result || !result.supplier || !result.invoiceNumber) {
                toast({
                    title: 'Extraction Failed',
                    description: 'The AI could not read the required details from the invoice. Please try a clearer image or use the manual upload.',
                    variant: 'destructive',
                    duration: 9000,
                });
                setIsExtracting(false);
                return;
            }
            
            // 4. Save to Firestore with a status based on privacy
            const invoiceData = {
                ...result,
                fileName: file.name,
                fileUrl: downloadURL,
                status: 'pending_review',
                paymentBatch: 'private',
                isPrivate: true,
                uploadedBy: 'manual_ai_upload',
                createdAt: serverTimestamp(),
                note: 'Manually added as a private invoice via AI upload.',
            };

            await addDoc(collection(db, "extractedInvoices"), invoiceData);

            toast({ 
                title: 'Upload Successful', 
                description: 'The private invoice has been extracted and sent for 1st review.' 
            });
            onUploadComplete();
            setFile(null);
            setIsOpen(false);

        } catch (error) {
            console.error("AI upload error:", error);
            toast({ title: 'Upload Failed', description: 'Could not process the invoice.', variant: 'destructive' });
        } finally {
            setIsExtracting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button variant="outline">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Upload with AI
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Upload Private Invoice (AI Extraction)</DialogTitle>
                    <DialogDescription>Select an invoice PDF or image. The AI will extract the details.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input id="invoice-file" type="file" accept="application/pdf,image/*" onChange={handleFileChange} />
                    <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="is-private" checked={true} disabled />
                        <label htmlFor="is-private" className="text-sm font-medium leading-none text-muted-foreground">
                            Mark as Private & Confidential (Forced)
                        </label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                    <Button onClick={handleUploadAndExtract} disabled={!file || isExtracting}>
                        {isExtracting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Upload and Extract
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function ManualPrivateUploadDialog({ onUploadComplete }: { onUploadComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const { toast } = useToast();

    const handleSave = async (data: any, file: File) => {
        toast({ title: 'Uploading Invoice...', description: 'Please wait.' });
        try {
            const storageRef = ref(storage, `invoices/manual-private/${Date.now()}-${file.name}`);
            const uploadResult = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(uploadResult.ref);

            const invoiceData = {
                ...data,
                fileName: file.name,
                fileUrl: downloadURL,
                uploadedBy: 'manual_upload',
                createdAt: serverTimestamp(),
                status: 'pending_review',
                paymentBatch: 'private',
                note: 'Manually added as a private invoice.',
                isPrivate: true,
            };

            await addDoc(collection(db, "extractedInvoices"), invoiceData);

            toast({ title: 'Upload Successful', description: 'The private invoice has been sent for 1st review.' });
            onUploadComplete();
            setIsOpen(false);
        } catch (error) {
            console.error("Manual upload error:", error);
            toast({ title: 'Upload Failed', description: 'Could not save the invoice.', variant: 'destructive' });
        }
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                 <Button>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Manual Upload
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Manual Private Invoice Upload</DialogTitle>
                    <DialogDescription>Enter the invoice details manually. This will add it directly to the private & confidential payment batch.</DialogDescription>
                </DialogHeader>
                <ManualInvoiceForm onSave={handleSave} onCancel={() => setIsOpen(false)} />
            </DialogContent>
        </Dialog>
    );
}

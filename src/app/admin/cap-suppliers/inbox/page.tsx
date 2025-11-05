
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox, RefreshCw, FileWarning, Plug, Paperclip, CheckCircle2, RotateCw, Trash2, FileSymlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { sendEmail } from '@/lib/email';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


const db = getFirestore(firebaseApp);

interface Attachment {
    filename: string;
    contentType: string;
    dataUrl: string;
    size: number;
}

interface Email {
    uid: number;
    from: string;
    subject: string;
    date: string;
    body: string;
    attachments: Attachment[];
    isProcessed?: boolean;
}

export default function InboxPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
    const { toast } = useToast();
    
    const handleProcessAttachments = useCallback(async (email: Email, reprocess = false) => {
        const processableAttachments = email.attachments.filter(att => 
            att.contentType === 'application/pdf' ||
            att.contentType === 'application/msword' ||
            att.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );

        if (processableAttachments.length === 0) {
            return;
        }

        try {
            await fetch('/api/emails/process-attachments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, reprocess }),
            });
        } catch (err: any) {
             toast({
                title: `Processing Failed for email from ${email.from}`,
                description: err.message,
                variant: "destructive",
            });
        }
    }, [toast]);
    
    const fetchEmails = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const processedSnapshot = await getDocs(collection(db, 'processedEmails'));
            const processedUids = new Set(processedSnapshot.docs.map(doc => doc.data().uid));
            const response = await fetch('/api/emails/inbox');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch emails');
            }
            const data: Email[] = await response.json();
            const emailsWithStatus = data.map(email => ({
                ...email,
                isProcessed: processedUids.has(email.uid),
            }));
            setEmails(emailsWithStatus);
        } catch (err: any) {
            console.error("Error fetching emails:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleProcessSelected = async (reprocess = false) => {
        const emailsToProcess = emails.filter(email => selectedUids.has(email.uid));
        if (emailsToProcess.length === 0) {
            toast({ title: 'No Emails Selected', description: 'Please select at least one email to process.' });
            return;
        }
        
        if (!reprocess && emailsToProcess.every(e => e.isProcessed)) {
             toast({ title: 'No Unprocessed Emails', description: 'All selected emails have already been processed. Use "Reprocess" to process them again.' });
             return;
        }

        setIsProcessing(true);
        toast({ title: `Processing ${emailsToProcess.length} email(s)...`, description: 'This may take a moment.' });
        
        for (const email of emailsToProcess) {
            // Only process if it's unprocessed, OR if reprocess is true
            if (!email.isProcessed || reprocess) {
               await handleProcessAttachments(email, reprocess);
            }
        }

        setIsProcessing(false);
        toast({ title: 'Processing Complete', description: `${emailsToProcess.length} email(s) have been submitted for processing.` });

        try {
            await sendEmail({
               to: 'kev@thinkestry.co.za',
               subject: 'New Invoices Ready for Review',
               html: `
                   <p>Hi Kevin,</p>
                   <p>${emailsToProcess.length} new email(s) have been processed, and the invoices are now ready for your review.</p>
                   <p><a href="${window.location.origin}/admin/cap-suppliers/review">Click here to review them</a>.</p>
                   <p>Thanks,<br/>The My Accountant Automated System</p>
               `
            });
        } catch (emailError) {
           console.error("Failed to send review notification email:", emailError);
           toast({
               title: "Email Notification Failed",
               description: "Could not send the 'ready for review' email notification.",
               variant: 'destructive',
           });
        }
        
        fetchEmails();
        setSelectedUids(new Set()); 
    };

    const handleDeleteSelected = async () => {
        if (selectedUids.size === 0) return;
        
        setIsProcessing(true);
        try {
            const response = await fetch('/api/emails/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uids: Array.from(selectedUids) }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete emails');
            }
            
            toast({ title: 'Emails Deleted', description: `${selectedUids.size} email(s) have been deleted.` });
            fetchEmails();
            setSelectedUids(new Set());
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive'});
        } finally {
            setIsProcessing(false);
        }
    };


    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allUids = new Set(emails.map(e => e.uid));
            setSelectedUids(allUids);
        } else {
            setSelectedUids(new Set());
        }
    };

    const handleSelectOne = (uid: number, checked: boolean) => {
        setSelectedUids(prev => {
            const newSelection = new Set(prev);
            if (checked) {
                newSelection.add(uid);
            } else {
                newSelection.delete(uid);
            }
            return newSelection;
        });
    };

    const handleTestConnection = async () => {
        setIsTesting(true);
        toast({ title: "Testing Connection...", description: "Please wait a moment." });
        try {
            const response = await fetch('/api/emails/test-connection', { method: 'POST' });
            const result = await response.json();
            if (result.success) {
                toast({
                    title: "Connection Successful",
                    description: "Successfully connected to the IMAP server.",
                    variant: 'default'
                });
            } else {
                 throw new Error(result.error);
            }
        } catch (err: any) {
             toast({
                title: "Connection Failed",
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setIsTesting(false);
        }
    }

    useEffect(() => {
        fetchEmails();
    }, [fetchEmails]);

    const getStatusBadge = (email: Email) => {
        if (email.isProcessed) {
            return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3"/>Processed</Badge>;
        }
        
        const hasProcessableAttachment = email.attachments.some(a => 
            a.contentType === 'application/pdf' ||
            a.contentType === 'application/msword' ||
            a.contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        );
        
        if (hasProcessableAttachment) {
            return <Badge variant="outline">Unprocessed</Badge>;
        }
        return <Badge variant="destructive"><FileSymlink className="mr-1 h-3 w-3"/>No Invoice File</Badge>;
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Email Inbox</h1>
                <div className="flex gap-2">
                     <Button onClick={() => handleProcessSelected()} disabled={isProcessing || selectedUids.size === 0}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Process {selectedUids.size > 0 ? `(${selectedUids.size})` : ''} Selected
                    </Button>
                     <Button onClick={() => handleProcessSelected(true)} variant="secondary" disabled={isProcessing || selectedUids.size === 0}>
                        <RotateCw className="mr-2 h-4 w-4"/>
                        Reprocess {selectedUids.size > 0 ? `(${selectedUids.size})` : ''} Selected
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" disabled={isProcessing || selectedUids.size === 0}>
                                <Trash2 className="mr-2 h-4 w-4"/> Delete {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete {selectedUids.size} email(s) from the server. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDeleteSelected}>Yes, Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                     </AlertDialog>
                     <Button onClick={handleTestConnection} variant="outline" disabled={isTesting}>
                        <Plug className={`mr-2 h-4 w-4 ${isTesting ? 'animate-pulse' : ''}`} />
                        Test Connection
                    </Button>
                    <Button onClick={fetchEmails} variant="outline" disabled={isLoading || isProcessing}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading || isProcessing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>invoices2@myacc.co.za</CardTitle>
                            <CardDescription>
                                {isLoading ? 'Loading messages...' : `Showing ${emails.length} messages.`}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : error ? (
                        <div className="p-4 text-center text-destructive"><FileWarning className="mx-auto h-12 w-12" /><p className="mt-4 text-sm font-semibold">Could not load inbox</p><p className="text-xs">{error}</p></div>
                    ) : emails.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground"><Inbox className="mx-auto h-12 w-12" /><p className="mt-4">The inbox is empty.</p></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                         <Checkbox 
                                            id="select-all" 
                                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                            checked={emails.length > 0 && selectedUids.size === emails.length}
                                            />
                                    </TableHead>
                                    <TableHead>From</TableHead>
                                    <TableHead>Subject</TableHead>
                                    <TableHead>Attachments</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                             <TableBody>
                                {emails.map((email) => {
                                    const hasPdf = email.attachments.some(a => a.contentType === 'application/pdf');
                                    return (
                                        <TableRow key={email.uid}>
                                            <TableCell>
                                                <Checkbox 
                                                    id={`select-${email.uid}`} 
                                                    onCheckedChange={(checked) => handleSelectOne(email.uid, !!checked)}
                                                    checked={selectedUids.has(email.uid)}
                                                />
                                            </TableCell>
                                            <TableCell className="font-medium">{email.from}</TableCell>
                                            <TableCell>{email.subject}</TableCell>
                                            <TableCell>
                                                {email.attachments.length > 0 ? (
                                                    <div className="flex items-center gap-1 text-primary">
                                                        <Paperclip className="h-4 w-4"/>
                                                        <span>{email.attachments.length}</span>
                                                    </div>
                                                ) : "None"}
                                            </TableCell>
                                            <TableCell>{format(new Date(email.date), 'dd MMM, HH:mm')}</TableCell>
                                            <TableCell>
                                                {getStatusBadge(email)}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

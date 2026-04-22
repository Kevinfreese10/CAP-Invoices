
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox, RefreshCw, FileWarning, Plug, Paperclip, CheckCircle2, RotateCw, Trash2, FileSymlink, Eye, CheckCircle, Hourglass, AlertTriangle, FileCheck2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getFirestore, collection, getDocs, deleteDoc, doc, writeBatch, query, where, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { sendEmail } from '@/lib/email';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExtractedInvoice } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';


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
    body: string | null;
    attachments: Attachment[];
    isProcessed?: boolean;
}

const getInvoiceStatusBadge = (status: ExtractedInvoice['status']) => {
    switch(status) {
        case 'approved': return <Badge variant={'success'}><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
        case 'approved_for_payment': return <Badge variant={'payment'}><FileCheck2 className="mr-1 h-3 w-3" />Approved for Payment</Badge>;
        case 'batched_for_payment': return <Badge variant={'payment'}><FileCheck2 className="mr-1 h-3 w-3" />Batched</Badge>;
        case 'paid': return <Badge variant={'success'}><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>;
        case 'rejected': return <Badge variant={'destructive'}><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
        case 'duplicate': return <Badge variant={'destructive'}><AlertTriangle className="mr-1 h-3 w-3" />Duplicate</Badge>;
        case 'extraction_failed': return <Badge variant={'destructive'}><AlertTriangle className="mr-1 h-3 w-3" />Extraction Failed</Badge>;
        case 'pending_review': return <Badge variant={'warning'}><Hourglass className="mr-1 h-3 w-3" />Pending Review</Badge>;
        case 'pending_account_review': return <Badge variant={'warning'}><Hourglass className="mr-1 h-3 w-3" />Pending Account Review</Badge>;
        case 'pending_third_review': return <Badge variant={'third_review'}><Hourglass className="mr-1 h-3 w-3" />Pending 3rd Review</Badge>;
        default: return <Badge>{status.replace(/_/g, ' ')}</Badge>;
    }
}


export default function InboxPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [reprocessingFile, setReprocessingFile] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
    const [openEmail, setOpenEmail] = useState<number | null>(null);
    const { toast } = useToast();
    
    const handleProcessAttachments = useCallback(async (email: Email, reprocess = false, attachmentFilename?: string) => {
        const processableAttachments = email.attachments.filter(att => 
            att.contentType === 'application/pdf'
        );

        if (processableAttachments.length === 0 && !attachmentFilename) {
            return;
        }

        try {
            await fetch('/api/emails/process-attachments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, reprocess, attachmentFilename }),
            });
        } catch (err: any) {
             toast({
                title: `Processing Failed for email from ${email.from}`,
                description: err.message,
                variant: "destructive",
            });
        }
    }, [toast]);
    
    const fetchEmailsAndInvoices = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch Emails by syncing with Firestore
            const response = await fetch('/api/ai-inbox?sync=true');
            if (!response.ok) {
                const errorText = await response.text();
                 try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(errorJson.error || 'Failed to fetch emails');
                } catch (e) {
                     throw new Error(errorText || 'Failed to fetch emails');
                }
            }
            const data: Email[] = await response.json();
            
            // isProcessed is now part of the data from Firestore, but we can keep this logic if needed.
            const processedSnapshot = await getDocs(collection(db, 'processedEmails'));
            const processedUids = new Set(processedSnapshot.docs.map(doc => doc.data().uid));
             const emailsWithStatus = data.map(email => ({
                ...email,
                isProcessed: processedUids.has(email.uid) || email.isProcessed,
            }));
            setEmails(emailsWithStatus);

            // Fetch all related invoices
            const invoiceQuery = query(collection(db, 'extractedInvoices'), orderBy('createdAt', 'desc'));
            const invoiceSnapshot = await getDocs(invoiceQuery);
            setInvoices(invoiceSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ExtractedInvoice)));

        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError(err.message || 'An unknown error occurred.');
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
               to: 'zizipho@combinedartists.co.za',
               subject: 'New Invoices Ready for Review',
               html: `
                   <p>Hi Zizipho,</p>
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
        
        fetchEmailsAndInvoices();
        setSelectedUids(new Set()); 
    };

    const handleDeleteSelected = async () => {
        if (selectedUids.size === 0) return;
        
        setIsProcessing(true);
        try {
            const response = await fetch('/api/ai-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uids: Array.from(selectedUids), action: 'delete' }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to delete emails');
            }
            
            toast({ title: 'Emails Deleted', description: `${selectedUids.size} email(s) have been deleted.` });
            fetchEmailsAndInvoices();
            setSelectedUids(new Set());
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive'});
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleReprocessOne = async (email: Email, filename: string) => {
        const fileKey = `${email.uid}-${filename}`;
        setReprocessingFile(fileKey);
        toast({ title: `Reprocessing ${filename}...` });
        try {
            await handleProcessAttachments(email, true, filename);
            toast({ title: 'Reprocessing complete!', description: 'The attachment has been submitted for processing again.' });
            fetchEmailsAndInvoices(); // Refresh all data
        } catch (err: any) {
             toast({
                title: `Reprocessing Failed for ${filename}`,
                description: err.message,
                variant: "destructive",
            });
        } finally {
            setReprocessingFile(null);
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
        fetchEmailsAndInvoices();
    }, [fetchEmailsAndInvoices]);
    
    const invoicesByEmail = useMemo(() => {
        return invoices.reduce((acc, invoice) => {
            if (invoice.sourceEmailUid) {
                if (!acc[invoice.sourceEmailUid]) {
                    acc[invoice.sourceEmailUid] = [];
                }
                acc[invoice.sourceEmailUid].push(invoice);
            }
            return acc;
        }, {} as { [key: number]: ExtractedInvoice[] });
    }, [invoices]);

    const getStatusBadge = (email: Email) => {
        const processableAttachments = email.attachments.filter(att => 
            att.contentType === 'application/pdf'
        );

        if (processableAttachments.length === 0) {
            return <Badge variant="destructive"><FileSymlink className="mr-1 h-3 w-3"/>No Invoice File</Badge>;
        }

        const processedInvoicesForEmail = invoicesByEmail[email.uid] || [];
        
        const attachmentStatuses = processableAttachments.map(att => {
            const foundInvoice = processedInvoicesForEmail.find(inv => inv.fileName === att.filename);
            return foundInvoice?.status;
        });

        if (attachmentStatuses.some(s => s === 'extraction_failed')) {
            return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3"/>Extraction Failed</Badge>;
        }

        const processedCount = attachmentStatuses.filter(s => s && s !== 'pending_review' && s !== 'new' && s !== 'extraction_failed').length;
        
        if (processedCount === processableAttachments.length) {
             return <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3"/>Processed</Badge>;
        }
        
        if (processedCount > 0) {
            return <Badge variant="warning"><Hourglass className="mr-1 h-3 w-3" />Partially Processed</Badge>;
        }

        return <Badge variant="outline">Unprocessed</Badge>;
    }
    
    const isReprocessable = (status: ExtractedInvoice['status'] | undefined) => {
        return !status || status === 'duplicate' || status === 'extraction_failed';
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
                    <Button onClick={fetchEmailsAndInvoices} variant="outline" disabled={isLoading || isProcessing}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading || isProcessing ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>{process.env.IMAP_USER || 'invoices2@myacc.co.za'}</CardTitle>
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
                        <div className="border rounded-lg">
                            <div className="grid grid-cols-[auto_2fr_3fr_1fr_1fr_1fr] items-center font-medium text-muted-foreground text-sm border-b">
                                <div className="px-4 py-3">
                                    <Checkbox 
                                        id="select-all" 
                                        onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                        checked={emails.length > 0 && selectedUids.size === emails.length}
                                    />
                                </div>
                                <div className="px-4 py-3">From</div>
                                <div className="px-4 py-3">Subject</div>
                                <div className="px-4 py-3">Attachments</div>
                                <div className="px-4 py-3">Date</div>
                                <div className="px-4 py-3">Status</div>
                            </div>
                            <div className="divide-y">
                            {emails.map((email) => {
                                const displayableAttachments = email.attachments.filter(att => att.contentType === 'application/pdf');
                                const attachmentsWithStatus = displayableAttachments.map(att => {
                                    const foundInvoice = invoices.find(inv => inv.fileName === att.filename && inv.sourceEmailUid === email.uid);
                                    return {
                                        ...att,
                                        status: foundInvoice?.status,
                                        fileUrl: foundInvoice?.fileUrl,
                                        rejectionReason: foundInvoice?.rejectionReason,
                                    }
                                });
                                return (
                                <Collapsible key={email.uid}>
                                    <CollapsibleTrigger asChild>
                                        <div className="grid grid-cols-[auto_2fr_3fr_1fr_1fr_1fr] items-center cursor-pointer hover:bg-muted/50 text-sm">
                                            <div className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    id={`select-${email.uid}`} 
                                                    onCheckedChange={(checked) => handleSelectOne(email.uid, !!checked)}
                                                    checked={selectedUids.has(email.uid)}
                                                />
                                            </div>
                                            <div className="px-4 py-3 font-medium truncate" title={email.from}>{email.from}</div>
                                            <div className="px-4 py-3 truncate" title={email.subject}>{email.subject}</div>
                                            <div className="px-4 py-3">
                                                {displayableAttachments.length > 0 ? (
                                                    <div className="flex items-center gap-1 text-primary">
                                                        <Paperclip className="h-4 w-4"/>
                                                        <span>{displayableAttachments.length}</span>
                                                    </div>
                                                ) : "None"}
                                            </div>
                                            <div className="px-4 py-3 whitespace-nowrap">{format(new Date(email.date), 'dd MMM, HH:mm')}</div>
                                            <div className="px-4 py-3">{getStatusBadge(email)}</div>
                                        </div>
                                    </CollapsibleTrigger>
                                     <CollapsibleContent>
                                        <div className="p-4 bg-muted/20 border-t">
                                            <h4 className="font-semibold mb-2">Attachment Status</h4>
                                            {attachmentsWithStatus.length > 0 ? (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Filename</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {attachmentsWithStatus.map((att, idx) => {
                                                        const isProcessingThis = reprocessingFile === `${email.uid}-${att.filename}`;
                                                        return (
                                                            <TableRow key={idx}>
                                                                <TableCell className="truncate" title={att.filename || 'No filename'}>{att.filename}</TableCell>
                                                                <TableCell>
                                                                    {att.status ? getInvoiceStatusBadge(att.status) : <Badge variant="secondary">Not Processed</Badge>}
                                                                    {att.rejectionReason && (
                                                                        <p className="text-xs text-muted-foreground mt-1 max-w-xs break-words">Reason: {att.rejectionReason}</p>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-right">
                                                                     {isReprocessable(att.status) && (
                                                                        <Button variant="outline" size="sm" onClick={() => handleReprocessOne(email, att.filename!)} disabled={isProcessingThis}>
                                                                            {isProcessingThis ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RotateCw className="mr-2 h-4 w-4" />}
                                                                            Reprocess
                                                                        </Button>
                                                                    )}
                                                                    {att.fileUrl && (
                                                                        <Button asChild variant="ghost" size="icon">
                                                                            <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                                <Eye className="h-4 w-4" />
                                                                            </a>
                                                                        </Button>
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                            ) : (
                                                <p className="text-sm text-muted-foreground text-center py-4">This email has no processable attachments.</p>
                                            )}
                                        </div>
                                     </CollapsibleContent>
                                </Collapsible>
                                )
                            })}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

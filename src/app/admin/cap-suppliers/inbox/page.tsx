'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Loader2, Inbox, RefreshCw, FileWarning, Plug, Paperclip, 
    CheckCircle2, RotateCw, Trash2, FileSymlink, Eye, CheckCircle, 
    Hourglass, AlertTriangle, FileCheck2, XCircle, FileX2, Archive, 
    ArchiveRestore, ChevronDown 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ExtractedInvoice } from '@/lib/types';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';


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
    isArchived?: boolean;
}

const getInvoiceStatusBadge = (status: ExtractedInvoice['status']) => {
    switch(status) {
        case 'approved': return <Badge variant={'success'} className="whitespace-nowrap shrink-0"><CheckCircle className="mr-1 h-3 w-3" />Approved</Badge>;
        case 'approved_for_payment': return <Badge variant={'payment'} className="whitespace-nowrap shrink-0"><FileCheck2 className="mr-1 h-3 w-3" />Approved for Payment</Badge>;
        case 'batched_for_payment': return <Badge variant={'payment'} className="whitespace-nowrap shrink-0"><FileCheck2 className="mr-1 h-3 w-3" />Batched</Badge>;
        case 'paid': return <Badge variant={'success'} className="whitespace-nowrap shrink-0"><CheckCircle className="mr-1 h-3 w-3" />Paid</Badge>;
        case 'rejected': return <Badge variant={'destructive'} className="whitespace-nowrap shrink-0"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
        case 'duplicate': return <Badge variant={'destructive'} className="whitespace-nowrap shrink-0"><AlertTriangle className="mr-1 h-3 w-3" />Duplicate</Badge>;
        case 'extraction_failed': return <Badge variant={'destructive'} className="whitespace-nowrap shrink-0"><AlertTriangle className="mr-1 h-3 w-3"/>Extraction Failed</Badge>;
        case 'pending_review': return <Badge variant={'warning'} className="whitespace-nowrap shrink-0"><Hourglass className="mr-1 h-3 w-3" />Pending Review</Badge>;
        case 'pending_account_review': return <Badge variant={'warning'} className="whitespace-nowrap shrink-0"><Hourglass className="mr-1 h-3 w-3" />Pending Account Review</Badge>;
        case 'pending_third_review': return <Badge variant={'third_review'} className="whitespace-nowrap shrink-0"><Hourglass className="mr-1 h-3 w-3" />Pending 3rd Review</Badge>;
        case 'archived': return <Badge variant={'secondary'} className="whitespace-nowrap shrink-0"><XCircle className="mr-1 h-3 w-3" />Archived</Badge>;
        default: return <Badge className="whitespace-nowrap shrink-0">{(status as string).replace(/_/g, ' ')}</Badge>;
    }
}


export default function InboxPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
    const [currentView, setCurrentView] = useState<'active' | 'archived'>('active');
    const [activeCount, setActiveCount] = useState<number>(0);
    const [archivedCount, setArchivedCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [reprocessingFile, setReprocessingFile] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
    const { toast } = useToast();
    const { user } = useAuth();
    
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
                body: JSON.stringify({ email, reprocess, attachmentFilename, assignedToEmail: user?.email }),
            });
        } catch (err: any) {
             toast({
                title: `Processing Failed for email from ${email.from}`,
                description: err.message,
                variant: "destructive",
            });
        }
    }, [toast, user?.email]);
    
    const fetchEmailsAndInvoices = useCallback(async (showLoader = true, targetView = currentView, shouldSync = true) => {
        if (showLoader) setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/ai-inbox?sync=${shouldSync}&view=${targetView}`);
            if (!response.ok) {
                const errorText = await response.text();
                 try {
                    const errorJson = JSON.parse(errorText);
                    throw new Error(errorJson.error || 'Failed to fetch emails');
                } catch (e) {
                     throw new Error(errorText || 'Failed to fetch emails');
                }
            }

            const activeHeader = response.headers.get('X-Active-Count');
            const archivedHeader = response.headers.get('X-Archived-Count');
            if (activeHeader !== null) setActiveCount(Number(activeHeader));
            if (archivedHeader !== null) setArchivedCount(Number(archivedHeader));

            const data: Email[] = await response.json();
            
            const processedSnapshot = await getDocs(collection(db, 'processedEmails'));
            const processedUids = new Set(processedSnapshot.docs.map(doc => doc.data().uid));
             const emailsWithStatus = data.map(email => ({
                ...email,
                isProcessed: processedUids.has(email.uid) || email.isProcessed,
            }));
            setEmails(emailsWithStatus);

            const invoiceQuery = query(collection(db, 'extractedInvoices'), orderBy('createdAt', 'desc'));
            const invoiceSnapshot = await getDocs(invoiceQuery);
            setInvoices(invoiceSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ExtractedInvoice)));

        } catch (err: any) {
            console.error("Error fetching data:", err);
            setError(err.message || 'An unknown error occurred.');
        } finally {
            if (showLoader) setIsLoading(false);
        }
    }, [currentView]);

    const handleViewChange = (newView: 'active' | 'archived') => {
        setCurrentView(newView);
        setSelectedUids(new Set());
        fetchEmailsAndInvoices(true, newView, false);
    };

    const handleProcessSelected = async (reprocess = false) => {
        if (selectedUids.size === 0) return;
        setIsProcessing(true);
        toast({
            title: reprocess ? "Reprocessing Emails..." : "Processing Emails...",
            description: `Starting for ${selectedUids.size} selected email(s).`,
        });

        let successCount = 0;
        let failCount = 0;

        for (const uid of selectedUids) {
            const email = emails.find(e => e.uid === uid);
            if (email) {
                try {
                    await handleProcessAttachments(email, reprocess);
                    successCount++;
                } catch (error) {
                    failCount++;
                }
            }
        }

        toast({
            title: "Batch Processing Complete",
            description: `Processed: ${successCount}, Failed: ${failCount}.`,
        });

        setIsProcessing(false);
        setSelectedUids(new Set());
        fetchEmailsAndInvoices(false);
    };

    const handleArchiveSelected = async () => {
        if (selectedUids.size === 0) return;
        setIsProcessing(true);
        try {
            const response = await fetch('/api/ai-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uids: Array.from(selectedUids), action: 'archive' }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to archive emails');
            }

            toast({ title: 'Emails Archived', description: `${selectedUids.size} email(s) moved to archive.` });
            setSelectedUids(new Set());
            fetchEmailsAndInvoices(false, currentView, false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive'});
        } finally {
            setIsProcessing(false);
        }
    };

    const handleUnarchiveSelected = async () => {
        if (selectedUids.size === 0) return;
        setIsProcessing(true);
        try {
            const response = await fetch('/api/ai-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uids: Array.from(selectedUids), action: 'unarchive' }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to unarchive emails');
            }

            toast({ title: 'Emails Restored', description: `${selectedUids.size} email(s) restored to active inbox.` });
            setSelectedUids(new Set());
            fetchEmailsAndInvoices(false, currentView, false);
        } catch (error: any) {
            toast({ title: 'Error', description: error.message, variant: 'destructive'});
        } finally {
            setIsProcessing(false);
        }
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
            fetchEmailsAndInvoices(false, currentView, false);
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
            fetchEmailsAndInvoices(false);
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
    };

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
            return <Badge variant="destructive" className="whitespace-nowrap shrink-0"><FileSymlink className="mr-1 h-3 w-3"/>No Invoice File</Badge>;
        }

        const processedInvoicesForEmail = invoicesByEmail[email.uid] || [];
        
        const attachmentStatuses = processableAttachments.map(att => {
            const foundInvoice = processedInvoicesForEmail.find(inv => inv.fileName === att.filename);
            return foundInvoice?.status;
        });

        if (attachmentStatuses.some(s => s === 'rejected')) {
             return <Badge variant={'destructive'} className="whitespace-nowrap shrink-0"><FileX2 className="mr-1 h-3 w-3" />Rejected</Badge>;
        }
        if (attachmentStatuses.some(s => s === 'extraction_failed')) {
            return <Badge variant="destructive" className="whitespace-nowrap shrink-0"><AlertTriangle className="mr-1 h-3 w-3"/>Extraction Failed</Badge>;
        }
        
        const handledStates = [
            'pending_review', 'pending_account_review', 'pending_third_review',
            'approved', 'approved_for_payment', 'batched_for_payment', 'paid', 
            'archived', 'duplicate'
        ];
        
        const allAttachmentsHandled = processableAttachments.every(att => {
            const invoice = processedInvoicesForEmail.find(inv => inv.fileName === att.filename);
            return invoice && invoice.status && handledStates.includes(invoice.status);
        });

        if (allAttachmentsHandled) {
            return <Badge variant="success" className="whitespace-nowrap shrink-0"><CheckCircle2 className="mr-1 h-3 w-3"/>Processed</Badge>;
        }
        
        const anyAttachmentHandled = processableAttachments.some(att => {
            const invoice = processedInvoicesForEmail.find(inv => inv.fileName === att.filename);
            return invoice && invoice.status && handledStates.includes(invoice.status);
        });

        if (anyAttachmentHandled) {
            return <Badge variant="warning" className="whitespace-nowrap shrink-0"><Hourglass className="mr-1 h-3 w-3" />Partially Processed</Badge>;
        }
        
        return <Badge variant="outline" className="whitespace-nowrap shrink-0">Unprocessed</Badge>;
    };
    
    const isReprocessable = (status: ExtractedInvoice['status'] | undefined) => {
        return !status || status === 'duplicate' || status === 'extraction_failed' || status === 'rejected';
    };

    return (
        <div className="space-y-6 pb-20 sm:pb-8">
            {/* Header & Batch Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Email Inbox</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                        Manage supplier invoices received via email.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {currentView === 'active' ? (
                        <>
                            <Button 
                                onClick={() => handleProcessSelected()} 
                                disabled={isProcessing || selectedUids.size === 0}
                                size="sm"
                                className="h-9 text-xs sm:text-sm"
                            >
                                {isProcessing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin"/> : null}
                                Process {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                            </Button>
                            <Button 
                                onClick={() => handleProcessSelected(true)} 
                                variant="secondary" 
                                disabled={isProcessing || selectedUids.size === 0}
                                size="sm"
                                className="h-9 text-xs sm:text-sm"
                            >
                                <RotateCw className="mr-1.5 h-3.5 w-3.5"/>
                                Reprocess {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                            </Button>
                            <Button 
                                onClick={handleArchiveSelected} 
                                variant="outline" 
                                disabled={isProcessing || selectedUids.size === 0}
                                size="sm"
                                className="h-9 text-xs sm:text-sm"
                            >
                                <Archive className="mr-1.5 h-3.5 w-3.5" />
                                Archive {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                            </Button>
                        </>
                    ) : (
                        <Button 
                            onClick={handleUnarchiveSelected} 
                            variant="outline" 
                            disabled={isProcessing || selectedUids.size === 0}
                            size="sm"
                            className="h-9 text-xs sm:text-sm"
                        >
                            <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" />
                            Unarchive {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                        </Button>
                    )}
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button 
                                variant="destructive" 
                                disabled={isProcessing || selectedUids.size === 0}
                                size="sm"
                                className="h-9 text-xs sm:text-sm"
                            >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5"/> Delete {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-[90vw] sm:max-w-lg rounded-xl">
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
                    <Button 
                        onClick={handleTestConnection} 
                        variant="outline" 
                        disabled={isTesting}
                        size="sm"
                        className="h-9 text-xs sm:text-sm"
                    >
                        <Plug className={`mr-1.5 h-3.5 w-3.5 ${isTesting ? 'animate-pulse' : ''}`} />
                        <span className="hidden sm:inline">Test Connection</span>
                        <span className="sm:hidden">Test</span>
                    </Button>
                    <Button 
                        onClick={() => fetchEmailsAndInvoices(true, currentView, true)} 
                        variant="outline" 
                        disabled={isLoading || isProcessing}
                        size="sm"
                        className="h-9 text-xs sm:text-sm"
                    >
                        <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isLoading || isProcessing ? 'animate-spin' : ''}`} />
                        <span className="hidden sm:inline">Refresh</span>
                    </Button>
                </div>
            </div>

            {/* View Switcher Tabs */}
            <div className="flex items-center gap-2 border-b pb-3 overflow-x-auto touch-scroll">
                <Button
                    variant={currentView === 'active' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewChange('active')}
                    className="gap-2 shrink-0"
                >
                    <Inbox className="h-4 w-4" />
                    Active Inbox
                    <Badge variant={currentView === 'active' ? 'secondary' : 'outline'} className="ml-1 px-1.5 py-0 text-xs">
                        {activeCount}
                    </Badge>
                </Button>
                <Button
                    variant={currentView === 'archived' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleViewChange('archived')}
                    className="gap-2 shrink-0"
                >
                    <Archive className="h-4 w-4" />
                    Archived Emails
                    <Badge variant={currentView === 'archived' ? 'secondary' : 'outline'} className="ml-1 px-1.5 py-0 text-xs">
                        {archivedCount}
                    </Badge>
                </Button>
            </div>

            <Card className="overflow-hidden shadow-xs">
                <CardHeader className="p-4 sm:p-6 bg-muted/10 border-b">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                        <div>
                            <CardTitle className="text-lg sm:text-xl font-bold">{process.env.IMAP_USER || 'invoices2@myacc.co.za'}</CardTitle>
                            <CardDescription className="text-xs sm:text-sm">
                                {isLoading ? 'Loading messages...' : `Showing ${emails.length} ${currentView} messages.`}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : error ? (
                        <div className="p-4 text-center text-destructive"><FileWarning className="mx-auto h-12 w-12" /><p className="mt-4 text-sm font-semibold">Could not load inbox</p><p className="text-xs">{error}</p></div>
                    ) : emails.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground"><Inbox className="mx-auto h-12 w-12" /><p className="mt-4">The inbox is empty.</p></div>
                    ) : (
                        <div className="border-0 sm:border rounded-none sm:rounded-lg overflow-hidden">
                            {/* MOBILE VIEW (< md) */}
                            <div className="md:hidden">
                                {/* Mobile Select All Bar */}
                                <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b text-xs text-muted-foreground font-medium">
                                    <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
                                        <Checkbox 
                                            id="mobile-select-all" 
                                            onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                            checked={emails.length > 0 && selectedUids.size === emails.length}
                                            className="h-4 w-4"
                                        />
                                        <label htmlFor="mobile-select-all" className="cursor-pointer select-none">
                                            {selectedUids.size > 0 ? `${selectedUids.size} selected` : 'Select All'}
                                        </label>
                                    </div>
                                    <span>{emails.length} message{emails.length === 1 ? '' : 's'}</span>
                                </div>

                                {/* Mobile Email Cards */}
                                <div className="divide-y divide-border">
                                    {emails.map((email) => {
                                        const displayableAttachments = email.attachments.filter(att => att.contentType === 'application/pdf');
                                        const attachmentsWithStatus = displayableAttachments.map(att => {
                                            const foundInvoice = invoices.find(inv => inv.fileName === att.filename && inv.sourceEmailUid === email.uid);
                                            return {
                                                ...att,
                                                status: foundInvoice?.status,
                                                fileUrl: foundInvoice?.fileUrl,
                                                rejectionReason: foundInvoice?.rejectionReason,
                                            };
                                        });
                                        const isSelected = selectedUids.has(email.uid);

                                        return (
                                            <Collapsible key={`mobile-${email.uid}`}>
                                                <div className={cn("p-3.5 transition-colors", isSelected ? "bg-primary/5" : "hover:bg-muted/40")}>
                                                    {/* Row 1: Checkbox, Sender, Date */}
                                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                                        <div className="flex items-center gap-2.5 min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
                                                            <Checkbox 
                                                                id={`mobile-select-${email.uid}`} 
                                                                onCheckedChange={(checked) => handleSelectOne(email.uid, !!checked)}
                                                                checked={isSelected}
                                                                className="h-4 w-4 shrink-0"
                                                            />
                                                            <span className="font-semibold text-sm text-foreground truncate" title={email.from}>
                                                                {email.from}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs text-muted-foreground shrink-0 font-medium whitespace-nowrap">
                                                            {format(new Date(email.date), 'dd MMM, HH:mm')}
                                                        </span>
                                                    </div>

                                                    {/* Row 2: Subject */}
                                                    <CollapsibleTrigger asChild>
                                                        <div className="cursor-pointer group">
                                                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2.5 group-hover:text-foreground">
                                                                {email.subject || '(No subject)'}
                                                            </p>

                                                            {/* Row 3: Status Badge + Attachments Pill + Expand Indicator */}
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                                    {getStatusBadge(email)}
                                                                    {displayableAttachments.length > 0 && (
                                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                            <Paperclip className="h-3 w-3" />
                                                                            {displayableAttachments.length} PDF{displayableAttachments.length > 1 ? 's' : ''}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-xs text-muted-foreground/70 flex items-center gap-0.5 group-hover:text-primary">
                                                                    <span>Attachments</span>
                                                                    <ChevronDown className="h-3.5 w-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </CollapsibleTrigger>
                                                </div>

                                                {/* Mobile Collapsible Attachment Details */}
                                                <CollapsibleContent>
                                                    <div className="p-3 bg-muted/20 border-t space-y-2">
                                                        <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                                                            Attachments ({attachmentsWithStatus.length})
                                                        </h4>
                                                        {attachmentsWithStatus.length > 0 ? (
                                                            <div className="space-y-2">
                                                                {attachmentsWithStatus.map((att, idx) => {
                                                                    const isProcessingThis = reprocessingFile === `${email.uid}-${att.filename}`;
                                                                    return (
                                                                        <div key={idx} className="bg-background border rounded-lg p-2.5 space-y-2 shadow-2xs">
                                                                            <div className="flex items-start justify-between gap-2">
                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className="text-xs font-medium text-foreground truncate" title={att.filename}>
                                                                                        {att.filename}
                                                                                    </p>
                                                                                    <div className="mt-1">
                                                                                        {att.status ? getInvoiceStatusBadge(att.status) : <Badge variant="secondary" className="whitespace-nowrap shrink-0">Not Processed</Badge>}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-1 shrink-0">
                                                                                    {isReprocessable(att.status) && (
                                                                                        <Button 
                                                                                            variant="outline" 
                                                                                            size="sm" 
                                                                                            className="h-7 text-xs px-2"
                                                                                            onClick={() => handleReprocessOne(email, att.filename!)} 
                                                                                            disabled={isProcessingThis}
                                                                                        >
                                                                                            {isProcessingThis ? <Loader2 className="mr-1 h-3 w-3 animate-spin"/> : <RotateCw className="mr-1 h-3 w-3" />}
                                                                                            Reprocess
                                                                                        </Button>
                                                                                    )}
                                                                                    {att.fileUrl && (
                                                                                        <Button asChild variant="ghost" size="icon" className="h-7 w-7">
                                                                                            <a href={att.fileUrl} target="_blank" rel="noopener noreferrer">
                                                                                                <Eye className="h-3.5 w-3.5" />
                                                                                            </a>
                                                                                        </Button>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                            {att.rejectionReason && (
                                                                                <p className="text-[11px] text-destructive bg-destructive/10 p-1.5 rounded break-words">
                                                                                    Reason: {att.rejectionReason}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-muted-foreground text-center py-2">This email has no processable attachments.</p>
                                                        )}
                                                    </div>
                                                </CollapsibleContent>
                                            </Collapsible>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* DESKTOP VIEW (>= md) */}
                            <div className="hidden md:block overflow-x-auto touch-scroll">
                                <div className="min-w-[780px]">
                                    <div className="grid grid-cols-[auto_2fr_3fr_1fr_1fr_1fr] items-center font-medium text-muted-foreground text-sm border-b bg-muted/20">
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
                                        <Collapsible key={`desktop-${email.uid}`}>
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
                                                    <h4 className="font-semibold mb-2 text-sm">Attachment Status</h4>
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
                                                                            {att.status ? getInvoiceStatusBadge(att.status) : <Badge variant="secondary" className="whitespace-nowrap shrink-0">Not Processed</Badge>}
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
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

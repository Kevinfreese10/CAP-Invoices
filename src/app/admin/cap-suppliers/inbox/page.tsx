
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox, RefreshCw, FileWarning, Plug, Paperclip, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Badge } from '@/components/ui/badge';
import { sendEmail } from '@/lib/email';
import { Checkbox } from '@/components/ui/checkbox';

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
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
    const { toast } = useToast();
    
    const handleProcessAttachments = useCallback(async (email: Email) => {
        const pdfAttachments = email.attachments.filter(att => att.contentType === 'application/pdf');
        if (pdfAttachments.length === 0) {
            return;
        }

        try {
            await fetch('/api/emails/process-attachments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
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
            if (emailsWithStatus.length > 0 && !selectedEmail) {
                setSelectedEmail(emailsWithStatus[0]);
            }
        } catch (err: any) {
            console.error("Error fetching emails:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [selectedEmail]);

    const handleProcessSelected = async () => {
        const emailsToProcess = emails.filter(email => selectedUids.has(email.uid));
        if (emailsToProcess.length === 0) {
            toast({ title: 'No Emails Selected', description: 'Please select at least one email to process.' });
            return;
        }

        setIsProcessing(true);
        toast({ title: `Processing ${emailsToProcess.length} email(s)...`, description: 'This may take a moment.' });
        
        for (const email of emailsToProcess) {
            await handleProcessAttachments(email);
        }

        setIsProcessing(false);
        toast({ title: 'Processing Complete', description: `${emailsToProcess.length} email(s) have been processed.` });

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
        
        // Refresh the list to show updated "processed" status
        fetchEmails();
        setSelectedUids(new Set()); // Clear selection
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allUids = new Set(emails.filter(e => !e.isProcessed && e.attachments.some(a => a.contentType === 'application/pdf')).map(e => e.uid));
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
    }, []);

    const selectableEmails = emails.filter(e => !e.isProcessed && e.attachments.some(a => a.contentType === 'application/pdf'));


    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Email Inbox</h1>
                <div className="flex gap-2">
                     <Button onClick={handleProcessSelected} disabled={isProcessing || selectedUids.size === 0}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                        Process {selectedUids.size > 0 ? selectedUids.size : ''} Selected
                    </Button>
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
            <Card className="h-[calc(100vh-12rem)]">
                <div className="grid grid-cols-1 md:grid-cols-3 h-full">
                    <div className="md:col-span-1 border-r">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle>invoices2@myacc.co.za</CardTitle>
                                    <CardDescription>
                                        {isLoading ? 'Loading messages...' : `Showing ${emails.length} messages.`}
                                    </CardDescription>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox 
                                      id="select-all" 
                                      onCheckedChange={handleSelectAll}
                                      checked={selectableEmails.length > 0 && selectedUids.size === selectableEmails.length}
                                    />
                                    <label htmlFor="select-all" className="text-sm font-medium">Select All</label>
                                </div>
                            </div>
                        </CardHeader>
                        <ScrollArea className="h-[calc(100vh-18rem)]">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                </div>
                            ) : error ? (
                                <div className="p-4 text-center text-destructive">
                                    <FileWarning className="mx-auto h-12 w-12" />
                                    <p className="mt-4 text-sm font-semibold">Could not load inbox</p>
                                    <p className="text-xs">{error}</p>
                                </div>
                            ) : emails.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground">
                                    <Inbox className="mx-auto h-12 w-12" />
                                    <p className="mt-4">The inbox is empty.</p>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    {emails.map((email) => {
                                      const hasPdf = email.attachments.some(a => a.contentType === 'application/pdf');
                                      const canSelect = hasPdf && !email.isProcessed;
                                      return (
                                        <div
                                            key={email.uid}
                                            onClick={() => setSelectedEmail(email)}
                                            className={`flex items-start gap-4 p-4 text-left border-b hover:bg-muted/50 cursor-pointer ${selectedEmail?.uid === email.uid ? 'bg-muted' : ''}`}
                                        >
                                            {canSelect ? (
                                                <Checkbox 
                                                  id={`select-${email.uid}`} 
                                                  onCheckedChange={(checked) => handleSelectOne(email.uid, !!checked)}
                                                  checked={selectedUids.has(email.uid)}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="mt-1"
                                                />
                                            ) : (
                                              <div className="w-4 h-4 mt-1 flex-shrink-0" />
                                            )}
                                            <div className="flex-grow">
                                                <div className="flex justify-between items-start">
                                                    <p className="font-semibold truncate">{email.from}</p>
                                                    {email.isProcessed && <Badge variant="success" className="text-xs">Processed</Badge>}
                                                </div>
                                                <p className="text-sm truncate">{email.subject}</p>
                                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                    <span>{format(new Date(email.date), 'dd MMM yyyy, HH:mm')}</span>
                                                    {hasPdf && (
                                                      <div className="flex items-center gap-1 text-primary">
                                                          <Paperclip className="h-3 w-3" />
                                                          <span>{email.attachments.filter(a => a.contentType === 'application/pdf').length} PDF(s)</span>
                                                      </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                      );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                    <div className="md:col-span-2">
                        {selectedEmail ? (
                            <div className="flex flex-col h-full">
                                <div className="p-4 border-b">
                                    <div className="flex justify-between items-start">
                                        <h2 className="font-semibold text-lg">{selectedEmail.subject}</h2>
                                        {selectedEmail.isProcessed && <Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3"/> Processed</Badge>}
                                    </div>
                                    <p className="text-sm"><strong>From:</strong> {selectedEmail.from}</p>
                                    <p className="text-sm text-muted-foreground"><strong>Date:</strong> {format(new Date(selectedEmail.date), 'dd MMMM yyyy, HH:mm')}</p>
                                    {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                                        <>
                                            <Separator className="my-2" />
                                            <div className="flex flex-wrap items-center gap-2">
                                                {selectedEmail.attachments.map((att, index) => (
                                                    <Button key={index} asChild variant="outline" size="sm">
                                                        <a href={att.dataUrl} download={att.filename}>
                                                            <Paperclip className="mr-2 h-4 w-4" />
                                                            {att.filename}
                                                        </a>
                                                    </Button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="p-4 text-sm text-muted-foreground">
                                    Email body preview has been removed to simplify the interface. Select an email to see its attachments.
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                { !isLoading && !error && <p>Select an email to view attachments</p> }
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}


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
    const { toast } = useToast();
    
    const handleProcessAttachments = useCallback(async (email: Email) => {
        const pdfAttachments = email.attachments.filter(att => att.contentType === 'application/pdf');
        if (pdfAttachments.length === 0) {
            return;
        }

        setIsProcessing(true);

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
        } finally {
            setIsProcessing(false);
        }
    }, [toast]);

    const fetchEmailsAndProcess = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            // Fetch processed email UIDs from Firestore
            const processedSnapshot = await getDocs(collection(db, 'processedEmails'));
            const processedUids = new Set(processedSnapshot.docs.map(doc => doc.data().uid));

            // Fetch emails from the API
            const response = await fetch('/api/emails/inbox');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch emails');
            }
            const data: Email[] = await response.json();
            
            const unprocessedEmails = data.filter(email => !processedUids.has(email.uid) && email.attachments.some(att => att.contentType === 'application/pdf'));

            if (unprocessedEmails.length > 0) {
                toast({ title: `Found ${unprocessedEmails.length} new email(s) with attachments.`, description: 'Processing them now...' });
                for (const email of unprocessedEmails) {
                    await handleProcessAttachments(email);
                }
                 toast({ title: "Processing Complete!", description: "New invoices have been sent to the review page." });
                 // Re-fetch everything after processing to get the latest status
                 await fetchEmailsAndProcess();
                 return; // Exit to avoid setting state with stale data
            }
            
            // Merge emails with their processed status
            const emailsWithStatus = data.map(email => ({
                ...email,
                isProcessed: processedUids.has(email.uid),
            }));

            setEmails(emailsWithStatus);
            if (emailsWithStatus.length > 0 && !selectedEmail) {
                setSelectedEmail(emailsWithStatus[0]);
            }

        } catch (err: any) {
            console.error("Error fetching or processing emails:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [handleProcessAttachments, toast, selectedEmail]);

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
        fetchEmailsAndProcess();
    }, [fetchEmailsAndProcess]);


    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Email Inbox</h1>
                <div className="flex gap-2">
                     <Button onClick={handleTestConnection} variant="outline" disabled={isTesting}>
                        <Plug className={`mr-2 h-4 w-4 ${isTesting ? 'animate-pulse' : ''}`} />
                        Test Connection
                    </Button>
                    <Button onClick={fetchEmailsAndProcess} variant="outline" disabled={isLoading || isProcessing}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading || isProcessing ? 'animate-spin' : ''}`} />
                        {isProcessing ? 'Processing...' : 'Refresh'}
                    </Button>
                </div>
            </div>
            <Card className="h-[calc(100vh-12rem)]">
                <div className="grid grid-cols-1 md:grid-cols-3 h-full">
                    <div className="md:col-span-1 border-r">
                        <CardHeader>
                            <CardTitle>invoices2@myacc.co.za</CardTitle>
                            <CardDescription>
                                {isLoading ? 'Loading messages...' : `Showing ${emails.length} messages.`}
                            </CardDescription>
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
                                    {emails.map((email) => (
                                        <button
                                            key={email.uid}
                                            onClick={() => setSelectedEmail(email)}
                                            className={`p-4 text-left border-b hover:bg-muted/50 ${selectedEmail?.uid === email.uid ? 'bg-muted' : ''}`}
                                        >
                                            <div className="flex justify-between items-start">
                                                <p className="font-semibold truncate">{email.from}</p>
                                                {email.isProcessed && <Badge variant="success" className="text-xs">Processed</Badge>}
                                            </div>
                                            <p className="text-sm truncate">{email.subject}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(email.date), 'dd MMM yyyy, HH:mm')}</p>
                                        </button>
                                    ))}
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
                                <ScrollArea className="flex-grow">
                                    <div
                                        className="p-4 prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                                    />
                                </ScrollArea>
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-full text-muted-foreground">
                                { !isLoading && !error && <p>Select an email to read</p> }
                            </div>
                        )}
                    </div>
                </div>
            </Card>
        </div>
    );
}

    
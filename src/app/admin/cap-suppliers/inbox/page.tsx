'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox, RefreshCw, FileWarning } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

interface Email {
    uid: number;
    from: string;
    subject: string;
    date: string;
    body: string;
}

export default function InboxPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchEmails = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/emails/inbox');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch emails');
            }
            const data = await response.json();
            setEmails(data);
            if (data.length > 0) {
                setSelectedEmail(data[0]);
            }
        } catch (err: any) {
            console.error("Error fetching emails:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchEmails();
    }, []);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Email Inbox</h1>
                <Button onClick={fetchEmails} variant="outline" disabled={isLoading}>
                    <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>
            <Card className="h-[calc(100vh-12rem)]">
                <div className="grid grid-cols-1 md:grid-cols-3 h-full">
                    <div className="md:col-span-1 border-r">
                        <CardHeader>
                            <CardTitle>invoices@myacc.co.za</CardTitle>
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
                                            <p className="font-semibold truncate">{email.from}</p>
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
                                    <h2 className="font-semibold text-lg">{selectedEmail.subject}</h2>
                                    <p className="text-sm"><strong>From:</strong> {selectedEmail.from}</p>
                                    <p className="text-sm text-muted-foreground"><strong>Date:</strong> {format(new Date(selectedEmail.date), 'dd MMMM yyyy, HH:mm')}</p>
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
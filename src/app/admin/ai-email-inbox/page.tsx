
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox, RefreshCw, FileWarning, Paperclip, CheckCircle2, Bot, Send, Trash2, XCircle, FileCheck2, Archive, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { categorizeSupportRequest } from '@/ai/flows/categorize-support-requests';
import { cn } from '@/lib/utils';

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
    processedAction?: 'processed' | 'archived';
    category?: 'Account issues' | 'Tax preparation' | 'Service inquiry' | 'Document upload' | 'Other';
    priority?: 'High' | 'Medium' | 'Low';
    sla?: 24 | 48 | 72;
}

const getActionIcon = (action?: 'processed' | 'archived') => {
    switch (action) {
        case 'processed':
            return <FileCheck2 className="mr-1 h-3 w-3" />;
        case 'archived':
            return <Archive className="mr-1 h-3 w-3" />;
        default:
            return null;
    }
}

export default function AiEmailInboxPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState<'inbox' | 'archive'>('inbox');
    const { toast } = useToast();

    const fetchEmails = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/ai-inbox');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch emails');
            }
            const data: Email[] = await response.json();
            setEmails(data);
            if (!selectedEmail && data.length > 0) {
                setSelectedEmail(data.filter(e => e.processedAction !== 'archived')[0] || data[0]);
            }
        } catch (err: any) {
            console.error("Error fetching emails:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, [selectedEmail]);

    useEffect(() => {
        fetchEmails();
    }, []);

    const processEmailAction = async (uids: Set<number>, action: 'process' | 'archive' | 'delete') => {
        const emailsToProcess = emails.filter(email => uids.has(email.uid));
        if (emailsToProcess.length === 0) return;

        setIsProcessing(true);
        toast({ title: `Performing action on ${emailsToProcess.length} email(s)...` });

        try {
            const response = await fetch('/api/ai-inbox', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uids: Array.from(uids), action }),
            });
            if (!response.ok) throw new Error('Failed to perform action');
            
            toast({ title: `Action successful on ${emailsToProcess.length} email(s).` });
            await fetchEmails();
            setSelectedUids(new Set());
        } catch (err: any) {
            toast({ title: `Action Failed`, description: err.message, variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    }
    
    const handleAnalyzeSelected = async () => {
        const uidsToAnalyze = Array.from(selectedUids);
        if (uidsToAnalyze.length === 0) return;

        setIsAnalyzing(true);
        toast({ title: `Analyzing ${uidsToAnalyze.length} email(s)...`, description: "The AI is working its magic."});

        try {
             const response = await fetch('/api/ai-inbox/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uids: uidsToAnalyze }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Analysis failed');
            }
            
            toast({ title: 'Analysis Complete!', description: 'Emails have been categorized and prioritized.' });
            await fetchEmails(); // Refresh to show new data
            setSelectedUids(new Set());

        } catch (err: any) {
             toast({ title: `Analysis Failed`, description: err.message, variant: 'destructive' });
        } finally {
            setIsAnalyzing(false);
        }
    }

    const inboxEmails = useMemo(() => emails.filter(e => e.processedAction !== 'archived'), [emails]);
    const archivedEmails = useMemo(() => emails.filter(e => e.processedAction === 'archived'), [emails]);
    const currentList = activeTab === 'inbox' ? inboxEmails : archivedEmails;

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allUids = new Set(inboxEmails.filter(e => !e.isProcessed).map(e => e.uid));
            setSelectedUids(allUids);
        } else {
            setSelectedUids(new Set());
        }
    };

    const handleSelectOne = (uid: number, checked: boolean) => {
        setSelectedUids(prev => {
            const newSelection = new Set(prev);
            if (checked) newSelection.add(uid); else newSelection.delete(uid);
            return newSelection;
        });
    };
    
    const getPriorityVariant = (priority?: 'High' | 'Medium' | 'Low') => {
        switch(priority) {
            case 'High': return 'destructive';
            case 'Medium': return 'warning';
            case 'Low': return 'secondary';
            default: return 'outline';
        }
    }
    
    return (
        <Dialog onOpenChange={(isOpen) => !isOpen && setSelectedEmail(null)}>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">AI Email Inbox</h1>
                    <div className="flex gap-2">
                        {activeTab === 'inbox' && (
                            <>
                                <Button onClick={() => processEmailAction(selectedUids, 'process')} disabled={isProcessing || selectedUids.size === 0}>
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4"/>}
                                    Process {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                                </Button>
                                <Button variant="secondary" onClick={() => processEmailAction(selectedUids, 'archive')} disabled={isProcessing || selectedUids.size === 0}>
                                    <Archive className="mr-2 h-4 w-4"/> Archive {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                                </Button>
                            </>
                        )}
                        <Button variant="destructive" onClick={() => processEmailAction(selectedUids, 'delete')} disabled={isProcessing || selectedUids.size === 0}>
                            <Trash2 className="mr-2 h-4 w-4"/> Delete {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                        </Button>
                        <Button onClick={fetchEmails} variant="outline" disabled={isLoading || isProcessing}>
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading || isProcessing ? 'animate-spin' : ''}`} /> Refresh
                        </Button>
                    </div>
                </div>

                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <Button variant={activeTab === 'inbox' ? 'default' : 'outline'} onClick={() => setActiveTab('inbox')}>Inbox ({inboxEmails.length})</Button>
                        <Button variant={activeTab === 'archive' ? 'default' : 'outline'} onClick={() => setActiveTab('archive')}>Archive ({archivedEmails.length})</Button>
                    </div>
                     {activeTab === 'inbox' && (
                         <div className="flex items-center gap-2">
                             <Button onClick={handleAnalyzeSelected} disabled={isAnalyzing || selectedUids.size === 0}>
                                {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                Analyze {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                            </Button>
                             <div className="flex items-center space-x-2">
                                <Checkbox id="select-all" onCheckedChange={handleSelectAll} checked={inboxEmails.length > 0 && selectedUids.size === inboxEmails.filter(e => !e.isProcessed).length}/>
                                <label htmlFor="select-all" className="text-sm font-medium">Select All</label>
                            </div>
                         </div>
                    )}
                </div>
                
                <Card className="h-[calc(100vh-20rem)]">
                    <div className="grid grid-cols-1 h-full">
                        <div className="col-span-1">
                            <ScrollArea className="h-full">
                                {isLoading ? (
                                    <div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
                                ) : error ? (
                                    <div className="p-4 text-center text-destructive"><FileWarning className="mx-auto h-12 w-12" /><p className="mt-4 text-sm font-semibold">{error}</p></div>
                                ) : currentList.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground"><Inbox className="mx-auto h-12 w-12" /><p className="mt-4">This folder is empty.</p></div>
                                ) : (
                                    currentList.map((email) => (
                                        <DialogTrigger key={email.uid} asChild>
                                            <div onClick={() => setSelectedEmail(email)} className={`flex items-start gap-4 p-4 text-left border-b hover:bg-muted/50 cursor-pointer ${selectedEmail?.uid === email.uid ? 'bg-muted' : ''}`}>
                                                {activeTab === 'inbox' && (email.isProcessed ? <div className="w-4 h-4 mt-1 flex-shrink-0" /> : <Checkbox onCheckedChange={(checked) => handleSelectOne(email.uid, !!checked)} checked={selectedUids.has(email.uid)} onClick={(e) => e.stopPropagation()} className="mt-1"/>)}
                                                <div className="flex-grow space-y-1">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-semibold truncate">{email.from}</p>
                                                        {email.processedAction && <Badge variant={email.processedAction === 'processed' ? 'success' : 'secondary'}>{getActionIcon(email.processedAction)} {email.processedAction}</Badge>}
                                                    </div>
                                                    <p className="text-sm truncate">{email.subject}</p>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {email.category && <Badge variant="outline">{email.category}</Badge>}
                                                        {email.priority && <Badge variant={getPriorityVariant(email.priority)}>{email.priority}</Badge>}
                                                        {email.sla && <Badge variant="outline">{email.sla}hr SLA</Badge>}
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                        <span>{format(new Date(email.date), 'dd MMM yyyy, HH:mm')}</span>
                                                        {email.attachments.length > 0 && <div className="flex items-center gap-1 text-primary"><Paperclip className="h-3 w-3" /><span>{email.attachments.length} attachment(s)</span></div>}
                                                    </div>
                                                </div>
                                            </div>
                                        </DialogTrigger>
                                    ))
                                )}
                            </ScrollArea>
                        </div>
                        {selectedEmail && (
                            <DialogContent className="sm:max-w-4xl">
                                <DialogHeader>
                                    <DialogTitle>{selectedEmail.subject}</DialogTitle>
                                    <DialogDescription>From: {selectedEmail.from} on {format(new Date(selectedEmail.date), 'dd MMM yyyy, HH:mm')}</DialogDescription>
                                </DialogHeader>
                                <div className="max-h-[70vh] overflow-y-auto">
                                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.body }} className="prose prose-sm max-w-none" />
                                </div>
                            </DialogContent>
                        )}
                    </div>
                </Card>
            </div>
        </Dialog>
    );
}

    
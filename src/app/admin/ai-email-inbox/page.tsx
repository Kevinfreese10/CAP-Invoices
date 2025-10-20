'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Inbox, RefreshCw, FileWarning, Paperclip, CheckCircle2, Bot, Send, Trash2, XCircle, FilePlus, Archive, Sparkles, Reply, ArchiveRestore, Eye, FileCheck2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';

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
    category?: 'Account issues' | 'Tax preparation' | 'Service inquiry' | 'Document upload' | 'Other' | 'Spam/Promo';
    priority?: 'High' | 'Medium' | 'Low';
    sla?: 24 | 48 | 72;
    summary?: string;
    suggestedAction?: 'create_task' | 'draft_reply' | 'archive' | 'none';
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
    const [isDrafting, setIsDrafting] = useState(false);
    const [draftedReply, setDraftedReply] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState<'inbox' | 'archive'>('inbox');
    const { toast } = useToast();

    const fetchEmails = useCallback(async ({ sync = false, selectFirst = false }: { sync?: boolean, selectFirst?: boolean } = {}) => {
        setIsLoading(true);
        setError(null);
        try {
            const url = sync ? '/api/ai-inbox?sync=true' : '/api/ai-inbox';
            const response = await fetch(url);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch emails');
            }
            const data: Email[] = await response.json();
            setEmails(data);
            if (selectFirst && data.length > 0) {
                 const firstUnarchived = data.find(e => e.processedAction !== 'archived');
                 setSelectedEmail(firstUnarchived || data[0]);
            }
        } catch (err: any) {
            console.error("Error fetching emails:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEmails({ selectFirst: true });
    }, [fetchEmails]);
    
    useEffect(() => {
        // Reset draft when selected email changes
        setDraftedReply('');
    }, [selectedEmail]);


    const processEmailAction = async (uids: Set<number>, action: 'process' | 'archive' | 'delete' | 'unarchive') => {
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
            await fetchEmails({});
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
            await fetchEmails({}); // Refresh to show new data
            setSelectedUids(new Set());

        } catch (err: any) {
             toast({ title: `Analysis Failed`, description: err.message, variant: 'destructive' });
        } finally {
            setIsAnalyzing(false);
        }
    }
    
    const handleDraftReply = async (email: Email | null = selectedEmail) => {
        if (!email) return;
        setIsDrafting(true);
        setDraftedReply('');
        setSelectedEmail(email); // Ensure the correct email is selected
        toast({ title: 'Drafting Reply...', description: 'The AI is composing a response.'});
        
        try {
            const response = await fetch('/api/ai-inbox/draft-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Drafting failed');
            }
            const data = await response.json();
            setDraftedReply(data.draft);
            toast({ title: 'Reply Drafted', description: 'Your draft is ready for review.'});
        } catch(err: any) {
            toast({ title: `Drafting Failed`, description: err.message, variant: 'destructive' });
        } finally {
            setIsDrafting(false);
        }
    };
    
    const handleCreateTaskFromEmail = async (email: Email) => {
        toast({ title: 'Creating Task...', description: `Creating a new task from email: ${email.subject}`});
        try {
             const response = await fetch('/api/ai-inbox/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uids: [email.uid] }),
            });
             if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Task creation failed');
            }
             toast({ title: 'Task Created!', description: 'A new task has been added to your task list.' });
             await fetchEmails({});
        } catch (err: any) {
             toast({ title: `Task Creation Failed`, description: err.message, variant: 'destructive' });
        }
    }

    const inboxEmails = useMemo(() => emails.filter(e => e.processedAction !== 'archived'), [emails]);
    const archivedEmails = useMemo(() => emails.filter(e => e.processedAction === 'archived'), [emails]);
    const currentList = activeTab === 'inbox' ? inboxEmails : archivedEmails;

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allUids = new Set(currentList.map(e => e.uid));
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
        <Dialog>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">AI Email Inbox</h1>
                    <div className="flex gap-2">
                        {activeTab === 'inbox' && (
                             <Button variant="secondary" onClick={() => processEmailAction(selectedUids, 'archive')} disabled={isProcessing || selectedUids.size === 0}>
                                <Archive className="mr-2 h-4 w-4"/> Archive {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                            </Button>
                        )}
                        {activeTab === 'archive' && (
                             <Button variant="secondary" onClick={() => processEmailAction(selectedUids, 'unarchive')} disabled={isProcessing || selectedUids.size === 0}>
                                <ArchiveRestore className="mr-2 h-4 w-4"/> Unarchive {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                            </Button>
                        )}
                        <Button variant="destructive" onClick={() => processEmailAction(selectedUids, 'delete')} disabled={isProcessing || selectedUids.size === 0}>
                            <Trash2 className="mr-2 h-4 w-4"/> Delete {selectedUids.size > 0 ? `(${selectedUids.size})` : ''}
                        </Button>
                        <Button onClick={() => fetchEmails({ sync: true })} variant="outline" disabled={isLoading || isProcessing}>
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
                                <Checkbox id="select-all" onCheckedChange={(checked) => handleSelectAll(!!checked)} checked={currentList.length > 0 && selectedUids.size === currentList.length}/>
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
                                    <div className="divide-y">
                                        {currentList.map((email) => (
                                            <div key={email.uid} className={cn("flex items-start gap-4 p-4 text-left cursor-pointer", selectedEmail?.uid === email.uid && 'bg-muted')}>
                                                <Checkbox onCheckedChange={(checked) => handleSelectOne(email.uid, !!checked)} checked={selectedUids.has(email.uid)} onClick={(e) => e.stopPropagation()} className="mt-1"/>
                                                <div className="flex-grow space-y-1" onClick={() => setSelectedEmail(email)}>
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="font-semibold truncate">{email.from}</p>
                                                            <p className="text-sm font-semibold truncate">{email.subject}</p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0 ml-4">
                                                            <p className="text-xs text-muted-foreground">{format(new Date(email.date), 'dd MMM, HH:mm')}</p>
                                                             <div className="flex justify-end gap-1 mt-1">
                                                                {email.processedAction && <Badge variant={email.processedAction === 'processed' ? 'success' : 'secondary'}>{getActionIcon(email.processedAction)} {email.processedAction}</Badge>}
                                                                {email.category && <Badge variant="outline">{email.category}</Badge>}
                                                                {email.priority && <Badge variant={getPriorityVariant(email.priority)}>{email.priority}</Badge>}
                                                                {email.sla && <Badge variant="outline">{email.sla}hr SLA</Badge>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {email.summary && <p className="text-xs text-muted-foreground italic truncate">"{email.summary}"</p>}
                                                    
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {email.attachments.length > 0 && <div className="flex items-center gap-1 text-xs text-primary"><Paperclip className="h-3 w-3" /><span>{email.attachments.length} attachment(s)</span></div>}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <DialogTrigger asChild>
                                                        <Button variant="ghost" size="sm" onClick={() => setSelectedEmail(email)}>
                                                            <Eye className="mr-2 h-4 w-4"/> View
                                                        </Button>
                                                    </DialogTrigger>
                                                    {email.suggestedAction && email.suggestedAction !== 'none' && (
                                                        <>
                                                            {email.suggestedAction === 'create_task' && (
                                                                <Button size="sm" variant="secondary" onClick={() => handleCreateTaskFromEmail(email)}><FilePlus className="mr-2 h-4 w-4"/>Create Task</Button>
                                                            )}
                                                            {email.suggestedAction === 'draft_reply' && (
                                                                <DialogTrigger asChild>
                                                                    <Button size="sm" variant="secondary" onClick={() => handleDraftReply(email)}><Reply className="mr-2 h-4 w-4"/>Draft Reply</Button>
                                                                </DialogTrigger>
                                                            )}
                                                            {email.suggestedAction === 'archive' && (
                                                                <Button size="sm" variant="secondary" onClick={() => processEmailAction(new Set([email.uid]), 'archive')}><Archive className="mr-2 h-4 w-4"/>Archive</Button>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </div>
                        {selectedEmail && (
                             <DialogContent className="sm:max-w-4xl">
                                <DialogHeader>
                                    <DialogTitle>{selectedEmail.subject}</DialogTitle>
                                    <DialogDescription>From: {selectedEmail.from} on {format(new Date(selectedEmail.date), 'dd MMM yyyy, HH:mm')}</DialogDescription>
                                </DialogHeader>
                                <div className="max-h-[70vh] overflow-y-auto space-y-6">
                                    <div dangerouslySetInnerHTML={{ __html: selectedEmail.body }} className="prose prose-sm max-w-none" />
                                    <Separator />
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-semibold">AI Reply</h3>
                                            <Button size="sm" onClick={() => handleDraftReply()} disabled={isDrafting}>
                                                {isDrafting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Reply className="mr-2 h-4 w-4"/>}
                                                Regenerate Draft
                                            </Button>
                                        </div>
                                        {isDrafting ? (
                                             <div className="flex items-center gap-2 text-primary">
                                                <Loader2 className="animate-spin"/>
                                                <span>AI is drafting a reply...</span>
                                            </div>
                                        ) : draftedReply ? (
                                            <Textarea value={draftedReply} onChange={(e) => setDraftedReply(e.target.value)} rows={8} />
                                        ) : <p className="text-sm text-muted-foreground">Click the button to generate a draft reply.</p>}
                                    </div>
                                </div>
                            </DialogContent>
                        )}
                    </div>
                </Card>
            </div>
        </Dialog>
    );
}
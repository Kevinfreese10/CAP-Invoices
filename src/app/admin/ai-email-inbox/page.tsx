
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Inbox, RefreshCw, FileWarning, Paperclip, Sparkles, Bot, MessageSquare, StickyNote, PlusCircle, User, CheckCircle, MoreHorizontal, Eye, Archive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { analyzeEmail, type EmailAnalysisOutput } from '@/ai/flows/analyze-email';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

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

export default function AIEmailInboxPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<EmailAnalysisOutput | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { toast } = useToast();
    const [analyzedEmailId, setAnalyzedEmailId] = useState<number | null>(null);

    const fetchEmails = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setAnalysisResult(null);
        setSelectedEmail(null); 
        try {
            const response = await fetch('/api/ai-inbox');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to fetch emails');
            }
            const data: Email[] = await response.json();
            setEmails(data);
        } catch (err: any) {
            console.error("Error fetching emails:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEmails();
    }, [fetchEmails]);

    const handleAnalyze = async (email: Email) => {
        if (!email) return;

        setAnalyzedEmailId(email.uid);
        setIsAnalyzing(true);
        setAnalysisResult(null);

        try {
            const attachments = email.attachments.map(att => ({
                dataUri: att.dataUrl,
                mimeType: att.contentType,
            }));

            const result = await analyzeEmail({
                subject: email.subject,
                body: email.body,
                attachments: attachments,
            });
            setAnalysisResult(result);
        } catch (err: any)
        {
            console.error("Error analyzing email:", err);
            setError("The AI failed to analyze this email. Please try again.");
        } finally {
            setIsAnalyzing(false);
        }
    };
    
    const handleSelectEmail = (email: Email) => {
        setSelectedEmail(email);
        setAnalysisResult(null); // Clear previous analysis
        setAnalyzedEmailId(null);
    }

    const handleMarkAsProcessed = async (email: Email) => {
        if (!email) return;

        try {
            const processedEmailRef = doc(db, 'processedEmails', String(email.uid));
            await setDoc(processedEmailRef, {
                uid: email.uid,
                processedAt: serverTimestamp(),
                subject: email.subject,
                from: email.from,
            });
            toast({ title: "Email Marked as Processed" });
            fetchEmails(); // Refresh the list
        } catch (error) {
            toast({ title: "Error", description: "Could not mark email as processed.", variant: "destructive" });
        }
    };


    return (
        <Dialog>
            <div className="space-y-8">
                <div className="flex items-center justify-between">
                    <h1 className="text-3xl font-bold tracking-tight">AI Email Inbox</h1>
                    <Button onClick={fetchEmails} variant="outline" disabled={isLoading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle>kev@myacc.co.za</CardTitle>
                        <CardDescription>
                            {isLoading ? 'Loading messages...' : `Showing ${emails.length} messages.`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <div className="flex items-center justify-center h-48">
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
                             <ScrollArea className="h-[calc(100vh-22rem)]">
                                <div className="flex flex-col">
                                    {emails.map((email) => (
                                         <div
                                            key={email.uid}
                                            className={`border-b ${email.isProcessed ? 'bg-muted/30' : ''}`}
                                        >
                                            <div className="flex items-center p-4 hover:bg-muted/50">
                                                <div className="flex-grow">
                                                    <p className="font-semibold truncate">{email.from}</p>
                                                    <p className="text-sm truncate">{email.subject}</p>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {format(new Date(email.date), 'dd MMM yyyy, HH:mm')}
                                                        </p>
                                                        {email.isProcessed && <Badge variant="secondary">Processed</Badge>}
                                                    </div>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={() => handleSelectEmail(email)}>
                                                                <Eye className="mr-2 h-4 w-4"/>View
                                                            </DropdownMenuItem>
                                                        </DialogTrigger>
                                                        <DropdownMenuItem onSelect={() => handleAnalyze(email)} disabled={isAnalyzing && analyzedEmailId === email.uid}>
                                                            {isAnalyzing && analyzedEmailId === email.uid ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}
                                                            Analyze
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => handleMarkAsProcessed(email)} disabled={email.isProcessed}>
                                                            <Archive className="mr-2 h-4 w-4"/>Archive
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                            {analyzedEmailId === email.uid && (
                                                <div className="p-4 border-t bg-muted/20">
                                                    {isAnalyzing ? (
                                                        <div className="flex items-center justify-center py-8">
                                                            <Loader2 className="h-8 w-8 animate-spin" />
                                                        </div>
                                                    ) : analysisResult ? (
                                                        <div className="space-y-4">
                                                            <Alert>
                                                                <Bot className="h-4 w-4"/>
                                                                <AlertTitle className="font-semibold">AI Summary</AlertTitle>
                                                                <AlertDescription>{analysisResult.summary}</AlertDescription>
                                                            </Alert>
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                                                                <div className="p-1 border rounded-lg"><p className="text-xs font-semibold text-muted-foreground">Priority</p><Badge variant={analysisResult.priority === 'High' ? 'destructive' : analysisResult.priority === 'Medium' ? 'warning' : 'secondary'}>{analysisResult.priority}</Badge></div>
                                                                <div className="p-1 border rounded-lg"><p className="text-xs font-semibold text-muted-foreground">Category</p><Badge>{analysisResult.category}</Badge></div>
                                                                <div className="p-1 border rounded-lg"><p className="text-xs font-semibold text-muted-foreground">SLA</p><Badge variant="outline">{analysisResult.sla}</Badge></div>
                                                                <div className="p-1 border rounded-lg"><p className="text-xs font-semibold text-muted-foreground">Sender</p><p className="text-xs font-medium truncate">{analysisResult.senderName || 'Unknown'}</p></div>
                                                            </div>
                                                            {analysisResult.detectedAttachments && analysisResult.detectedAttachments.length > 0 && (<div><h4 className="font-semibold text-xs mb-1">Attachments:</h4><ul className="list-disc pl-5 text-xs space-y-1">{analysisResult.detectedAttachments.map((att, i) => <li key={i}>{att}</li>)}</ul></div>)}
                                                            <div><h4 className="font-semibold text-xs mb-1">Next Step:</h4><p className="text-xs p-2 bg-muted rounded-md">{analysisResult.nextStep}</p></div>
                                                            
                                                            {analysisResult.draftReply?.body && (
                                                                <Card>
                                                                    <CardHeader className="p-2"><CardTitle className="flex items-center gap-2 text-sm"><MessageSquare /> Draft Reply</CardTitle></CardHeader>
                                                                    <CardContent className="p-2 space-y-2">
                                                                        <Input readOnly value={analysisResult.draftReply.subject} className="font-semibold h-8 text-xs"/>
                                                                        <Textarea readOnly value={analysisResult.draftReply.body} rows={4} className="text-xs" />
                                                                        <Input type="file" className="h-8 text-xs"/>
                                                                    </CardContent>
                                                                    <CardFooter className="p-2"><Button size="sm" className="text-xs">Send</Button></CardFooter>
                                                                </Card>
                                                            )}

                                                            {analysisResult.suggestedTask?.title && (
                                                                <Card>
                                                                    <CardHeader className="p-2"><CardTitle className="flex items-center gap-2 text-sm"><StickyNote /> Suggested Task</CardTitle></CardHeader>
                                                                    <CardContent className="p-2 space-y-1">
                                                                        <p className="text-xs font-medium">{analysisResult.suggestedTask.title}</p>
                                                                        <p className="text-xs text-muted-foreground">{analysisResult.suggestedTask.description}</p>
                                                                    </CardContent>
                                                                    <CardFooter className="p-2"><Button size="sm" className="text-xs"><PlusCircle className="mr-1 h-3 w-3"/> Create Task</Button></CardFooter>
                                                                </Card>
                                                            )}
                                                        </div>
                                                    ) : <p className="text-xs text-muted-foreground text-center py-4">No analysis available.</p>}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                             </ScrollArea>
                        )}
                    </CardContent>
                </Card>
            </div>
            
            <DialogContent className="sm:max-w-4xl h-[90vh]">
                {selectedEmail && (
                    <div className="flex flex-col h-full">
                        <DialogHeader>
                           <DialogTitle>{selectedEmail.subject}</DialogTitle>
                           <DialogDescription>
                                <strong>From:</strong> {selectedEmail.from}
                                <br />
                                <strong>Date:</strong> {format(new Date(selectedEmail.date), 'dd MMMM yyyy, HH:mm')}
                           </DialogDescription>
                        </DialogHeader>
                        
                        <div className="py-2">
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

                        <Separator className="my-2" />

                        <ScrollArea className="flex-grow">
                            <div
                                className="p-4 text-sm prose max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedEmail.body.replace(/(<hr\s*\/?>)/gi, '<br class="hidden" />$1') }}
                            />
                        </ScrollArea>
                        
                        <DialogFooter className="pt-4 border-t flex justify-between w-full">
                            <Button onClick={() => handleMarkAsProcessed(selectedEmail)} size="sm" variant="secondary" disabled={selectedEmail.isProcessed}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                {selectedEmail.isProcessed ? 'Archived' : 'Archive'}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

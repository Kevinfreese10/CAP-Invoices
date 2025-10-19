
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Inbox, RefreshCw, FileWarning, Paperclip, Sparkles, Bot, MessageSquare, StickyNote, PlusCircle, User } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
}

export default function AIEmailInboxPage() {
    const [emails, setEmails] = useState<Email[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<EmailAnalysisOutput | null>(null);
    const [error, setError] = useState<string | null>(null);

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

    const handleAnalyze = async () => {
        if (!selectedEmail) return;

        setIsAnalyzing(true);
        setAnalysisResult(null);

        try {
            const attachments = selectedEmail.attachments.map(att => ({
                dataUri: att.dataUrl,
                mimeType: att.contentType,
            }));

            const result = await analyzeEmail({
                subject: selectedEmail.subject,
                body: selectedEmail.body,
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
    }

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
                             <ScrollArea className="h-[calc(100vh-28rem)]">
                                <div className="flex flex-col">
                                    {emails.map((email) => (
                                         <DialogTrigger key={email.uid} asChild>
                                            <div
                                                onClick={() => handleSelectEmail(email)}
                                                className={`p-4 border-b hover:bg-muted/50 cursor-pointer`}
                                            >
                                                <p className="font-semibold truncate">{email.from}</p>
                                                <p className="text-sm truncate">{email.subject}</p>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    {format(new Date(email.date), 'dd MMM yyyy, HH:mm')}
                                                </p>
                                            </div>
                                        </DialogTrigger>
                                    ))}
                                </div>
                             </ScrollArea>
                        )}
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>AI Analysis</CardTitle>
                        <CardDescription>
                            AI-generated analysis of the selected email will appear here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isAnalyzing ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="h-8 w-8 animate-spin" />
                            </div>
                        ) : analysisResult ? (
                            <div className="space-y-6">
                                <Alert>
                                    <Bot className="h-4 w-4"/>
                                    <AlertTitle className="font-semibold">AI Summary</AlertTitle>
                                    <AlertDescription>{analysisResult.summary}</AlertDescription>
                                </Alert>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                    <div className="p-2 border rounded-lg">
                                        <p className="text-xs font-semibold text-muted-foreground">Priority</p>
                                        <Badge variant={analysisResult.priority === 'High' ? 'destructive' : analysisResult.priority === 'Medium' ? 'warning' : 'secondary'}>{analysisResult.priority}</Badge>
                                    </div>
                                    <div className="p-2 border rounded-lg">
                                        <p className="text-xs font-semibold text-muted-foreground">Category</p>
                                        <Badge>{analysisResult.category}</Badge>
                                    </div>
                                    <div className="p-2 border rounded-lg">
                                        <p className="text-xs font-semibold text-muted-foreground">SLA</p>
                                        <Badge variant="outline">{analysisResult.sla}</Badge>
                                    </div>
                                    <div className="p-2 border rounded-lg">
                                        <p className="text-xs font-semibold text-muted-foreground">Sender</p>
                                        <p className="text-sm font-medium truncate">{analysisResult.senderName || 'Unknown'}</p>
                                    </div>
                                </div>
                                {analysisResult.detectedAttachments && analysisResult.detectedAttachments.length > 0 && (
                                    <div>
                                        <h4 className="font-semibold text-sm mb-2">Detected Attachments:</h4>
                                        <ul className="list-disc pl-5 text-sm space-y-1">
                                            {analysisResult.detectedAttachments.map((att, i) => <li key={i}>{att}</li>)}
                                        </ul>
                                    </div>
                                )}
                                <div>
                                    <h4 className="font-semibold text-sm mb-2">Recommended Next Step:</h4>
                                    <p className="text-sm p-3 bg-muted rounded-md">{analysisResult.nextStep}</p>
                                </div>
                                
                                {analysisResult.draftReply?.body && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg"><MessageSquare /> Draft Reply</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-1">
                                                <Label htmlFor="reply-subject">Subject</Label>
                                                <Input id="reply-subject" readOnly value={analysisResult.draftReply.subject} className="font-semibold"/>
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="reply-body">Body</Label>
                                                <Textarea readOnly value={analysisResult.draftReply.body} rows={8} className="text-sm" id="reply-body" />
                                            </div>
                                            <div className="space-y-1">
                                                <Label htmlFor="reply-attachment">Attachment</Label>
                                                <Input id="reply-attachment" type="file" />
                                            </div>
                                        </CardContent>
                                        <CardFooter>
                                            <Button>Send Email</Button>
                                        </CardFooter>
                                    </Card>
                                )}

                                {analysisResult.suggestedTask?.title && (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2 text-lg"><StickyNote /> Suggested Task</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <p className="text-sm font-medium">{analysisResult.suggestedTask.title}</p>
                                            <p className="text-sm text-muted-foreground">{analysisResult.suggestedTask.description}</p>
                                        </CardContent>
                                        <CardFooter>
                                            <Button><PlusCircle className="mr-2 h-4 w-4"/> Create Task</Button>
                                        </CardFooter>
                                    </Card>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-10 border-2 border-dashed rounded-lg">
                                <h3 className="text-lg font-medium">No Analysis Yet</h3>
                                <p className="text-sm text-muted-foreground">Select an email and click 'Analyze' to see its summary here.</p>
                            </div>
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
                        
                        <DialogFooter className="pt-4 border-t">
                            <Button onClick={handleAnalyze} size="sm" variant="outline" disabled={isAnalyzing}>
                                {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4 text-primary"/>}
                                Analyze
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

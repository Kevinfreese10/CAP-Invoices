
'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, Send, Loader2, User, Sparkles, X, CornerDownLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { websiteQAndA, WebsiteQAndAInput } from '@/ai/flows/website-q-and-a';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

type Message = {
    role: 'user' | 'bot';
    content: string;
    serviceUrl?: string;
};

export default function WebsiteAIWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }

    useEffect(scrollToBottom, [messages]);
    
    useEffect(() => {
        setMessages([
             { role: 'bot', content: "Hi there! I'm Khai, your AI assistant. How can I help you with our services today?" }
        ]);
    }, []);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        const history = messages.map(msg => ({
            role: msg.role,
            content: msg.content,
        }));
        
        try {
            const result = await websiteQAndA({ question: input, history });
            const botMessage: Message = { role: 'bot', content: result.answer, serviceUrl: result.serviceUrl };
            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            console.error("AI response error:", error);
            const errorMessage: Message = { role: 'bot', content: "Sorry, I'm having a little trouble right now. Please try again in a moment." };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };
    
    const quickQuestions = [
        "What is CIPC Annual Returns?",
        "What is your refund policy?",
        "How much is a new company registration?",
        "Tell me about BEI",
    ]

    return (
        <>
            <div className={`fixed bottom-4 right-4 z-50 transition-all duration-300 ${isOpen ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
                <Button onClick={() => setIsOpen(true)} size="lg" className="rounded-full h-16 w-16 shadow-lg">
                    <Bot className="h-8 w-8" />
                </Button>
            </div>

            {isOpen && (
                 <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm" onClick={() => setIsOpen(false)}></div>
            )}
           
            <Card className={`fixed bottom-4 right-4 z-50 w-full max-w-md h-[70vh] transition-all duration-300 flex flex-col shadow-2xl ${isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
                 <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                         <div className="relative">
                            <Avatar>
                                <AvatarImage src="https://picsum.photos/seed/ai-avatar/100" />
                                <AvatarFallback>AI</AvatarFallback>
                            </Avatar>
                             <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-white"></span>
                        </div>
                        <div>
                            <CardTitle>Khai</CardTitle>
                            <CardDescription>AI Assistant</CardDescription>
                        </div>
                    </div>
                     <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                        <X className="h-4 w-4" />
                    </Button>
                </CardHeader>
                <CardContent className="flex-grow overflow-y-auto pr-2 space-y-4">
                    {messages.map((message, index) => (
                        <div key={index} className={`flex items-start gap-3 ${message.role === 'user' ? 'justify-end' : ''}`}>
                             {message.role === 'bot' && (
                                 <Avatar className="h-8 w-8">
                                     <AvatarImage src="https://picsum.photos/seed/ai-avatar/100" />
                                     <AvatarFallback>AI</AvatarFallback>
                                 </Avatar>
                             )}
                            <div className={`rounded-lg p-3 max-w-[80%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                                <ReactMarkdown 
                                    className="prose prose-sm"
                                    components={{
                                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                                    }}
                                >
                                    {message.content}
                                </ReactMarkdown>
                                {message.serviceUrl && (
                                     <Button asChild variant="secondary" size="sm" className="mt-2">
                                        <Link href={message.serviceUrl}>
                                            View Service <ArrowRight className="ml-2 h-4 w-4" />
                                        </Link>
                                    </Button>
                                )}
                            </div>
                            {message.role === 'user' && <User className="h-8 w-8 text-muted-foreground" />}
                        </div>
                    ))}
                     {isLoading && (
                        <div className="flex items-start gap-3">
                             <Avatar className="h-8 w-8"><AvatarImage src="https://picsum.photos/seed/ai-avatar/100" /><AvatarFallback>AI</AvatarFallback></Avatar>
                             <div className="rounded-lg p-3 bg-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </CardContent>
                <CardFooter className="flex-shrink-0 flex-col items-start gap-2">
                    <div className="flex gap-2 overflow-x-auto pb-2 w-full">
                        {quickQuestions.map(q => (
                             <Button key={q} variant="outline" size="sm" className="whitespace-nowrap" onClick={() => setInput(q)}>{q}</Button>
                        ))}
                    </div>
                     <form onSubmit={handleSendMessage} className="w-full flex items-center gap-2 relative">
                        <Input 
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            placeholder="Ask about a service..."
                            className="pr-10"
                        />
                         <Button type="submit" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8" disabled={isLoading}>
                             <Send className="h-4 w-4" />
                         </Button>
                    </form>
                </CardFooter>
            </Card>
        </>
    );
}

    
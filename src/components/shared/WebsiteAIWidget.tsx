
'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { websiteQAndA } from '@/ai/dev';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Loader2, MessageCircle, Send, X, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  question: z.string().min(1, 'Cannot send an empty message.'),
});

type ChatMessage = {
  role: 'user' | 'bot';
  text: string;
}

export default function WebsiteAIWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: '',
    },
  });

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);
  
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      role: 'bot',
      text: "Hello! I'm Khai, your AI assistant. How can I help you today? You can ask me about our services, pricing, or company information.",
    };
    setChatHistory([welcomeMessage]);
  }, []);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    const userMessage: ChatMessage = { role: 'user', text: values.question };
    setChatHistory(prev => [...prev, userMessage]);
    setIsLoading(true);
    form.reset();

    try {
      const response = await websiteQAndA({ 
        question: values.question,
        // Include previous messages for conversational context
        // history: chatHistory.map(m => ({ role: m.role, content: m.text }))
       });
      const botMessage: ChatMessage = { role: 'bot', text: response.answer };
      setChatHistory(prev => [...prev, botMessage]);
    } catch (e) {
      const errorMessage: ChatMessage = { role: 'bot', text: 'Sorry, I am having trouble connecting. Please try again later.' };
      setChatHistory(prev => [...prev, errorMessage]);
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50">
        <Button onClick={() => setIsOpen(!isOpen)} size="icon" className="w-16 h-16 rounded-full shadow-lg bg-gradient">
           {isOpen ? <X className="h-8 w-8" /> : <MessageCircle className="h-8 w-8" />}
        </Button>
      </div>

      {isOpen && (
        <div className="fixed bottom-24 right-4 z-50 w-full max-w-sm sm:w-auto sm:max-w-sm md:max-w-md">
          <Card className="flex flex-col h-[60vh] shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between bg-gradient text-primary-foreground p-4">
              <div className="flex items-center gap-3">
                  <Bot className="h-6 w-6" />
                  <CardTitle className="text-lg">Khai - Your AI Assistant</CardTitle>
              </div>
            </CardHeader>
            <CardContent ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatHistory.map((message, index) => (
                <div key={index} className={cn("flex items-end gap-2", message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {message.role === 'bot' && <Bot className="h-6 w-6 text-primary flex-shrink-0" />}
                   <div className={cn(
                        "p-3 rounded-lg max-w-xs",
                        message.role === 'user' ? 'bg-gradient text-primary-foreground' : 'bg-muted'
                    )}>
                        <p className="text-sm">{message.text}</p>
                    </div>
                   {message.role === 'user' && <User className="h-6 w-6 text-primary flex-shrink-0" />}
                </div>
              ))}
              {isLoading && (
                 <div className="flex items-end gap-2 justify-start">
                    <Bot className="h-6 w-6 text-primary flex-shrink-0" />
                    <div className="p-3 rounded-lg bg-muted flex items-center">
                       <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-2 border-t">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="w-full flex items-center gap-2">
                  <FormField
                    control={form.control}
                    name="question"
                    render={({ field }) => (
                      <FormItem className="flex-grow">
                        <FormControl>
                          <Input placeholder="Type your message..." {...field} autoComplete="off" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" size="icon" disabled={isLoading}>
                    <Send className="h-5 w-5" />
                  </Button>
                </form>
              </Form>
            </CardFooter>
          </Card>
        </div>
      )}
    </>
  );
}

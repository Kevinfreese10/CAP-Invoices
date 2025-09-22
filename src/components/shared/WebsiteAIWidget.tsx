
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { WebsiteQAndAOutput, websiteQAndA } from '@/ai/flows/website-q-and-a';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Loader2, Sparkles, History } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';

const formSchema = z.object({
  question: z.string().min(10, 'Please ask a more detailed question.'),
});

const RECENT_QUESTIONS_KEY = 'ai-widget-recent-questions';
const MAX_RECENT_QUESTIONS = 3;

export default function WebsiteAIWidget() {
  const [response, setResponse] = useState<WebsiteQAndAOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentQuestions, setRecentQuestions] = useState<string[]>([]);

  useEffect(() => {
    try {
      const storedQuestions = localStorage.getItem(RECENT_QUESTIONS_KEY);
      if (storedQuestions) {
        setRecentQuestions(JSON.parse(storedQuestions));
      }
    } catch (e) {
      console.error("Failed to parse recent questions from localStorage", e);
    }
  }, []);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: '',
    },
  });
  
  const handleExampleQuestionClick = (question: string) => {
    form.setValue('question', question);
    form.handleSubmit(onSubmit)();
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setResponse(null);
    setError('');
    try {
      const response = await websiteQAndA({ question: values.question });
      setResponse(response);
      
      // Update recent questions
      setRecentQuestions(prev => {
        const updatedQuestions = [values.question, ...prev.filter(q => q !== values.question)];
        const uniqueQuestions = [...new Set(updatedQuestions)].slice(0, MAX_RECENT_QUESTIONS);
        try {
            localStorage.setItem(RECENT_QUESTIONS_KEY, JSON.stringify(uniqueQuestions));
        } catch (e) {
            console.error("Failed to save recent questions to localStorage", e);
        }
        return uniqueQuestions;
      });

    } catch (e) {
      setError('Sorry, our AI is taking a break. Please try again later.');
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader className="text-center">
        <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <CardTitle>Ask Our AI Assistant</CardTitle>
        </div>
        <CardDescription>Get instant answers about our services, pricing, and more.</CardDescription>
      </CardHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="question"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input placeholder="e.g., How much does company registration cost?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isLoading && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                <span>Finding the best answer...</span>
              </div>
            )}
            {error && <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>}
            {response && !isLoading && (
              <Alert>
                <AlertTitle className="flex justify-between items-center">
                    <span>Answer:</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Confidence: {response.confidence}%</span>
                        <Progress value={response.confidence} className="w-20 h-2" />
                    </div>
                </AlertTitle>
                <AlertDescription>
                  <p>{response.answer}</p>
                  {response.serviceUrl && (
                    <Button asChild variant="link" className="p-0 h-auto mt-2">
                      <Link href={response.serviceUrl}>View Service Details</Link>
                    </Button>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {!isLoading && recentQuestions.length > 0 && (
                 <div className="pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <History className="h-4 w-4" />
                        <span>Recently asked</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {recentQuestions.map((q, i) => (
                        <Button 
                            key={i} 
                            variant="outline" 
                            size="sm" 
                            type="button" 
                            onClick={() => handleExampleQuestionClick(q)}
                            className="text-xs h-auto py-1 px-2"
                        >
                            {q}
                        </Button>
                        ))}
                    </div>
                </div>
            )}
          </CardContent>
          <CardFooter className="justify-center gap-2">
            <Button type="submit" disabled={isLoading}>
              Ask Question
            </Button>
            <Button variant="outline" asChild>
                <Link href="/contact">Contact Support</Link>
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

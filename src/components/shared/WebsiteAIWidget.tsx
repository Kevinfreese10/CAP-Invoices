'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { websiteQAndA } from '@/ai/flows/website-q-and-a';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Loader2, Sparkles } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const formSchema = z.object({
  question: z.string().min(10, 'Please ask a more detailed question.'),
});

export default function WebsiteAIWidget() {
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      question: '',
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    setAnswer('');
    setError('');
    try {
      const response = await websiteQAndA({ question: values.question });
      setAnswer(response.answer);
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
            {answer && !isLoading && <Alert><AlertTitle>Answer:</AlertTitle><AlertDescription>{answer}</AlertDescription></Alert>}
          </CardContent>
          <CardFooter className="justify-center">
            <Button type="submit" disabled={isLoading}>
              Ask Question
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}

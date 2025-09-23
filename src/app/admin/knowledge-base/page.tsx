
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Trash, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { KnowledgeBaseItem } from '@/lib/types';
import { knowledgeBaseItems as initialKnowledgeBaseItems } from '@/lib/knowledge-base';
import { collection, getDocs, deleteDoc, doc, query, orderBy, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import { Separator } from '@/components/ui/separator';

type UnansweredQuestion = {
  id: string;
  question: string;
  timestamp: Date;
};

type KBItem = KnowledgeBaseItem;
const db = getFirestore(firebaseApp);

const formSchema = z.object({
  id: z.string().optional(),
  question: z.string().min(10, 'Question must be at least 10 characters.'),
  answer: z.string().min(20, 'Answer must be at least 20 characters.'),
});

function KnowledgeBaseForm({ item, onSubmit, onCancel }: { item: KBItem | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: item?.id || '',
            question: item?.question || '',
            answer: item?.answer || '',
        },
    });

    useEffect(() => {
        form.reset({
            id: item?.id || '',
            question: item?.question || '',
            answer: item?.answer || '',
        });
    }, [item, form]);

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="question"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Question / Topic</FormLabel>
                            <FormControl><Textarea {...field} rows={2} placeholder="e.g., What is our refund policy?" /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="answer"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Answer / Information</FormLabel>
                            <FormControl><Textarea {...field} rows={5} placeholder="Provide a detailed and accurate answer."/></FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Item</Button>
                </div>
            </form>
        </Form>
    )
}

export default function AdminKnowledgeBasePage() {
  const [items, setItems] = useState<KBItem[]>(initialKnowledgeBaseItems);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<KBItem | null>(null);
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      try {
        const q = query(collection(db, 'unansweredQuestions'), orderBy('timestamp', 'desc'));
        const querySnapshot = await getDocs(q);
        const fetchedQuestions = querySnapshot.docs.map(doc => ({
          id: doc.id,
          question: doc.data().question,
          timestamp: doc.data().timestamp.toDate(),
        }));
        setQuestions(fetchedQuestions);
      } catch (error) {
        console.error("Error fetching unanswered questions:", error);
        toast({
          title: "Error",
          description: "Could not fetch unanswered questions.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchQuestions();
  }, [toast]);

  const handleAddToKnowledgeBase = (question: UnansweredQuestion) => {
    setSelectedItem({ id: question.id, question: question.question, answer: '' });
    setIsFormOpen(true);
  };

  const handleDeleteUnanswered = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'unansweredQuestions', id));
      setQuestions(prev => prev.filter(q => q.id !== id));
      toast({
        title: 'Question Deleted',
        description: 'The unanswered question has been removed.',
      });
    } catch (error) {
      console.error("Error deleting question:", error);
      toast({
        title: 'Error',
        description: 'Could not delete the question.',
        variant: 'destructive',
      });
    }
  };

  const handleAddKB = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };

  const handleEditKB = (item: KBItem) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };
  
  const handleDeleteKB = (itemId: string) => {
    setItems(prev => prev.filter(c => c.id !== itemId));
    toast({
        title: 'Item Deleted',
        description: 'The knowledge base item has been removed.',
        variant: 'destructive',
    })
  };

  const handleFormSubmit = (data: Omit<KBItem, 'id'> & { id?: string }) => {
    const isEditingExistingKB = selectedItem && selectedItem.id && !questions.some(q => q.id === selectedItem.id);

    if (isEditingExistingKB) {
      // Logic for editing an item that is already in the knowledge base
      setItems(prev => prev.map(c => (c.id === selectedItem.id ? { ...c, ...data } : c)));
      toast({ title: 'Item Updated', description: 'The knowledge base has been updated.' });
    } else { 
      // Logic for adding a new item, either from scratch or from an unanswered question
      setItems(prev => [...prev, { ...data, id: `kb-${Date.now()}` }]);
      toast({ title: 'Item Added', description: 'The new information has been added to the knowledge base.'});
      
      // If it was from an unanswered question, we should remove it from that list
      if (selectedItem && selectedItem.id) {
           handleDeleteUnanswered(selectedItem.id);
      }
    }
    setIsFormOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="space-y-8">
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogTrigger asChild>
                <span/>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{selectedItem?.answer ? 'Edit Item' : 'Add to Knowledge Base'}</DialogTitle>
                    <DialogDescription>
                        {selectedItem?.answer ? 'Update this piece of information for the AI.' : 'Add a new piece of information for the AI to learn.'}
                    </DialogDescription>
                </DialogHeader>
                <KnowledgeBaseForm 
                    item={selectedItem} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                />
            </DialogContent>
        </Dialog>

        <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold tracking-tight">Knowledge Base &amp; AI Training</h1>
            <Button onClick={handleAddKB}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Add to Knowledge Base
            </Button>
        </div>

        <Card>
            <CardHeader>
            <CardTitle>Unanswered Questions</CardTitle>
            <CardDescription>
                These are questions users have asked that the AI could not answer. Click a question to add it to the knowledge base.
            </CardDescription>
            </CardHeader>
            <CardContent>
            {isLoading ? (
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
            ) : questions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No unanswered questions right now. Great job!</p>
            ) : (
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Question</TableHead>
                        <TableHead>Asked</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {questions.map((q) => (
                        <TableRow key={q.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleAddToKnowledgeBase(q)}>
                            <TableCell className="font-medium max-w-2xl">{q.question}</TableCell>
                            <TableCell>{formatDistanceToNow(q.timestamp, { addSuffix: true })}</TableCell>
                            <TableCell className="text-right">
                                <AlertDialog onOpenChange={(e) => e.stopPropagation()}>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
                                            <Trash className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                            This action cannot be undone. This will permanently delete this question from the training list.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDeleteUnanswered(q.id)}>
                                                Continue
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
            )}
            </CardContent>
        </Card>

        <Separator />
        
        <Card>
            <CardHeader>
            <CardTitle>All Knowledge Base Items</CardTitle>
            <CardDescription>This information is used to help the "Ask Our AI Assistant" answer questions correctly.</CardDescription>
            </CardHeader>
            <CardContent>
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Question / Topic</TableHead>
                    <TableHead>Answer</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {items.map(item => (
                    <TableRow key={item.id}>
                    <TableCell className="font-medium align-top">{item.question}</TableCell>
                    <TableCell className="text-muted-foreground align-top max-w-lg truncate">{item.answer}</TableCell>
                    <TableCell className="text-right align-top">
                        <AlertDialog>
                            <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem onClick={() => handleEditKB(item)}>
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <AlertDialogTrigger asChild>
                                    <DropdownMenuItem className="text-destructive">
                                        Delete
                                    </DropdownMenuItem>
                                </AlertDialogTrigger>
                            </DropdownMenuContent>
                            </DropdownMenu>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete this item from the knowledge base.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteKB(item.id)}>
                                        Continue
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </CardContent>
        </Card>
    </div>
  );
}

    

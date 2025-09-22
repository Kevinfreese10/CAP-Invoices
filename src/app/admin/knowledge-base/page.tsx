
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
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

type KBItem = KnowledgeBaseItem;

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
  const { toast } = useToast();

  const handleAdd = () => {
    setSelectedItem(null);
    setIsFormOpen(true);
  };

  const handleEdit = (item: KBItem) => {
    setSelectedItem(item);
    setIsFormOpen(true);
  };
  
  const handleDelete = (itemId: string) => {
    setItems(prev => prev.filter(c => c.id !== itemId));
    toast({
        title: 'Item Deleted',
        description: 'The knowledge base item has been removed.',
        variant: 'destructive',
    })
  };

  const handleFormSubmit = (data: Omit<KBItem, 'id'>) => {
    if (selectedItem) {
      setItems(prev =>
        prev.map(c => (c.id === selectedItem.id ? { ...c, ...data } : c))
      );
       toast({
        title: 'Item Updated',
        description: 'The knowledge base has been updated.',
      });
    } else {
      setItems(prev => [
        ...prev,
        { ...data, id: `kb-${Date.now()}` }, // Mock ID
      ]);
       toast({
        title: 'Item Added',
        description: 'The new information has been added to the knowledge base.',
      });
    }
    setIsFormOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">AI Knowledge Base</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Add Information
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{selectedItem ? 'Edit Item' : 'Add to Knowledge Base'}</DialogTitle>
                    <DialogDescription>
                        {selectedItem ? 'Update this piece of information for the AI.' : 'Add a new piece of information for the AI to learn.'}
                    </DialogDescription>
                </DialogHeader>
                <KnowledgeBaseForm 
                    item={selectedItem} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Information</CardTitle>
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
                            <DropdownMenuItem onClick={() => handleEdit(item)}>
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
                                <AlertDialogAction onClick={() => handleDelete(item.id)}>
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

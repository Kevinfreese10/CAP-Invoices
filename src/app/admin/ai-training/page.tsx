
'use client';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Trash, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, getDocs, deleteDoc, doc, query, orderBy, getFirestore } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useRouter } from 'next/navigation';

type UnansweredQuestion = {
  id: string;
  question: string;
  timestamp: Date;
};

const db = getFirestore(firebaseApp);

export default function AITrainingPage() {
  const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

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

  const handleAddToKnowledgeBase = (question: string) => {
    // Navigate to the knowledge base page, pre-filling the form would be a great enhancement.
    // For now, we just navigate.
    router.push('/admin/knowledge-base');
    toast({
        title: "Redirecting...",
        description: "Navigating to Knowledge Base to add the new entry."
    })
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'unansweredQuestions', id));
      setQuestions(prev => prev.filter(q => q.id !== id));
      toast({
        title: 'Question Deleted',
        description: 'The question has been removed from the list.',
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

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">AI Training</h1>
        <Button onClick={() => router.push('/admin/knowledge-base')}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Manage Knowledge Base
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Unanswered Questions</CardTitle>
          <CardDescription>
            These are questions users have asked that the AI could not answer. Review them to improve the knowledge base.
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
                    <TableRow key={q.id}>
                    <TableCell className="font-medium max-w-2xl">{q.question}</TableCell>
                    <TableCell>{formatDistanceToNow(q.timestamp, { addSuffix: true })}</TableCell>
                    <TableCell className="text-right">
                        <AlertDialog>
                            <Button variant="ghost" onClick={() => handleAddToKnowledgeBase(q.question)}>
                                Add to KB
                            </Button>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
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
                                    <AlertDialogAction onClick={() => handleDelete(q.id)}>
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
    </div>
  );
}

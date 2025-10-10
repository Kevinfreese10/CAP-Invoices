
'use client';

import { useState, useEffect } from 'react';
import { getFirestore, collection, addDoc, query, where, onSnapshot, orderBy, doc, updateDoc, arrayUnion, arrayRemove, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { CommunityQuestion, CommunityAnswer, User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageCircle, ThumbsUp, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Separator } from '../ui/separator';

const db = getFirestore(firebaseApp);

export default function CommunityQnA() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
    const [users, setUsers] = useState<{ [key: string]: User }>({});
    const [newQuestion, setNewQuestion] = useState('');
    const [newAnswers, setNewAnswers] = useState<{ [key: string]: string }>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);

    useEffect(() => {
        // Fetch all users once to create a map
        const fetchUsers = async () => {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersMap = usersSnapshot.docs.reduce((acc, doc) => {
                acc[doc.id] = { uid: doc.id, ...doc.data() } as User;
                return acc;
            }, {} as { [key: string]: User });
            setUsers(usersMap);
        };
        fetchUsers();

        const q = query(collection(db, 'communityQuestions'), where('status', '==', 'approved'), orderBy('askedAt', 'desc'));
        const unsubscribe = onSnapshot(q, async (querySnapshot) => {
            const fetchedQuestions: CommunityQuestion[] = [];
            for (const doc of querySnapshot.docs) {
                const questionData = { id: doc.id, ...doc.data() } as CommunityQuestion;
                
                // Fetch answers for each question
                const answersQuery = query(collection(db, `communityQuestions/${doc.id}/answers`), orderBy('answeredAt', 'asc'));
                const answersSnapshot = await getDocs(answersQuery);
                questionData.answers = answersSnapshot.docs.map(answerDoc => ({ id: answerDoc.id, ...answerDoc.data() } as CommunityAnswer));
                
                fetchedQuestions.push(questionData);
            }
            setQuestions(fetchedQuestions);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleAskQuestion = async () => {
        if (!newQuestion.trim() || !user) return;
        setIsPosting(true);
        try {
            await addDoc(collection(db, 'communityQuestions'), {
                text: newQuestion,
                askedBy: user.uid,
                askedAt: new Date(),
                status: 'pending_approval',
                answerCount: 0,
            });
            setNewQuestion('');
            toast({ title: 'Question Submitted', description: 'Your question has been sent for admin approval.' });
        } catch (error) {
            toast({ title: 'Error', description: 'Could not submit your question.', variant: 'destructive' });
        } finally {
            setIsPosting(false);
        }
    };

    const handlePostAnswer = async (questionId: string) => {
        const answerText = newAnswers[questionId];
        if (!answerText || !answerText.trim() || !user) return;

        try {
            const answerRef = await addDoc(collection(db, `communityQuestions/${questionId}/answers`), {
                text: answerText,
                answeredBy: user.uid,
                answeredAt: new Date(),
                likes: 0,
                isBestAnswer: false,
            });
            // Update answer count
            const questionRef = doc(db, 'communityQuestions', questionId);
            const currentQuestion = questions.find(q => q.id === questionId);
            await updateDoc(questionRef, { answerCount: (currentQuestion?.answerCount || 0) + 1 });
            
            setNewAnswers(prev => ({ ...prev, [questionId]: '' }));
            toast({ title: 'Answer Posted!' });
        } catch (error) {
            toast({ title: 'Error', description: 'Could not post your answer.', variant: 'destructive' });
        }
    };

    const handleLikeAnswer = async (questionId: string, answerId: string) => {
        if (!user) return;
        const likeRef = doc(db, `communityQuestions/${questionId}/answers/${answerId}/likes`, user.uid);
        const answerRef = doc(db, `communityQuestions/${questionId}/answers`, answerId);

        // This is a simplified like logic. A transaction would be better in a real app.
        try {
            await setDoc(likeRef, { likedAt: new Date() });
            const currentAnswer = questions.find(q => q.id === questionId)?.answers?.find(a => a.id === answerId);
            await updateDoc(answerRef, { likes: (currentAnswer?.likes || 0) + 1 });
        } catch (error) {
             toast({ title: 'Error', description: 'Could not like the answer.', variant: 'destructive' });
        }
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Community Q&A</CardTitle>
                <CardDescription>Ask questions and share your knowledge with other resellers.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Textarea 
                        value={newQuestion}
                        onChange={(e) => setNewQuestion(e.target.value)}
                        placeholder="Ask the community a question..."
                    />
                    <Button onClick={handleAskQuestion} disabled={isPosting}>
                        {isPosting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>}
                        Ask Question
                    </Button>
                </div>
                
                <Separator />
                
                <div className="space-y-6">
                    {questions.map(q => {
                        const askedByUser = users[q.askedBy];
                        return (
                        <div key={q.id} className="space-y-4">
                            <div className="p-4 bg-muted/50 rounded-lg">
                                <p className="font-semibold">{q.text}</p>
                                <p className="text-xs text-muted-foreground">
                                    Asked by {askedByUser?.name || '...'} about {formatDistanceToNow(q.askedAt.toDate(), { addSuffix: true })}
                                </p>
                            </div>
                            <div className="pl-6 space-y-4">
                                {q.answers?.map(a => {
                                    const answeredByUser = users[a.answeredBy];
                                    return (
                                        <div key={a.id} className="border-l-2 pl-4">
                                            <p>{a.text}</p>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground mt-2">
                                                <p>by {answeredByUser?.name || '...'} {formatDistanceToNow(a.answeredAt.toDate(), { addSuffix: true })}</p>
                                                <Button variant="ghost" size="sm" onClick={() => handleLikeAnswer(q.id, a.id)}>
                                                    <ThumbsUp className="h-4 w-4 mr-2" />
                                                    {a.likes}
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                                 <div className="flex items-start gap-2">
                                     <Textarea
                                        value={newAnswers[q.id] || ''}
                                        onChange={(e) => setNewAnswers(prev => ({...prev, [q.id]: e.target.value}))}
                                        placeholder="Write an answer..."
                                        rows={2}
                                     />
                                     <Button onClick={() => handlePostAnswer(q.id)}>
                                        <Send className="h-4 w-4"/>
                                     </Button>
                                 </div>
                            </div>
                        </div>
                    )})}
                </div>
            </CardContent>
        </Card>
    )
}

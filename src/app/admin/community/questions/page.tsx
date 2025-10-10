
'use client';

import { useState, useEffect } from 'react';
import { getFirestore, collection, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { CommunityQuestion, User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, MoreHorizontal, CheckCircle, Trash2, XCircle } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';

const db = getFirestore(firebaseApp);

export default function CommunityQuestionsAdminPage() {
    const [questions, setQuestions] = useState<CommunityQuestion[]>([]);
    const [users, setUsers] = useState<{ [key: string]: User }>({});
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();
    const [filter, setFilter] = useState('pending_approval');

    const fetchQuestionsAndUsers = async () => {
        setIsLoading(true);
        try {
            // Fetch users first to map them
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersMap = usersSnapshot.docs.reduce((acc, doc) => {
                acc[doc.id] = { uid: doc.id, ...doc.data() } as User;
                return acc;
            }, {} as { [key: string]: User });
            setUsers(usersMap);

            // Fetch questions
            const q = query(collection(db, 'communityQuestions'), orderBy('askedAt', 'desc'));
            const querySnapshot = await getDocs(q);
            const fetchedQuestions = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as CommunityQuestion));
            setQuestions(fetchedQuestions);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ title: 'Error', description: 'Could not fetch community questions.', variant: 'destructive'});
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchQuestionsAndUsers();
    }, [toast]);
    
    const handleUpdateStatus = async (id: string, status: CommunityQuestion['status']) => {
        try {
            const questionRef = doc(db, 'communityQuestions', id);
            await updateDoc(questionRef, { status });
            toast({ title: 'Status Updated', description: `Question has been ${status}.` });
            fetchQuestionsAndUsers();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not update status.', variant: 'destructive'});
        }
    };
    
    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'communityQuestions', id));
            toast({ title: 'Question Deleted', variant: 'destructive'});
            fetchQuestionsAndUsers();
        } catch (error) {
            toast({ title: 'Error', description: 'Could not delete question.', variant: 'destructive'});
        }
    };
    
    const filteredQuestions = questions.filter(q => filter === 'all' || q.status === filter);
    
    const getStatusBadge = (status: CommunityQuestion['status']) => {
        switch (status) {
            case 'approved': return <Badge variant="success">Approved</Badge>;
            case 'pending_approval': return <Badge variant="warning">Pending</Badge>;
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Community Q&A</h1>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Manage Questions</CardTitle>
                    <CardDescription>Review, approve, or reject questions submitted by resellers.</CardDescription>
                    <div className="flex gap-2 pt-2">
                        <Button variant={filter === 'pending_approval' ? 'default' : 'outline'} onClick={() => setFilter('pending_approval')}>Pending</Button>
                        <Button variant={filter === 'approved' ? 'default' : 'outline'} onClick={() => setFilter('approved')}>Approved</Button>
                        <Button variant={filter === 'rejected' ? 'default' : 'outline'} onClick={() => setFilter('rejected')}>Rejected</Button>
                        <Button variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>All</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Question</TableHead>
                                    <TableHead>Asked By</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredQuestions.length === 0 ? (
                                    <TableRow><TableCell colSpan={5} className="text-center h-24">No questions found for this filter.</TableCell></TableRow>
                                ) : (
                                    filteredQuestions.map(q => {
                                        const user = users[q.askedBy];
                                        return (
                                            <TableRow key={q.id}>
                                                <TableCell>{getStatusBadge(q.status)}</TableCell>
                                                <TableCell className="font-medium max-w-lg">{q.text}</TableCell>
                                                <TableCell>{user?.name || q.askedBy}</TableCell>
                                                <TableCell>{formatDistanceToNow(q.askedAt.toDate(), { addSuffix: true })}</TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent>
                                                            {q.status !== 'approved' && <DropdownMenuItem onSelect={() => handleUpdateStatus(q.id, 'approved')}><CheckCircle className="mr-2 h-4 w-4"/>Approve</DropdownMenuItem>}
                                                            {q.status !== 'rejected' && <DropdownMenuItem onSelect={() => handleUpdateStatus(q.id, 'rejected')}><XCircle className="mr-2 h-4 w-4"/>Reject</DropdownMenuItem>}
                                                            <DropdownMenuItem onSelect={() => handleDelete(q.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}


'use client';
import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { Task, User } from '@/lib/types';
import { users as allUsers } from '@/contexts/AuthContext';
import { subDays } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare, PlusCircle } from 'lucide-react';

// Using the same mock data as the main tasks page for consistency
const initialTasks: Task[] = [
    { id: 'task-1', title: 'Follow up on ORD-001 documentation', description: 'Client needs to upload their ID copy.', assignedTo: '3', createdBy: '2', dueDate: new Date(), status: 'In Progress', orderId: 'ORD-001', updates: [ { text: 'Emailed client for documents', date: subDays(new Date(), 1), authorId: '2' }] },
    { id: 'task-2', title: 'Prepare ORD-002 monthly reports', description: 'Generate and send the income statement and balance sheet.', assignedTo: '3', createdBy: '2', dueDate: subDays(new Date(), -3), status: 'To Do', updates: [] },
    { id: 'task-3', title: 'Review new client onboarding', description: 'Check all new client details from last week.', assignedTo: '2', createdBy: '2', dueDate: new Date(), status: 'Completed', updates: [] },
    { id: 'task-4', title: 'Finalize Q2 financial statements', description: 'Final review before sending to the client.', assignedTo: '2', createdBy: '3', dueDate: subDays(new Date(), -5), status: 'In Progress', updates: [] },
];

const TaskTable = ({ tasks, title, description }: { tasks: Task[], title: string, description: string }) => {
    const getAssignee = (userId?: string): User | undefined => {
        if (!userId) return undefined;
        return allUsers.find(u => u.id === userId);
    }
    
    if (tasks.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>{title}</CardTitle>
                    <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">No tasks to display.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Task</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Related Order</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {tasks.map(task => {
                        const assignee = getAssignee(task.assignedTo);
                        const lastUpdate = task.updates && task.updates.length > 0 ? task.updates[task.updates.length - 1] : null;
                        const updateAuthor = lastUpdate ? getAssignee(lastUpdate.authorId) : null;
                        return (
                        <TableRow key={task.id}>
                        <TableCell className="font-medium max-w-xs align-top">
                            <p className="font-semibold truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                            {lastUpdate && updateAuthor && (
                                <div className="mt-2 flex items-start gap-2 border-l-2 border-primary/50 pl-2">
                                    <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                                    <div className="text-xs">
                                        <span className="font-semibold">{updateAuthor.name}:</span>
                                        <span className="text-muted-foreground ml-1">{`"${lastUpdate.text}"`}</span>
                                    </div>
                                </div>
                            )}
                        </TableCell>
                        <TableCell className="align-top">
                            {assignee ? (
                                <div className="flex items-center gap-2">
                                    <Avatar className="h-6 w-6">
                                        <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${assignee.email}`} alt={assignee.name} />
                                        <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <span className="text-xs">{assignee.name}</span>
                                </div>
                            ) : <span className="text-muted-foreground text-xs">N/A</span>}
                        </TableCell>
                        <TableCell className="align-top">{format(task.dueDate, 'dd MMM yyyy')}</TableCell>
                        <TableCell className="align-top">
                            <Badge variant={task.status === 'Completed' ? 'default' : 'secondary'}>
                                {task.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="align-top">
                           {task.orderId ? (
                                <Button variant="link" asChild className="p-0 h-auto text-xs">
                                    <Link href={`/admin/orders/${task.orderId}`}>{task.orderId}</Link>
                                </Button>
                            ) : <span className="text-muted-foreground text-xs">N/A</span>}
                        </TableCell>
                        </TableRow>
                    )})}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
};


export default function AdminDashboardPage() {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>(initialTasks);

    const myTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => task.assignedTo === user.id).sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
    }, [tasks, user]);

    const delegatedTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => task.createdBy === user.id && task.assignedTo !== user.id).sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
    }, [tasks, user]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}!</h1>
                <Button asChild>
                    <Link href="/admin/tasks">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Task
                    </Link>
                </Button>
            </div>
            
            <div className="space-y-8">
                <TaskTable tasks={myTasks} title="My Tasks" description="These are tasks that are assigned to you."/>
                {user?.role === 'admin' && (
                    <TaskTable tasks={delegatedTasks} title="Delegated Tasks" description="Tasks you have created and assigned to other staff."/>
                )}
            </div>
        </div>
    );
}

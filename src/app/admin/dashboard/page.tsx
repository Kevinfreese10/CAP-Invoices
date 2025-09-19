
'use client';
import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, subDays } from 'date-fns';
import { Task, User, TaskUpdate } from '@/lib/types';
import { users as allUsers } from '@/contexts/AuthContext';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare, PlusCircle, MoreHorizontal, CalendarIcon, Loader2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import ProductivityStats from '@/components/dashboard/ProductivityStats';

// Using the same mock data as the main tasks page for consistency
const initialTasks: Task[] = [
    { id: 'task-1', title: 'Follow up on ORD-001 documentation', description: 'Client needs to upload their ID copy.', assignedTo: '3', createdBy: '2', dueDate: new Date(), status: 'In Progress', updates: [ { text: 'Emailed client for documents', date: subDays(new Date(), 1), authorId: '2' }] },
    { id: 'task-2', title: 'Prepare ORD-002 monthly reports', description: 'Generate and send the income statement and balance sheet.', assignedTo: '3', createdBy: '2', dueDate: subDays(new Date(), -3), status: 'To Do', updates: [] },
    { id: 'task-3', title: 'Review new client onboarding', description: 'Check all new client details from last week.', assignedTo: '2', createdBy: '2', dueDate: new Date(), status: 'Completed', updates: [] },
    { id: 'task-4', title: 'Finalize Q2 financial statements', description: 'Final review before sending to the client.', assignedTo: '2', createdBy: '3', dueDate: subDays(new Date(), -5), status: 'In Progress', updates: [] },
];

const allStaff = allUsers.filter(u => u.role === 'staff' || u.role === 'admin');
const taskStatuses: Task['status'][] = ['To Do', 'In Progress', 'Completed'];

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(5, 'Title is required.'),
  description: z.string().min(10, 'Description is required.'),
  assignedTo: z.string().min(1, 'Please assign a staff member.'),
  dueDate: z.date({ required_error: 'A due date is required.'}),
  orderId: z.string().optional(),
  newUpdate: z.string().optional(),
});

function TaskForm({ task, onSubmit, onCancel, onUpdateSubmit }: { task: Task | null, onSubmit: (data: any) => void, onCancel: () => void, onUpdateSubmit: (taskId: string, updateText: string) => void }) {
    const { user } = useAuth();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: task?.id || '',
            title: task?.title || '',
            description: task?.description || '',
            assignedTo: task?.assignedTo || '',
            dueDate: task?.dueDate || new Date(),
            orderId: task?.orderId || '',
            newUpdate: '',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };

    const handleUpdateSubmit = () => {
        if (!task || !task.id) return;
        const updateText = form.getValues('newUpdate');
        if (updateText) {
            onUpdateSubmit(task.id, updateText);
            form.setValue('newUpdate', '');
        }
    }
    
    const getAuthor = (authorId: string): User | undefined => {
        return allUsers.find(u => u.id === authorId);
    }
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="assignedTo" render={({ field }) => (<FormItem><FormLabel>Assign To</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger></FormControl><SelectContent>{allStaff.map(staff => <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                     <FormField
                        control={form.control}
                        name="dueDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col pt-2">
                            <FormLabel className="mb-1">Due Date</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value ? (
                                        format(field.value, "PPP")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                </div>
                 <FormField control={form.control} name="orderId" render={({ field }) => (<FormItem><FormLabel>Related Order ID (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g. ORD-12345" /></FormControl><FormMessage /></FormItem>)} />
                
                {task && (
                    <>
                        <Separator />
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-foreground">Updates</h3>
                            <div className="space-y-4 max-h-40 overflow-y-auto pr-2">
                                {task.updates && task.updates.length > 0 ? task.updates.slice().reverse().map((update, index) => {
                                    const author = getAuthor(update.authorId);
                                    return (
                                    <div key={index} className="flex items-start gap-3">
                                         <Avatar className="h-8 w-8 border">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${author?.email}`} />
                                            <AvatarFallback>{author?.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="bg-muted p-3 rounded-lg w-full">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-xs font-semibold">{author?.name}</p>
                                                <p className="text-xs text-muted-foreground">{format(update.date, 'dd MMM yyyy, HH:mm')}</p>
                                            </div>
                                            <p className="text-sm">{update.text}</p>
                                        </div>
                                    </div>
                                )}) : <p className="text-xs text-muted-foreground text-center py-4">No updates posted yet.</p>}
                            </div>
                            <FormField 
                                control={form.control} 
                                name="newUpdate" 
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Add an Update</FormLabel>
                                    <FormControl><Textarea {...field} placeholder="Post a new update..." rows={2}/></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <Button type="button" size="sm" onClick={handleUpdateSubmit}>Post Update</Button>
                        </div>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Task</Button>
                </div>
            </form>
        </Form>
    )
}

const TaskTable = ({ tasks, title, description, onEdit, onUpdateStatus, onDelete }: { tasks: Task[], title: string, description: string, onEdit: (task: Task) => void, onUpdateStatus: (taskId: string, status: Task['status']) => void, onDelete: (taskId: string) => void }) => {
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
                        <TableHead className="text-right">Actions</TableHead>
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
                                    <DropdownMenuItem onClick={() => onEdit(task)}>
                                        Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuSub>
                                        <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                                        <DropdownMenuSubContent>
                                        {taskStatuses.map(status => (
                                            <DropdownMenuItem key={status} onClick={() => onUpdateStatus(task.id, status)} disabled={task.status === status}>
                                                Mark as {status}
                                            </DropdownMenuItem>
                                        ))}
                                        </DropdownMenuSubContent>
                                    </DropdownMenuSub>
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
                                        This action cannot be undone. This will permanently delete the task:
                                        <span className="font-semibold"> {task.title}</span>.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => onDelete(task.id)}>
                                            Continue
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
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
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const { toast } = useToast();

    const myTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => task.assignedTo === user.id).sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
    }, [tasks, user]);

    const delegatedTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => task.createdBy === user.id && task.assignedTo !== user.id).sort((a,b) => a.dueDate.getTime() - b.dueDate.getTime());
    }, [tasks, user]);

    const handleAdd = () => {
        setSelectedTask(null);
        setIsFormOpen(true);
    };

    const handleEdit = (task: Task) => {
        setSelectedTask(task);
        setIsFormOpen(true);
    };
    
    const handleDelete = (taskId: string) => {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        toast({
            title: 'Task Deleted',
            description: 'The task has been successfully removed.',
            variant: 'destructive',
        })
    };

    const handleUpdateStatus = (taskId: string, status: Task['status']) => {
        setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, status } : t))
        );
        toast({
            title: 'Task Status Updated',
            description: `The task has been marked as "${status}".`,
        });
    };

    const handleFormSubmit = (data: Omit<Task, 'id' | 'status' | 'createdBy' | 'updates'>) => {
        if (!user) return;
        if (selectedTask) {
        // Update
        setTasks(prev =>
            prev.map(t => (t.id === selectedTask.id ? { ...selectedTask, ...data } : t))
        );
        toast({
            title: 'Task Updated',
            description: 'The task details have been saved.',
        });
        } else {
        // Add
        setTasks(prev => [
            ...prev,
            { ...data, id: `new-task-${Date.now()}`, status: 'To Do', createdBy: user.id, updates: [] },
        ]);
        toast({
            title: 'Task Created',
            description: 'The new task has been added successfully.',
        });
        }
        setIsFormOpen(false);
        setSelectedTask(null);
    };
  
    const handleUpdateSubmit = (taskId: string, updateText: string) => {
        if (!user) return;
        const newUpdate: TaskUpdate = {
            text: updateText,
            date: new Date(),
            authorId: user.id,
        };

        const updateTask = (taskToUpdate: Task) => {
            const updatedTask = {
                ...taskToUpdate,
                updates: [...(taskToUpdate.updates || []), newUpdate],
            };
            // Also update the selected task in the dialog
            setSelectedTask(updatedTask); 
            return updatedTask;
        }

        setTasks(prev =>
            prev.map(t => t.id === taskId ? updateTask(t) : t)
        );

        toast({
            title: 'Update Posted',
            description: 'Your update has been added to the task.',
        });
    }

    const handleFormClose = () => {
        setIsFormOpen(false);
        setSelectedTask(null);
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}!</h1>
                 <Dialog open={isFormOpen} onOpenChange={handleFormClose}>
                    <DialogTrigger asChild>
                        <Button onClick={handleAdd}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Create Task
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>{selectedTask?.id ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                            <DialogDescription>
                                {selectedTask?.id ? 'Update the details of this task.' : 'Fill out the form to add a new task for a staff member.'}
                            </DialogDescription>
                        </DialogHeader>
                        <TaskForm 
                            task={selectedTask} 
                            onSubmit={handleFormSubmit}
                            onCancel={handleFormClose}
                            onUpdateSubmit={handleUpdateSubmit}
                        />
                    </DialogContent>
                </Dialog>
            </div>
            
             <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <ProductivityStats tasks={myTasks} className="lg:col-span-3" />
                <Card className="lg:col-span-4">
                <CardHeader>
                    <CardTitle>Task Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-8">
                     <div className="flex items-center">
                        <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">My Tasks</p>
                            <p className="text-sm text-muted-foreground">
                               {myTasks.length} tasks assigned to you
                            </p>
                        </div>
                        <div className="ml-auto font-medium">{myTasks.filter(t => t.status === 'Completed').length} / {myTasks.length}</div>
                    </div>
                     <div className="flex items-center">
                        <div className="ml-4 space-y-1">
                            <p className="text-sm font-medium leading-none">Delegated Tasks</p>
                            <p className="text-sm text-muted-foreground">
                                {delegatedTasks.length} tasks created by you
                            </p>
                        </div>
                        <div className="ml-auto font-medium">{delegatedTasks.filter(t => t.status === 'Completed').length} / {delegatedTasks.length}</div>
                    </div>
                </CardContent>
                </Card>
            </div>

            <div className="space-y-8">
                <TaskTable 
                    tasks={myTasks} 
                    title="My Tasks" 
                    description="These are tasks that are assigned to you."
                    onEdit={handleEdit}
                    onUpdateStatus={handleUpdateStatus}
                    onDelete={handleDelete}
                />
                {user?.role === 'admin' && (
                    <TaskTable 
                        tasks={delegatedTasks} 
                        title="Delegated Tasks" 
                        description="Tasks you have created and assigned to other staff."
                        onEdit={handleEdit}
                        onUpdateStatus={handleUpdateStatus}
                        onDelete={handleDelete}
                    />
                )}
            </div>
        </div>
    );
}



'use client';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Repeat, Check, Tag } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Task, User, TaskComment } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, MessageSquare } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, arrayUnion, Timestamp, writeBatch, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { users } from '@/lib/data';

const db = getFirestore(firebaseApp);

const departments = ['Accounting and Tax', 'Administration', 'CAP'] as const;

const taskStatuses: Task['status'][] = ['To-Do', 'In Progress', 'Review', 'Done'];
const taskRecurrences: Task['recurrence'][] = ['None', 'Daily', 'Weekly', 'Monthly'];

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(5, 'Title is required.'),
  description: z.string().min(10, 'Description is required.'),
  assignedTo: z.array(z.string()).min(1, 'Please assign a staff member.'),
  tags: z.array(z.string()).optional(),
  dueDate: z.date({ required_error: 'A due date is required.'}),
  recurrence: z.enum(taskRecurrences).optional(),
  orderId: z.string().optional(),
  newComment: z.string().optional(),
});

function TaskForm({ task, onSubmit, onCancel, onCommentSubmit, allStaff, staffByDept }: { task: Task | null, onSubmit: (data: any) => void, onCancel: () => void, onCommentSubmit: (taskId: string, commentText: string) => void, allStaff: User[], staffByDept: Record<string, User[]> }) {
    const { user } = useAuth();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: task?.id || '',
            title: task?.title || '',
            description: task?.description || '',
            assignedTo: task?.assignedTo || [],
            tags: task?.tags || [],
            dueDate: task?.dueDate ? task.dueDate.toDate() : new Date(),
            recurrence: task?.recurrence || 'None',
            orderId: task?.orderId || '',
            newComment: '',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };

    const handleCommentSubmit = () => {
        if (!task || !task.id) return;
        const commentText = form.getValues('newComment');
        if (commentText) {
            onCommentSubmit(task.id, commentText);
            form.setValue('newComment', '');
        }
    }
    
    const getAuthor = (authorId: string): User | undefined => {
        return allStaff.find(u => u.id === authorId) || users.find(u => u.id === authorId);
    }
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="assignedTo"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Assign To</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "w-full justify-between",
                                        !field.value?.length && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value?.length > 0
                                        ? `${field.value.length} selected`
                                        : "Select staff or team"}
                                    <MoreHorizontal className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search..." />
                                    <CommandList>
                                    <CommandEmpty>No results found.</CommandEmpty>
                                    <CommandGroup heading="Teams">
                                        <CommandItem onSelect={() => field.onChange(['all'])}>All Staff</CommandItem>
                                        <CommandItem onSelect={() => field.onChange(staffByDept['Accounting and Tax']?.map(s => s.id) || [])}>Accounting and Tax Dept</CommandItem>
                                        <CommandItem onSelect={() => field.onChange(staffByDept['Administration']?.map(s => s.id) || [])}>Administration Dept</CommandItem>
                                        <CommandItem onSelect={() => field.onChange(staffByDept['CAP']?.map(s => s.id) || [])}>CAP Dept</CommandItem>
                                    </CommandGroup>
                                    <CommandGroup heading="Individual Staff">
                                        {allStaff.map((staff) => (
                                        <CommandItem
                                            key={staff.id}
                                            value={staff.name}
                                            onSelect={() => {
                                            const selection = new Set(field.value);
                                            if (selection.has(staff.id)) {
                                                selection.delete(staff.id);
                                            } else {
                                                selection.add(staff.id);
                                            }
                                            field.onChange(Array.from(selection));
                                            }}
                                        >
                                            <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                field.value?.includes(staff.id)
                                                ? "bg-primary text-primary-foreground"
                                                : "opacity-50 [&_svg]:invisible"
                                            )}
                                            >
                                            <Check className={cn("h-4 w-4")} />
                                            </div>
                                            <span>{staff.name}</span>
                                        </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
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
                                        format(field.value, "dd MMM yyyy")
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
                 <FormField
                        control={form.control}
                        name="tags"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Tag Staff (Optional)</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    className={cn(
                                        "w-full justify-between",
                                        !field.value?.length && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value?.length > 0
                                        ? `${field.value.length} tagged`
                                        : "Select staff to tag..."}
                                    <MoreHorizontal className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search..." />
                                    <CommandList>
                                    <CommandEmpty>No results found.</CommandEmpty>
                                    <CommandGroup heading="Individual Staff">
                                        {allStaff.map((staff) => (
                                        <CommandItem
                                            key={staff.id}
                                            value={staff.name}
                                            onSelect={() => {
                                            const selection = new Set(field.value);
                                            if (selection.has(staff.id)) {
                                                selection.delete(staff.id);
                                            } else {
                                                selection.add(staff.id);
                                            }
                                            field.onChange(Array.from(selection));
                                            }}
                                        >
                                            <div
                                            className={cn(
                                                "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                field.value?.includes(staff.id)
                                                ? "bg-primary text-primary-foreground"
                                                : "opacity-50 [&_svg]:invisible"
                                            )}
                                            >
                                            <Check className={cn("h-4 w-4")} />
                                            </div>
                                            <span>{staff.name}</span>
                                        </CommandItem>
                                        ))}
                                    </CommandGroup>
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                 <FormField control={form.control} name="orderId" render={({ field }) => (<FormItem><FormLabel>Related Order ID (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g. ORD-12345" /></FormControl><FormMessage /></FormItem>)} />
                 <FormField control={form.control} name="recurrence" render={({ field }) => (<FormItem><FormLabel>Recurrence</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select recurrence..." /></SelectTrigger></FormControl><SelectContent>{taskRecurrences.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                {task && (
                    <>
                        <Separator />
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-foreground">Comments</h3>
                            <div className="space-y-4 max-h-40 overflow-y-auto pr-2">
                                {task.comments && task.comments.length > 0 ? task.comments.slice().reverse().map((comment, index) => {
                                    const author = getAuthor(comment.authorId);
                                    const date = comment.date?.toDate ? comment.date.toDate() : new Date(comment.date);
                                    return (
                                    <div key={index} className="flex items-start gap-3">
                                         <Avatar className="h-8 w-8 border">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${author?.email}`} />
                                            <AvatarFallback>{author?.name.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="bg-muted p-3 rounded-lg w-full">
                                            <div className="flex justify-between items-center mb-1">
                                                <p className="text-xs font-semibold">{author?.name}</p>
                                                <p className="text-xs text-muted-foreground">{format(date, 'dd MMM yyyy, HH:mm')}</p>
                                            </div>
                                            <p className="text-sm">{comment.text}</p>
                                        </div>
                                    </div>
                                )}) : <p className="text-xs text-muted-foreground text-center py-4">No comments posted yet.</p>}
                            </div>
                            <FormField 
                                control={form.control} 
                                name="newComment" 
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Add a Comment</FormLabel>
                                    <FormControl><Textarea {...field} placeholder="Post a new comment..." rows={2}/></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}/>
                            <Button type="button" size="sm" onClick={handleCommentSubmit}>Post Comment</Button>
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

const userColors = [
  'bg-red-200 text-red-800',
  'bg-blue-200 text-blue-800',
  'bg-green-200 text-green-800',
  'bg-yellow-200 text-yellow-800',
  'bg-purple-200 text-purple-800',
  'bg-pink-200 text-pink-800',
  'bg-indigo-200 text-indigo-800',
  'bg-teal-200 text-teal-800',
];

const getUserColor = (userId: string) => {
  // Simple hash function to get a consistent color for a user
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return userColors[hash % userColors.length];
};

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [allStaff, setAllStaff] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [taskTypeFilter, setTaskTypeFilter] = useState('all');
  const { toast } = useToast();
  const { user } = useAuth();
  
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
        const tasksQuery = query(collection(db, 'tasks'), orderBy('dueDate', 'asc'));
        const tasksSnapshot = await getDocs(tasksQuery);
        const fetchedTasks = tasksSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
        setTasks(fetchedTasks);

        const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
        const staffSnapshot = await getDocs(staffQuery);
        const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
        setAllStaff(fetchedStaff);

    } catch (error) {
        console.error("Error fetching tasks:", error);
        toast({ title: "Error", description: "Could not fetch tasks.", variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const staffByDept = useMemo(() => {
    const result: Record<string, User[]> = {};
    departments.forEach(dept => {
        result[dept] = allStaff.filter(u => u.department === dept);
    });
    return result;
  }, [allStaff]);

  const taskTypes = useMemo(() => {
    const types = new Set(tasks.map(task => {
        const title = task.title;
        const forIndex = title.lastIndexOf(' for ');
        if (forIndex > -1) {
            return title.substring(0, forIndex);
        }
        return title;
    }));
    return ['All Tasks', ...Array.from(types)];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let tasksToFilter = tasks;
    if (user?.role === 'staff') {
        tasksToFilter = tasks.filter(task => Array.isArray(task.assignedTo) && task.assignedTo.includes(user.id));
    }
    
    if (taskTypeFilter !== 'all' && taskTypeFilter !== 'All Tasks') {
        return tasksToFilter.filter(task => task.title.startsWith(taskTypeFilter));
    }

    return tasksToFilter;
  }, [tasks, user, taskTypeFilter]);


  const handleAdd = () => {
    setSelectedTask(null);
    setIsFormOpen(true);
  };

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setIsFormOpen(true);
  };
  
  const handleDelete = async (taskId: string) => {
    try {
        await deleteDoc(doc(db, 'tasks', taskId));
        fetchTasks();
        toast({
            title: 'Task Deleted',
            description: 'The task has been successfully removed.',
            variant: 'destructive',
        })
    } catch (error) {
        console.error("Error deleting task:", error);
        toast({ title: 'Error', description: 'Could not delete task.', variant: 'destructive'});
    }
  };

   const handleUpdateStatus = async (taskId: string, status: Task['status']) => {
    try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, { status });
        
        if (status === 'Done') {
            toast({
                title: 'Task Completed!',
                description: 'The task has been successfully marked as complete.',
            });
        } else {
             toast({
                title: 'Task Status Updated',
                description: `The task has been marked as "${status}".`,
            });
        }
        fetchTasks();
    } catch (error) {
        console.error("Error updating status:", error);
        toast({ title: 'Error', description: 'Could not update status.', variant: 'destructive'});
    }
  };

  const handleFormSubmit = async (data: Omit<Task, 'id' | 'status' | 'createdBy' | 'comments' | 'priority'>) => {
    if (!user) return;
    setIsLoading(true);
    
    const taskData = {
        ...data,
        dueDate: Timestamp.fromDate(data.dueDate as Date),
    };

    try {
        if (selectedTask?.id) {
            const taskRef = doc(db, 'tasks', selectedTask.id);
            await updateDoc(taskRef, { ...taskData });
            toast({ title: 'Task Updated', description: 'The task details have been saved.' });
        } else {
            const newTask: Omit<Task, 'id' | 'priority'> = {
                ...taskData,
                status: 'To-Do',
                createdBy: user.id,
                comments: [],
            };
            await addDoc(collection(db, 'tasks'), newTask);
            toast({ title: 'Task Created', description: `Task assigned to ${data.assignedTo.length} member(s).` });
        }
        fetchTasks();
        setIsFormOpen(false);
        setSelectedTask(null);
    } catch (error) {
        console.error("Error saving task:", error);
        toast({ title: 'Error', description: 'Could not save the task.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleCommentSubmit = async (taskId: string, commentText: string) => {
    if (!user) return;
    
    const newComment: TaskComment = {
        text: commentText,
        date: Timestamp.now(),
        authorId: user.id,
    };

    try {
        const taskRef = doc(db, 'tasks', taskId);
        await updateDoc(taskRef, {
            comments: arrayUnion(newComment),
        });
        
        const newCommentForState = { ...newComment, date: new Date() };

        if (selectedTask) {
             const updatedComments = [...(selectedTask.comments || []), newCommentForState];
             setSelectedTask({ ...selectedTask, comments: updatedComments });
        }
       
        setTasks(prevTasks => prevTasks.map(t => {
            if (t.id === taskId) {
                const existingComments = t.comments?.map(c => c.date.toDate ? c : {...c, date: new Date(c.date)}) || [];
                return {...t, comments: [...existingComments, newCommentForState]};
            }
            return t;
        }));

        toast({ title: 'Comment Posted', description: 'Your comment has been added.' });
    } catch (error) {
        console.error("Error posting comment:", error);
        toast({ title: 'Error', description: 'Could not post comment.', variant: 'destructive' });
    }
}

  const getAssignee = (userId?: string): User | undefined => {
    if (!userId) return undefined;
    return allStaff.find(u => u.id === userId) || users.find(u => u.id === userId);
  }

    const getStatusVariant = (status: Task['status']) => {
        switch (status) {
            case 'Done': return 'success';
            case 'In Progress': return 'info';
            case 'To-Do': return 'info';
            case 'Review': return 'warning';
            default: return 'secondary';
        }
    };
    

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Tasks</h1>
        <Dialog open={isFormOpen} onOpenChange={(isOpen) => { setIsFormOpen(isOpen); if (!isOpen) setSelectedTask(null);}}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Task
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>{selectedTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                    <DialogDescription>
                        {selectedTask ? 'Update the details of this task.' : 'Fill out the form to add a new task for a staff member.'}
                    </DialogDescription>
                </DialogHeader>
                <TaskForm 
                    task={selectedTask} 
                    onSubmit={handleFormSubmit}
                    onCancel={() => setIsFormOpen(false)}
                    onCommentSubmit={handleCommentSubmit}
                    allStaff={allStaff}
                    staffByDept={staffByDept}
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle>All Tasks</CardTitle>
              <CardDescription>
                {user?.role === 'staff' ? 'Showing all tasks assigned to you.' : 'View, edit, and delete all tasks in the system.'}
              </CardDescription>
            </div>
            <div className="w-full sm:w-auto">
                <Select onValueChange={setTaskTypeFilter} defaultValue="all">
                    <SelectTrigger className="w-full sm:w-[240px]">
                        <SelectValue placeholder="Filter by task type..." />
                    </SelectTrigger>
                    <SelectContent>
                        {taskTypes.map(type => (
                            <SelectItem key={type} value={type === 'All Tasks' ? 'all' : type}>
                                {type}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>Assigned To</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Related Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">No tasks to display.</TableCell>
                </TableRow>
              ) : (
                filteredTasks.map(task => {
                    const lastComment = task.comments && task.comments.length > 0 ? task.comments[task.comments.length - 1] : null;
                    const commentAuthor = lastComment ? getAssignee(lastComment.authorId) : null;
                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                    const tags = Array.isArray(task.tags) ? task.tags : [];
                    return (
                    <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-xs align-top">
                        <div className="flex items-center gap-2">
                            {task.recurrence && task.recurrence !== 'None' && <Repeat className="h-4 w-4 text-muted-foreground" title={`Repeats ${task.recurrence}`} />}
                            <p className="font-semibold truncate">{task.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                        {lastComment && commentAuthor && (
                            <div className="mt-2 flex items-start gap-2 border-l-2 border-primary/50 pl-2">
                                <MessageSquare className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                                <div className="text-xs">
                                    <span className="font-semibold">{commentAuthor.name}:</span>
                                    <span className="text-muted-foreground ml-1">"{lastComment.text}"</span>
                                </div>
                            </div>
                        )}
                    </TableCell>
                    <TableCell className="align-top">
                         <div className="flex items-center -space-x-2">
                            {assignees.slice(0, 3).map(userId => {
                                const assignee = getAssignee(userId);
                                if (!assignee) return null;
                                return (
                                        <TooltipProvider key={userId}>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <span className={cn("h-6 w-6 border-2 border-background rounded-full flex items-center justify-center text-xs font-semibold", getUserColor(assignee.id))}>{assignee.name.charAt(0)}</span>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>{assignee.name}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}
                                {assignees.length > 3 && (
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold border-2 border-background">
                                    +{assignees.length - 3}
                                </div>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="align-top">
                        <div className="flex items-center -space-x-2">
                            {tags.slice(0, 3).map(userId => {
                                const taggedUser = getAssignee(userId);
                                if (!taggedUser) return null;
                                return (
                                        <TooltipProvider key={userId}>
                                        <Tooltip>
                                            <TooltipTrigger>
                                                <Avatar className="h-6 w-6 border-2 border-background opacity-70">
                                                    <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${taggedUser.email}`} alt={taggedUser.name} />
                                                    <AvatarFallback>{taggedUser.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                <p>Tagged: {taggedUser.name}</p>
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                );
                            })}
                                {tags.length > 3 && (
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold border-2 border-background opacity-70">
                                    +{tags.length - 3}
                                </div>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="align-top">{task.dueDate.toDate ? format(task.dueDate.toDate(), 'dd MMM yyyy') : format(task.dueDate, 'dd MMM yyyy')}</TableCell>
                    <TableCell className="align-top">
                        <Badge variant={getStatusVariant(task.status)}>
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
                                <DropdownMenuItem onClick={() => handleEdit(task)}>
                                    Edit / View Comments
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Change Status</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                    {taskStatuses.map(status => (
                                        <DropdownMenuItem key={status} onClick={() => handleUpdateStatus(task.id, status)} disabled={task.status === status}>
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
                                    <AlertDialogAction onClick={() => handleDelete(task.id)}>
                                        Continue
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                    </TableRow>
                )})
              )}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
    

    


    



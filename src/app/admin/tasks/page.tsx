

'use client';
import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle, Repeat } from 'lucide-react';
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
import { users } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Loader2, MessageSquare } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, orderBy, arrayUnion, Timestamp, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const db = getFirestore(firebaseApp);

const allStaff = users.filter(u => u.role === 'staff' || u.role === 'admin');
const departments = ['Accounting and Tax', 'Administration'] as const;
const staffByDept = {
    'Accounting and Tax': allStaff.filter(u => u.department === 'Accounting and Tax'),
    'Administration': allStaff.filter(u => u.department === 'Administration'),
};
const taskStatuses: Task['status'][] = ['To-Do', 'In Progress', 'Review', 'Done'];
const taskPriorities: Task['priority'][] = ['High', 'Medium', 'Low'];
const taskRecurrences: Task['recurrence'][] = ['None', 'Daily', 'Weekly', 'Monthly'];

const formSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(5, 'Title is required.'),
  description: z.string().min(10, 'Description is required.'),
  assignedTo: z.string().min(1, 'Please assign a staff member.'),
  dueDate: z.date({ required_error: 'A due date is required.'}),
  priority: z.enum(taskPriorities),
  recurrence: z.enum(taskRecurrences).optional(),
  orderId: z.string().optional(),
  newComment: z.string().optional(),
});

function TaskForm({ task, onSubmit, onCancel, onCommentSubmit }: { task: Task | null, onSubmit: (data: any) => void, onCancel: () => void, onCommentSubmit: (taskId: string, commentText: string) => void }) {
    const { user } = useAuth();
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: task?.id || '',
            title: task?.title || '',
            description: task?.description || '',
            assignedTo: task?.assignedTo?.[0] || '',
            dueDate: task?.dueDate ? task.dueDate.toDate() : new Date(),
            priority: task?.priority || 'Medium',
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
        return users.find(u => u.id === authorId);
    }
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField control={form.control} name="assignedTo" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Assign To</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value} disabled={!!task?.id}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger></FormControl>
                                <SelectContent>
                                    {!task?.id && (
                                    <>
                                        <SelectGroup>
                                            <SelectLabel>Teams</SelectLabel>
                                            <SelectItem value="all">All Staff</SelectItem>
                                            <SelectItem value="dept-accounting-and-tax">Accounting and Tax Dept</SelectItem>
                                            <SelectItem value="dept-administration">Administration Dept</SelectItem>
                                        </SelectGroup>
                                        <SelectGroup>
                                            <SelectLabel>Individual Staff</SelectLabel>
                                            {departments.map(dept => (
                                                <SelectGroup key={dept}>
                                                    <SelectLabel className="pl-4 text-xs">{dept}</SelectLabel>
                                                    {staffByDept[dept].map(staff => <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>)}
                                                </SelectGroup>
                                            ))}
                                        </SelectGroup>
                                    </>
                                    )}
                                    {!!task?.id && Array.isArray(task.assignedTo) && task.assignedTo.map(userId => {
                                        const user = getAuthor(userId);
                                        return user ? <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem> : null;
                                    })}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )} />
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
                    <FormField control={form.control} name="priority" render={({ field }) => (<FormItem><FormLabel>Priority</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select priority..." /></SelectTrigger></FormControl><SelectContent>{taskPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="recurrence" render={({ field }) => (<FormItem><FormLabel>Recurrence</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Never" /></SelectTrigger></FormControl><SelectContent>{taskRecurrences.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                </div>
                 <FormField control={form.control} name="orderId" render={({ field }) => (<FormItem><FormLabel>Related Order ID (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g. ORD-12345" /></FormControl><FormMessage /></FormItem>)} />
                
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

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, 'tasks'), orderBy('dueDate', 'asc'));
        const querySnapshot = await getDocs(q);
        const fetchedTasks = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
        setTasks(fetchedTasks);
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

  const filteredTasks = useMemo(() => {
    if (user?.role === 'staff') {
        return tasks.filter(task => Array.isArray(task.assignedTo) && task.assignedTo.includes(user.id));
    }
    return tasks;
  }, [tasks, user]);


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
        fetchTasks();
        toast({
            title: 'Task Status Updated',
            description: `The task has been marked as "${status}".`,
        });
    } catch (error) {
        console.error("Error updating status:", error);
        toast({ title: 'Error', description: 'Could not update status.', variant: 'destructive'});
    }
  };

  const handleFormSubmit = async (data: Omit<Task, 'id' | 'status' | 'createdBy' | 'comments' | 'assignedTo'> & { assignedTo: string }) => {
    if (!user) return;
    setIsLoading(true);
    
    const { assignedTo: assignmentKey, ...restOfData } = data;

    const taskData = {
        ...restOfData,
        dueDate: Timestamp.fromDate(data.dueDate as Date),
    };

    try {
        if (selectedTask?.id) {
            const taskRef = doc(db, 'tasks', selectedTask.id);
            await updateDoc(taskRef, { ...taskData });
            toast({ title: 'Task Updated', description: 'The task details have been saved.' });
        } else {
             let targetStaffIds: string[] = [];
            let successMessage = '';

            if (assignmentKey === 'all') {
                targetStaffIds = allStaff.map(s => s.id);
                successMessage = `A new task has been assigned to all ${targetStaffIds.length} staff members.`;
            } else if (assignmentKey.startsWith('dept-')) {
                const dept = assignmentKey.replace('dept-', '') as keyof typeof staffByDept;
                targetStaffIds = staffByDept[dept].map(s => s.id);
                successMessage = `Task assigned to all ${targetStaffIds.length} members of the ${dept} department.`;
            } else {
                const singleStaff = allStaff.find(s => s.id === assignmentKey);
                if (singleStaff) {
                    targetStaffIds.push(singleStaff.id);
                }
                successMessage = 'The new task has been added successfully.';
            }

            if (targetStaffIds.length > 0) {
                const newTask: Omit<Task, 'id'> = {
                    ...taskData,
                    assignedTo: targetStaffIds,
                    status: 'To-Do',
                    createdBy: user.id,
                    comments: [],
                };
                await addDoc(collection(db, 'tasks'), newTask);
                toast({ title: 'Task Created', description: successMessage });
            } else {
                    toast({ title: 'Assignment Error', description: 'No staff members found for the selected assignment.', variant: 'destructive' });
            }
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
      const commentTimestamp = Timestamp.now();
      const newComment: TaskComment = {
          text: commentText,
          date: commentTimestamp,
          authorId: user.id,
      };

      try {
          const taskRef = doc(db, 'tasks', taskId);
          await updateDoc(taskRef, {
              comments: arrayUnion(newComment)
          });
          if (selectedTask) {
              const updatedComments = [...(selectedTask.comments || []), newComment];
              setSelectedTask({ ...selectedTask, comments: updatedComments });
          }
           setTasks(prevTasks => prevTasks.map(t => {
                if (t.id === taskId) {
                    return {...t, comments: [...(t.comments || []), newComment]};
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
    return users.find(u => u.id === userId);
  }

    const getStatusVariant = (status: Task['status']) => {
        switch (status) {
            case 'Done': return 'success';
            case 'In Progress': return 'info';
            case 'To-Do': return 'secondary';
            case 'Review': return 'warning';
            default: return 'secondary';
        }
    };
    
    const getPriorityVariant = (priority: Task['priority']) => {
        switch(priority) {
            case 'High': return 'destructive';
            case 'Medium': return 'warning';
            case 'Low': return 'secondary';
            default: return 'secondary';
        }
    }

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
                />
           </DialogContent>
        </Dialog>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Tasks</CardTitle>
          <CardDescription>
            {user?.role === 'staff' ? 'Showing all tasks assigned to you.' : 'View, edit, and delete all tasks in the system.'}
          </CardDescription>
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
                <TableHead>Due Date</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Related Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No tasks to display.</TableCell>
                </TableRow>
              ) : (
                filteredTasks.map(task => {
                    const lastComment = task.comments && task.comments.length > 0 ? task.comments[task.comments.length - 1] : null;
                    const commentAuthor = lastComment ? getAssignee(lastComment.authorId) : null;
                    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
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
                                                <Avatar className="h-6 w-6 border-2 border-background">
                                                    <AvatarImage src={`https://api.dicebear.com/7.x/micah/svg?seed=${assignee.email}`} alt={assignee.name} />
                                                    <AvatarFallback>{assignee.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
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
                    <TableCell className="align-top">{format(task.dueDate.toDate(), 'dd MMM yyyy')}</TableCell>
                    <TableCell className="align-top">
                        <Badge variant={getPriorityVariant(task.priority)}>
                            {task.priority}
                        </Badge>
                    </TableCell>
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

    

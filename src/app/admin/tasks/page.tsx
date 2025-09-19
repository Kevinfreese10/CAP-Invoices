
'use client';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, PlusCircle } from 'lucide-react';
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
import { Task, User } from '@/lib/types';
import { users as allUsers } from '@/contexts/AuthContext';
import { useAuth } from '@/contexts/AuthContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Link from 'next/link';

// Mock data
const initialTasks: Task[] = [
    { id: 'task-1', title: 'Follow up on ORD-001 documentation', description: 'Client needs to upload their ID copy.', assignedTo: '3', dueDate: new Date(), status: 'In Progress', orderId: 'ORD-001' },
    { id: 'task-2', title: 'Prepare ORD-002 monthly reports', description: 'Generate and send the income statement and balance sheet.', assignedTo: '3', dueDate: subDays(new Date(), -3), status: 'To Do' },
    { id: 'task-3', title: 'Review new client onboarding', description: 'Check all new client details from last week.', assignedTo: '2', dueDate: new Date(), status: 'Completed' },
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
});

function TaskForm({ task, onSubmit, onCancel }: { task: Task | null, onSubmit: (data: any) => void, onCancel: () => void }) {
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            id: task?.id || '',
            title: task?.title || '',
            description: task?.description || '',
            assignedTo: task?.assignedTo || '',
            dueDate: task?.dueDate || new Date(),
            orderId: task?.orderId || '',
        },
    });

    const handleSubmit = (values: z.infer<typeof formSchema>) => {
        onSubmit(values);
    };
    
    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel>Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>)} />
                <FormField control={form.control} name="description" render={({ field }) => (<FormItem><FormLabel>Description</FormLabel><FormControl><Textarea {...field} rows={3} /></FormControl><FormMessage /></FormItem>)} />
                <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="assignedTo" render={({ field }) => (<FormItem><FormLabel>Assign To</FormLabel><Select onValueChange={field.onChange} defaultValue={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger></FormControl><SelectContent>{allStaff.map(staff => <SelectItem key={staff.id} value={staff.id}>{staff.name}</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>)} />
                    <FormField control={form.control} name="dueDate" render={({ field }) => (<FormItem className="flex flex-col justify-end"><FormLabel>Due Date</FormLabel><Popover><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}><CalendarIcon className="mr-2 h-4 w-4 opacity-50" />{field.value ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus /></PopoverContent></Popover><FormMessage /></FormItem>)}/>
                </div>
                 <FormField control={form.control} name="orderId" render={({ field }) => (<FormItem><FormLabel>Related Order ID (Optional)</FormLabel><FormControl><Input {...field} placeholder="e.g. ORD-12345" /></FormControl><FormMessage /></FormItem>)} />
                <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
                    <Button type="submit">Save Task</Button>
                </div>
            </form>
        </Form>
    )
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const filteredTasks = useMemo(() => {
    if (user?.role === 'staff') {
        return tasks.filter(task => task.assignedTo === user.id);
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

  const handleFormSubmit = (data: Omit<Task, 'id' | 'status'>) => {
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
        { ...data, id: `new-task-${Date.now()}`, status: 'To Do' },
      ]);
       toast({
        title: 'Task Created',
        description: 'The new task has been added successfully.',
      });
    }
    setIsFormOpen(false);
    setSelectedTask(null);
  };
  
  const getAssignee = (userId?: string): User | undefined => {
    if (!userId) return undefined;
    return allUsers.find(u => u.id === userId);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Manage Tasks</h1>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
           <DialogTrigger asChild>
                <Button onClick={handleAdd}>
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Task
                </Button>
           </DialogTrigger>
           <DialogContent className="sm:max-w-[500px]">
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
              {filteredTasks.map(task => {
                const assignee = getAssignee(task.assignedTo);
                return (
                <TableRow key={task.id}>
                  <TableCell className="font-medium max-w-xs">
                    <p className="font-semibold truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                  </TableCell>
                  <TableCell>
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
                   <TableCell>{format(task.dueDate, 'dd MMM yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={task.status === 'Completed' ? 'default' : 'secondary'}>
                        {task.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.orderId ? (
                        <Button variant="link" asChild className="p-0 h-auto text-xs">
                            <Link href={`/admin/orders/${task.orderId}`}>{task.orderId}</Link>
                        </Button>
                    ) : <span className="text-muted-foreground text-xs">N/A</span>}
                  </TableCell>
                  <TableCell className="text-right">
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
                                Edit
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
              )})}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}


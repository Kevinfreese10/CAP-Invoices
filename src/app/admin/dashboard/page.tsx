

'use client';
import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, isPast } from 'date-fns';
import { Task, User, TaskComment } from '@/lib/types';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { MessageSquare, PlusCircle, MoreHorizontal, CalendarIcon, Loader2, Repeat, BrainCircuit, Check, Tag } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import ProductivityStats from '@/components/dashboard/ProductivityStats';
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where, orderBy, arrayUnion, Timestamp, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { users } from '@/lib/data';


const db = getFirestore(firebaseApp);

type UnansweredQuestion = {
  id: string;
  question: string;
  timestamp: Date;
};


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
                                        <CommandItem onSelect={() => field.onChange(['dept:accounting-and-tax'])}>Accounting and Tax Dept</CommandItem>
                                        <CommandItem onSelect={() => field.onChange(['dept:administration'])}>Administration Dept</CommandItem>
                                        <CommandItem onSelect={() => field.onChange(['dept:cap'])}>CAP Dept</CommandItem>
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
                                         <div className="flex-shrink-0">
                                            {/* No Avatar */}
                                        </div>
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

const TaskTable = ({ tasks, title, description, onEdit, onUpdateStatus, onDelete, allStaff }: { tasks: Task[], title: string, description: string, onEdit: (task: Task) => void, onUpdateStatus: (taskId: string, status: Task['status']) => void, onDelete: (taskId: string) => void, allStaff: User[] }) => {
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
                        <TableHead>Tags</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Related Order</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {tasks.map(task => {
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
                                    const isDept = userId.startsWith('dept:');
                                    if (isDept) {
                                        const deptName = userId.split(':')[1].replace(/-/g, ' ');
                                        return (
                                            <TooltipProvider key={userId}>
                                                <Tooltip>
                                                    <TooltipTrigger>
                                                        <span className="h-6 w-6 border-2 border-background rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">{deptName.charAt(0).toUpperCase()}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p className="capitalize">{deptName} Department</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )
                                    }
                                    const assignee = getAssignee(userId);
                                    if (!assignee) return null;
                                    return (
                                         <TooltipProvider key={userId}>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <span className="h-6 w-6 border-2 border-background rounded-full bg-muted flex items-center justify-center text-xs">{assignee.name.charAt(0)}</span>
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
                                                    <span className="h-6 w-6 border-2 border-background rounded-full bg-muted flex items-center justify-center text-xs opacity-70">{taggedUser.name.charAt(0)}</span>
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
                                    <DropdownMenuItem onClick={() => onEdit(task)}>
                                        Edit / View Comments
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
    const [tasks, setTasks] = useState<Task[]>([]);
    const [unansweredQuestions, setUnansweredQuestions] = useState<UnansweredQuestion[]>([]);
    const [allStaff, setAllStaff] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [automatedTaskFilter, setAutomatedTaskFilter] = useState('all');
    const { toast } = useToast();

    const fetchDashboardData = async () => {
        setIsLoading(true);
        try {
            // Fetch tasks
            const tasksQuery = query(collection(db, 'tasks'), orderBy('dueDate', 'asc'));
            const tasksSnapshot = await getDocs(tasksQuery);
            const fetchedTasks = tasksSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Task));
            setTasks(fetchedTasks);

            // Fetch staff
            const staffQuery = query(collection(db, "users"), where('role', 'in', ['staff', 'admin']));
            const staffSnapshot = await getDocs(staffQuery);
            const fetchedStaff = staffSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as User));
            setAllStaff(fetchedStaff);

            // Fetch unanswered questions
            if (user?.role === 'admin') {
                const questionsQuery = query(collection(db, 'unansweredQuestions'), orderBy('timestamp', 'desc'));
                const questionsSnapshot = await getDocs(questionsQuery);
                const fetchedQuestions = questionsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    question: doc.data().question,
                    timestamp: doc.data().timestamp.toDate(),
                }));
                setUnansweredQuestions(fetchedQuestions);
            }
        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            toast({ title: "Error", description: "Could not fetch dashboard data.", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };
    
    useEffect(() => {
        if (user) fetchDashboardData();
    }, [user]);

    const staffByDept = useMemo(() => {
        const result: Record<string, User[]> = {};
        departments.forEach(dept => {
            result[dept] = allStaff.filter(u => u.department === dept);
        });
        return result;
    }, [allStaff]);

    const taskTypes = useMemo(() => {
        const types = new Set(tasks.filter(task => task.recurrence && task.recurrence !== 'None').map(task => {
            const title = task.title;
            const forIndex = title.lastIndexOf(' for ');
            if (forIndex > -1) {
                return title.substring(0, forIndex);
            }
            return title;
        }));
        return ['All Tasks', ...Array.from(types)];
    }, [tasks]);

    const myTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => 
            Array.isArray(task.assignedTo) && 
            task.assignedTo.includes(user.id) &&
            task.status !== 'Done' &&
            (!task.recurrence || task.recurrence === 'None')
        ).sort((a,b) => (a.dueDate.toDate ? a.dueDate.toDate().getTime() : a.dueDate) - (b.dueDate.toDate ? b.dueDate.toDate().getTime() : b.dueDate));
    }, [tasks, user]);
    
    const allMyTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => 
            Array.isArray(task.assignedTo) && 
            task.assignedTo.includes(user.id)
        );
    }, [tasks, user]);

    const delegatedTasks = useMemo(() => {
        if (!user) return [];
        // A task is delegated if the current user created it, but it is NOT assigned to them.
        return tasks.filter(task => 
            task.createdBy === user.id &&
            !task.assignedTo.includes(user.id) &&
             task.status !== 'Done' &&
            (!task.recurrence || task.recurrence === 'None')
        ).sort((a,b) => (a.dueDate.toDate ? a.dueDate.toDate().getTime() : a.dueDate) - (b.dueDate.toDate ? b.dueDate.toDate().getTime() : b.dueDate));
    }, [tasks, user]);

    const taggedTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => 
            Array.isArray(task.tags) && 
            task.tags.includes(user.id) &&
            task.status !== 'Done' &&
            (!task.recurrence || task.recurrence === 'None')
        ).sort((a,b) => (a.dueDate.toDate ? a.dueDate.toDate().getTime() : a.dueDate) - (b.dueDate.toDate ? b.dueDate.toDate().getTime() : b.dueDate));
    }, [tasks, user]);
    
    const departmentTasks = useMemo(() => {
        if (!user?.department) return [];
        const deptIdentifier = `dept:${user.department.toLowerCase().replace(/ & /g, '-and-').replace(/ /g, '-')}`;
        const deptTasks = tasks.filter(task => {
            if (task.recurrence && task.recurrence !== 'None') return false;
            return task.assignedTo.includes(deptIdentifier) && task.status !== 'Done';
        });
        
        return deptTasks.sort((a, b) => (a.dueDate.toDate ? a.dueDate.toDate().getTime() : b.dueDate) - (b.dueDate.toDate ? b.dueDate.toDate().getTime() : b.dueDate));
    }, [tasks, user]);


    const automatedTasks = useMemo(() => {
        return tasks.filter(task => task.recurrence && task.recurrence !== 'None' && task.status !== 'Done');
    }, [tasks]);
    
    const completedTasks = useMemo(() => {
        if (!user) return [];
        return tasks.filter(task => 
            task.status === 'Done' &&
            (task.assignedTo.includes(user.id) || task.createdBy === user.id)
        );
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
            fetchDashboardData();
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
            
            // This is the key fix: update the local state correctly
            setTasks(prevTasks =>
                prevTasks.map(t => (t.id === taskId ? { ...t, status } : t))
            );
            
            if (status === 'Done') {
                 toast({
                    title: 'Task Completed!',
                    description: `The task has been marked as "${status}".`,
                });
            } else {
                 toast({
                    title: 'Task Status Updated',
                    description: `The task has been marked as "${status}".`,
                });
            }
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
            dueDate: Timestamp.fromDate(data.dueDate),
        };
        
        try {
            if (selectedTask?.id) { // This is an update
                const taskRef = doc(db, 'tasks', selectedTask.id);
                await updateDoc(taskRef, { ...taskData });
                toast({ title: 'Task Updated', description: 'The task details have been saved.' });
            } else { // This is a new task or tasks
                const newTask: Omit<Task, 'id'> = {
                    ...taskData,
                    status: 'To-Do',
                    priority: 'Medium',
                    createdBy: user.id,
                    comments: [],
                };
                await addDoc(collection(db, 'tasks'), newTask);
                toast({ title: 'Task Created', description: `Task assigned.` });
            }
            fetchDashboardData();
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

    const handleFormOpenChange = (open: boolean) => {
        setIsFormOpen(open);
        if (!open) {
            setSelectedTask(null);
            fetchDashboardData(); // Re-fetch tasks when closing dialog to ensure data is fresh
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}!</h1>
                    <p className="text-muted-foreground">Here's a summary of what's happening today.</p>
                </div>
                <div className="flex gap-2">
                     <Dialog open={isFormOpen} onOpenChange={handleFormOpenChange}>
                        <DialogTrigger asChild>
                            <Button onClick={handleAdd}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create Task
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[700px]">
                            <DialogHeader>
                                <DialogTitle>{selectedTask?.id ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                                <DialogDescription>
                                    {selectedTask?.id ? 'Update the details of this task.' : 'Fill out the form to add a new task for a staff member.'}
                                </DialogDescription>
                            </DialogHeader>
                            <TaskForm 
                                task={selectedTask} 
                                onSubmit={handleFormSubmit}
                                onCancel={() => handleFormOpenChange(false)}
                                onCommentSubmit={handleCommentSubmit}
                                allStaff={allStaff}
                                staffByDept={staffByDept}
                            />
                        </DialogContent>
                    </Dialog>
                </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <ProductivityStats tasks={allMyTasks} className="lg:col-span-3" />
                
                {user?.role === 'admin' ? (
                <Card className="lg:col-span-4">
                    <CardHeader>
                        <CardTitle>AI Training</CardTitle>
                        <CardDescription>
                            Review questions that users have asked which the AI could not answer.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {unansweredQuestions.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Question</TableHead>
                                        <TableHead>Asked</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {unansweredQuestions.slice(0, 3).map((q) => (
                                        <TableRow key={q.id}>
                                            <TableCell className="font-medium max-w-[300px] truncate">{q.question}</TableCell>
                                            <TableCell>{format(q.timestamp, 'dd MMM yyyy')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="flex flex-col items-center justify-center text-center p-8 h-full">
                                <BrainCircuit className="h-10 w-10 text-muted-foreground mb-4" />
                                <h3 className="font-semibold">All Caught Up!</h3>
                                <p className="text-sm text-muted-foreground">There are no unanswered questions right now.</p>
                            </div>
                        )}
                        <Button asChild variant="secondary" className="w-full mt-4">
                            <Link href="/admin/knowledge-base">
                                Go to AI Training Center
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
                ) : (
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
                            <div className="ml-auto font-medium">{myTasks.filter(t => t.status === 'Done').length} / {myTasks.length}</div>
                        </div>
                        <div className="flex items-center">
                            <div className="ml-4 space-y-1">
                                <p className="text-sm font-medium leading-none">Delegated Tasks</p>
                                <p className="text-sm text-muted-foreground">
                                    {delegatedTasks.length} tasks created by you
                                </p>
                            </div>
                            <div className="ml-auto font-medium">{delegatedTasks.filter(t => t.status === 'Done').length} / {delegatedTasks.length}</div>
                        </div>
                    </CardContent>
                </Card>
                )}
            </div>

             <Separator />

            <div className="space-y-8">
                {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <>
                        <TaskTable 
                            tasks={myTasks} 
                            title="My Tasks" 
                            description="All non-automated tasks assigned directly to you."
                            onEdit={handleEdit}
                            onUpdateStatus={handleUpdateStatus}
                            onDelete={handleDelete}
                            allStaff={allStaff}
                        />

                        <TaskTable 
                            tasks={delegatedTasks} 
                            title="Delegated Tasks" 
                            description="Tasks you have created and assigned to other team members."
                            onEdit={handleEdit}
                            onUpdateStatus={handleUpdateStatus}
                            onDelete={handleDelete}
                            allStaff={allStaff}
                        />

                        <TaskTable 
                            tasks={taggedTasks} 
                            title="My Tagged Tasks" 
                            description="Tasks where you have been tagged for visibility, but not directly assigned."
                            onEdit={handleEdit}
                            onUpdateStatus={handleUpdateStatus}
                            onDelete={handleDelete}
                            allStaff={allStaff}
                        />
                        
                        <TaskTable 
                            tasks={completedTasks} 
                            title="Completed Tasks" 
                            description="Tasks assigned to or created by you that have been marked as 'Done'."
                            onEdit={handleEdit}
                            onUpdateStatus={handleUpdateStatus}
                            onDelete={handleDelete}
                            allStaff={allStaff}
                        />


                        {departmentTasks.length > 0 && (
                             <TaskTable 
                                tasks={departmentTasks} 
                                title={`${user?.department} Department Tasks`} 
                                description={`All tasks assigned to your department.`}
                                onEdit={handleEdit}
                                onUpdateStatus={handleUpdateStatus}
                                onDelete={handleDelete}
                                allStaff={allStaff}
                            />
                        )}
                        
                        {(user?.role === 'admin' && automatedTasks.length > 0) && (
                            <Card>
                                <CardHeader>
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                        <div>
                                        <CardTitle>Automated Client Tasks</CardTitle>
                                        <CardDescription>Recurring tasks generated from the client automation system.</CardDescription>
                                        </div>
                                        <div className="w-full sm:w-auto">
                                            <Select onValueChange={setAutomatedTaskFilter} defaultValue="all">
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
                                    <TaskTable 
                                        tasks={automatedTasks.filter(task => automatedTaskFilter === 'all' || task.title.startsWith(automatedTaskFilter))} 
                                        title="" 
                                        description=""
                                        onEdit={handleEdit}
                                        onUpdateStatus={handleUpdateStatus}
                                        onDelete={handleDelete}
                                        allStaff={allStaff}
                                    />
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
    

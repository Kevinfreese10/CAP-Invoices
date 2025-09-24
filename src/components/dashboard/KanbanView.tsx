
'use client';

import { Task, User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { users } from '@/lib/data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format, isPast } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useMemo } from 'react';
import Link from 'next/link';
import { Button } from '../ui/button';

type KanbanViewProps = {
  tasks: Task[];
  onTaskUpdate: (taskId: string, status: Task['status']) => void;
};

const taskStatuses: Task['status'][] = ['To-Do', 'In Progress', 'Review', 'Done'];

const getAssignee = (userId?: string): User | undefined => {
    if (!userId) return undefined;
    return users.find(u => u.id === userId);
}

const getPriorityVariant = (priority: Task['priority'], dueDate: any) => {
    const date = dueDate?.toDate ? dueDate.toDate() : new Date(dueDate);
    if (isPast(date) && priority !== 'High') return 'destructive';
    
    switch(priority) {
        case 'High': return 'destructive';
        case 'Medium': return 'warning';
        case 'Low': return 'secondary';
        default: return 'secondary';
    }
}

const statusColors: { [key in Task['status']]: string } = {
  'To-Do': 'border-t-gray-400',
  'In Progress': 'border-t-blue-500',
  'Review': 'border-t-orange-500',
  'Done': 'border-t-green-500',
};

export default function KanbanView({ tasks, onTaskUpdate }: KanbanViewProps) {
  const columns = useMemo(() => {
    const groupedTasks: { [key in Task['status']]: Task[] } = {
      'To-Do': [],
      'In Progress': [],
      'Review': [],
      'Done': [],
    };

    tasks.forEach(task => {
      if (groupedTasks[task.status]) {
        groupedTasks[task.status].push(task);
      }
    });

    return taskStatuses.map(status => ({
      status,
      tasks: groupedTasks[status],
    }));
  }, [tasks]);

  return (
    <div>
        <h2 className="text-2xl font-bold tracking-tight mb-4">Kanban Board (Manual Tasks)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {columns.map(column => (
            <div key={column.status} className="bg-muted/50 rounded-lg">
                <div className="p-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                        {column.status}
                        <Badge variant="secondary">{column.tasks.length}</Badge>
                    </h3>
                </div>
                <div className="p-2 space-y-3">
                    {column.tasks.length > 0 ? column.tasks.map(task => {
                        const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                        const priority = task.status !== 'Done' && isPast(task.dueDate.toDate()) ? 'High' : task.priority;
                        
                        return (
                            <Card key={task.id} className={`border-t-4 ${statusColors[task.status]}`}>
                                <CardHeader className="p-3">
                                    <CardTitle className="text-sm font-semibold">{task.title}</CardTitle>
                                    <CardDescription className="text-xs">{format(task.dueDate.toDate(), 'dd MMM yyyy')}</CardDescription>
                                </CardHeader>
                                <CardContent className="p-3 pt-0">
                                    <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                                </CardContent>
                                <CardFooter className="p-3 pt-0 flex justify-between items-center">
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
                                                        <TooltipContent><p>{assignee.name}</p></TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            );
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {task.orderId && (
                                            <Button variant="link" size="sm" asChild className="p-0 h-auto text-xs">
                                                <Link href={`/admin/orders/${task.orderId}`}>Order</Link>
                                            </Button>
                                        )}
                                        <Badge variant={getPriorityVariant(priority, task.dueDate)} className="text-xs">
                                            {priority}
                                        </Badge>
                                    </div>
                                </CardFooter>
                            </Card>
                        )
                    }) : (
                        <p className="p-4 text-xs text-center text-muted-foreground">No tasks in this column.</p>
                    )}
                </div>
            </div>
        ))}
        </div>
    </div>
  );
}

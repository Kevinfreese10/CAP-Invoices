
'use client';

import React, { useState } from 'react';
import { Task, User } from '@/lib/types';
import { format, startOfWeek, addDays, isSameDay, eachDayOfInterval, isToday, isPast } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertOctagon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Separator } from '../ui/separator';

const userColors = [
  'bg-red-200 text-red-800', 'bg-blue-200 text-blue-800', 'bg-green-200 text-green-800',
  'bg-yellow-200 text-yellow-800', 'bg-purple-200 text-purple-800', 'bg-pink-200 text-pink-800',
];

const getUserColor = (userId: string) => {
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return userColors[hash % userColors.length];
};

const getPriorityVariant = (priority: Task['priority']) => {
    switch(priority) {
        case 'High': return 'destructive';
        case 'Medium': return 'warning';
        case 'Low': return 'secondary';
        default: return 'secondary';
    }
}

export default function WeeklyTaskCalendar({ tasks, allStaff, currentUser, onTaskUpdate }: { tasks: Task[], allStaff: User[], currentUser: User | null, onTaskUpdate: (taskId: string, updates: Partial<Task>) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const weekStartsOn = 1; // Monday
  const start = startOfWeek(currentDate, { weekStartsOn });
  const end = addDays(start, 6);
  const weekDays = eachDayOfInterval({ start, end });

  const getAssignee = (userId: string) => allStaff.find(u => u.id === userId);

  const changeWeek = (direction: 'next' | 'prev') => {
    const amount = direction === 'next' ? 7 : -7;
    setCurrentDate(addDays(currentDate, amount));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  }

  const userTasks = tasks.filter(task => {
    if (!currentUser) return false;
    return Array.isArray(task.assignedTo) && task.assignedTo.includes(currentUser.id);
  });
  
  const overdueTasks = userTasks.filter(task => isPast(task.dueDate.toDate()) && task.status !== 'Done');

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, newDate: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    onTaskUpdate(taskId, { dueDate: newDate });
  };
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                 <CardTitle>My Weekly Tasks</CardTitle>
                 <CardDescription>{format(start, 'dd MMM yyyy')} - {format(end, 'dd MMM yyyy')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={goToToday}>Today</Button>
                <Button variant="outline" size="icon" onClick={() => changeWeek('prev')}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" onClick={() => changeWeek('next')}><ChevronRight className="h-4 w-4" /></Button>
            </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[1fr_repeat(7,_1fr)] border-t border-l">
           <div className="border-r border-b min-h-[200px] bg-destructive/5">
                <div className="p-2 text-center border-b">
                    <p className="text-sm font-semibold text-destructive flex items-center justify-center gap-2">
                        <AlertOctagon className="h-4 w-4"/>
                        Overdue
                    </p>
                </div>
                <div className="p-2 space-y-2">
                     {overdueTasks.map(task => {
                        const priority = 'High'; // Always high if overdue
                        return (
                            <TooltipProvider key={task.id}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div 
                                            draggable
                                            onDragStart={(e) => handleDragStart(e, task.id)}
                                            className="p-2 bg-background rounded-lg border text-left space-y-1 cursor-grab"
                                        >
                                            <div className="flex justify-between items-start">
                                                <p className="text-xs font-semibold leading-tight line-clamp-2">{task.title}</p>
                                                <Badge variant={getPriorityVariant(priority)} className="text-xs shrink-0">{priority}</Badge>
                                            </div>
                                            {task.orderId && <Link href={`/admin/orders/${task.orderId}`} className="text-xs text-blue-600 hover:underline">Order #{task.orderId}</Link>}
                                            <div className="text-xs text-destructive">Due: {format(task.dueDate.toDate(), 'dd MMM')}</div>
                                        </div>
                                    </TooltipTrigger>
                                     <TooltipContent side="bottom" align="start">
                                        <div className="max-w-xs space-y-2">
                                            <p className="font-bold">{task.title}</p>
                                            <p className="text-xs text-muted-foreground">{task.description}</p>
                                            <Separator />
                                            <p className="text-xs"><span className="font-semibold">Assignees:</span> {task.assignedTo.map(id => getAssignee(id)?.name).join(', ')}</p>
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        )
                    })}
                </div>
            </div>
          {weekDays.map(day => (
            <div 
                key={day.toString()} 
                onDrop={(e) => handleDrop(e, day)}
                onDragOver={handleDragOver}
                className="border-r border-b min-h-[200px]"
            >
              <div className={cn("p-2 text-center border-b", isToday(day) && "bg-primary/10")}>
                <p className={cn("text-sm font-semibold", isToday(day) && "text-primary")}>{format(day, 'EEE')}</p>
                <p className="text-xs text-muted-foreground">{format(day, 'd MMM')}</p>
              </div>
              <div className="p-2 space-y-2">
                {userTasks.filter(task => isSameDay(task.dueDate.toDate(), day) && !overdueTasks.some(ot => ot.id === task.id)).map(task => {
                  const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
                  const priority = task.status !== 'Done' && isPast(task.dueDate.toDate()) ? 'High' : task.priority;
                  return (
                  <TooltipProvider key={task.id}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                             <div 
                                draggable
                                onDragStart={(e) => handleDragStart(e, task.id)}
                                className="p-2 bg-background rounded-lg border text-left space-y-1 cursor-grab"
                            >
                                <div className="flex justify-between items-start">
                                    <p className="text-xs font-semibold leading-tight line-clamp-2">{task.title}</p>
                                    <Badge variant={getPriorityVariant(priority)} className="text-xs shrink-0">{priority}</Badge>
                                </div>
                                {task.orderId && <Link href={`/admin/orders/${task.orderId}`} className="text-xs text-blue-600 hover:underline">Order #{task.orderId}</Link>}
                                 <div className="flex items-center pt-1">
                                    {assignees.slice(0, 2).map(userId => {
                                        const assignee = getAssignee(userId);
                                        if (!assignee) return null;
                                        return (
                                            <span key={userId} className={cn("h-5 w-5 -ml-1 border-2 border-background rounded-full flex items-center justify-center text-[10px] font-bold", getUserColor(assignee.id))}>
                                                {assignee.name.charAt(0)}
                                            </span>
                                        );
                                    })}
                                    {assignees.length > 2 && (
                                         <span className="h-5 w-5 -ml-1 border-2 border-background rounded-full flex items-center justify-center text-[10px] font-bold bg-muted text-muted-foreground">
                                            +{assignees.length - 2}
                                        </span>
                                    )}
                                </div>
                             </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="start">
                            <div className="max-w-xs space-y-2">
                                <p className="font-bold">{task.title}</p>
                                <p className="text-xs text-muted-foreground">{task.description}</p>
                                <Separator />
                                <p className="text-xs"><span className="font-semibold">Assignees:</span> {assignees.map(id => getAssignee(id)?.name).join(', ')}</p>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )})}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

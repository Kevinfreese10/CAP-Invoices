
'use client';

import React, { useState } from 'react';
import { Task, User } from '@/lib/types';
import { format, startOfWeek, addDays, isSameDay, isToday, isPast, eachDayOfInterval, startOfToday, setHours, setMinutes, setSeconds, getHours, startOfDay } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, AlertOctagon, Check } from 'lucide-react';
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

const hours = Array.from({ length: 10 }, (_, i) => i + 8); // 8 AM to 5 PM

export default function WeeklyTaskCalendar({ tasks, allStaff, currentUser, onTaskUpdate }: { tasks: Task[], allStaff: User[], currentUser: User | null, onTaskUpdate: (taskId: string, updates: Partial<Task>) => void }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const start = startOfWeek(currentDate, { weekStartsOn: 1 });
  const end = addDays(start, 2); // Show 3 days: Monday, Tuesday, Wednesday if week starts on Mon
  const weekDays = eachDayOfInterval({ start, end });

  const getAssignee = (userId: string) => allStaff.find(u => u.id === userId);

  const changeWeek = (direction: 'next' | 'prev') => {
    const amount = direction === 'next' ? 3 : -3;
    setCurrentDate(addDays(currentDate, amount));
  };
  
  const goToToday = () => {
    setCurrentDate(new Date());
  }

  const userTasks = tasks.filter(task => {
    if (!currentUser) return false;
    return Array.isArray(task.assignedTo) && task.assignedTo.includes(currentUser.id) && task.status !== 'Done';
  });
  
  const getTaskDate = (task: Task): Date => {
    if (task.dueDate instanceof Date) {
        return task.dueDate;
    }
    if (task.dueDate && typeof (task.dueDate as any).toDate === 'function') {
        return (task.dueDate as any).toDate();
    }
    return new Date(task.dueDate);
  }
  
  const overdueTasks = userTasks.filter(task => {
    const dueDate = getTaskDate(task);
    return isPast(dueDate) && !isToday(dueDate) && task.status !== 'Done';
  });


  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, newDate: Date, hour?: number) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    let finalDate: Date;
    
    if (hour !== undefined) {
        finalDate = setSeconds(setMinutes(setHours(newDate, hour), 0), 0);
    } else if (e.currentTarget.dataset.droptarget === 'unslotted') {
        finalDate = startOfDay(newDate); 
    } else {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            const originalDueDate = getTaskDate(task);
            finalDate = setSeconds(setMinutes(setHours(newDate, getHours(originalDueDate) || 9), 0), 0);
        } else {
            finalDate = setHours(newDate, 9);
        }
    }
    onTaskUpdate(taskId, { dueDate: finalDate });
};
  
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  
  const DraggableTask = ({ task }: { task: Task }) => {
    const assignees = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div 
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        className="p-2 bg-background rounded-lg border text-left space-y-1 cursor-grab group relative"
                    >
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => onTaskUpdate(task.id, { status: 'Done'})}
                        >
                            <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <div className="flex justify-between items-start">
                            <p className="text-xs font-semibold leading-tight line-clamp-2">{task.title}</p>
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
    )
  }

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
      <CardContent className="overflow-x-auto">
        <div className="grid grid-cols-[1fr_repeat(3,_2fr)] border-t border-l min-w-[800px]">
           <div className="border-r border-b bg-destructive/5">
                <div className="p-2 text-center border-b h-16 flex flex-col justify-center">
                    <p className="text-sm font-semibold text-destructive flex items-center justify-center gap-2">
                        <AlertOctagon className="h-4 w-4"/>
                        Overdue
                    </p>
                </div>
                <div className="border-b h-24 bg-destructive/5" />
                <div 
                  className="p-2 space-y-2 min-h-[500px]"
                  onDrop={(e) => handleDrop(e, addDays(new Date(), -1))}
                  onDragOver={handleDragOver}
                >
                     {overdueTasks.map(task => <DraggableTask key={task.id} task={task} />)}
                </div>
            </div>
          {weekDays.map(day => {
              const unslottedTasks = userTasks.filter(task => {
                const dueDate = getTaskDate(task);
                const taskHour = getHours(dueDate);
                return isSameDay(dueDate, day) && (taskHour < 8 || taskHour > 17);
              });

              return (
              <div 
                  key={day.toString()} 
                  className="border-r border-b"
              >
                <div className={cn("p-2 text-center border-b h-16 flex flex-col justify-center", isToday(day) && "bg-primary/10")}>
                  <p className={cn("text-sm font-semibold", isToday(day) && "text-primary")}>{format(day, 'EEE')}</p>
                  <p className="text-xs text-muted-foreground">{format(day, 'd MMM')}</p>
                </div>
                <div 
                    data-droptarget="unslotted"
                    className="p-2 border-b h-24 bg-muted/30 overflow-y-auto"
                    onDrop={(e) => handleDrop(e, day)}
                    onDragOver={handleDragOver}
                >
                    <p className="text-xs text-center text-muted-foreground pb-1">Unslotted Tasks</p>
                     <div className="space-y-1">
                        {unslottedTasks.map(task => <DraggableTask key={task.id} task={task} />)}
                    </div>
                </div>
                <div className="divide-y">
                   {hours.map(hour => {
                      const tasksForSlot = userTasks.filter(task => {
                          const dueDate = getTaskDate(task);
                          return isSameDay(dueDate, day) && getHours(dueDate) === hour && !isPast(dueDate);
                      });
                       return (
                        <div
                          key={hour}
                          className="h-28 p-2 space-y-1 overflow-y-auto"
                          onDrop={(e) => handleDrop(e, day, hour)}
                          onDragOver={handleDragOver}
                        >
                           <div className="text-xs text-muted-foreground">{format(setHours(day, hour), 'ha')}</div>
                           {tasksForSlot.map(task => <DraggableTask key={task.id} task={task} />)}
                        </div>
                      )
                   })}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  );
}

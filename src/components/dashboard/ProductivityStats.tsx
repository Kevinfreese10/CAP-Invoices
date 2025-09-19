
'use client';
import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { PieChart, Pie, Cell } from 'recharts';
import type { Task } from '@/lib/types';
import { Trophy } from 'lucide-react';

type ProductivityStatsProps = {
  tasks: Task[];
  className?: string;
};

const chartConfig = {
  completed: {
    label: 'Completed',
    color: 'hsl(var(--chart-1))',
  },
  pending: {
    label: 'Pending',
    color: 'hsl(var(--muted))',
  },
};

export default function ProductivityStats({ tasks, className }: ProductivityStatsProps) {
  const completedTasks = useMemo(() => tasks.filter(t => t.status === 'Completed').length, [tasks]);
  const pendingTasks = useMemo(() => tasks.length - completedTasks, [tasks, completedTasks]);
  const totalTasks = tasks.length;
  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const chartData = [
    { name: 'completed', value: completedTasks, fill: 'var(--color-completed)' },
    { name: 'pending', value: pendingTasks, fill: 'var(--color-pending)' },
  ];

  const getMotivationalQuote = () => {
    if (completionPercentage === 100) return "Incredible! You've completed all your tasks!";
    if (completionPercentage >= 75) return "Amazing progress! You're so close to the finish line.";
    if (completionPercentage >= 50) return "You're halfway there! Keep up the great momentum.";
    if (completionPercentage > 0) return 'Every task completed is a step forward. Keep going!';
    return 'A new day, a new set of tasks. Let\'s get started!';
  };

  return (
    <Card className={className}>
      <CardHeader className="items-center pb-0">
        <CardTitle>Productivity Stats</CardTitle>
        <CardDescription>Your progress for this week</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center gap-2 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square h-[200px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              strokeWidth={5}
            >
                {chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform flex flex-col items-center">
            <span className="text-3xl font-bold">{completionPercentage}%</span>
            <span className="text-xs text-muted-foreground">Complete</span>
        </div>
      </CardContent>
       <CardContent className="flex flex-col items-center justify-center gap-2 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <span>{getMotivationalQuote()}</span>
            </div>
            <div className="flex w-full justify-around pt-4">
                <div className="text-center">
                    <p className="font-bold text-lg">{completedTasks}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                </div>
                <div className="text-center">
                    <p className="font-bold text-lg">{pendingTasks}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                </div>
            </div>
      </CardContent>
    </Card>
  );
}

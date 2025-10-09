
"use client"

import * as React from "react"
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, getMonth, endOfDay } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DateRangePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  onDateChange: (date: DateRange | undefined) => void;
  financialYearEnd?: string; // e.g., "February"
}

export function DateRangePicker({
  className,
  onDateChange,
  financialYearEnd,
}: DateRangePickerProps) {
  const [date, setDate] = React.useState<DateRange | undefined>(undefined);
  const [preset, setPreset] = React.useState<string>("all");

  React.useEffect(() => {
    onDateChange(date);
  }, [date, onDateChange]);

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const now = new Date();
    let newDate: DateRange | undefined = undefined;

    const getFinancialYear = (date: Date, endMonthName?: string) => {
        const endMonth = endMonthName ? new Date(`${endMonthName} 1, 2000`).getMonth() : 1; // Default to Feb if not provided
        const currentMonth = date.getMonth();
        let year = date.getFullYear();

        if (currentMonth > endMonth) {
            return {
                start: new Date(year, endMonth + 1, 1),
                end: endOfDay(new Date(year + 1, endMonth, new Date(year + 1, endMonth + 1, 0).getDate())),
            };
        } else {
             return {
                start: new Date(year - 1, endMonth + 1, 1),
                end: endOfDay(new Date(year, endMonth, new Date(year, endMonth + 1, 0).getDate())),
            };
        }
    };
    
    const lastFinancialYear = (date: Date, endMonthName?: string) => {
        const { start } = getFinancialYear(date, endMonthName);
        const lastYearStart = new Date(start);
        lastYearStart.setFullYear(lastYearStart.getFullYear() - 1);
        const lastYearEnd = new Date(start);
        lastYearEnd.setDate(lastYearEnd.getDate() - 1);
        return { from: lastYearStart, to: endOfDay(lastYearEnd) };
    };


    switch (value) {
      case "all":
        newDate = undefined;
        break;
      case "this_month":
        newDate = { from: startOfMonth(now), to: endOfDay(endOfMonth(now)) };
        break;
      case "this_year":
        const { start, end } = getFinancialYear(now, financialYearEnd);
        newDate = { from: start, to: end };
        break;
      case "last_year":
        newDate = lastFinancialYear(now, financialYearEnd);
        break;
      case "custom":
        if (!date) {
            newDate = { from: startOfMonth(now), to: endOfDay(endOfMonth(now)) };
        } else {
            newDate = date;
        }
        break;
    }
    setDate(newDate);
  };

  return (
    <div className={cn("grid gap-2", className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 items-end">
            <div className="space-y-2">
                <p className="text-sm font-medium">Date Range</p>
                 <Select value={preset} onValueChange={handlePresetChange}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a date range" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Dates</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="this_year">This Financial Year</SelectItem>
                        <SelectItem value="last_year">Last Financial Year</SelectItem>
                        <SelectItem value="custom">Custom Dates</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            {preset === "custom" && (
                <div className="grid grid-cols-2 gap-2 items-end">
                    <div className="grid gap-1">
                        <span className="text-sm font-medium">From:</span>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date-from"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !date?.from && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.from ? format(date.from, "dd/MM/yyyy") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="single"
                                selected={date?.from}
                                onSelect={(day) => setDate(prev => ({ from: day, to: prev?.to }))}
                                numberOfMonths={1}
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="grid gap-1">
                        <span className="text-sm font-medium">To:</span>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button
                                id="date-to"
                                variant={"outline"}
                                className={cn(
                                "w-full justify-start text-left font-normal",
                                !date?.to && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date?.to ? format(date.to, "dd/MM/yyyy") : <span>Pick a date</span>}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="single"
                                selected={date?.to}
                                onSelect={(day) => setDate(prev => ({ from: prev?.from, to: day ? endOfDay(day) : undefined }))}
                                numberOfMonths={1}
                            />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            )}
        </div>
    </div>
  )
}


"use client"

import * as React from "react"
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from "date-fns"
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

export function DateRangePicker({
  className,
}: React.HTMLAttributes<HTMLDivElement>) {
  const [date, setDate] = React.useState<DateRange | undefined>(undefined);
  const [preset, setPreset] = React.useState<string>("all");

  const handlePresetChange = (value: string) => {
    setPreset(value);
    const now = new Date();
    switch (value) {
      case "all":
        setDate(undefined);
        break;
      case "this_month":
        setDate({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case "this_year":
        setDate({ from: startOfYear(now), to: endOfYear(now) });
        break;
      case "custom":
        // Keep current date or set a default if none
        if (!date) {
            setDate({ from: startOfMonth(now), to: endOfMonth(now) });
        }
        break;
    }
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
                        <SelectItem value="this_year">This Year</SelectItem>
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
                                onSelect={(day) => setDate(prev => ({ from: prev?.from, to: day }))}
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

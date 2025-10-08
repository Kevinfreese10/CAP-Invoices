
'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useState } from "react";
import { DateRange } from "react-day-picker";

export default function GeneralLedgerPage({ params }: { params: { clientId: string }}) {
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
    
    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>General Ledger Report</CardTitle>
                    <CardDescription>
                        Filter and view the general ledger for a specific period. This report is under construction.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <DateRangePicker onDateChange={setDateRange} />
                     <Button disabled>View Report</Button>
                </CardContent>
            </Card>
        </div>
    );
}

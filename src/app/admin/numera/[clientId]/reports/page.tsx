'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import React from "react";

export default function ReportsPage({ params }: { params: { clientId: string }}) {
  const reports = [
    { title: 'Trial Balance', description: 'View the trial balance for a selected period.', component: <p>Trial Balance report is under construction.</p> },
    { title: 'General Ledger', description: 'See a detailed list of all transactions for each account.', component: <p>General Ledger report is under construction.</p> },
    // More reports can be added here
  ];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Financial Reports</CardTitle>
          <CardDescription>
            Select a report to view for this client.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {reports.map((report) => (
            <Card key={report.title}>
              <CardHeader>
                <CardTitle className="text-lg">{report.title}</CardTitle>
                <CardDescription>{report.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <DateRangePicker />
              </CardContent>
              <CardContent>
                <Dialog>
                    <DialogTrigger asChild>
                        <Button>
                            View Report <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-4xl">
                        <DialogHeader>
                            <DialogTitle>{report.title}</DialogTitle>
                            <DialogDescription>
                                Report generated for the selected date range.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="border rounded-lg p-4 min-h-[300px]">
                            {report.component}
                        </div>
                    </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

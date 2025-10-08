
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from 'next/link';
import { ArrowRight } from "lucide-react";

export default function ReportsPage({ params }: { params: { clientId: string }}) {
  const reports = [
    { title: 'Trial Balance', description: 'View the trial balance for a selected period.', href: `/admin/numera/${params.clientId}/reports/trial-balance` },
    { title: 'General Ledger', description: 'See a detailed list of all transactions for each account.', href: `/admin/numera/${params.clientId}/reports/general-ledger` },
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
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{report.description}</p>
              </CardContent>
              <CardContent>
                <Button asChild variant="outline">
                  <Link href={report.href}>
                    View Report <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

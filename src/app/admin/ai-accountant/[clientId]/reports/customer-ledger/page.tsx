
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomerLedgerPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Customer Ledger Report</CardTitle>
                <CardDescription>View detailed transaction histories for your customers.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <h3 className="text-lg font-medium">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground">The Customer Ledger report will be available here.</p>
                </div>
            </CardContent>
        </Card>
    );
}

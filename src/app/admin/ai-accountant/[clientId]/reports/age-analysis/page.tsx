
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AgeAnalysisPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Customer Age Analysis</CardTitle>
                <CardDescription>View an aged analysis of your outstanding customer invoices.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="text-center py-10 border-2 border-dashed rounded-lg">
                    <h3 className="text-lg font-medium">Coming Soon</h3>
                    <p className="text-sm text-muted-foreground">The Age Analysis report will be available here.</p>
                </div>
            </CardContent>
        </Card>
    );
}

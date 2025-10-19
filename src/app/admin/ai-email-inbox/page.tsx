
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AIEmailInboxPage() {
    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">AI Email Inbox</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Inbox</CardTitle>
                    <CardDescription>
                        This is the main AI Email Inbox. Functionality will be added here.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-10 border-2 border-dashed rounded-lg">
                        <h3 className="text-lg font-medium">Coming Soon</h3>
                        <p className="text-sm text-muted-foreground">The AI-powered email inbox will be available here.</p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}


'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PayfastSimulatorPage() {
    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight">PayFast ITN Simulator</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Simulator Disabled</CardTitle>
                    <CardDescription>
                        PayFast integration has been removed from this application. This tool is no longer functional.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">All payments are now processed via EFT.</p>
                </CardContent>
            </Card>
        </div>
    );
}

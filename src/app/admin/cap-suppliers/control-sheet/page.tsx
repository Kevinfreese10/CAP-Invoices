
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ControlSheetPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">CAP Suppliers Control Sheet</h1>
      <Card>
        <CardHeader>
          <CardTitle>Control Sheet</CardTitle>
          <CardDescription>
            This is the control sheet for CAP Suppliers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Control sheet functionality will be implemented here.</p>
        </CardContent>
      </Card>
    </div>
  );
}


'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuppliersPage() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Suppliers</CardTitle>
                <CardDescription>
                    This feature is coming soon. You will be able to manage your suppliers and upload their invoices here.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center">Supplier management functionality will be available here.</p>
            </CardContent>
        </Card>
    )
}

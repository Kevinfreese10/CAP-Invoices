
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChartOfAccountsPage() {
  return (
    <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
        <Card>
            <CardHeader>
                <CardTitle>Chart of Accounts</CardTitle>
                <CardDescription>Manage the general ledger accounts for financial reporting.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center py-10">Chart of Accounts management will be built here.</p>
            </CardContent>
        </Card>
    </div>
  );
}

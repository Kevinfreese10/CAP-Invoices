
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AllocationRulesPage() {
  return (
    <div className="space-y-8">
        <h1 className="text-3xl font-bold tracking-tight">Allocation Rules</h1>
        <Card>
            <CardHeader>
                <CardTitle>Allocation Rules</CardTitle>
                <CardDescription>Create rules to automatically categorize transactions.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground text-center py-10">Allocation Rules management will be built here.</p>
            </CardContent>
        </Card>
    </div>
  );
}

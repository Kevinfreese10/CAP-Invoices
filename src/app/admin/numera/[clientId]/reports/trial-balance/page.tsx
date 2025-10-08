
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export default function TrialBalancePage({ params }: { params: { clientId: string }}) {
    return (
        <div>
            <Button variant="outline" size="sm" asChild className="mb-4">
                <Link href={`/admin/numera/${params.clientId}/reports`}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Reports
                </Link>
            </Button>
            <Card>
                <CardHeader>
                    <CardTitle>Trial Balance</CardTitle>
                    <CardDescription>
                        This report is under construction.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>The Trial Balance report will be available here soon.</p>
                </CardContent>
            </Card>
        </div>
    );
}

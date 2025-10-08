
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NumeraClientDashboardPage() {
    return (
        <div>
            <Card>
                <CardHeader>
                    <CardTitle>Client Dashboard</CardTitle>
                    <CardDescription>
                        This is the main dashboard for this client's Numera profile.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p>More widgets and information will be added here soon.</p>
                </CardContent>
            </Card>
        </div>
    );
}

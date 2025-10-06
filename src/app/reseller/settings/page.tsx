
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResellerSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">API &amp; Branding</h1>
        <Card>
            <CardHeader>
                <CardTitle>Email Settings</CardTitle>
                <CardDescription>All emails sent to your clients will now originate from the My Accountant system email address (no_reply@myacc.co.za) to ensure deliverability. The "From" name will still be your company name.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">Individual SMTP settings for resellers have been disabled to improve email reliability.</p>
            </CardContent>
        </Card>
    </div>
  );
}

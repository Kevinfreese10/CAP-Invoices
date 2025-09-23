
import EmailSettingsForm from "@/components/reseller/EmailSettingsForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResellerSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">API &amp; Branding</h1>
        <Card>
            <CardHeader>
                <CardTitle>Email Settings</CardTitle>
                <CardDescription>Manage your outgoing (SMTP) and incoming (IMAP) mail server settings. This allows the application to send emails on your behalf and process replies from your clients.</CardDescription>
            </CardHeader>
            <CardContent>
                <EmailSettingsForm />
            </CardContent>
        </Card>
    </div>
  );
}

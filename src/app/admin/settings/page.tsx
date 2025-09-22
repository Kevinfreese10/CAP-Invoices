
import EmailSettingsForm from "@/components/admin/EmailSettingsForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminSettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Settings</h1>
        <Card>
            <CardHeader>
                <CardTitle>Email Settings</CardTitle>
                <CardDescription>Manage your SMTP settings for sending automated emails to your clients.</CardDescription>
            </CardHeader>
            <CardContent>
                <EmailSettingsForm />
            </CardContent>
        </Card>
    </div>
  );
}

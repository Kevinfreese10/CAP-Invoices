import ResellerProfile from "@/components/reseller/ResellerProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResellerProfilePage() {
  return (
    <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">My Company Profile</h1>
        <Card>
            <CardHeader>
                <CardTitle>Company Details</CardTitle>
                <CardDescription>Review your company information below.</CardDescription>
            </CardHeader>
            <CardContent>
                <ResellerProfile />
            </CardContent>
        </Card>
    </div>
  );
}

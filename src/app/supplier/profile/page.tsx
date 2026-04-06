
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ProfileForm from '@/components/supplier/ProfileForm';

export default function SupplierProfilePage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight mb-8">My Profile</h1>
      <Card>
        <CardHeader>
          <CardTitle>My Details</CardTitle>
          <CardDescription>Update your contact information below.</CardDescription>
        </CardHeader>
        <CardContent>
            <ProfileForm />
        </CardContent>
      </Card>
    </div>
  );
}

    
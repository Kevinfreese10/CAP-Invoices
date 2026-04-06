
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import SupplierSignupForm from '@/components/auth/SupplierSignupForm';

export default function SupplierSignupPage() {
  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Supplier Registration</CardTitle>
          <CardDescription>Create an account to submit invoices and track your payments.</CardDescription>
        </CardHeader>
        <CardContent>
          <SupplierSignupForm />
        </CardContent>
      </Card>
    </div>
  );
}

    
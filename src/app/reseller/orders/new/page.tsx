
import CreateOrderForm from "@/components/reseller/CreateResellerOrderForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NewResellerOrderPage() {
  return (
    <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-8">Create Custom Order</h1>
        <Card>
            <CardHeader>
                <CardTitle>New Order Details</CardTitle>
                <CardDescription>Fill out the form below to create a new order for a client.</CardDescription>
            </CardHeader>
            <CardContent>
                <CreateOrderForm />
            </CardContent>
        </Card>
    </div>
  );
}

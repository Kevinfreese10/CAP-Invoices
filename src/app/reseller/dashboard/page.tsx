
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ResellerDashboardPage() {
    const { user } = useAuth();

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.contactPerson}!</h1>
             <p className="text-lg text-muted-foreground">{user?.companyName}</p>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                    <CardHeader>
                        <CardTitle>Create New Order</CardTitle>
                        <CardDescription>Create a custom order for your clients.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/reseller/orders/new">Create Order</Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Manage Orders</CardTitle>
                        <CardDescription>View history and status of all your orders.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/reseller/orders">View Orders</Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Manage Profile</CardTitle>
                        <CardDescription>Update your company information.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/reseller/profile">Edit Profile</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

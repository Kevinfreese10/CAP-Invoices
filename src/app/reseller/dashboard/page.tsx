
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';

export default function ResellerDashboardPage() {
    const { user } = useAuth();

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.contactPerson}!</h1>
                <p className="text-lg text-muted-foreground">{user?.companyName}</p>
            </div>

            <section>
                <WebsiteAIWidget />
            </section>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Create New Order</CardTitle>
                        <CardDescription>Create a custom order for your clients.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow flex items-end">
                        <Button asChild>
                            <Link href="/reseller/orders/new">Create Order</Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Manage Orders</CardTitle>
                        <CardDescription>View history and status of all your orders.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow flex items-end">
                        <Button asChild>
                            <Link href="/reseller/orders">View Orders</Link>
                        </Button>
                    </CardContent>
                </Card>
                <Card className="flex flex-col">
                    <CardHeader>
                        <CardTitle>Manage Profile</CardTitle>
                        <CardDescription>Update your company information.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow flex items-end">
                        <Button asChild>
                            <Link href="/reseller/profile">Edit Profile</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

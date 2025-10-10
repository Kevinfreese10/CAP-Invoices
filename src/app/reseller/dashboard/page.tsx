
'use client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';
import { useBlog } from '@/contexts/BlogContext';
import { Loader2, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { format } from 'date-fns';

export default function ResellerDashboardPage() {
    const { user } = useAuth();
    const { blogPosts, isLoading: isBlogLoading } = useBlog();

    const latestNews = blogPosts.slice(0, 3);

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
            </div>
            
            <section>
                <Card>
                    <CardHeader>
                        <CardTitle>Latest News</CardTitle>
                        <CardDescription>Stay up-to-date with the latest tax tips and articles.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isBlogLoading ? (
                            <div className="flex justify-center items-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {latestNews.map(post => (
                                    <div key={post.id} className="group">
                                        <Link href={`/blog/${post.slug}`} className="block">
                                            <div className="relative h-40 w-full overflow-hidden rounded-lg">
                                                <Image
                                                    src={post.imageUrl}
                                                    alt={post.title}
                                                    fill
                                                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                                                    data-ai-hint={post.imageHint}
                                                />
                                            </div>
                                            <div className="mt-3">
                                                <p className="text-sm font-semibold group-hover:text-primary">{post.title}</p>
                                                <p className="text-xs text-muted-foreground">{format(new Date(post.date), 'dd MMMM yyyy')}</p>
                                            </div>
                                        </Link>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}

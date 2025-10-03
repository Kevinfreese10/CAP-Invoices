
'use client';
import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useBlog } from '@/contexts/BlogContext';
import { format } from 'date-fns';

export default function BlogPage() {
  const { blogPosts, isLoading } = useBlog();

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Tax Tip Blog</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Stay informed with our latest articles, tips, and updates on tax-related topics for South Africans.
        </p>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {blogPosts.map(post => (
            <Card key={post.id} className="flex flex-col overflow-hidden">
                <Link href={`/blog/${post.slug}`} className="block">
                <div className="relative h-48 w-full">
                    <Image
                    src={post.imageUrl}
                    alt={post.title}
                    fill
                    className="object-cover"
                    data-ai-hint={post.imageHint}
                    />
                </div>
                </Link>
                <CardHeader>
                <CardTitle className="leading-tight hover:text-primary transition-colors">
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                </CardTitle>
                <CardDescription>
                    by {post.author} on {format(new Date(post.date), 'dd MMMM yyyy')}
                </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                <p className="text-muted-foreground">{post.excerpt}</p>
                </CardContent>
                <CardFooter>
                <Button variant="link" asChild className="p-0">
                    <Link href={`/blog/${post.slug}`}>
                    Read More <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
                </CardFooter>
            </Card>
            ))}
        </div>
      )}
    </div>
  );
}

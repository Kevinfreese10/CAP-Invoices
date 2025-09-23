
'use client';

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { services } from '@/lib/data';
import { blogPosts } from '@/lib/data';

export default function MediaPage() {
    const serviceImages = services.map(s => ({
        id: s.id,
        title: s.title,
        url: s.imageUrl,
        hint: s.imageHint,
        source: 'Service'
    }));

    const blogImages = blogPosts.map(p => ({
        id: p.id,
        title: p.title,
        url: p.imageUrl,
        hint: p.imageHint,
        source: 'Blog'
    }));

    const allImages = [...serviceImages, ...blogImages];
    const uniqueImages = Array.from(new Map(allImages.map(item => [item.url, item])).values());

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Media Database</h1>
      <Card>
        <CardHeader>
          <CardTitle>Image Library</CardTitle>
          <CardDescription>
            A collection of all images currently used in your services and blog posts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uniqueImages.length > 0 ? (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {uniqueImages.map((image) => (
                    <div key={image.id} className="group relative">
                        <div className="aspect-w-1 aspect-h-1 w-full overflow-hidden rounded-lg bg-gray-200 xl:aspect-w-7 xl:aspect-h-8">
                        <Image
                            src={image.url}
                            alt={image.title}
                            fill
                            className="object-cover group-hover:opacity-75"
                            data-ai-hint={image.hint}
                        />
                        </div>
                        <div className="mt-2 text-sm text-foreground">
                             <h3 className="font-medium truncate">{image.title}</h3>
                             <p className="text-xs text-muted-foreground">{image.source}</p>
                        </div>
                    </div>
                ))}
            </div>
          ) : (
            <p>No images found in services or blog posts.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}


'use client';

import { useState, useEffect } from 'react';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import { Loader2, FileText } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';
import { services } from '@/lib/data';
import { useBlog } from '@/contexts/BlogContext';

const storage = getStorage(firebaseApp);

interface MediaLibraryProps {
  onSelectImage: (url: string) => void;
  accept?: string;
}

export default function MediaLibrary({ onSelectImage, accept = "image/*" }: MediaLibraryProps) {
  const [images, setImages] = useState<{ url: string; title: string; isImage: boolean; }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { blogPosts } = useBlog();

  useEffect(() => {
    const fetchImages = async () => {
      setIsLoading(true);
      let allImages: { url: string; title: string; isImage: boolean; }[] = [];

      // 1. Fetch from static service data
      services.forEach(service => {
        allImages.push({
          url: service.imageUrl,
          title: service.title,
          isImage: true,
        });
      });

      // 2. Fetch from blog posts
      blogPosts.forEach(post => {
        allImages.push({
          url: post.imageUrl,
          title: post.title,
          isImage: true,
        });
      });

      // 3. Fetch from user uploads in Firebase Storage
      if (user?.uid) {
        try {
          const storageRef = ref(storage, `uploads/${user.uid}`);
          const result = await listAll(storageRef);
          
          const uploadedUrls = await Promise.all(
            result.items.map(async (itemRef) => {
              const url = await getDownloadURL(itemRef);
              return {
                url: url,
                title: itemRef.name,
                isImage: itemRef.name.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null,
              };
            })
          );
          allImages.push(...uploadedUrls);
        } catch (error) {
          console.error("Error fetching uploaded images:", error);
          // Don't show toast here as it can be annoying
        }
      }

      // Remove duplicates by URL and set state
      const uniqueImages = Array.from(new Map(allImages.map(item => [item.url, item])).values());
      setImages(uniqueImages);

      setIsLoading(false);
    };

    fetchImages();
  }, [user, blogPosts]);

  const filteredImages = images.filter(image => {
      if (accept === 'application/pdf') {
          return !image.isImage;
      }
      if (accept === 'image/*') {
          return image.isImage;
      }
      return true; // if no specific accept is passed, show all
  })

  return (
    <ScrollArea className="h-[60vh]">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : filteredImages.length === 0 ? (
        <p className="text-center text-muted-foreground p-8">No compatible files found in your library.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 p-4">
          {filteredImages.map((image) => (
            <button
              key={image.url}
              className="group relative aspect-square w-full overflow-hidden rounded-md border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary hover:border-primary"
              onClick={() => onSelectImage(image.url)}
            >
              {image.isImage ? (
                <Image
                    src={image.url}
                    alt={image.title}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                 <div className="flex flex-col items-center justify-center h-full bg-muted p-2">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                    <p className="text-xs text-center text-muted-foreground mt-2 break-all">{image.title}</p>
                 </div>
              )}
               <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}

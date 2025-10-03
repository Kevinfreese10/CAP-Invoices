
'use client';

import { useState, useEffect } from 'react';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import { Loader2 } from 'lucide-react';
import { ScrollArea } from '../ui/scroll-area';

const storage = getStorage(firebaseApp);

interface MediaLibraryProps {
  onSelectImage: (url: string) => void;
}

export default function MediaLibrary({ onSelectImage }: MediaLibraryProps) {
  const [images, setImages] = useState<{ url: string; title: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchImages = async () => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const storageRef = ref(storage, `uploads/${user.uid}`);
        const result = await listAll(storageRef);
        
        const urls = await Promise.all(
          result.items.map(async (itemRef) => {
            const url = await getDownloadURL(itemRef);
            return {
              url: url,
              title: itemRef.name,
            };
          })
        );
        setImages(urls);
      } catch (error) {
        console.error("Error fetching images:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, [user]);

  return (
    <ScrollArea className="h-[60vh]">
      {isLoading ? (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : images.length === 0 ? (
        <p className="text-center text-muted-foreground p-8">No images found in your library.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4 p-4">
          {images.map((image) => (
            <button
              key={image.url}
              className="group relative aspect-square w-full overflow-hidden rounded-md border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary hover:border-primary"
              onClick={() => onSelectImage(image.url)}
            >
              <Image
                src={image.url}
                alt={image.title}
                fill
                className="object-cover transition-transform group-hover:scale-105"
              />
               <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </ScrollArea>
  );
}

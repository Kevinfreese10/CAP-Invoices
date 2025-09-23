
'use client';

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { services } from '@/lib/data';
import { blogPosts } from '@/lib/data';
import { useState, useEffect } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, listAll } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const storage = getStorage(firebaseApp);

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
    
    const [uploadedImages, setUploadedImages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [file, setFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    const fetchUploadedImages = async () => {
        setIsLoading(true);
        try {
            const storageRef = ref(storage, 'uploads');
            const result = await listAll(storageRef);
            
            const urls = await Promise.all(
              result.items.map(async (itemRef) => {
                const url = await getDownloadURL(itemRef);
                return {
                  id: `uploaded-${itemRef.name}`,
                  title: itemRef.name,
                  url: url,
                  hint: '',
                  source: 'Uploaded',
                };
              })
            );
            setUploadedImages(urls);
        } catch (error) {
            console.error("Error fetching uploaded images:", error);
            toast({ title: "Error", description: "Could not load uploaded images. Please check storage permissions.", variant: "destructive"});
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchUploadedImages();
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = () => {
        if (!file) {
            toast({ title: "No file selected", description: "Please choose a file to upload.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        const storageRef = ref(storage, `uploads/${Date.now()}-${file.name}`);
        const uploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload error:", error);
                toast({ title: "Upload Failed", description: "There was an error uploading your file.", variant: "destructive"});
                setIsUploading(false);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then(() => {
                    toast({ title: "Upload Successful", description: "Your image has been added to the library." });
                    setIsUploading(false);
                    setFile(null);
                    // Refresh the list of images
                    fetchUploadedImages();
                });
            }
        );
    };

    const combinedImages = [...allImages, ...uploadedImages];
    const uniqueImages = Array.from(new Map(combinedImages.map(item => [item.url, item])).values());


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Media Database</h1>
        <Card>
            <CardHeader>
                <CardTitle>Upload New Image</CardTitle>
                <CardDescription>Add a new image to your Firebase Storage library.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <Input type="file" onChange={handleFileChange} accept="image/*" className="max-w-xs" />
                    <Button onClick={handleUpload} disabled={isUploading || !file}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {isUploading ? `Uploading... ${Math.round(uploadProgress)}%` : 'Upload Image'}
                    </Button>
                </div>
                {isUploading && <Progress value={uploadProgress} className="w-full" />}
            </CardContent>
        </Card>
      <Card>
        <CardHeader>
          <CardTitle>Image Library</CardTitle>
          <CardDescription>
            A collection of all images from services, blog posts, and direct uploads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : uniqueImages.length > 0 ? (
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
            <p>No images found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

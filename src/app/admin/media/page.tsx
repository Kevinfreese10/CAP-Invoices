
'use client';

import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { services } from '@/lib/data';
import { blogPosts } from '@/lib/data';
import { useState, useEffect } from 'react';
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Trash2, RefreshCw, Copy, FileText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/contexts/AuthContext';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const storage = getStorage(firebaseApp);
const db = getFirestore(firebaseApp);

type MediaItem = {
    id: string;
    title: string;
    url: string;
    hint?: string;
    source: 'Service' | 'Blog' | 'Uploaded';
    uploadedBy?: string;
};

export default function MediaPage() {
    const serviceImages: MediaItem[] = services.map(s => ({
        id: s.id,
        title: s.title,
        url: s.imageUrl,
        hint: s.imageHint,
        source: 'Service'
    }));

    const blogImages: MediaItem[] = blogPosts.map(p => ({
        id: p.id,
        title: p.title,
        url: p.imageUrl,
        hint: p.imageHint,
        source: 'Blog'
    }));

    const allImages = [...serviceImages, ...blogImages];
    
    const [uploadedImages, setUploadedImages] = useState<MediaItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [files, setFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();
    const { user } = useAuth();

    const fetchUploadedImages = async () => {
        setIsLoading(true);
        if (!user?.uid) {
            setIsLoading(false);
            return;
        }
        try {
            const q = query(collection(db, 'media'), where('uploadedBy', '==', user.uid));
            const querySnapshot = await getDocs(q);
            const urls = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.name,
                    url: data.url,
                    source: 'Uploaded',
                    uploadedBy: data.uploadedBy,
                } as MediaItem;
            });
            setUploadedImages(urls);
        } catch (error) {
            console.error("Error fetching uploaded images:", error);
            toast({ title: "Error", description: "Could not load uploaded images. Please check your database permissions.", variant: "destructive"});
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => {
        fetchUploadedImages();
    }, [user]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFiles(Array.from(e.target.files));
        }
    };

    const handleUpload = async () => {
        if (files.length === 0 || !user?.uid) {
            toast({ title: "No files or user selected", description: "Please choose one or more files to upload.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        setUploadProgress(0);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const storageRef = ref(storage, `uploads/${user.uid}/${Date.now()}-${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            await new Promise<void>((resolve, reject) => {
                 uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress((i * 100 + progress) / files.length);
                    },
                    (error) => {
                        console.error("Upload error:", error);
                        toast({ title: "Upload Failed", description: `Error uploading ${file.name}.`, variant: "destructive"});
                        reject(error);
                    },
                    async () => {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                        // Save metadata to Firestore
                        await addDoc(collection(db, 'media'), {
                            name: file.name,
                            url: downloadURL,
                            uploadedBy: user.uid,
                            createdAt: serverTimestamp(),
                        });
                        resolve();
                    }
                );
            });
        }
        
        toast({ title: "Upload Successful", description: `${files.length} file(s) have been added to the library.` });
        setIsUploading(false);
        setFiles([]);
        const fileInput = document.getElementById('media-file-input') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
        await fetchUploadedImages();
    };
    
    const handleDelete = async (image: MediaItem) => {
        try {
            // Delete from Firestore
            await deleteDoc(doc(db, 'media', image.id));

            // Delete from Storage
            const imageRef = ref(storage, image.url);
            await deleteObject(imageRef);

            toast({ title: 'Image Deleted', description: 'The image has been removed from your library.' });
            fetchUploadedImages();
        } catch(error) {
            console.error("Delete error:", error);
            toast({ title: 'Delete Failed', description: 'There was an error deleting the image.', variant: 'destructive' });
        }
    }

    const combinedImages = [...allImages, ...uploadedImages];
    const uniqueImages = Array.from(new Map(combinedImages.map(item => [item.url, item])).values());
    
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text).then(() => {
            toast({ title: 'URL Copied!', description: 'The link has been copied to your clipboard.'});
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            toast({ title: 'Copy Failed', description: 'Could not copy the link to your clipboard.', variant: 'destructive'});
        });
    }


  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold tracking-tight">Media Database</h1>
        <Card>
            <CardHeader>
                <CardTitle>Upload New File(s)</CardTitle>
                <CardDescription>Add new images or documents to your Firebase Storage library and Firestore database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="flex flex-col sm:flex-row gap-4">
                    <Input id="media-file-input" type="file" onChange={handleFileChange} multiple accept="image/*,.pdf" className="max-w-xs" />
                    <Button onClick={handleUpload} disabled={isUploading || files.length === 0}>
                        {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                        {isUploading ? `Uploading ${files.length} files...` : `Upload ${files.length} File(s)`}
                    </Button>
                </div>
                {isUploading && <Progress value={uploadProgress} className="w-full" />}
            </CardContent>
        </Card>
      <Card>
        <CardHeader>
            <div className="flex items-center justify-between">
                <div>
                    <CardTitle>File Library</CardTitle>
                    <CardDescription>
                        A collection of all images and documents from services, blog posts, and direct uploads.
                    </CardDescription>
                </div>
                 <Button variant="outline" size="sm" onClick={fetchUploadedImages} disabled={isLoading}>
                    {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Refresh
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : uniqueImages.length > 0 ? (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {uniqueImages.map((image) => {
                    const isImage = image.url.includes('.png') || image.url.includes('.jpg') || image.url.includes('.jpeg') || image.url.includes('.gif') || image.url.includes('firebasestorage');
                    return (
                    <div key={image.id} className="group relative space-y-2">
                        <div className="aspect-w-16 aspect-h-9 w-full overflow-hidden rounded-lg bg-gray-200">
                        {isImage ? (
                            <Image
                                src={image.url}
                                alt={image.title}
                                fill
                                className="object-cover group-hover:opacity-75"
                                data-ai-hint={image.hint}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full bg-muted p-2 text-center">
                                <FileText className="w-8 h-8 text-muted-foreground" />
                            </div>
                        )}
                        {image.source === 'Uploaded' && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                 <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>This will permanently delete the file <span className="font-semibold">{image.title}</span> from your storage and database.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDelete(image)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        </div>
                         <div className="text-sm space-y-1">
                            <h3 className="font-medium truncate">{image.title}</h3>
                             <p className="text-xs text-muted-foreground">{image.source}</p>
                            <div className="flex items-center gap-1">
                                <Input value={image.url} readOnly className="h-7 text-xs flex-grow truncate" />
                                <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => copyToClipboard(image.url)}>
                                    <Copy className="h-4 w-4" />
                                </Button>
                             </div>
                        </div>
                    </div>
                )})}
            </div>
          ) : (
            <p>No files found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

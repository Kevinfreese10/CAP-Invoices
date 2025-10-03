
'use client';

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { BlogPost } from '@/lib/types';
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc, addDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

const db = getFirestore(firebaseApp);

interface BlogContextType {
  blogPosts: BlogPost[];
  addPost: (post: Omit<BlogPost, 'id' | 'slug' | 'date'>) => Promise<void>;
  updatePost: (post: BlogPost) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  isLoading: boolean;
}

const BlogContext = createContext<BlogContextType | undefined>(undefined);

export const BlogProvider = ({ children }: { children: ReactNode }) => {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  const fetchBlogPosts = async () => {
    setIsLoading(true);
    try {
        const q = query(collection(db, "blogPosts"), orderBy("date", "desc"));
        const querySnapshot = await getDocs(q);
        const fetchedPosts = querySnapshot.docs.map(doc => ({ 
            ...doc.data(), 
            id: doc.id,
            date: doc.data().date.toDate().toISOString(), // Convert Timestamp to ISO string
         } as BlogPost));
        setBlogPosts(fetchedPosts);
    } catch(error) {
        console.error("Error fetching blog posts:", error);
        toast({ title: 'Error', description: 'Could not fetch blog posts.', variant: 'destructive'});
    } finally {
        setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchBlogPosts();
  }, []);

  const addPost = async (postData: Omit<BlogPost, 'id' | 'slug' | 'date'>) => {
    const slug = postData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');
    const newPost = {
      ...postData,
      slug,
      date: serverTimestamp(),
    };
    try {
        await addDoc(collection(db, "blogPosts"), newPost);
        fetchBlogPosts();
    } catch (error) {
        throw new Error("Failed to add blog post.");
    }
  };

  const updatePost = async (updatedPost: BlogPost) => {
    try {
        const { id, ...postData } = updatedPost;
        await setDoc(doc(db, "blogPosts", id), {
            ...postData,
            date: new Date(postData.date), // Convert back to Date object for Firestore
        }, { merge: true });
        fetchBlogPosts();
    } catch (error) {
        throw new Error("Failed to update blog post.");
    }
  };

  const deletePost = async (postId: string) => {
    try {
        await deleteDoc(doc(db, "blogPosts", postId));
        fetchBlogPosts();
    } catch (error) {
        throw new Error("Failed to delete blog post.");
    }
  };

  return (
    <BlogContext.Provider value={{ blogPosts, addPost, updatePost, deletePost, isLoading }}>
      {children}
    </BlogContext.Provider>
  );
};

export const useBlog = () => {
  const context = useContext(BlogContext);
  if (context === undefined) {
    throw new Error('useBlog must be used within a BlogProvider');
  }
  return context;
};

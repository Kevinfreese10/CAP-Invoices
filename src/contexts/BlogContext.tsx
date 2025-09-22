
'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';
import { BlogPost } from '@/lib/types';
import { blogPosts as initialBlogPosts } from '@/lib/data';

interface BlogContextType {
  blogPosts: BlogPost[];
  addPost: (post: Omit<BlogPost, 'id' | 'slug' | 'date'>) => void;
  updatePost: (post: BlogPost) => void;
  deletePost: (postId: string) => void;
}

const BlogContext = createContext<BlogContextType | undefined>(undefined);

export const BlogProvider = ({ children }: { children: ReactNode }) => {
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>(initialBlogPosts);

  const addPost = (postData: Omit<BlogPost, 'id' | 'slug' | 'date'>) => {
    const newPost: BlogPost = {
      ...postData,
      id: `post-${Date.now()}`,
      slug: postData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, ''),
      date: new Date().toISOString(),
    };
    setBlogPosts((prevPosts) => [newPost, ...prevPosts]);
  };

  const updatePost = (updatedPost: BlogPost) => {
    setBlogPosts((prevPosts) =>
      prevPosts.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
  };

  const deletePost = (postId: string) => {
    setBlogPosts((prevPosts) => prevPosts.filter((p) => p.id !== postId));
  };

  return (
    <BlogContext.Provider value={{ blogPosts, addPost, updatePost, deletePost }}>
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

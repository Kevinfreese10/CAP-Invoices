
import { MetadataRoute } from 'next';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service, BlogPost } from '@/lib/types';

const db = getFirestore(firebaseApp);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://studio--studio-2604127518-57889.us-central1.hosted.app';

  // Fetch dynamic pages
  const servicesSnapshot = await getDocs(collection(db, 'services'));
  const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
  
  const blogPostsSnapshot = await getDocs(collection(db, 'blogPosts'));
  const blogPosts = blogPostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));

  const servicePages = services.map(service => ({
    url: `${siteUrl}/services/${service.id}`,
    lastModified: new Date(),
  }));

  const blogPostPages = blogPosts.map(post => {
    let lastModifiedDate;
    try {
        if (typeof post.date === 'string') {
            lastModifiedDate = new Date(post.date);
        } else if (post.date && typeof post.date.toDate === 'function') {
            // Handle Firestore Timestamp
            lastModifiedDate = post.date.toDate();
        } else {
            // Fallback for any other case
            lastModifiedDate = new Date();
        }
        
        if (isNaN(lastModifiedDate.getTime())) {
            // If date is still invalid, use current date as a fallback
            lastModifiedDate = new Date();
        }
    } catch (e) {
        lastModifiedDate = new Date();
    }
    
    return {
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: lastModifiedDate,
    };
  });

  const staticPages = [
    { url: `${siteUrl}/`, lastModified: new Date() },
    { url: `${siteUrl}/about`, lastModified: new Date() },
    { url: `${siteUrl}/blog`, lastModified: new Date() },
    { url: `${siteUrl}/contact`, lastModified: new Date() },
    { url: `${siteUrl}/compliance`, lastModified: new Date() },
    { url: `${siteUrl}/login`, lastModified: new Date() },
    { url: `${siteUrl}/reseller-signup`, lastModified: new Date() },
    { url: `${siteUrl}/popia`, lastModified: new Date() },
    { url: `${siteUrl}/refund-policy`, lastModified: new Date() },
  ];

  return [
    ...staticPages,
    ...servicePages,
    ...blogPostPages,
  ];
}

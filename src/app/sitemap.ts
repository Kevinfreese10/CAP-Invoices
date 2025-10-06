
import { getFirestore, collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { BlogPost, Service } from '@/lib/types';
import { MetadataRoute } from 'next';

const db = getFirestore(firebaseApp);

const BASE_URL = 'https://studio--studio-2604127518-57889.us-central1.hosted.app';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  const staticRoutes = [
    '',
    '/about',
    '/blog',
    '/cart',
    '/checkout',
    '/compliance',
    '/contact',
    '/login',
    '/popia',
    '/refund-policy',
    '/reseller-signup',
    '/services',
    '/support',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
  
  const servicesSnapshot = await getDocs(query(collection(db, "services"), orderBy("title")));
  const services = servicesSnapshot.docs.map(doc => doc.data() as Service);
  const serviceRoutes = services.map((service) => ({
    url: `${BASE_URL}/services/${service.slug}`,
    lastModified: new Date(),
  }));

  const blogPostsSnapshot = await getDocs(query(collection(db, "blogPosts"), orderBy("date", "desc")));
  const blogPosts = blogPostsSnapshot.docs.map(doc => doc.data() as BlogPost);
  
  const blogPostRoutes = blogPosts.map((post) => {
    let lastModifiedDate;
    if (post.date && typeof post.date === 'object' && 'toDate' in post.date) {
        // It's a Firestore Timestamp
        lastModifiedDate = (post.date as Timestamp).toDate();
    } else if (typeof post.date === 'string') {
        // It's a string, try to parse it
        lastModifiedDate = new Date(post.date);
    } else {
        // Fallback to now
        lastModifiedDate = new Date();
    }
    
    return {
        url: `${BASE_URL}/blog/${post.slug}`,
        lastModified: lastModifiedDate,
    }
  });

  return [
    ...staticRoutes,
    ...serviceRoutes,
    ...blogPostRoutes,
  ];
}

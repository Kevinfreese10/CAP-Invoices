
import { MetadataRoute } from 'next';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service, BlogPost } from '@/lib/types';

const db = getFirestore(firebaseApp);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://my-accountant-app.com';

  // Fetch dynamic pages
  const servicesSnapshot = await getDocs(collection(db, 'services'));
  const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
  
  // This assumes blog posts are also in a 'blogPosts' collection.
  // If not, this will return an empty array, which is safe.
  const blogPostsSnapshot = await getDocs(collection(db, 'blogPosts'));
  const blogPosts = blogPostsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));

  const servicePages = services.map(service => ({
    url: `${siteUrl}/services/${service.id}`,
    lastModified: new Date(),
  }));

  const blogPostPages = blogPosts.map(post => ({
    url: `${siteUrl}/blog/${post.slug}`,
    lastModified: new Date(post.date),
  }));

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

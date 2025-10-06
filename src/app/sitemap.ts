
import { MetadataRoute } from 'next';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { Service, BlogPost } from '@/lib/types';

// By exporting 'revalidate', we are opting into dynamic rendering.
// Setting it to 0 means this route will be re-evaluated on every request.
export const revalidate = 0;

const db = getFirestore(firebaseApp);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://my-accountant-app.com';

  // Fetch dynamic pages
  const servicesSnapshot = await getDocs(collection(db, 'services'));
  const services = servicesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Service));
  
  const blogPostsSnapshot = await getDocs(collection(db, 'blogPosts'));
  const blogPosts = blogPostsSnapshot.docs.map(doc => ({ ...doc.data(), date: new Date(doc.data().date.toDate()) } as BlogPost));

  const servicePages = services.map(service => ({
    url: `${siteUrl}/services/${service.slug}`,
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

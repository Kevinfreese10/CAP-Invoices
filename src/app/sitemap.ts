
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { BlogPost, Service } from '@/lib/types';
import { MetadataRoute } from 'next';

const db = getFirestore(firebaseApp);

const BASE_URL = 'https://my-accountant-app-961d6.web.app';

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
  const blogPostRoutes = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.date),
  }));

  return [
    ...staticRoutes,
    ...serviceRoutes,
    ...blogPostRoutes,
  ];
}

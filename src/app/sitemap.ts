
import { getFirestore, collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { BlogPost, Service } from '@/lib/types';
import { MetadataRoute } from 'next';

const db = getFirestore(firebaseApp);

const BASE_URL = 'https://www.myacc.co.za';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {

  const staticRoutes = [
    '/',
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
    '/become-a-partner',
  ].map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
  
  let serviceRoutes: MetadataRoute.Sitemap = [];
  try {
    const servicesSnapshot = await getDocs(query(collection(db, "services"), orderBy("title")));
    const services = servicesSnapshot.docs.map(doc => doc.data() as Service);
    serviceRoutes = services.map((service) => ({
      url: `${BASE_URL}/services/${service.slug}`,
      lastModified: new Date(),
    }));
  } catch (err) {
    console.warn("Could not load services for sitemap:", err);
  }

  let blogPostRoutes: MetadataRoute.Sitemap = [];
  try {
    const blogPostsSnapshot = await getDocs(query(collection(db, "blogPosts"), orderBy("date", "desc")));
    const blogPosts = blogPostsSnapshot.docs.map(doc => doc.data() as BlogPost);
    
    blogPostRoutes = blogPosts.map((post) => {
      let lastModifiedDate;
      if (post.date && typeof post.date === 'object' && 'toDate' in post.date) {
          lastModifiedDate = (post.date as Timestamp).toDate();
      } else if (typeof post.date === 'string') {
          lastModifiedDate = new Date(post.date);
      } else {
          lastModifiedDate = new Date();
      }
      
      return {
          url: `${BASE_URL}/blog/${post.slug}`,
          lastModified: lastModifiedDate,
      }
    });
  } catch (err) {
    console.warn("Could not load blog posts for sitemap:", err);
  }

  return [
    ...staticRoutes,
    ...serviceRoutes,
    ...blogPostRoutes,
  ];
}

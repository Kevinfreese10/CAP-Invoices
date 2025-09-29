
import { MetadataRoute } from 'next';
import { services } from '@/lib/data';
import { blogPosts } from '@/lib/data';

export default function sitemap(): MetadataRoute.Sitemap {
  
  // In a real app, you'd get this from an environment variable
  const siteUrl = 'https://my-accountant-app.com'; 

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

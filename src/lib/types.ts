export type Service = {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  price: number;
  imageUrl: string;
  imageHint: string;
  category: string;
  whatsIncluded: string[];
  turnaroundTime: string;
  clientRequirements: string[];
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  imageUrl: string;
  imageHint: string;
  author: string;
  date: string;
};

export type FAQ = {
  id:string;
  question: string;
  answer: string;
};

export type CartItem = {
  service: Service;
  quantity: number;
};

export type Order = {
  id: string;
  userId?: string;
  customerName: string;
  customerEmail: string;
  date: any;
  items: any[];
  total: number;
  status: 'Pending Payment' | 'Processing' | 'Completed' | 'Cancelled';
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'admin';
};

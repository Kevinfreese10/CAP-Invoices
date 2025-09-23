

export type Service = {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  price: number;
  resellerPrice?: number;
  imageUrl: string;
  imageHint: string;
  category: string;
  department?: 'Accounting and Tax' | 'Administration';
  whatsIncluded: string[];
  turnaroundTime: string;
  clientRequirements: string[];
  informationToProvide: {
    label: string;
  }[];
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
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string[];
};

export type FAQ = {
  id:string;
  question: string;
  answer: string;
};

export type KnowledgeBaseItem = {
  id: string;
  question: string;
  answer: string;
}

export type CartItem = {
  service: Service;
  quantity: number;
};

export type OrderNote = {
  text: string;
  date: any;
  authorId: string;
  type?: 'note' | 'email';
  subject?: string;
};

export type Order = {
  id: string;
  userId?: string;
  resellerId?: string;
  customerName: string;
  customerEmail: string;
  endCustomerName?: string; // Added for reseller's client
  endCustomerEmail?: string; // Added for reseller's client
  date: any;
  items: any[];
  total: number;
  clientTotal?: number;
  status: 'Pending Payment' | 'Processing' | 'Completed' | 'Cancelled' | 'Outsourced';
  isOutsourced?: boolean;
  assignedTo?: string | null;
  department?: 'Accounting and Tax' | 'Administration' | null;
  originalOrderId?: string;
  notes?: OrderNote[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'admin' | 'staff' | 'reseller';
  department?: 'Accounting and Tax' | 'Administration';
  status?: 'Active' | 'Inactive';
  // Reseller specific fields
  companyName?: string;
  contactPerson?: string;
  contactNumber?: string;
  address?: {
    street: string;
    city: string;
    province: string;
    zip: string;
  },
  bankingDetails?: {
    bankName: string;
    accountHolder: string;
    accountNumber: string;
    branchCode: string;
  },
  smtpDetails?: {
    host: string;
    port: string;
    user: string;
    pass: string;
  },
  imapDetails?: {
    host: string;
    port: string;
    user: string;
    pass: string;
  }
};

export type TaskComment = {
  text: string;
  date: any;
  authorId: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  assignedTo: string[];
  createdBy: string;
  dueDate: any;
  priority: 'High' | 'Medium' | 'Low';
  status: 'To-Do' | 'In Progress' | 'Review' | 'Done';
  recurrence?: 'None' | 'Daily' | 'Weekly' | 'Monthly';
  orderId?: string;
  comments?: TaskComment[];
};


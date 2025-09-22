
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
  informationToUpload: {
    label: string;
    type: 'text' | 'file';
  }[];
  conditionalFields?: {
    enabled: boolean;
    fieldName: string;
    fieldValues: string[];
    duplicatedDocuments: {
      label: string;
      type: 'text' | 'file';
    }[];
  };
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
  resellerId?: string;
  customerName: string;
  customerEmail: string;
  date: any;
  items: any[];
  total: number;
  status: 'Pending Payment' | 'Processing' | 'Completed' | 'Cancelled';
  assignedTo?: string;
  department?: string;
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
  }
};

export type TaskUpdate = {
  text: string;
  date: Date;
  authorId: string;
};

export type Task = {
  id: string;
  title: string;
  description: string;
  assignedTo: string;
  createdBy: string;
  dueDate: Date;
  status: 'To Do' | 'In Progress' | 'Completed';
  orderId?: string;
  updates?: TaskUpdate[];
};

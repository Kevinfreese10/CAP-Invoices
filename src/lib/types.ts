

export type VatType =
  // Output Tax
  | 'standard_rated_sales'
  | 'zero_rated_sales'
  | 'exempt_sales'
  // Input Tax
  | 'standard_rated_purchases'
  | 'capital_goods_purchases'
  | 'zero_rated_purchases'
  | 'exempt_purchases'
  | 'no_vat';

export type ChartOfAccount = {
  id: string;
  accountNumber: string;
  description: string;
  section: 'Income Statement' | 'Balance Sheet';
};

export type AllocationRule = {
  id: string;
  keywords: string[];
  accountId: string;
  vatType: VatType;
};

export type Service = {
  id: string;
  title: string;
  description: string;
  longDescription: string;
  price: number;
  resellerPrice?: number;
  imageUrl: string;
  imageHint: string;
  seoImageUrl?: string;
  category: string;
  department?: 'Accounting and Tax' | 'Administration' | 'CAP';
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
  assignedTo?: string[] | null;
  department?: 'Accounting and Tax' | 'Administration' | 'CAP' | null;
  originalOrderId?: string;
  notes?: OrderNote[];
  source?: 'Client' | 'Staff' | 'Reseller';
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'client' | 'admin' | 'staff' | 'reseller';
  source?: 'Numera' | 'Client Management';
  department?: 'Accounting and Tax' | 'Administration' | 'CAP';
  status?: 'Active' | 'Inactive';
  // Reseller specific fields or contact person for Numera
  companyName?: string;
  contactPerson?: string;
  contactEmail?: string;
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
  },
  // Client specific fields for task automation
  yearEnd?: any;
  preparesFinancials?: boolean;
  financialsDueDate?: any;
  requiresManagementAccounts?: boolean;
  managementAccountsFrequency?: 'Monthly' | 'Quarterly' | 'Bi-Annually' | 'Annually';
  managementAccountsDueDate?: any;
  isVatRegistered?: boolean;
  vatCategory?: 'A' | 'B' | 'C';
  vatRegistrationDate?: any;
  submitsProvisionalTaxes?: boolean;
  submitsIncomeTaxReturn?: boolean;
  preparesPayroll?: boolean;
  payrollDueDate?: any;
  submitsEmp201?: boolean;
  submitsEmp501?: boolean;
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
  recurrence?: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Bi-Monthly' | 'Annually';
  orderId?: string;
  clientId?: string;
  comments?: TaskComment[];
};

export type ImportedTransaction = {
    id: string;
    clientId: string;
    date: string;
    description: string;
    amount: number;
    bankAccountId: string;
};

export type AllocatedTransaction = {
    id: string;
    clientId: string;
    date: string;
    description: string;
    amount: number;
    bankAccountId: string;
    allocatedTo: {
        value: string;
        type: 'account' | 'customer' | 'supplier';
    };
    vatType: VatType;
    vatAmount: number;
    allocatedAt: any; // Using `any` for Firestore Timestamp compatibility
};

export type Supplier = {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
};

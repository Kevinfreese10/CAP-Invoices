
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
  id:string;
  type: 'hard' | 'soft';
  description: string; // Used for soft rules, or as a note for hard rules
  keywords: string[]; // Only for hard rules
  accountId: string;
  vatType: VatType;
  scope?: 'client' | 'global';
};

export type DocumentUpload = {
  serviceId: string;
  requirementLabel: string;
  type: 'file' | 'text';
  fileUrl?: string;
  fileName?: string;
  textValue?: string;
  uploadedAt: any; // Firestore Timestamp
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
};

export type Service = {
  id: string;
  slug: string;
  title: string;
  description: string;
  longDescription: string;
  price: number;
  resellerPrice?: number;
  imageUrl: string;
  imageHint: string;
  seoImageUrl: string;
  category: string;
  department?: 'Accounting and Tax' | 'Administration' | 'CAP';
  whatsIncluded: string[];
  turnaroundTime: string;
  clientRequirements: string[];
  informationToProvide: {
    label: string;
    type: 'text' | 'pdf';
  }[];
  attachmentUrl?: string;
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
  subject?: string | null;
};

export type ItnLog = {
  receivedAt: any;
  status: 'Success' | 'Failed';
  message: string;
  payload: { [key: string]: any };
};

export type Order = {
  id: string;
  userId?: string | null;
  resellerId?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  endCustomerName?: string; // Added for reseller's client
  endCustomerEmail?: string; // Added for reseller's client
  date: any;
  items: any[];
  total: number;
  discountCode: string | null;
  discountAmount: number | null;
  paymentMethod?: string;
  clientTotal?: number;
  status: 'Pending Payment' | 'Processing' | 'Completed' | 'Cancelled' | 'Outsourced';
  isOutsourced?: boolean;
  assignedTo?: string[] | null;
  department?: 'Accounting and Tax' | 'Administration' | 'CAP' | null;
  originalOrderId?: string | null;
  notes?: OrderNote[];
  documentUploads?: DocumentUpload[];
  itnHistory?: ItnLog[];
  source?: 'Client' | 'Staff' | 'Reseller' | 'AI Accountant Signup';
  renewalForClientId?: string;
};

export type Invoice = {
  id: string;
  customerId: string;
  invoiceDate: any; // Firestore Timestamp
  dueDate: any; // Firestore Timestamp
  lineItems: { 
    accountId: string;
    description: string; 
    quantity: number; 
    rate: number;
    vatType: string;
  }[];
  notes?: string;
  subtotal: number;
  vat: number;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'final';
  createdAt: any;
};

export type SubscriptionData = {
    serviceLevel: 'free' | 'ai_addon' | 'monthly_non_vat' | 'monthly_vat';
    extraUsers: number;
    includeSubmissions: boolean;
    includePayslips: boolean;
    payslipCount: number;
    includeCatchUp: boolean;
    monthlyTotal: number;
    catchUpFee: number;
    payrollSetupFee: number;
    subscriptionEndDate?: any; // Firestore Timestamp
    subscriptionStatus?: 'active' | 'lapsed';
};

export type User = {
  uid: string; // Firebase Authentication UID
  id: string; // Document ID
  name: string;
  email: string;
  role: 'client' | 'admin' | 'staff' | 'reseller' | 'ai_accountant' | 'cap_staff' | 'cap_supervisor';
  createdAt?: any;
  password?: string;
  source?: 'AI Accountant' | 'Client Management';
  department?: 'Accounting and Tax' | 'Administration' | 'CAP';
  status?: 'Active' | 'Inactive';
  // Reseller specific fields or contact person for AI Accountant
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
    bankName?: string;
    accountHolder?: string;
    accountNumber?: string;
    branchCode?: string;
  },
  smtpDetails?: {
    host: string;
    port: string;
    user: string;
    pass: string;
  },
  wantsOutsourcedWork?: boolean;
  cvUrl?: string;
  certificateUrl?: string;
  capableServices?: string[];
  // Client specific fields for task automation & AI Accountant
  yearEnd?: any;
  preparesFinancials?: boolean;
  financialsDueDate?: any;
  requiresManagementAccounts?: boolean;
  managementAccountsFrequency?: 'Monthly' | 'Quarterly' | 'Bi-Annually' | 'Annually';
  isVatRegistered?: boolean;
  vatNumber?: string;
  vatCategory?: 'A' | 'B' | 'C';
  submitsProvisionalTaxes?: boolean;
  submitsIncomeTaxReturn?: boolean;
  preparesPayroll?: boolean;
  payrollDueDate?: any;
  submitsEmp201?: boolean;
  submitsEmp501?: boolean;
  chartOfAccounts?: ChartOfAccount[];
  allocationRules?: AllocationRule[];
  hasAIAccountantProfile?: boolean;
  subscription?: SubscriptionData;
  sharedWith?: string[];
  enableInvoicing?: boolean;
  logoUrl?: string;
  nextInvoiceNumber?: number;
};

export type ClientCustomer = {
    id: string;
    name: string;
    contactPerson?: string;
    email?: string;
    cellNumber?: string;
    address?: string;
    vatNumber?: string;
}

export type Supplier = {
  id: string;
  name: string;
};


export type DiscountCode = {
  id: string; // The code itself
  percentage: number;
  status: 'active' | 'used';
  clientEmail: string;
  orderId?: string;
  createdAt: any;
  usedAt?: any;
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
  createdAt: any;
  dueDate: any;
  priority: 'High' | 'Medium' | 'Low';
  status: 'To-Do' | 'In Progress' | 'Review' | 'Done';
  recurrence?: 'None' | 'Daily' | 'Weekly' | 'Monthly' | 'Bi-Monthly' | 'Annually';
  orderId?: string;
  clientId?: string;
  comments?: TaskComment[];
  tags?: string[];
};

export type ImportedTransaction = {
    id: string;
    clientId: string;
    date: string;
    reference: string;
    description: string;
    amount: number;
    bankAccountId: string;
    status: 'new' | 'allocated' | 'review' | 'reviewed';
    allocatedTo?: { // Optional for imported, required for allocated
        value: string;
        type: 'account' | 'customer' | 'supplier';
    };
    vatType?: VatType;
};

export type AllocatedTransaction = {
    id: string;
    clientId: string;
    date: string;
    reference: string;
    description: string;
    amount: number;
    bankAccountId: string;
    allocatedTo: {
        value: string;
        type: 'account' | 'customer' | 'supplier';
    };
    vatType: VatType;
    vatAmount: number;
    status: 'allocated';
    allocatedAt: any; // Using `any` for Firestore Timestamp compatibility
};

export type ExtractedInvoice = {
  id: string;
  supplier: string;
  invoiceNumber: string;
  date: string;
  lineItems: { 
    description: string; 
    exclusiveAmount: number; 
    vatAmount: number; 
    accountId?: string;
    paye?: boolean;
    ledgerDescription?: string;
  }[];
  invoiceTotal: number;
  status: 'pending_review' | 'approved' | 'rejected' | 'batched_for_payment' | 'duplicate' | 'pending_account_review' | 'pending_third_review' | 'approved_for_payment' | 'paid' | 'archived';
  fileName: string;
  fileUrl: string;
  createdAt: any;
  uploadedBy: string;
  approvedBy?: string;
  rejectedBy?: string;
  expenseType?: 'CAP' | 'S38';
  commissionNumber?: string;
  storyName?: string;
  rejectionReason?: string;
  paymentBatch?: string;
  sourceEmailUid?: number;
  proofOfPaymentUrl?: string;
};

export type CommunityQuestion = {
    id: string;
    text: string;
    askedBy: string;
    askedAt: any;
    status: 'pending_approval' | 'approved' | 'rejected';
    answerCount: number;
    answers?: CommunityAnswer[]; // Optional: for client-side joining
    askedByUserDetails?: { name: string; companyName?: string; }; // Optional: for client-side joining
};

export type CommunityAnswer = {
    id: string;
    text: string;
    answeredBy: string;
    answeredAt: any;
    likes: number;
    isBestAnswer: boolean;
    answeredByUserDetails?: { name: string; companyName?: string; }; // Optional: for client-side joining
};

export type AIAllocationJob = {
    id: string;
    clientId: string;
    status: 'running' | 'completed' | 'stopped' | 'failed';
    total: number;
    processed: number;
    createdAt: any;
    completedAt?: any;
    error?: string;
}

import { z } from 'zod';

export const FindStoryNameInputSchema = z.object({
  commissionNumber: z.string().describe('The commission number to search for.'),
  knowledgeBase: z.string().describe('A block of text containing mappings of commission numbers to story names. Each entry is typically on a new line, e.g., "CM-123\tMy Story Name".'),
});
export type FindStoryNameInput = z.infer<typeof FindStoryNameInputSchema>;

export const FindStoryNameOutputSchema = z.object({
  storyName: z.string().optional().describe('The corresponding story name found in the knowledge base. Returns nothing if no match is found.'),
});
export type FindStoryNameOutput = z.infer<typeof FindStoryNameOutputSchema>;

import type { Service, BlogPost, FAQ, Order } from './types';

export const services: Service[] = [
  {
    id: 'personal-tax-return',
    title: 'Personal Tax Return (ITR12)',
    description: 'Annual tax filing for individuals and provisional taxpayers.',
    longDescription:
      'Our personal tax return service ensures that your annual tax filings are accurate, compliant, and optimized for maximum returns. We handle everything from gathering your documents to submitting the final return to SARS, providing peace of mind for both standard and provisional taxpayers.',
    price: 750,
    imageUrl: 'https://picsum.photos/seed/101/600/400',
    imageHint: 'tax forms',
    category: 'SARS Services',
    whatsIncluded: [
        'Consultation on tax-deductible expenses',
        'Preparation of your annual tax return',
        'Submission of ITR12 to SARS',
        'Handling of basic SARS queries',
    ],
    turnaroundTime: '5-7 working days',
    clientRequirements: [
        'IRP5/IT3(a) certificates',
        'Medical aid tax certificate',
        'Retirement annuity fund certificate',
        'Logbook for travel claims (if applicable)',
    ],
    metaTitle: 'Personal Tax Return Filing (ITR12) | My Accountant',
    metaDescription: 'Expert personal tax return (ITR12) filing services for South African individuals and provisional taxpayers. We ensure compliance and maximize your returns.',
    metaKeywords: ['personal tax return', 'ITR12', 'SARS eFiling', 'South Africa tax'],
  },
  {
    id: 'company-registration',
    title: 'New Company Registration',
    description: 'Register your new Pty (Ltd) company with CIPC.',
    longDescription:
      'Start your business journey on the right foot. We manage the entire company registration process with CIPC, including name reservation and all necessary documentation, to get your Pty (Ltd) established quickly and correctly.',
    price: 950,
    imageUrl: 'https://picsum.photos/seed/102/600/400',
    imageHint: 'business documents',
    category: 'Entity Registrations',
    whatsIncluded: [
        'Company Name Reservation (COR 9.1)',
        'Company Registration Certificate (COR 14.3)',
        'Income Tax Number Registration',
        'Memorandum of Incorporation (MOI)',
    ],
    turnaroundTime: '3-5 working days',
    clientRequirements: [
        'ID copies of all directors (min. 1)',
        '4 proposed company names',
        'Proof of address for all directors',
    ],
    metaTitle: 'New Company Registration (Pty Ltd) | My Accountant',
    metaDescription: 'Fast and reliable Pty (Ltd) company registration services with CIPC in South Africa. Includes name reservation, tax number, and all essential documents.',
    metaKeywords: ['company registration', 'CIPC', 'Pty Ltd', 'start a business', 'South Africa'],
  },
  {
    id: 'monthly-bookkeeping',
    title: 'Monthly Bookkeeping (Basic)',
    description: 'Comprehensive bookkeeping for small businesses.',
    longDescription:
      'Focus on growing your business while we handle the numbers. Our monthly bookkeeping service includes transaction recording, bank reconciliations, and financial reporting, ensuring your books are always accurate and up-to-date.',
    price: 1500,
    imageUrl: 'https://picsum.photos/seed/103/600/400',
    imageHint: 'accounting ledger',
    category: 'Accounting Services',
    whatsIncluded: [
        'Processing of up to 50 monthly transactions',
        'Bank and credit card reconciliations',
        'Monthly management reports (Income Statement, Balance Sheet)',
        'VAT201 submission support',
    ],
    turnaroundTime: 'Ongoing monthly service',
    clientRequirements: [
        'Bank statements',
        'Supplier invoices',
        'Customer invoices',
    ],
    metaTitle: 'Monthly Bookkeeping Services for Small Businesses | My Accountant',
    metaDescription: 'Affordable monthly bookkeeping and accounting services for small businesses in South Africa. We handle reconciliations, reporting, and more.',
    metaKeywords: ['bookkeeping services', 'small business accounting', 'monthly bookkeeping', 'accountant South Africa'],
  },
  {
    id: 'cipc-annual-returns',
    title: 'CIPC Annual Returns',
    description: 'File your company\'s mandatory annual returns with CIPC.',
    longDescription: 'Ensure your company remains compliant by filing your CIPC annual returns on time. This is a mandatory requirement for all registered companies and close corporations to keep their registration active.',
    price: 450,
    imageUrl: 'https://picsum.photos/seed/104/600/400',
    imageHint: 'compliance calendar',
    category: 'CIPC Services',
    whatsIncluded: [
        'Calculation of annual return fee',
        'Filing of the return with CIPC',
        'Confirmation of filing certificate',
    ],
    turnaroundTime: '1-2 working days',
    clientRequirements: [
        'Company registration number',
        'Latest Annual Financial Statements (if applicable)',
    ],
    metaTitle: 'CIPC Annual Returns Filing | My Accountant',
    metaDescription: 'Quick and easy CIPC annual return filing service to keep your South African company compliant. Avoid penalties and deregistration.',
    metaKeywords: ['CIPC annual returns', 'company compliance', 'CIPC filing', 'South Africa'],
  },
  {
    id: 'coida-registration',
    title: 'COIDA Registration',
    description: 'Register for Compensation for Occupational Injuries and Diseases Act.',
    longDescription: 'Register your business with the Compensation Fund to protect your employees against injuries or diseases sustained at work. This is a legal requirement for all employers in South Africa.',
    price: 800,
    imageUrl: 'https://picsum.photos/seed/105/600/400',
    imageHint: 'health safety',
    category: 'COIDA Services',
    whatsIncluded: [
        'Preparation of registration documents',
        'Submission to the Department of Labour',
        'Confirmation of registration',
    ],
    turnaroundTime: '10-15 working days',
    clientRequirements: [
        'Company registration documents',
        'ID copies of directors',
        'Proof of business address',
        'Employee details and total earnings',
    ],
    metaTitle: 'COIDA Registration Service | My Accountant',
    metaDescription: 'COIDA registration service for South African employers. Ensure compliance with the Compensation for Occupational Injuries and Diseases Act.',
    metaKeywords: ['COIDA registration', 'Compensation Fund', 'Department of Labour', 'workmans compensation'],
  }
];

export const blogPosts: BlogPost[] = [
  {
    id: '1',
    slug: '5-essential-tax-tips-for-sa-freelancers',
    title: '5 Essential Tax Tips for South African Freelancers',
    excerpt:
      'Navigating the world of tax as a freelancer can be daunting. Here are five essential tips to help you stay compliant and maximize your earnings.',
    content: `
      <p>Being a freelancer in South Africa offers incredible flexibility, but it also comes with the responsibility of managing your own taxes. Here are five tips to keep you on the right track:</p>
      <h3 class="font-headline text-xl font-semibold mt-4 mb-2">1. Register as a Provisional Taxpayer</h3>
      <p>If you earn income other than a salary, you're likely a provisional taxpayer. This means you need to pay tax in advance, twice a year. Registering with SARS is the first and most crucial step.</p>
      <h3 class="font-headline text-xl font-semibold mt-4 mb-2">2. Keep Meticulous Records</h3>
      <p>Track every invoice and every expense. Use a spreadsheet or accounting software to keep your financial records organized. This will be invaluable when it's time to file.</p>
      <h3 class="font-headline text-xl font-semibold mt-4 mb-2">3. Separate Business and Personal Finances</h3>
      <p>Open a separate bank account for your business. This makes tracking income and expenses much easier and demonstrates professionalism to SARS.</p>
      <h3 class="font-headline text-xl font-semibold mt-4 mb-2">4. Understand Deductible Expenses</h3>
      <p>You can reduce your taxable income by deducting legitimate business expenses. This includes costs like internet, office supplies, software subscriptions, and a portion of your home office costs.</p>
      <h3 class="font-headline text-xl font-semibold mt-4 mb-2">5. Set Aside Money for Tax</h3>
      <p>A good rule of thumb is to set aside 25-30% of every invoice for your tax payments. This way, you won't be caught off guard when it's time to pay SARS.</p>
    `,
    imageUrl: 'https://picsum.photos/seed/201/800/400',
    imageHint: 'financial advice',
    author: 'Jane Doe',
    date: '2024-07-15',
  },
  {
    id: '2',
    slug: 'understanding-vat-in-south-africa',
    title: 'A Simple Guide to Understanding VAT in South Africa',
    excerpt:
      "VAT can be complex, but it's a critical component of many businesses. Here's a simple guide to what it is and when you need to register.",
    content: `
      <p>Value-Added Tax (VAT) is an indirect tax on the consumption of goods and services in the economy. Here's what South African business owners need to know.</p>
      <h3 class="font-headline text-xl font-semibold mt-4 mb-2">What is VAT?</h3>
      <p>Currently set at 15%, VAT is added to the price of most goods and services. Businesses that are registered for VAT (known as vendors) collect this tax on behalf of the government.</p>
      <h3 class="font-headline text-xl font-semibold mt-4 mb-2">When Do You Need to Register?</h3>
      <p>VAT registration is compulsory if the total value of your taxable supplies (income) is more than R1 million in any consecutive 12-month period, or is expected to exceed this amount. You can also register voluntarily if your income is more than R50,000 in a 12-month period.</p>
      <h3 class="font-headline text-xl font-semibold mt-4 mb-2">Input vs. Output VAT</h3>
      <p><strong>Output VAT</strong> is the tax you collect on your sales. <strong>Input VAT</strong> is the tax you pay on your business purchases. As a vendor, you pay the difference between your output and input VAT to SARS. If your input VAT is more than your output VAT, SARS will refund you the difference.</p>
    `,
    imageUrl: 'https://picsum.photos/seed/202/800/400',
    imageHint: 'shopping receipt',
    author: 'John Smith',
    date: '2024-06-28',
  },
];

export const faqs: FAQ[] = [
  {
    id: 'faq1',
    question: 'What documents do I need for my personal tax return?',
    answer:
      'You will typically need your IRP5/IT3(a) from your employer, medical aid tax certificate, retirement annuity contribution certificates, and details of any other income or deductible expenses.',
  },
  {
    id: 'faq2',
    question: 'How long does company registration take?',
    answer:
      'The company registration process with CIPC, including name reservation, usually takes between 3 to 7 business days, provided all documentation is in order.',
  },
  {
    id: 'faq3',
    question: 'Can I purchase a service online?',
    answer:
      'Yes, you can add any of our services to your cart and complete the purchase securely through our website using PayFast. You will receive an order confirmation via email.',
  },
  {
    id: 'faq4',
    question: 'How do I upload my documents securely?',
    answer:
      'Once you have created an account and purchased a service, you can log in to your client portal. There, you will find a secure document upload section for each of your orders.',
  },
];

const allServices = [...services];
export const orders: Order[] = [
    {
        id: 'ORD-001',
        date: '2024-07-20',
        items: [{ service: allServices[0], quantity: 1 }, { service: allServices[1], quantity: 1 }],
        total: allServices[0].price + allServices[1].price,
        status: 'Completed',
    },
    {
        id: 'ORD-002',
        date: '2024-07-22',
        items: [{ service: allServices[2], quantity: 1 }],
        total: allServices[2].price,
        status: 'Processing',
    }
];

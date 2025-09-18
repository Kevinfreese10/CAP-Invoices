import type { Service, BlogPost, FAQ, Order } from './types';

export const services: Service[] = [
  {
    id: 'personal-tax-return',
    title: 'Personal Tax Return',
    description: 'Annual tax filing for individuals and provisional taxpayers.',
    longDescription:
      'Our personal tax return service ensures that your annual tax filings are accurate, compliant, and optimized for maximum returns. We handle everything from gathering your documents to submitting the final return to SARS, providing peace of mind for both standard and provisional taxpayers.',
    price: 750,
    imageUrl: 'https://picsum.photos/seed/101/600/400',
    imageHint: 'tax forms',
    category: 'Tax Services',
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
    category: 'Business Services',
  },
  {
    id: 'monthly-bookkeeping',
    title: 'Monthly Bookkeeping',
    description: 'Comprehensive bookkeeping services to keep your finances in order.',
    longDescription:
      'Focus on growing your business while we handle the numbers. Our monthly bookkeeping service includes transaction recording, bank reconciliations, and financial reporting, ensuring your books are always accurate and up-to-date.',
    price: 1500,
    imageUrl: 'https://picsum.photos/seed/103/600/400',
    imageHint: 'accounting ledger',
    category: 'Accounting',
  },
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

export const orders: Order[] = [
    {
        id: 'ORD-001',
        date: '2024-07-20',
        items: [{ service: services[0], quantity: 1 }, { service: services[1], quantity: 1 }],
        total: services[0].price + services[1].price,
        status: 'Completed',
    },
    {
        id: 'ORD-002',
        date: '2024-07-22',
        items: [{ service: services[2], quantity: 1 }],
        total: services[2].price,
        status: 'Processing',
    }
];

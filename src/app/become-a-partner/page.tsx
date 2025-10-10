
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Rocket, ShieldCheck, Wallet, UserCheck, Cpu, Briefcase, Users, FileText, BotMessageSquare, LifeBuoy, GraduationCap, CheckCircle2, ArrowRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import WebsiteAIWidget from '@/components/shared/WebsiteAIWidget';
import dynamic from 'next/dynamic';

const TrustIndexWidget = dynamic(() => import('@/components/shared/TrustIndexWidget'), {
  ssr: false,
});

const FaqSection = () => {
    const faqs = [
    {
        question: "Who should join the Bookkeeper Empowerment Initiative?",
        answer: "BEI is ideal for passionate professionals who want to grow their business without stress, including:\n- Freelance Bookkeepers\n- Startup Accounting Firms\n- Tax Practitioners\n- Business Consultants\n- Payroll Administrators"
    },
    {
        question: "What does it cost to join?",
        answer: "Joining is completely free — there are no upfront or monthly fees.\nYou’ll only pay for the services you choose to outsource through your dashboard.\n\nAs a My Accountant Partner, you’ll also receive a 25% discount on all our services, allowing you to set your own pricing and profit margins.\nOur retail pricing remains the same — you simply earn the difference."
    },
    {
        question: "How does outsourcing work?",
        answer: "You can seamlessly outsource orders directly to My Accountant through your partner dashboard.\nOur qualified team handles the work while all client communication goes through your email, ensuring your brand remains front and center."
    },
    {
        question: "How It Works",
        answer: "Joining is simple and straightforward. Follow these steps to start growing your practice:\n\n1. Apply Online\n2. Access Your Dashboard\n3. Outsource or Accept Work\n4. Learn & Grow",
    },
    {
        question: "Do I need to be a registered accountant?",
        answer: "No. Everyone is welcome — including business owners who do not work in the accounting or tax space but would like to offer these services to their clients.\n\nHowever, to qualify for opportunities where My Accountant outsources work to you, you must belong to a recognized professional accounting or tax body such as SAICA, SAIT, CIBA, or SAIPA. This ensures we maintain consistent quality and professional standards across all client work."
    },
    {
        question: "How do I get support?",
        answer: "You’ll have access to a dedicated partner support team, mentorship network, and helpdesk through your dashboard."
    }
  ];

  return (
      <section className="container mx-auto px-4 max-w-4xl">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
        </div>
         <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent className="whitespace-pre-line">{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>
  )
}

const DynamicFaqSection = dynamic(() => Promise.resolve(FaqSection), {
    ssr: false,
});


export default function BecomeAPartnerPage() {

  const challenges = [
    {
      title: 'Limited Service Range',
      description: 'Offering only bookkeeping services limits your earning potential.',
      solution: "Through BEI, you can sell My Accountant’s full suite of services — from company registration to VAT, COIDA, CIDB, NCR, and more.",
      icon: Briefcase,
    },
    {
      title: 'Lack of Mentorship',
      description: 'Many bookkeepers work alone, with no guidance from experienced professionals.',
      solution: 'We provide mentorship from senior accountants and industry experts who help you grow your confidence and capabilities.',
      icon: GraduationCap,
    },
    {
      title: 'Technology Gaps',
      description: 'Without proper systems, managing clients and documents becomes messy.',
      solution: 'You get access to our cloud-based reseller dashboard to manage, track, and outsource client orders seamlessly.',
      icon: Cpu,
    },
    {
      title: 'Capacity Constraints',
      description: 'Handling large clients or complex projects alone isn’t easy.',
      solution: 'We’re a qualified team of accountants and tax professionals — when you outsource overflow work to us, it’s handled securely, accurately, and on time.',
      icon: Users,
    },
     {
      title: 'Compliance Overwhelm',
      description: 'Complex tax and statutory rules can deter small practitioners from taking on advanced clients.',
      solution: 'We provide ready-to-use templates, compliance guides, and ongoing training to help you stay compliant and confident.',
      icon: ShieldCheck,
    },
  ];

  const benefits = [
    {
        icon: '📊',
        title: 'Reseller Dashboard',
        description: 'Access your dedicated reseller dashboard to create and manage client orders, track progress in real time, and outsource orders directly to My Accountant through a secure platform. This dashboard keeps you in control — while our team handles the heavy lifting.',
    },
    {
        icon: '🤝',
        title: 'Outsourcing Opportunities',
        description: 'Join a growing pool of bookkeepers and accountants who share work through the BEI network. Get access to new outsourcing projects, take on client work from other members, and earn by completing orders or referring clients. You stay independent, but never alone.',
    },
    {
        icon: '✉️',
        title: 'Seamless Outsourcing (White-Label Model)',
        description: 'Maintain your client relationships and protect your brand identity. When you outsource work to us, all communication with your clients happens through your email address — not ours. Your clients never know the service has been outsourced, ensuring total confidentiality and trust.',
    },
    {
        icon: '🎓',
        title: 'Mentorship & Training',
        description: 'Get practical guidance from experienced accountants and business advisors. Join monthly training webinars and Q&A sessions. Access resources to help you price, sell, and manage your services effectively and grow a sustainable, modern accounting practice.',
    },
    {
        icon: '🧾',
        title: 'Document Templates & Compliance Tools',
        description: 'Save time and standardize your work with our professional templates for engagement letters, employment contracts, pricing schedules, POPIA & compliance documents, and client onboarding forms.',
    },
    {
        icon: '💻',
        title: 'Technical & Partner Support',
        description: 'Our technical team ensures your reseller dashboard runs smoothly. You’ll have access to support whenever you need help with your account, orders, or system setup.',
    },
  ];

  return (
    <div className="space-y-16 pb-16">
      <section className="bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
                Bookkeeper <span className="text-gradient">#Empowerment</span> Initiative
            </h1>
            <h2 className="mt-4 text-2xl md:text-3xl font-semibold">Empower Your Accounting Practice in South Africa</h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-3xl mx-auto">
                Partner with My Accountant – Grow Smarter, Earn More, Work Freely.
            </p>
            <Button asChild size="lg" className="mt-8">
            <Link href="/reseller-signup">Join the Initiative — It's Free</Link>
            </Button>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center space-y-4">
            <h2 className="text-3xl font-bold">About the Initiative</h2>
            <p className="text-muted-foreground text-lg">
                The Bookkeeper Empowerment Initiative by My Accountant was created to empower small and growing bookkeepers across South Africa. We know what it’s like to start out — you have the skills, but limited clients, tools, and support. That’s why BEI gives you the technology, mentorship, and opportunities to build your own brand, attract more clients, and scale your income — all while staying independent.
            </p>
             <p className="text-muted-foreground text-lg">
                Whether you’re a freelance bookkeeper, a new accounting firm, or a small practitioner, BEI is designed to help you grow faster with less stress.
            </p>
        </div>
      </section>
      
      <section className="container mx-auto px-4">
        <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">The Challenges We’re Solving</h2>
        </div>
        <div className="space-y-8 max-w-4xl mx-auto">
            {challenges.map((challenge, index) => (
                <div key={challenge.title} className="space-y-3">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 rounded-full h-12 w-12 flex items-center justify-center flex-shrink-0">
                            <challenge.icon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold">{challenge.title}</h3>
                            <p className="text-muted-foreground">{challenge.description}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-4 pl-16">
                        <CheckCircle2 className="h-5 w-5 text-green-500 mt-1 flex-shrink-0"/>
                        <p className="font-medium">{challenge.solution}</p>
                    </div>
                </div>
            ))}
        </div>
      </section>
      
      <section className="bg-background py-16">
        <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Key Benefits of Joining</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {benefits.map(benefit => (
                <div key={benefit.title} className="flex items-start gap-4">
                    <div className="text-2xl">{benefit.icon}</div>
                    <div>
                        <h3 className="text-lg font-semibold">{benefit.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{benefit.description}</p>
                    </div>
                </div>
                ))}
            </div>
        </div>
      </section>

      <DynamicFaqSection />
      
      <section className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button asChild size="lg">
                <Link href="/reseller-signup">Sign Up Now</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
                <Link href="/login">Access Demo Dashboard</Link>
            </Button>
        </div>
      </section>

      <section id="ai-assistant" className="container mx-auto px-4 scroll-m-20">
        <WebsiteAIWidget />
      </section>
    </div>
  );
}

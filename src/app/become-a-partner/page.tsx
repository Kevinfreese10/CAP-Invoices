
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Rocket, ShieldCheck, Wallet, UserCheck, Cpu, Briefcase, Users, FileText, BotMessageSquare, LifeBuoy, GraduationCap, CheckCircle2, ArrowRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';


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

  const faqs = [
    {
        question: "What does it cost to join?",
        answer: "Joining is completely free. You’ll only pay for services you choose to outsource through the dashboard."
    },
    {
        question: "How does outsourcing work?",
        answer: "You can send orders directly to My Accountant or other qualified partners in the BEI network. All client communication happens through your email to maintain your professional brand."
    },
    {
        question: "Do I need to be a registered accountant?",
        answer: "No. We welcome bookkeepers, tax practitioners, consultants, and accounting students."
    },
    {
        question: "How do I get support?",
        answer: "You’ll have access to a dedicated partner support team, mentorship network, and helpdesk through your dashboard."
    }
  ];

  const whoShouldJoin = [
    'Freelance Bookkeepers',
    'Startup Accounting Firms',
    'Tax Practitioners',
    'Business Consultants',
    'Payroll Administrators',
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

       <section className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold">How It Works</h2>
            <p className="text-muted-foreground">Joining is simple and straightforward. Follow these steps to start growing your practice:</p>
            <ul className="space-y-4">
                {['Apply Online', 'Access Your Dashboard', 'Outsource or Accept Work', 'Learn & Grow'].map((step, index) => (
                    <li key={index} className="flex items-center gap-4">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">{index + 1}</div>
                        <p className="font-medium">{step}</p>
                    </li>
                ))}
            </ul>
          </div>
           <Card className="bg-primary/5">
            <CardHeader>
                <CardTitle>Who Should Join?</CardTitle>
                 <CardDescription>BEI is ideal for passionate professionals who want to grow their business without stress.</CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {whoShouldJoin.map(role => (
                        <li key={role} className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-primary"/>
                            <span className="font-medium">{role}</span>
                        </li>
                    ))}
                </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="container mx-auto px-4 max-w-4xl">
         <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Frequently Asked Questions</h2>
        </div>
         <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
      </section>

      <section className="container mx-auto px-4">
        <Card className="bg-gradient-to-r from-primary to-blue-600 text-primary-foreground">
            <CardContent className="p-8 md:p-12 text-center space-y-6">
                <h2 className="text-3xl font-bold">Secure Your Future Today</h2>
                <p className="max-w-3xl mx-auto">
                   Most small accounting practices fail due to isolation, lack of support, and limited scalability. The BEI helps you break that cycle — giving you the tools, mentorship, and opportunities to build a thriving practice.
                </p>
                <Button variant="secondary" size="lg" asChild>
                    <Link href="/reseller-signup">Ready to grow your practice? Join the Bookkeeper Empowerment Initiative</Link>
                </Button>
            </CardContent>
        </Card>
      </section>
    </div>
  );
}

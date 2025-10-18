
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Rocket, ShieldCheck, Wallet, Bot, FileInput, BarChart, Percent, Building, Users, FileText, BadgeDollarSign, CheckCircle } from 'lucide-react';
import TrustIndexWidget from '@/components/shared/TrustIndexWidget';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function AiAccountantPage() {

  const whyChooseUs = [
    {
      title: 'Fully Automated',
      description: 'Let our AI handle the tedious work of data entry and transaction categorization.',
      icon: Rocket,
    },
    {
      title: 'Highly Accurate',
      description: 'Our AI is trained on thousands of transactions to ensure your books are precise.',
      icon: ShieldCheck,
    },
    {
      title: 'Cost-Effective',
      description: 'Save on billable hours by automating your bookkeeping processes.',
      icon: Wallet,
    },
  ];

  const features = [
    {
      title: 'Automated Transaction Imports',
      description: 'Securely import your bank statements via CSV or our AI-powered PDF reader.',
      icon: FileInput,
    },
    {
      title: 'Intelligent Categorization',
      description: 'Our AI automatically allocates transactions to the correct accounts based on your rules.',
      icon: Bot,
    },
    {
      title: 'Real-time Financial Reports',
      description: 'Generate Trial Balances, General Ledgers, and other reports instantly.',
      icon: BarChart,
    },
    {
        title: 'VAT & Tax Compliance',
        description: 'The AI helps ensure your VAT is correctly categorized for easier submissions.',
        icon: Percent,
    }
  ];
  
   const pricingTiers = [
    {
      title: "Free Plan",
      price: "R0",
      description: "Perfect for getting started and managing one company.",
      features: [
        "1 Company Profile",
        "1 User",
        "Manual Transaction Processing",
        "Basic Reporting",
      ],
      cta: "Get Started for Free",
      href: "/ai-accountant-signup"
    },
    {
      title: "AI Accountant Add-on",
      price: "R290",
      period: "/ company / month",
      description: "Unlock the power of AI for full automation.",
      features: [
        "Includes all Free Plan features",
        "Automated AI transaction allocation",
        "Bank statement PDF reading",
        "Advanced real-time reports",
      ],
      cta: "Add AI to Your Profile",
       href: "/ai-accountant-signup"
    },
  ];

  const subscriptionTiers = [
    {
      title: "Monthly Accounting (Non-VAT)",
      price: "R950",
      period: "/ month",
      description: "Complete bookkeeping for non-VAT registered companies.",
      features: [
          "Includes the AI Accountant feature",
          "Up to 150 transactions per month",
          "Monthly management reports",
          "Annual Financial Statements",
          "Income Tax Submissions",
      ],
      cta: "Sign Up for Monthly Accounting",
       href: "/ai-accountant-signup"
    },
     {
      title: "Monthly Accounting (VAT Registered)",
      price: "R1950",
      period: "/ month",
      description: "Full-suite accounting for VAT registered companies.",
      features: [
          "Includes the AI Accountant feature",
          "Up to 300 transactions per month",
          "Monthly management reports",
          "Bi-monthly VAT201 Submissions",
          "Annual Financial Statements & Tax",
      ],
      cta: "Sign Up for VAT Accounting",
      href: "/ai-accountant-signup"
    },
     {
      title: "Payroll Services",
      price: "From R110",
      period: "/ payslip",
      description: "Comprehensive payroll management.",
      features: [
        "R110 per payslip",
        "Monthly Payroll Submissions (EMP201) for R550 p/m",
        "Bi-annual Reconciliations (EMP501)",
        "UIF Registrations & Submissions",
      ],
      cta: "Contact Us for Payroll",
       href: "/contact"
    },
  ]


  return (
    <div className="space-y-16 pb-16">
      <section>
        <div className="container mx-auto grid grid-cols-1 items-center gap-12 px-4 py-16 lg:py-24">
          <div className="space-y-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl text-foreground">
              Welcome to the Future of Accounting with <span className="text-gradient">#AIAccountant</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Automate your bookkeeping, eliminate manual data entry, and get real-time financial insights with our revolutionary AI-powered accounting module.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Button asChild size="lg">
                <Link href="/ai-accountant-signup">Sign Up Now</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <TrustIndexWidget />

      <section className="bg-background pt-16">
         <div className="container mx-auto px-4">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-bold">Why Choose The AI Accountant?</h2>
                <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                    Transform your bookkeeping from a chore into a strategic advantage.
                </p>
            </div>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {whyChooseUs.map(item => (
                    <div key={item.title} className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                            <item.icon className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-semibold">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </section>

       <section id="features" className="container mx-auto px-4 scroll-m-20">
          <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">Key Features</h2>
              <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
                  Everything you need to put your accounting on autopilot.
              </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {features.map(feature => (
                  <div key={feature.title} className="flex items-start gap-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0">
                        <feature.icon className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                          <h3 className="font-semibold text-lg">{feature.title}</h3>
                          <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                  </div>
              ))}
          </div>
      </section>
      
       <section id="pricing" className="bg-background py-16 scroll-m-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Flexible Pricing for Every Need</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Choose the plan that's right for you. Start for free and add features as you grow.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-3xl mx-auto">
            {pricingTiers.map((tier) => (
              <Card key={tier.title} className="flex flex-col">
                <CardHeader>
                  <CardTitle>{tier.title}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="flex items-baseline pt-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.period && <span className="text-sm text-muted-foreground">{tier.period}</span>}
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={tier.href}>{tier.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          
           <div className="text-center mt-16 mb-12">
            <h3 className="text-2xl font-bold">All-Inclusive Monthly Subscriptions</h3>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              For complete peace of mind, choose a monthly package that includes the AI Accountant and all your compliance needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-stretch max-w-6xl mx-auto">
             {subscriptionTiers.map((tier) => (
              <Card key={tier.title} className="flex flex-col bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle>{tier.title}</CardTitle>
                   <div className="flex items-baseline pt-4">
                    <span className="text-4xl font-bold">{tier.price}</span>
                    {tier.period && <span className="text-sm text-muted-foreground">{tier.period}</span>}
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <ul className="space-y-3">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button asChild className="w-full">
                    <Link href={tier.href}>{tier.cta}</Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>

           <div className="text-center mt-16">
                <h3 className="text-2xl font-bold">Need to Add More Users?</h3>
                <p className="text-muted-foreground mt-2">Additional users can be added to any plan for just <span className="font-bold text-primary">R50 per user, per month</span>.</p>
            </div>

        </div>
      </section>
    </div>
  );
}

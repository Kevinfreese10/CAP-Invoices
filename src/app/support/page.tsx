import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { faqs } from '@/lib/data';
import SupportForm from '@/components/support/SupportForm';
import FaqAI from '@/components/support/FaqAI';

export default function SupportPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">Support Center</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Find answers to common questions or contact our support team.
        </p>
      </div>

      <div className="space-y-12">
        <section>
          <FaqAI />
        </section>

        <section>
          <h2 className="text-2xl font-bold mb-4 text-center">Frequently Asked Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map(faq => (
              <AccordionItem key={faq.id} value={faq.id}>
                <AccordionTrigger className="text-left">{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section>
          <SupportForm />
        </section>
      </div>
    </div>
  );
}

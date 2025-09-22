
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PopiaPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">POPIA Compliance Policy</h1>
          <p className="mt-2 text-lg text-muted-foreground">My Accountant (Pty) Ltd</p>
        </div>
        
        <Card>
            <CardContent className="p-6 space-y-6 text-muted-foreground">
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">1. Purpose of this Policy</h2>
                    <p>My Accountant (Pty) Ltd (“the Company”) is committed to safeguarding personal information in line with the Protection of Personal Information Act, 4 of 2013 (POPIA). This policy outlines how we collect, process, store, share, and safeguard personal information to ensure compliance with POPIA and to maintain the trust of our clients, partners, and employees.</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">2. Scope</h2>
                    <p>This policy applies to:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>All directors, employees, contractors, and service providers of My Accountant (Pty) Ltd.</li>
                        <li>All personal information processed by the Company relating to clients, prospective clients, suppliers, employees, and third parties.</li>
                    </ul>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">3. Definitions</h2>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li><strong>Personal Information:</strong> Any information relating to an identifiable, living individual or juristic person.</li>
                        <li><strong>Processing:</strong> Any operation concerning personal information, such as collection, storage, use, or sharing.</li>
                        <li><strong>Data Subject:</strong> The person to whom the personal information relates.</li>
                        <li><strong>Responsible Party:</strong> My Accountant (Pty) Ltd, determining the purpose and means of processing.</li>
                        <li><strong>Operator:</strong> A third party processing information on behalf of My Accountant (Pty) Ltd.</li>
                    </ul>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">4. Principles of Processing Personal Information</h2>
                    <p>My Accountant (Pty) Ltd undertakes to comply with POPIA’s eight conditions:</p>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li><strong>Accountability</strong> – We accept responsibility for lawful processing.</li>
                        <li><strong>Processing Limitation</strong> – We process personal information lawfully, minimally, and with consent or other justification.</li>
                        <li><strong>Purpose Specification</strong> – Personal information is collected for defined, legitimate business purposes.</li>
                        <li><strong>Further Processing Limitation</strong> – Further use will be compatible with the original purpose.</li>
                        <li><strong>Information Quality</strong> – We ensure information is complete, accurate, and up to date.</li>
                        <li><strong>Openness</strong> – We maintain transparency and provide data subjects with information about their rights.</li>
                        <li><strong>Security Safeguards</strong> – We implement technical and organisational security controls to protect personal information.</li>
                        <li><strong>Data Subject Participation</strong> – Data subjects may access, correct, or request deletion of their personal information.</li>
                    </ul>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">5. Collection of Personal Information</h2>
                    <p>We may collect personal information directly from data subjects or from third parties (with consent or lawful justification). Information collected may include:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Identification details (names, ID numbers, company registration numbers).</li>
                        <li>Contact information (addresses, phone numbers, email).</li>
                        <li>Financial details (banking, tax, compliance records).</li>
                        <li>Employment or contractual details.</li>
                    </ul>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">6. Purpose of Processing</h2>
                    <p>Personal information is processed for purposes including:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Delivering accounting, tax, and compliance services.</li>
                        <li>Fulfilling statutory obligations (e.g., SARS, CIPC, NCR).</li>
                        <li>Communicating with clients, employees, and stakeholders.</li>
                        <li>Business administration and HR management.</li>
                        <li>Marketing our services (with consent).</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">7. Sharing of Personal Information</h2>
                    <p>We may share personal information with:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Regulatory authorities (e.g., SARS, CIPC, Department of Labour).</li>
                        <li>Professional service providers and subcontractors (e.g., auditors, IT support, outsourced compliance specialists).</li>
                        <li>Only where necessary, under strict confidentiality and in line with POPIA.</li>
                    </ul>
                    <p className="mt-2">We will not sell personal information to third parties.</p>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">8. Safeguarding Personal Information</h2>
                    <p>My Accountant (Pty) Ltd employs physical, technical, and administrative safeguards, including:</p>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Secure filing systems and restricted access.</li>
                        <li>Encryption, firewalls, and secure passwords.</li>
                        <li>Confidentiality agreements with staff and service providers.</li>
                        <li>Regular training on data protection.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">9. Rights of Data Subjects</h2>
                    <p>Under POPIA, data subjects have the right to:</p>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Be informed of personal information collected.</li>
                        <li>Access, correct, or delete their information.</li>
                        <li>Object to certain processing activities (e.g., direct marketing).</li>
                        <li>Lodge complaints with the Information Regulator.</li>
                    </ul>
                     <p className="mt-2">Requests must be made in writing to the Information Officer.</p>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">10. Information Officer</h2>
                    <p>The appointed Information Officer for My Accountant (Pty) Ltd is:</p>
                    <div className="mt-2 p-4 bg-muted/50 rounded-md">
                        <p><strong>Name:</strong> Kevin William Freese</p>
                        <p><strong>Email:</strong> info@myacc.co.za</p>
                        <p><strong>Address:</strong> 369 Oak Avenue, Ferndale, Randburg, Johannesburg</p>
                    </div>
                    <p className="mt-2">The Information Officer is responsible for compliance with POPIA, maintaining records of processing activities, and managing data subject requests.</p>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">11. Retention of Records</h2>
                    <p>Personal information will only be retained for as long as necessary to fulfil business and legal obligations. Records no longer required will be securely destroyed or anonymised.</p>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">12. Breach Notification</h2>
                    <p>In the event of a data breach, the Company will notify affected data subjects and the Information Regulator as required by law, and take corrective measures to minimise risks.</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">13. Review of Policy</h2>
                    <p>This policy will be reviewed annually or when there are material changes in business processes or legislation.</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">14. Acceptance</h2>
                    <p>All employees and contractors must familiarise themselves with this policy and confirm compliance as a condition of employment or engagement with My Accountant (Pty) Ltd.</p>
                </section>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}

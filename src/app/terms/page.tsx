
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function TermsAndConditionsPage() {
  return (
    <div className="container mx-auto max-w-4xl px-4 py-12">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">Bookkeeper Empowerment Initiative (BEI) – Terms & Conditions</h1>
          <p className="mt-2 text-lg text-muted-foreground">My Accountant (Pty) Ltd</p>
        </div>
        
        <Card>
            <CardHeader>
                <CardTitle>Effective Date: {new Date().toLocaleDateString('en-ZA')}</CardTitle>
                <div className="text-sm text-muted-foreground">
                    <p><strong>Operator:</strong> My Accountant (Pty) Ltd (“My Accountant”, “we”, “our”, or “us”)</p>
                    <p><strong>Website:</strong> <Link href="https://www.myacc.co.za" className="text-primary hover:underline">www.myacc.co.za</Link></p>
                    <p><strong>Email:</strong> <a href="mailto:info@myacc.co.za" className="text-primary hover:underline">info@myacc.co.za</a></p>
                </div>
            </CardHeader>
            <CardContent className="space-y-6 text-muted-foreground">
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">1. Introduction</h2>
                    <p>Welcome to the <strong>Bookkeeper Empowerment Initiative (BEI)</strong>, a program operated by <strong>My Accountant (Pty) Ltd</strong>. By registering as a BEI Partner, accessing your reseller dashboard, or outsourcing/accepting work through the BEI platform, you agree to comply with the following Terms and Conditions (“Terms”).</p>
                    <p className="mt-2">These Terms govern the relationship between <strong>My Accountant</strong>, <strong>BEI Partners</strong>, and <strong>Clients</strong> in connection with:</p>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>The creation and outsourcing of client orders;</li>
                        <li>Communication and data sharing between My Accountant and partners;</li>
                        <li>Payment, invoicing, and refunds; and</li>
                        <li>Compliance with applicable laws, including the <strong>Protection of Personal Information Act (POPIA)</strong>.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">2. Definitions</h2>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li><strong>“Partner”</strong> means any bookkeeper, accountant, tax practitioner, consultant, or other approved participant in the BEI program.</li>
                        <li><strong>“Client”</strong> means any individual or entity whose order is processed through the BEI dashboard.</li>
                        <li><strong>“Platform” or “Dashboard”</strong> refers to the BEI online system used for managing, tracking, and outsourcing orders.</li>
                        <li><strong>“Outsourced Work”</strong> means any order assigned by a Partner to My Accountant or another approved BEI partner.</li>
                        <li><strong>“Personal Information”</strong> means information as defined under the <strong>Protection of Personal Information Act 4 of 2013 (POPIA)</strong>.</li>
                    </ul>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">3. Eligibility</h2>
                    <p>To join the BEI program, you must:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Be a natural person or registered entity in South Africa;</li>
                        <li>Be at least 18 years of age;</li>
                        <li>Have basic accounting or bookkeeping knowledge; and</li>
                        <li>Agree to these Terms in full.</li>
                    </ul>
                     <p className="mt-2">My Accountant reserves the right to vet, approve, or decline any application at its sole discretion.</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">4. Program Overview</h2>
                    <p>The BEI program allows Partners to:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Create, manage, and outsource client orders through the BEI dashboard;</li>
                        <li>Access mentorship, templates, and compliance resources;</li>
                        <li>Participate in outsourcing opportunities from My Accountant and other partners; and</li>
                        <li>Retain their brand identity when outsourcing work to My Accountant.</li>
                    </ul>
                    <p className="mt-2">All communication with clients (for outsourced work) is conducted through the Partner’s email, ensuring a <strong>white-label experience</strong> where the client remains unaware that services are outsourced.</p>
                </section>
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">5. Partner Responsibilities</h2>
                    <p>By participating in the BEI program, you agree to:</p>
                    <ol className="list-decimal pl-6 space-y-1 mt-2">
                        <li>Use the platform solely for legitimate business purposes.</li>
                        <li>Ensure all information submitted about yourself or your clients is accurate and lawful.</li>
                        <li>Maintain client confidentiality and comply with POPIA at all times.</li>
                        <li>Only outsource work that you have been engaged or authorized to handle.</li>
                        <li>Deliver services in good faith and in accordance with professional accounting standards.</li>
                        <li>Avoid any form of misrepresentation, fraud, or unethical conduct while representing yourself as a BEI Partner.</li>
                    </ol>
                    <p className="mt-2">Failure to comply with these responsibilities may result in suspension or termination of your BEI partnership.</p>
                </section>
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">6. Outsourcing & Workflow Terms</h2>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">6.1 Outsourcing to My Accountant</h3>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>When you outsource a client order to My Accountant, you authorize us to perform the service on your behalf.</li>
                        <li>Communication with your client will occur through your email address (via our CRM) to preserve your client relationship.</li>
                        <li>You remain the client-facing representative, while My Accountant acts as your back-office service provider.</li>
                        <li><strong>Payment for outsourced work is required upfront</strong> before work commences.</li>
                    </ul>

                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">6.2 Outsourcing to Other Partners</h3>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Partners may also receive outsourced work from other BEI members.</li>
                        <li>All such transactions must be conducted through the BEI dashboard and adhere to these Terms.</li>
                        <li>Partners accepting outsourced work must maintain professional confidentiality and deliver services within agreed timelines.</li>
                    </ul>

                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">6.3 Payment and Responsibility</h3>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>For work outsourced <strong>to My Accountant</strong>, full payment is due <strong>upfront</strong> prior to commencement of work.</li>
                        <li>For work outsourced <strong>to another Partner</strong>, My Accountant will facilitate the process through the BEI dashboard.</li>
                        <li><strong>Partners who complete outsourced work will be paid once the service has been successfully completed and the partner has submitted a valid tax invoice to My Accountant.</strong></li>
                        <li>My Accountant will review the completion status before authorizing payment.</li>
                        <li>My Accountant will not be liable for payment disputes between partners who transact outside the BEI platform.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">7. Fees, Payments, and Refunds</h2>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">7.1 Joining the BEI</h3>
                    <p>Joining the BEI program is <strong>free</strong>. You only pay for services you choose to outsource through the dashboard.</p>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">7.2 Payment Process</h3>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>All payments for outsourced services must be made upfront before work begins.</li>
                        <li>Payments are processed securely through approved payment gateways such as <strong>PayFast</strong> and <strong>Ozow</strong>.</li>
                        <li>Partners earning income through outsourced work must submit an official tax invoice to My Accountant once the service has been completed.</li>
                        <li>Payments to partners will be made within <strong>7 to 14 business days</strong> after successful completion and verification of work.</li>
                    </ul>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">7.3 Refund Policy</h3>
                    <p>Refunds are considered only where:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>A duplicate payment was made;</li>
                        <li>A service could not be completed due to an error or oversight on our side; or</li>
                        <li>A cancellation is requested <strong>before</strong> any work has commenced.</li>
                    </ul>
                    <p className="mt-2">Refunds are processed within <strong>7–14 business days</strong> once approved. No refunds will be issued once work has begun or documents have been submitted to regulatory authorities (e.g., SARS, CIPC).</p>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">7.4 Pricing Changes</h3>
                    <p>My Accountant reserves the right to modify service pricing or commission structures. Partners will be notified in advance of any such changes.</p>
                </section>
                
                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">8. Confidentiality</h2>
                     <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">8.1 Client Data</h3>
                     <p>Both My Accountant and Partners agree to maintain the highest level of confidentiality regarding client data, documentation, and financial information.</p>
                     <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">8.2 White-Label Protection</h3>
                     <p>When outsourcing to My Accountant, all correspondence with clients will be conducted under the Partner’s email identity. My Accountant will not contact your clients directly or disclose its involvement without your written consent.</p>
                     <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">8.3 Non-Disclosure</h3>
                     <p>Partners may not share or reproduce My Accountant’s internal documents, templates, software systems, or training materials without authorization.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">9. Data Protection (POPIA Compliance)</h2>
                     <p>My Accountant is committed to protecting all Personal Information in accordance with the <strong>Protection of Personal Information Act (Act 4 of 2013)</strong>.</p>
                     <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">9.1 Data Collected</h3>
                     <p>We collect limited Personal Information such as your name, email address, business information, and order details to provide our services.</p>
                     <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">9.2 Purpose of Collection</h3>
                     <p>Information is collected for:</p>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Managing Partner and Client accounts;</li>
                        <li>Processing payments and outsourced work;</li>
                        <li>Communication and service delivery; and</li>
                        <li>Compliance with legal obligations.</li>
                    </ul>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">9.3 Data Sharing</h3>
                     <p>We may share information only with:</p>
                      <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Regulatory authorities (e.g., SARS, CIPC) for compliance filings;</li>
                        <li>Other BEI partners involved in a transaction;</li>
                        <li>Third-party service providers who assist in fulfilling client services.</li>
                    </ul>
                    <p className="mt-2">All third parties are contractually bound to protect your data and may not use it for any other purpose.</p>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">9.4 Security</h3>
                    <p>We employ secure storage systems, encryption, and controlled access to protect all data.</p>
                    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">9.5 Your Rights</h3>
                    <p>You have the right to access, correct, or request the deletion of your personal data by contacting <strong><a href="mailto:info@myacc.co.za" className="text-primary hover:underline">info@myacc.co.za</a></strong>.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">10. Intellectual Property</h2>
                    <p>All content, logos, templates, training material, and software associated with the BEI remain the property of My Accountant. Partners may use these resources only for business conducted through the BEI program. Unauthorized use, resale, or reproduction is strictly prohibited.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">11. Limitation of Liability</h2>
                    <p>My Accountant provides the BEI platform “as is” and makes no warranties regarding uninterrupted access, performance, or suitability for any particular purpose.</p>
                    <p className="mt-2">To the maximum extent permitted by law:</p>
                     <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>My Accountant is not liable for any indirect or consequential losses arising from participation in the BEI;</li>
                        <li>Responsibility for maintaining client satisfaction, compliance, and ethical conduct rests with the Partner;</li>
                        <li>My Accountant’s total liability under these Terms shall not exceed the total fees paid for the specific service in question.</li>
                    </ul>
                </section>
                
                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">12. Termination</h2>
                    <p>My Accountant may suspend or terminate a Partner’s access to the BEI program immediately if:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>Any fraudulent, unethical, or misleading activity is detected;</li>
                        <li>There is misuse of client information or violation of POPIA; or</li>
                        <li>These Terms are breached in any material way.</li>
                    </ul>
                    <p className="mt-2">Upon termination, the Partner must cease all use of BEI branding, templates, and dashboard access.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">13. Dispute Resolution</h2>
                     <p>In the event of a dispute between Partners or between a Partner and My Accountant:</p>
                    <ul className="list-disc pl-6 space-y-1 mt-2">
                        <li>The matter should first be addressed in writing to <strong><a href="mailto:info@myacc.co.za" className="text-primary hover:underline">info@myacc.co.za</a></strong>;</li>
                        <li>If unresolved, the dispute may be referred to arbitration in Johannesburg in accordance with the <strong>Arbitration Act 42 of 1965</strong>;</li>
                        <li>Each party will bear its own costs unless otherwise agreed.</li>
                    </ul>
                </section>

                 <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">14. Amendments</h2>
                    <p>My Accountant reserves the right to update or amend these Terms at any time. Any significant changes will be communicated to Partners via email or dashboard notification.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">15. Governing Law</h2>
                    <p>These Terms are governed by and construed in accordance with the laws of the <strong>Republic of South Africa</strong>. Any legal proceedings shall be subject to the jurisdiction of the South African courts.</p>
                </section>

                <section>
                    <h2 className="text-xl font-semibold text-foreground mb-2">16. Contact</h2>
                    <p>For questions regarding these Terms or the BEI program, please contact:</p>
                     <div className="mt-2 text-sm">
                        <p>📧 <a href="mailto:info@myacc.co.za" className="text-primary hover:underline">info@myacc.co.za</a></p>
                        <p>🏢 369 Oak Avenue, Ferndale, Randburg, South Africa</p>
                    </div>
                </section>

            </CardContent>
        </Card>
      </div>
    </div>
  );
}


import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight">About My Accountant</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-3xl mx-auto">
          Your dynamic partner in conquering the financial world.
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-12">
        <section className="text-center">
            <p className="text-lg text-foreground/80 leading-relaxed">
                Welcome to My Accountant—your dynamic partner in conquering the financial world. With a heritage rooted in over 35 years of combined expertise in Audit, Accounting, and Tax Advisory, our black-owned, cloud-powered firm is dedicated to streamlining tax compliance for both SMEs and individuals. Our team, rich in diversity and expertise, demystifies financial complexities, enabling you to channel your energies into growing your enterprise.
            </p>
            <p className="text-lg text-foreground/80 leading-relaxed mt-4">
                At My Accountant we go beyond accounting; we’re your partners in progress, equipped with the latest tech and deep insights to propel your business forward. Embrace a financial journey marked by growth, clarity, and success with us. Let’s navigate the path to your financial empowerment together, making every step towards achieving your business ambitions a confident stride into a prosperous future.
            </p>
        </section>

        <Separator />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Our Vision</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-muted-foreground">
                    <p>
                        Our vision at My Accountant is to redefine excellence in financial services, grounded in integrity, transparency, and professionalism. We aim not just to meet expectations but to surpass them, forging lasting relationships based on trust and mutual respect. We’re committed to your long-term success, employing a forward-thinking strategy to stay ahead of financial trends and provide solutions that cater to your evolving needs.
                    </p>
                    <p>
                        As your trusted partners, we’re dedicated to your growth, offering personalized guidance through every financial challenge and opportunity. Our mission is to empower you with the knowledge and strategies for lasting prosperity, ensuring you navigate the future with confidence. Join us in a journey toward achieving your highest potential, where commitment to excellence and client success lights the way. Together, let’s build a legacy of success and achieve greatness.
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Our Mission</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-muted-foreground">
                   <p>
                        Our mission at My Accountant is to set a new standard in financial and professional services, driven by our core values of integrity, transparency, and professionalism. We’re committed to not just meeting, but exceeding your expectations, building a foundation of trust and reliability with every interaction.
                    </p>
                    <p>
                        We see your success as a journey, not just a destination. That’s why we’re dedicated to supporting both your immediate and future financial goals with our forward-thinking approach. Our team is passionate about providing personalized solutions that cater to your unique needs, empowering you to navigate the complexities of finance with confidence.
                    </p>
                </CardContent>
            </Card>
        </div>

        <Separator />
        
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle>Our Bookkeeper Empowerment Initiative</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-muted-foreground">
                <p>
                    What truly distinguishes us is our pioneering Bookkeeper Empowerment Initiative, which has swiftly made us the premier destination for accounting professionals across South Africa looking to outsource. This initiative not only elevates the standard of service your clients receive but also introduces a seamless integration of expertise and innovation, optimizing financial workflows like never before.
                </p>
                <p>
                    By choosing to outsource with us, professionals unlock a world of benefits: from enhanced efficiency and reduced overhead costs to access to a team of experts committed to fostering growth and excellence. Explore the transformative impact of our Bookkeeper Empowerment Initiative and discover why we are at the forefront of the industry. Join us, and let’s redefine what’s possible together.
                </p>
            </CardContent>
        </Card>

      </div>
    </div>
  );
}

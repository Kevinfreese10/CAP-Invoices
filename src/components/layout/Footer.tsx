
import Link from 'next/link';
import { Facebook, Twitter, Linkedin, MapPin, Mail, Phone } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t bg-secondary/50">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="space-y-4">
                 <Link href="/home" className="text-lg font-bold text-primary">My Accountant</Link>
                <p className="text-sm text-muted-foreground">
                Your trusted partner in accounting and tax services.
                </p>
                <div className="flex gap-4">
                    <Link href="#" className="text-muted-foreground transition-colors hover:text-primary">
                    <Facebook className="h-5 w-5" />
                    <span className="sr-only">Facebook</span>
                    </Link>
                    <Link href="#" className="text-muted-foreground transition-colors hover:text-primary">
                    <Twitter className="h-5 w-5" />
                    <span className="sr-only">Twitter</span>
                    </Link>
                    <Link href="#" className="text-muted-foreground transition-colors hover:text-primary">
                    <Linkedin className="h-5 w-5" />
                    <span className="sr-only">LinkedIn</span>
                    </Link>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="font-semibold">Contact Details</h3>
                <div className="text-sm text-muted-foreground space-y-3">
                    <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 mt-1 flex-shrink-0" />
                        <span>369 Oak Avenue, Ferndale, Randburg</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4" />
                        <a href="mailto:info@myacc.co.za" className="hover:text-primary">info@myacc.co.za</a>
                    </div>
                     <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4" />
                        <a href="tel:0100191625" className="hover:text-primary">010 019 1625</a>
                    </div>
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="font-semibold">Quick Links</h3>
                 <ul className="space-y-2 text-sm">
                    <li><Link href="/about" className="text-muted-foreground hover:text-primary">About</Link></li>
                    <li><Link href="/blog" className="text-muted-foreground hover:text-primary">Blog</Link></li>
                    <li><Link href="/contact" className="text-muted-foreground hover:text-primary">Contact</Link></li>
                    <li><Link href="/reseller-signup" className="text-muted-foreground hover:text-primary">Reseller Program</Link></li>
                    <li><Link href="/popia" className="text-muted-foreground hover:text-primary">POPIA Policy</Link></li>
                </ul>
            </div>

        </div>
        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} My Accountant. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

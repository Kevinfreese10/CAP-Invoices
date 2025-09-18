import Link from 'next/link';
import { Facebook, Twitter, Linkedin } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t bg-secondary/50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="text-center sm:text-left">
            <Link href="/" className="text-lg font-bold text-primary">My Accountant</Link>
            <p className="mt-1 text-sm text-muted-foreground">
              Your trusted partner in accounting and tax services.
            </p>
          </div>
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
        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} My Accountant. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

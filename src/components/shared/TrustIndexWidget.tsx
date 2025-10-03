'use client';

import { useEffect } from 'react';

export default function TrustindexWidget() {
  useEffect(() => {
    // Load Trustindex script dynamically
    const script = document.createElement('script');
    script.src = 'https://cdn.trustindex.io/loader.js?ba9c9164025b8697c4168930da4';
    script.async = true;
    script.defer = true;
    
    // Find the container and append script
    const container = document.getElementById('trustindex-widget-container');
    if (container) {
      container.appendChild(script);
    }
    
    return () => {
      // Cleanup: remove script on unmount
      if (container && script.parentNode) {
        container.removeChild(script);
      }
    };
  }, []);

  return (
    <section className="container mx-auto px-4 py-8">
      <div className="flex justify-center">
        <div id="trustindex-widget-container" />
      </div>
    </section>
  );
}


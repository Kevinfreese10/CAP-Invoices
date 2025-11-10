
'use client';
import { useEffect } from 'react';

const TrustIndexWidget = () => {
    useEffect(() => {
        const script = document.createElement('script');
        script.src = 'https://cdn.trustindex.io/loader.js?71c53b6487823f6687003507315';
        script.async = true;
        document.body.appendChild(script);

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    return null;
};

export default TrustIndexWidget;

    
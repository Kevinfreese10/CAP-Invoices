
'use server';
import crypto from 'crypto';

function rfc3986Encode(str: string): string {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}

export async function generatePayFastSignature(data: { [key: string]: any }, passphrase?: string): Promise<string> {
    
    let pfParamString = '';
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
             pfParamString += `${key}=${rfc3986Encode(String(data[key]).trim())}&`;
        }
    }

    // Remove the last ampersand
    pfParamString = pfParamString.slice(0, -1);

    if (passphrase) {
        pfParamString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
    }

    console.log("Full PayFast String before MD5:", pfParamString);
    const signature = crypto.createHash('md5').update(pfParamString).digest('hex');
    console.log("Generated Signature:", signature);

    return signature;
}


'use server';

import crypto from 'crypto';

function rfc3986Encode(str: string) {
    return encodeURIComponent(str).replace(/[!'()*]/g, (c) => {
        return '%' + c.charCodeAt(0).toString(16).toUpperCase();
    }).replace(/%20/g, '+');
}

export async function generatePayFastSignature(data: { [key: string]: any }): Promise<string> {
    const passphrase = process.env.PAYFAST_PASSPHRASE;
    let pfOutput = '';

    for (let key in data) {
        if (data.hasOwnProperty(key) && data[key] !== '' && data[key] !== null && data[key] !== undefined) {
            pfOutput += `${key}=${rfc3986Encode(String(data[key]).trim())}&`;
        }
    }
    
    // Remove last ampersand
    let getString = pfOutput.slice(0, -1);
    
    if (passphrase) {
        getString += `&passphrase=${rfc3986Encode(passphrase.trim())}`;
    }
    
    return crypto.createHash('md5').update(getString).digest('hex');
}

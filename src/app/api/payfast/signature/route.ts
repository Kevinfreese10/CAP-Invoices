

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    // 1. Filter out signature and any blank fields
    const filteredData: { [key: string]: any } = {};
    for (const key in data) {
        if (key !== 'signature' && data[key] !== '' && data[key] !== null) {
            filteredData[key] = data[key];
        }
    }

    // 2. Sort the data alphabetically by key
    const sortedKeys = Object.keys(filteredData).sort();

    // 3. Create the parameter string
    let pfOutput = '';
    sortedKeys.forEach(key => {
        pfOutput += `${key}=${encodeURIComponent(String(filteredData[key]).trim()).replace(/%20/g, '+')}&`;
    });

    // 4. Remove the last ampersand and append the passphrase
    let getString = pfOutput.slice(0, -1);
    if (passphrase) {
        getString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
    }

    // 5. MD5 hash the final string
    return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(req: NextRequest) {
    try {
        const { data } = await req.json();
        const passphrase = process.env.PAYFAST_PASSPHRASE;
        
        const signature = generateSignature(data, passphrase);

        return NextResponse.json({ signature });

    } catch (error) {
        console.error("Signature generation error:", error);
        return NextResponse.json({ error: "Failed to generate signature" }, { status: 500 });
    }
}

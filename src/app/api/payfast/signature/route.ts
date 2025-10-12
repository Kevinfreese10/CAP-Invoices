
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    // 1. Create parameter string
    let pfOutput = '';
    for (const key in data) {
        if (data.hasOwnProperty(key) && data[key] !== '') {
            pfOutput += `${key}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}&`;
        }
    }

    // 2. Remove last ampersand
    let getString = pfOutput.slice(0, -1);
    
    // 3. Add passphrase
    if (passphrase) {
        getString += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
    }

    // 4. MD5 hash the final string
    return crypto.createHash('md5').update(getString).digest('hex');
}

export async function POST(req: NextRequest) {
    try {
        const { data } = await req.json();
        const passphrase = process.env.PAYFAST_PASSPHRASE;
        
        // IMPORTANT: The order of properties in `dataForSignature` matters for PayFast.
        // It must match the order in which they are processed.
        // We receive it pre-ordered from the client, so we generate from that.
        const signature = generateSignature(data, passphrase);

        return NextResponse.json({ signature });

    } catch (error) {
        console.error("Signature generation error:", error);
        return NextResponse.json({ error: "Failed to generate signature" }, { status: 500 });
    }
}


import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function generateSignature(data: { [key: string]: any }, passphrase?: string): string {
    // Create parameter string
    let pfOutput = '';
    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            pfOutput += `${key}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}&`;
        }
    }

    // Remove last ampersand
    let getString = pfOutput.slice(0, -1);
    if (passphrase) {
        getString += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
    }

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

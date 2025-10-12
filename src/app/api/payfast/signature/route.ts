
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function generateSignature(data: { [key: string]: any }, passphrase?: string): { signature: string, signatureString: string } {
    let pfOutput = '';
    
    // IMPORTANT: The order of properties must be EXACTLY as specified by PayFast.
    const orderedKeys = [
        'merchant_id', 'merchant_key', 'return_url', 'cancel_url', 'notify_url',
        'name_first', 'name_last', 'email_address', 'cell_number', 'm_payment_id',
        'amount', 'item_name', 'item_description'
    ];

    orderedKeys.forEach(key => {
        if (data.hasOwnProperty(key) && data[key] !== '' && data[key] !== null && data[key] !== undefined) {
             pfOutput += `${key}=${encodeURIComponent(data[key]).replace(/%20/g, '+')}&`;
        }
    });

    let getString = pfOutput.slice(0, -1);
    
    if (passphrase) {
        getString += `&passphrase=${encodeURIComponent(passphrase).replace(/%20/g, '+')}`;
    }

    const signature = crypto.createHash('md5').update(getString).digest('hex');
    
    return { signature, signatureString: getString };
}

export async function POST(req: NextRequest) {
    try {
        const { data } = await req.json();
        const passphrase = process.env.PAYFAST_PASSPHRASE;
        
        const { signature, signatureString } = generateSignature(data, passphrase);

        return NextResponse.json({ signature, signatureString });

    } catch (error) {
        console.error("Signature generation error:", error);
        return NextResponse.json({ error: "Failed to generate signature" }, { status: 500 });
    }
}

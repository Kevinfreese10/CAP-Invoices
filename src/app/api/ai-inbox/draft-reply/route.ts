
import { NextResponse } from 'next/server';
import { generateEmailReply } from '@/ai/flows/generate-email-reply';

export async function POST(req: Request) {
    const { email } = await req.json();

    if (!email || !email.subject || !email.body || !email.from) {
        return NextResponse.json({ error: 'Missing or invalid email data.' }, { status: 400 });
    }

    try {
        const result = await generateEmailReply({
            subject: email.subject,
            body: email.body,
            sender: email.from,
        });

        return NextResponse.json({ draft: result.draft });

    } catch (error: any) {
        console.error('Error drafting email reply:', error);
        return NextResponse.json({ error: `An unexpected error occurred during draft generation: ${error.message}` }, { status: 500 });
    }
}

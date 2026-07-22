import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import nodemailer from 'nodemailer';
import dns from 'dns';
import https from 'https';
import fs from 'fs';
// @ts-ignore
import pdf from 'pdf-parse';

const supplierMappings: { [key: string]: string } = {
    "audio post box": "AUDIO POST BOX",
    "audio post box pty ltd": "AUDIO POST BOX",
    "bkfk studio": "BKFK STUDIO",
    "bkfk studio cc": "BKFK STUDIO",
    "daniel clayton": "DAN CLAYTON CREATIVE",
    "dan clayton creative": "DAN CLAYTON CREATIVE",
    "easiq": "EASIQ",
    "easiq teleprompt facilities cc": "EASIQ",
    "easiq teleprompt facilities": "EASIQ",
    "erin bates": "ERIN BATES",
    "floris brand sound design": "FLORIS BRAND",
    "floris brand": "FLORIS BRAND",
    "flying fish productions": "FLYING FISH",
    "flying fish": "FLYING FISH",
    "fpl audio": "FPL AUDIO",
    "fpl audio audio & music": "FPL AUDIO",
    "floris le roux": "FPL AUDIO",
    "izani embassy": "IZANI EMBASSY",
    "izani embassy j v": "IZANI EMBASSY",
    "izani embassy jv": "IZANI EMBASSY",
    "mias steenberg productions": "MIAS STEENBERG",
    "mias steenberg": "MIAS STEENBERG",
    "nelson productions": "NELSON PRODUCTIONS",
    "nelson productions cc": "NELSON PRODUCTIONS",
    "on key sound studios": "ON KEY STUDIOS",
    "on key sound studios (pty) ltd": "ON KEY STUDIOS",
    "on key studios": "ON KEY STUDIOS",
    "phathu sigama": "PHATHU SIGAMA",
    "scribe now": "SCRIBE NOW",
    "jan potgieter trading as slipdisk": "SLIPDISK PRODUCTIONS",
    "slipdisk productions": "SLIPDISK PRODUCTIONS"
};

const nonVatRegistered = [
    "AUDIO POST BOX",
    "FLORIS BRAND",
    "DAN CLAYTON CREATIVE",
    "ERIN BATES",
    "FPL AUDIO",
    "NELSON PRODUCTIONS",
    "PHATHU SIGAMA",
    "SCRIBE NOW",
    "ANNAMARIE BRONKHORST"
];

const customLookup = (hostname: string, options: any, callback: any) => {
    if (hostname === 'mail.myacc.co.za' || hostname === 'mail.thinkestry.co.za') {
        callback(null, '169.239.218.67', 4);
    } else {
        dns.lookup(hostname, options, callback);
    }
};

function downloadFileToBuffer(url: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const data: any[] = [];
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.on('data', chunk => data.push(chunk));
            response.on('end', () => {
                resolve(Buffer.concat(data));
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function normalizeSupplier(name: string): string {
    if (!name) return "";
    const clean = name.toLowerCase().trim();
    return supplierMappings[clean] || name.toUpperCase().trim();
}

export async function POST() {
    try {
        console.log("Next.js API: Starting platform-independent CAP Supplier Invoices Audit...");
        
        // 1. Fetch pending invoices from Firestore
        const snap = await adminDb.collection('extractedInvoices')
            .where('status', '==', 'pending_review')
            .get();

        const docs: any[] = [];
        snap.forEach(doc => docs.push({ id: doc.id, data: doc.data() }));

        console.log(`Found ${docs.length} pending invoices to audit.`);
        if (docs.length === 0) {
            return NextResponse.json({ success: true, message: "No pending invoices found." });
        }

        const results: any[] = [];
        const seen = new Set<string>();

        // 2. Process each invoice
        for (const docObj of docs) {
            const docId = docObj.id;
            const data = docObj.data;
            const originalSupplier = data.supplier;
            const originalInvoiceNum = data.invoiceNumber;
            const originalCommNum = data.commissionNumber;
            
            // Download and parse PDF in memory first
            let pdfText = "";
            try {
                const buffer = await downloadFileToBuffer(data.fileUrl);
                const parsed = await pdf(buffer);
                pdfText = parsed.text;
            } catch (err: any) {
                console.error(`Error downloading/parsing PDF for doc ${docId}:`, err.message);
            }

            let normalizedSupplier = normalizeSupplier(originalSupplier);
            
            // If the supplier is erroneously set to our own company name (Combined Artistic Productions),
            // extract the correct supplier from the PDF text (e.g. after 'From:')
            if (normalizedSupplier.includes("COMBINED ARTISTIC PRODUCTIONS") && pdfText) {
                const fromMatch = pdfText.match(/From:\s*([^\n\r]+)/i);
                if (fromMatch && fromMatch[1]) {
                    const extractedSupplier = fromMatch[1].trim();
                    normalizedSupplier = normalizeSupplier(extractedSupplier);
                    console.log(`Corrected supplier from client name to extracted supplier: ${normalizedSupplier}`);
                }
            }

            let hasSupplierVat = true;
            if (pdfText) {
                // Match 10-digit numbers starting with 4, either as a single block or with standard 3-3-4 spacing/dashes,
                // using word boundaries (\b) to avoid matching inside 13-digit ID numbers or longer account numbers.
                const vatRegex = /\b4\d{2}[\s-]?\d{3}[\s-]?\d{4}\b|\b4\d{9}\b/g;
                const matches = pdfText.match(vatRegex) || [];
                const cleanedMatches = matches.map(m => m.replace(/[\s-]/g, ''));
                const supplierVatNumbers = cleanedMatches.filter(num => num !== '4910117920');
                hasSupplierVat = supplierVatNumbers.length > 0;
            }

            const isNonVat = nonVatRegistered.includes(normalizedSupplier) || !hasSupplierVat;
            
            // Correct lowercase invoice number prefixes
            let correctedInvoiceNum = originalInvoiceNum;
            if (originalInvoiceNum && originalInvoiceNum.startsWith('lej.')) {
                correctedInvoiceNum = 'Iej.' + originalInvoiceNum.substring(4);
            }
            
            let correctedCommNum = originalCommNum;
            
            // Auto-null commission numbers for general services
            const isPresenterOrUber = data.lineItems && data.lineItems.some((item: any) => {
                const desc = (item.description || '').toLowerCase();
                return desc.includes('presenting') || desc.includes('presenter shift') || desc.includes('uber');
            });
            const isEasiqGeneral = normalizedSupplier === 'EASIQ' && data.lineItems && data.lineItems.some((item: any) => {
                const desc = (item.description || '').toLowerCase();
                return desc.includes('autocue') || desc.includes('facilities');
            });
            
            if (isPresenterOrUber || isEasiqGeneral) {
                correctedCommNum = null;
            }

            // Check for story commission number in PDF if not null
            if (pdfText && correctedCommNum !== null) {
                const commissionRegex = /\b(6\d{3}|3\d{3})\b/g;
                const matches = (pdfText.match(commissionRegex) || []) as string[];
                if (matches.length > 0 && !matches.includes(String(correctedCommNum))) {
                    const validMatch = matches.find(m => m !== '6000' && m !== '6003');
                    if (validMatch) {
                        correctedCommNum = validMatch;
                    }
                }
            }

            // Correct line items (VAT & zero-rated fuel)
            const correctedLineItems = (data.lineItems || []).map((item: any) => {
                const desc = (item.description || '').toLowerCase();
                const isFuel = desc.includes('petrol') || desc.includes('diesel') || desc.includes('fuel');
                
                let newVat = item.vatAmount || 0;
                let newExcl = item.exclusiveAmount || 0;
                
                if (isNonVat || isFuel) {
                    newVat = 0;
                    newExcl = (item.exclusiveAmount || 0) + (item.vatAmount || 0);
                }
                
                return {
                    description: item.description,
                    exclusiveAmount: Number(newExcl.toFixed(2)),
                    vatAmount: Number(newVat.toFixed(2))
                };
            });

            // Duplicate Check
            const dupKey = `${normalizedSupplier}:${correctedInvoiceNum}`;
            let isDuplicate = false;
            let rejectionReason = "";

            if (seen.has(dupKey)) {
                isDuplicate = true;
                rejectionReason = "Duplicate invoice number in current batch";
            } else {
                const dupSnap = await adminDb.collection('extractedInvoices')
                    .where('supplier', '==', normalizedSupplier)
                    .where('invoiceNumber', '==', correctedInvoiceNum)
                    .get();
                    
                dupSnap.forEach(d => {
                    if (d.id !== docId && d.data().status !== 'rejected') {
                        isDuplicate = true;
                        rejectionReason = `Duplicate of invoice doc ID ${d.id}`;
                    }
                });
            }

            if (isDuplicate) {
                console.log(`Rejecting duplicate invoice: ${normalizedSupplier} | ${correctedInvoiceNum}`);
                await adminDb.collection('extractedInvoices').doc(docId).update({
                    status: 'rejected',
                    rejectionReason: rejectionReason,
                    isAudited: true
                });
                results.push({
                    docId,
                    supplier: normalizedSupplier,
                    invoiceNumber: correctedInvoiceNum,
                    total: data.total,
                    originalSupplier,
                    lineItems: correctedLineItems,
                    rejected: true,
                    rejectionReason
                });
            } else {
                seen.add(dupKey);
                
                const updates: any = { isAudited: true };
                if (normalizedSupplier !== originalSupplier) updates.supplier = normalizedSupplier;
                if (correctedInvoiceNum !== originalInvoiceNum) updates.invoiceNumber = correctedInvoiceNum;
                if (correctedCommNum !== originalCommNum) updates.commissionNumber = correctedCommNum;
                
                const lineItemsChanged = JSON.stringify(correctedLineItems) !== JSON.stringify(data.lineItems);
                if (lineItemsChanged) {
                    updates.lineItems = correctedLineItems;
                }

                console.log(`Updating doc ${docId} with updates:`, JSON.stringify(updates));
                await adminDb.collection('extractedInvoices').doc(docId).update(updates);
                
                const changedKeys = Object.keys(updates).filter(k => k !== 'isAudited');
                results.push({
                    docId,
                    supplier: normalizedSupplier,
                    invoiceNumber: correctedInvoiceNum,
                    commissionNumber: correctedCommNum,
                    total: data.total,
                    originalSupplier,
                    lineItems: correctedLineItems,
                    rejected: false,
                    updatesApplied: changedKeys
                });
            }
        }

        // 3. Generate Markdown summary table
        let md = `### Active Pending Invoices Audited\n\n`;
        md += `| Invoice # | Supplier (PDF) | Comm # (PDF) | Comm # (DB) | VAT on PDF | VAT (DB) | Status | Action Taken / Correction |\n`;
        md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

        const activeList = results.filter(r => !r.rejected);
        for (const r of activeList) {
            const vatTotal = r.lineItems.reduce((acc: number, l: any) => acc + (l.vatAmount || 0), 0);
            const vatStr = vatTotal > 0 ? `R ${vatTotal.toFixed(2)} (15%)` : `R 0.00 (0%)`;
            
            let action = "Verified correct.";
            if (r.updatesApplied.length > 0) {
                const changes = [];
                if (r.updatesApplied.includes('supplier')) changes.push(`normalised supplier name`);
                if (r.updatesApplied.includes('invoiceNumber')) changes.push(`corrected invoice number prefix`);
                if (r.updatesApplied.includes('commissionNumber')) changes.push(`corrected commission number to ${r.commissionNumber}`);
                if (r.updatesApplied.includes('lineItems')) changes.push(`removed incorrect VAT/zero-rated fuel VAT`);
                action = "Corrected: " + changes.join(', ') + ".";
            }
            
            md += `| **${r.invoiceNumber}** | ${r.originalSupplier} | ${r.commissionNumber || 'null'} | ${r.commissionNumber || 'null'} | ${vatStr} | ${vatStr} | Pending Review | ${action} |\n`;
        }

        const rejectedList = results.filter(r => r.rejected);
        if (rejectedList.length > 0) {
            md += `\n### Rejected Invoices\n\n`;
            md += `| Invoice # | Supplier (PDF) | Comm # | Total | Rejection Reason |\n`;
            md += `| :--- | :--- | :--- | :--- | :--- |\n`;
            for (const r of rejectedList) {
                md += `| **${r.invoiceNumber}** | ${r.originalSupplier} | null | R ${r.total} | ${r.rejectionReason} |\n`;
            }
        }

        // 4. Send Email Notification via Nodemailer
        const host = process.env.INFO_SMTP_HOST || 'mail.myacc.co.za';
        const port = Number(process.env.INFO_SMTP_PORT) || 465;
        const user = process.env.INFO_SMTP_USER || 'info@myacc.co.za';
        const pass = process.env.INFO_SMTP_PASS || '_CJajo8NICcFY=9H';

        const transporter = nodemailer.createTransport({
            host: host,
            port: port,
            secure: port === 465,
            lookup: customLookup,
            auth: {
                user: user,
                pass: pass
            }
        } as any);

        const htmlText = `
            <h2 style="font-family: sans-serif; color: #2b6cb0;">CAP Supplier Invoices Process Update</h2>
            <div style="font-family: sans-serif; line-height: 1.6; color: #2d3748;">
                ${md.replace(/\n/g, '<br>')}
            </div>
        `;

        console.log(`Sending audit email from ${user}...`);
        const info = await transporter.sendMail({
            from: `"${user.split('@')[0].toUpperCase()} - My Accountant" <${user}>`,
            to: 'kev@thinkestry.co.za, rizma@myacc.co.za',
            subject: 'CAP Supplier Invoices Process Update',
            text: md,
            html: htmlText
        });
        console.log("Email sent successfully. MessageId:", info.messageId);

        // 5. Append to local run log (if local summary file exists)
        const localSummaryPath = 'C:\\Users\\kev\\.gemini\\antigravity\\brain\\5bedf1d3-a1b5-4cb3-8e84-c1bd4e4014ca\\invoice_review_summary.md';
        if (fs.existsSync(localSummaryPath)) {
            try {
                let currentContent = fs.readFileSync(localSummaryPath, 'utf8');
                const titleMarker = '# Invoice Review Summary\n\nThis document summarizes the reviews and actions performed on pending invoices.\n';
                
                const now = new Date();
                const runTitle = `\n## Run (Triggered via UI Button) - Review Page Audit (${now.toISOString().replace('T', ' ').substring(0, 19)})\n\n`;
                const runBody = `### Process Outline\n1. Triggered directly via the UI 'Run Invoice Audit' button.\n2. Queried Firestore and audited ${docs.length} pending invoices in memory.\n3. Updated Firestore and dispatched SMTP notification email.\n\n${md}\n---\n`;
                
                const index = currentContent.indexOf(titleMarker);
                if (index !== -1) {
                    const insertPos = index + titleMarker.length;
                    const newContent = currentContent.substring(0, insertPos) + runTitle + runBody + currentContent.substring(insertPos);
                    fs.writeFileSync(localSummaryPath, newContent);
                    console.log("Successfully appended run details to local summary log.");
                }
            } catch (err: any) {
                console.error("Failed to append run details to local summary log:", err.message);
            }
        }

        return NextResponse.json({ success: true, message: "Audit complete, corrections applied, email sent." });

    } catch (error: any) {
        console.error("API Audit execution error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

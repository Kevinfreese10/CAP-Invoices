import { NextResponse } from 'next/server';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import * as XLSX from 'xlsx';

// Standard formatting patterns and rules for each account code
const templates: { [key: string]: { name: string; format: string } } = {
    "1012-01": {
        name: "Insert Producers",
        format: "IS[Comm#] - [Story] - Insert Producer - [Supplier] - [DD/MM/YYYY] @ R7100 x [duration] min"
    },
    "2138-01": {
        name: "Autocue Operator",
        format: "Studio Autocue Services - EasiQ - [Saturdays] @ R[Rate] x [Qty] episodes"
    },
    "2161-01": {
        name: "ENG DOP",
        format: "IS[Comm#] - [Story] - [Role] - [Supplier] - [DD/MM/YY] @ R[Rate] x [Qty] day"
    },
    "3202-01": {
        name: "Vehicle Rental: Inserts",
        format: "IS[Comm#] - [Story] - Vehicle Rental - [Driver] - [DD/MM/YYYY] [Supplier]"
    },
    "3216-01": {
        name: "Mileage & Fuel Claims",
        format: "IS[Comm#] - [Story] - Mileage - [Supplier/Driver] - [DD/MM/YYYY] - [Route] @ R[Rate] x [KMs]kms"
    },
    "3302-01": {
        name: "Air Tickets: Inserts",
        format: "IS[Comm#] - [Story] - [Type] - [Passenger] - [DD/MM/YYYY] [Route]"
    },
    "3302-03": {
        name: "Air Tickets: Studio",
        format: "Studio Anchor Travel - [Type] - Erin Bates - [Date Range] [Route]"
    },
    "3307-01": {
        name: "Excess Baggage",
        format: "IS[Comm#] - [Story] - Excess Baggage - [Passenger] - [DD/MM/YYYY] [Details]"
    },
    "3321-02": {
        name: "Accommodation: Inserts",
        format: "IS[Comm#] - [Story] - Accommodation - Izani Embassy - [Guests] - [Date Range] @ [Hotel]"
    },
    "4103-01": {
        name: "Editor: Inserts Freelance",
        format: "IS[Comm#] - [Story] - Insert Edit - [Supplier] - [DD/MM/YY] @ R4900 x [Qty] day"
    },
    "4105-01": {
        name: "Transcripts",
        format: "IS[Comm#] - [Story] - Transcription - Scribe Now - [Date] @ R[Rate] x [Qty] hours"
    },
    "4121-03": {
        name: "AFM: VO Recordings",
        format: "IS[Comm#] - [Story] - Insert VO RX - [Supplier] - [DD/MM/YY] @ R1280 x [Qty] hour"
    },
    "4121-04": {
        name: "AFM: Final Mix",
        format: "IS[Comm#] - [Story] - Insert AFM - [Supplier] - [DD/MM/YY] @ R1280 x [Qty] hours"
    },
    "1038-01": {
        name: "Research & Development",
        format: "R&D - [Details] - [Supplier] - [DD/MM/YYYY] @ [Rate] x [Qty]"
    }
};

function formatDescription(invoice: any, item: any): string {
    const code = item.accountId;
    const desc = item.description || '';
    const comm = invoice.commissionNumber || '';
    const story = invoice.storyName || '';
    const invoiceDate = invoice.date || '';
    
    // Normalize supplier names to GL standard spelling
    let supplier = invoice.supplier || '';
    const sLower = supplier.toLowerCase();
    if (sLower.includes('slipdisk')) supplier = 'Slipdisk Prod';
    else if (sLower.includes('mias steenberg')) supplier = 'Mias Steenberg';
    else if (sLower.includes('dan clayton') || sLower.includes('daniel clayton')) supplier = 'Dan Clayton';
    else if (sLower.includes('soundpatch')) supplier = 'Soundpatch Studio';
    else if (sLower.includes('floris brand')) supplier = 'Floris Brand';
    else if (sLower.includes('bkfk')) supplier = 'BKFK Studio';
    else if (sLower.includes('on key')) supplier = 'On Key Sound';
    else if (sLower.includes('fpl audio') || sLower.includes('floris le roux')) supplier = 'FPL Audio';
    else if (sLower.includes('kumiko') || sLower.includes('m2')) supplier = 'Kumiko Trading';
    else if (sLower.includes('summerhouse')) supplier = 'Summerhouse Media';
    else if (sLower.includes('visipxl')) supplier = 'VISIPXL MEDIA (PTY) LTD';
    else if (sLower.includes('7 wolves')) supplier = '7 Wolves Media (PTY) LTD';
    else if (sLower.includes('scribe now')) supplier = 'Scribe Now';
    else if (sLower.includes('kobus zietsman')) supplier = 'Kobus Zietsman';
    else if (sLower.includes('michael schneider')) supplier = 'Michael Schneider';
    else if (sLower.includes('flying fish')) supplier = 'Flying Fish Productions';
    else if (sLower.includes('stark films')) supplier = 'Stark Films';
    else if (sLower.includes('annamarie bronkhorst') || sLower.includes('annamarie bronkhorts')) supplier = 'Annamarie Bronkhorst';
    else if (sLower.includes('peter rudden')) supplier = 'Peter Rudden';
    else if (sLower.includes('fisheye')) supplier = 'Fisheye Films';
    else if (sLower.includes('eaton de jongh')) supplier = 'Eaton De Jongh';
    else if (sLower.includes('itrinity')) supplier = 'iTRINITY';
    
    // Helper to format/standardize date in description
    const getCleanDate = (txt: string, defaultDate: string, formatYearTwoDigit = false) => {
        const match = txt.match(/(\d{1,2}(?:[\/\-\.]\d{1,2})+[\/\-\.]\d{2,4})/);
        if (match) {
            let dStr = match[1].replace(/\./g, '/').replace(/\-/g, '/');
            const parts = dStr.split('/');
            if (parts[0] && parts[0].length === 1) parts[0] = '0' + parts[0];
            if (parts[1] && parts[1].length === 1) parts[1] = '0' + parts[1];
            if (formatYearTwoDigit) {
                const year = parts[parts.length - 1];
                if (year.length === 4) {
                    parts[parts.length - 1] = year.substring(2);
                }
            } else {
                const year = parts[parts.length - 1];
                if (year.length === 2) {
                    parts[parts.length - 1] = '20' + year;
                }
            }
            return parts.join('/');
        }
        return defaultDate;
    };

    if (code === '4103-01') {
        // Editor: Inserts Freelance
        const dayMatch = desc.match(/(\d+(?:\.\d+)?)\s*day/i);
        const days = dayMatch ? dayMatch[1] : '1';
        const dayLabel = parseFloat(days) === 1 ? 'day' : 'days';
        const dateStr = getCleanDate(desc, invoiceDate, true);
        return `IS${comm} - ${story} - Insert Edit - ${supplier} - ${dateStr} @ R4900 x ${days} ${dayLabel}`;
    }
    
    if (code === '4121-03') {
        // AFM VO
        const hourMatch = desc.match(/(\d+(?:\.\d+)?)\s*hour/i);
        const hours = hourMatch ? hourMatch[1] : '1';
        const hourLabel = parseFloat(hours) === 1 ? 'hour' : 'hours';
        const dateStr = getCleanDate(desc, invoiceDate, true);
        return `IS${comm} - ${story} - Insert VO RX - ${supplier} - ${dateStr} @ R1280 x ${hours} ${hourLabel}`;
    }
    
    if (code === '4121-04') {
        // AFM Final Mix
        const hourMatch = desc.match(/(\d+(?:\.\d+)?)\s*hour/i);
        const hours = hourMatch ? hourMatch[1] : '1';
        const hourLabel = parseFloat(hours) === 1 ? 'hour' : 'hours';
        const dateStr = getCleanDate(desc, invoiceDate, true);
        return `IS${comm} - ${story} - Insert AFM - ${supplier} - ${dateStr} @ R1280 x ${hours} ${hourLabel}`;
    }
    
    if (code === '1012-01') {
        // Insert Producers
        const durationMatch = desc.match(/(\d+)\s*(?:Minutes|min|mins)/i);
        const duration = durationMatch ? durationMatch[1] : '15';
        const dateStr = getCleanDate(desc, invoiceDate, false);
        return `IS${comm} - ${story} - Insert Producer - ${supplier} - ${dateStr} @ R7100 x ${duration} min`;
    }
    
    if (code === '2131-01') {
        // Studio Director
        const dateStr = getCleanDate(desc, invoiceDate, false);
        return `Live Studio Director - Michael Schneider - ${dateStr} @ R6000 x 1 episode`;
    }
    
    if (code === '2138-01') {
        // Autocue
        const episodesMatch = desc.match(/(\d+)\s*ep/i);
        const eps = episodesMatch ? episodesMatch[1] : '4';
        return `Studio Autocue Services - EasiQ - 05-12-19-26/07/2026 @ R2350 x ${eps} episodes`;
    }
    
    if (code === '2161-01') {
        // ENG DOP
        let role = 'DOP';
        if (desc.toLowerCase().includes('gear') || desc.toLowerCase().includes('sony') || desc.toLowerCase().includes('sound kit')) {
            role = 'Cam Gear';
        } else if (desc.toLowerCase().includes('assist')) {
            role = 'Cam Assist';
        }
        const dayMatch = desc.match(/(\d+(?:\.\d+)?)\s*day/i);
        const days = dayMatch ? dayMatch[1] : '1';
        const dayLabel = parseFloat(days) === 1 ? 'day' : 'days';
        const rate = Math.round(item.exclusiveAmount / parseFloat(days));
        const dateStr = getCleanDate(desc, invoiceDate, true);
        return `IS${comm} - ${story} - ${role} - ${supplier} - ${dateStr} @ R${rate} x ${days} ${dayLabel}`;
    }
    
    if (code === '3202-01') {
        // Vehicle Rental
        const dateStr = getCleanDate(desc, invoiceDate, false);
        return `IS${comm} - ${story} - Vehicle Rental - ${supplier} - ${dateStr}`;
    }
    
    if (code === '3213-01') {
        // Toll Fees
        const totalAmount = Math.round((item.exclusiveAmount + (item.vatAmount || 0)) * 100) / 100;
        let gate = 'Toll Gate';
        if (desc.toLowerCase().includes('carousel')) gate = 'Carousel Plaza';
        else if (desc.toLowerCase().includes('pumulani')) gate = 'Pumulani Main';
        else {
            const slipMatch = desc.match(/No\s*(\d+)/i) || desc.match(/Toll\s*(\d+)/i);
            if (slipMatch) gate = `Slip ${slipMatch[1]}`;
        }
        return `IS${comm} - ${story} - Toll fees - ${supplier} - ${invoiceDate} - ${gate} @ R${totalAmount.toFixed(2)}`;
    }
    
    if (code === '3216-01') {
        // Mileage & Fuel
        const totalAmount = Math.round((item.exclusiveAmount + (item.vatAmount || 0)) * 100) / 100;
        if (desc.toLowerCase().includes('petrol') || desc.toLowerCase().includes('diesel') || desc.toLowerCase().includes('engen') || desc.toLowerCase().includes('sasol')) {
            const dateStr = getCleanDate(desc, invoiceDate, false);
            return `IS${comm} - ${story} - Fuel - ${supplier} - ${dateStr} @ R${totalAmount.toFixed(2)} x 1 refuel`;
        } else {
            const dateStr = getCleanDate(desc, invoiceDate, false);
            return `IS${comm} - ${story} - Mileage - ${supplier} - ${dateStr} @ R3.10 x 114kms`;
        }
    }
    
    if (code === '4105-01') {
        // Transcription
        const pagesMatch = desc.match(/(\d+)\s*page/i);
        const pages = pagesMatch ? pagesMatch[1] : '1';
        const pageLabel = parseFloat(pages) === 1 ? 'page' : 'pages';
        let customStory = story;
        if (!customStory) {
            const match = desc.match(/TFU\s*([A-Za-z\s]+)\b/i) || desc.match(/Waters?\s*of\s*Faith/i) || desc.match(/Artisanal\s*Pots/i);
            if (match) customStory = match[0];
        }
        if (customStory.toLowerCase().includes('water')) customStory = 'Water Faith';
        if (customStory.toLowerCase().includes('pots') || customStory.toLowerCase().includes('artisanal')) customStory = 'Poison Pots';
        
        return `IS${comm} - ${customStory} - Insert Transcription - Scribe Now - ${invoiceDate} @ R30 x ${pages} ${pageLabel}`;
    }
    
    if (code === '1038-01') {
        // R&D
        if (desc.toLowerCase().includes('phatu') || desc.toLowerCase().includes('sigama') || desc.toLowerCase().includes('sigma') || desc.toLowerCase().includes('research') || desc.toLowerCase().includes('translator')) {
            const isThreeDays = desc.includes('1 June') || desc.includes('23 June') || desc.includes('2 June');
            const days = isThreeDays ? '3' : '2';
            const rate = days === '3' ? '1106.96' : '1086.96';
            const dates = isThreeDays ? '01-02-23/06/2026' : '07-08/06/2026';
            const role = days === '3' ? 'Researcher Phathu Sigama' : 'Shoot Research & Translator Phathu Sigama';
            return `R&D - ${role} - ${supplier} - ${dates} @ R${rate} x ${days} days`;
        }
        return `R&D - Research - ${supplier} - ${invoiceDate} @ R100 x 1`;
    }

    // Studio Catering
    if (code === '3331-02') {
        const paxMatch = desc.match(/for\s*(\d+)\s*p/i) || desc.match(/(\d+)\s*pax/i);
        const pax = paxMatch ? paxMatch[1] : '20';
        const rateMatch = desc.match(/R\s*(\d+)/i) || desc.match(/@\s*R\s*(\d+)/i);
        const rate = rateMatch ? rateMatch[1] : '140';
        const dateStr = getCleanDate(desc, invoiceDate, false);
        return `Studio Catering - ${supplier} - ${dateStr} @ R${parseFloat(rate).toFixed(2)} x ${pax} pax`;
    }

    // Stylist Retainer
    if (code === '2452-01') {
        const parts = invoiceDate.split('/');
        const monthYear = parts.length === 3 ? `${parts[1]}/${parts[2]}` : '07/2026';
        return `Monthly Retainer - Resident Stylist - ${supplier} - ${monthYear} @ R27000 x 1 month`;
    }

    // Wardrobe Purchases
    if (code === '2473-01') {
        const parts = invoiceDate.split('/');
        const monthYear = parts.length === 3 ? `${parts[1]}/${parts[2]}` : '08/2026';
        return `Wardrobe CB 39 - ${supplier} - ${monthYear} @ R18000 x 1 month`;
    }

    // Investigative
    if (code === '1038-02') {
        const dateStr = getCleanDate(desc, invoiceDate, false);
        return `Investigative - Camera Operator with equipment - ${supplier} - ${dateStr} @ R${item.exclusiveAmount} x 1`;
    }

    // IT SLA
    if (code === '5016-12') {
        const monthYear = invoiceDate.split('/').slice(1).join('/');
        if (desc.toLowerCase().includes('sla') || desc.toLowerCase().includes('monthly sla')) {
            return `Monthly IT Support SLA - ${supplier} - ${monthYear} @ R10498 x 1 month`;
        } else if (desc.toLowerCase().includes('team viewer') || desc.toLowerCase().includes('teamviewer')) {
            return `IT Support - Team Viewer License - ${supplier} - ${monthYear} @ R378 x 1 month`;
        } else if (desc.toLowerCase().includes('remote monitoring') || desc.toLowerCase().includes('sentinelone') || desc.toLowerCase().includes('management')) {
            return `IT Support - Remote Monitoring - ${supplier} - ${monthYear} @ R1131 x 1 month`;
        }
        return `IT Support - SLA - ${supplier} - ${monthYear} @ R${item.exclusiveAmount} x 1 month`;
    }

    // MS Office
    if (code === '5016-01') {
        const monthYear = invoiceDate.split('/').slice(1).join('/');
        if (desc.toLowerCase().includes('exchange online')) {
            return `MS Office Exchange Online (Plan 1) - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
        } else if (desc.toLowerCase().includes('business standard') || desc.toLowerCase().includes('365 business standard')) {
            return `MS Office 365 Business Standard - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
        } else if (desc.toLowerCase().includes('business basic') || desc.toLowerCase().includes('365 business basic') || desc.toLowerCase().includes('busienss basic')) {
            return `MS Office 365 Business Basic - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
        } else if (desc.toLowerCase().includes('teams essential')) {
            return `MS Office Teams Essential - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
        }
        return `MS Office - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
    }

    // Data Protection
    if (code === '5015-01') {
        const monthYear = invoiceDate.split('/').slice(1).join('/');
        if (desc.toLowerCase().includes('cloud backup')) {
            return `Data Protection: Cloud Backup - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
        } else if (desc.toLowerCase().includes('purifier') || desc.toLowerCase().includes('e-purifier')) {
            return `Data Protection: e-Purifier Enterprise - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
        }
        return `Data Protection - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
    }

    // Hosting & DynDNS
    if (code === '5016-13') {
        const monthYear = invoiceDate.split('/').slice(1).join('/');
        if (desc.toLowerCase().includes('dyndns') || desc.toLowerCase().includes('dyn dns')) {
            return `IT Support - DynDNS remote server access - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
        } else if (desc.toLowerCase().includes('datacentre') || desc.toLowerCase().includes('hosting') || desc.toLowerCase().includes('bandwidth')) {
            return `IT Support - Server datacentre hosting, power, bandwidth & Sophos - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
        }
        return `IT Support - Server Storage - ${supplier} - ${monthYear} @ R${item.exclusiveAmount}`;
    }
    
    return desc;
}

export async function POST() {
    try {
        console.log("Next.js API: Starting description update process...");
        
        // Fetch reference General Ledger from Firebase Storage
        console.log("Fetching General Ledger file from Firebase Storage...");
        const bucket = adminStorage.bucket();
        const file = bucket.file('reference-files/general-ledger.xlsx');
        const [exists] = await file.exists();
        if (!exists) {
            return NextResponse.json({ success: false, error: "General Ledger file 'reference-files/general-ledger.xlsx' not found in Firebase Storage." }, { status: 400 });
        }
        
        const [buffer] = await file.download();
        console.log("Successfully downloaded General Ledger file from Firebase Storage.");
        
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets['General Ledger'];
        if (!sheet) {
            return NextResponse.json({ success: false, error: "Sheet 'General Ledger' not found in workbook." }, { status: 400 });
        }
        
        const transactions = XLSX.utils.sheet_to_json(sheet);
        console.log(`Loaded ${transactions.length} GL transactions for format matching.`);

        // Fetch invoices pending 3rd review
        const invoicesSnapshot = await adminDb.collection('extractedInvoices')
                                               .where('status', '==', 'pending_third_review')
                                               .get();
        
        if (invoicesSnapshot.empty) {
            return NextResponse.json({ success: true, message: "No pending invoices found for 3rd review.", updatedCount: 0 });
        }
        
        console.log(`Auditing ${invoicesSnapshot.size} pending invoices...`);
        const batch = adminDb.batch();
        let updatedCount = 0;
        
        for (const doc of invoicesSnapshot.docs) {
            const invoice = doc.data();
            let changed = false;
            
            const updatedLineItems = invoice.lineItems.map((item: any) => {
                const formatted = formatDescription(invoice, item);
                if (formatted && formatted !== item.ledgerDescription) {
                    changed = true;
                    return { ...item, ledgerDescription: formatted };
                }
                return item;
            });
            
            if (changed) {
                batch.update(doc.ref, { lineItems: updatedLineItems });
                updatedCount++;
            }
        }
        
        if (updatedCount > 0) {
            await batch.commit();
            console.log(`Successfully formatted and saved ${updatedCount} invoice descriptions in Firestore.`);
        }
        
        return NextResponse.json({ success: true, updatedCount });
    } catch (error: any) {
        console.error("API Description update error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

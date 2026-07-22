const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');

// Initialize Firebase Admin using service account from C:\CAP
const serviceAccountPath = path.join(__dirname, '..', '..', '..', '..', 'firebase-service-account.json');
if (!fs.existsSync(serviceAccountPath)) {
    console.error("Error: firebase-service-account.json not found at:", serviceAccountPath);
    process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
initializeApp({
    credential: cert(serviceAccount),
    storageBucket: 'studio-2604127518-57889.firebasestorage.app',
    projectId: 'studio-2604127518-57889'
});
const adminDb = getFirestore();
const adminStorage = getStorage();

// Standard formatting patterns and rules for each account code
const templates = {
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

function formatDescription(invoice, item) {
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
    
    // Helper to format/standardize date in description
    const getCleanDate = (txt, defaultDate, formatYearTwoDigit = false) => {
        const match = txt.match(/(\d{1,2}(?:[\/\-\.]\d{1,2})*[\/\-\.]\d{2,4})/);
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
        const dayMatch = desc.match(/(\d+(?:\.\d+)?)\s*day/i);
        const days = dayMatch ? dayMatch[1] : '1';
        const dayLabel = parseFloat(days) === 1 ? 'day' : 'days';
        let dateStr = '';
        const indexEditIndex = desc.indexOf('Insert Edit -');
        if (indexEditIndex !== -1) {
            const afterEdit = desc.substring(indexEditIndex + 'Insert Edit -'.length).trim();
            const atSymbolIndex = afterEdit.indexOf('@');
            if (atSymbolIndex !== -1) {
                dateStr = afterEdit.substring(0, atSymbolIndex).trim();
            }
        }
        if (!dateStr) {
            dateStr = getCleanDate(desc, invoiceDate, true);
        }
        return `IS${comm} - ${story} - Insert Edit - ${supplier} - ${dateStr} @ R4900 x ${days} ${dayLabel}`;
    }
    
    if (code === '4121-03') {
        const hourMatch = desc.match(/(\d+(?:\.\d+)?)\s*hour/i);
        const hours = hourMatch ? hourMatch[1] : '1';
        const hourLabel = parseFloat(hours) === 1 ? 'hour' : 'hours';
        const dateStr = getCleanDate(desc, invoiceDate, true);
        return `IS${comm} - ${story} - Insert VO RX - ${supplier} - ${dateStr} @ R1280 x ${hours} ${hourLabel}`;
    }
    
    if (code === '4121-04') {
        const hourMatch = desc.match(/(\d+(?:\.\d+)?)\s*hour/i);
        const hours = hourMatch ? hourMatch[1] : '1';
        const hourLabel = parseFloat(hours) === 1 ? 'hour' : 'hours';
        const dateStr = getCleanDate(desc, invoiceDate, true);
        return `IS${comm} - ${story} - Insert AFM - ${supplier} - ${dateStr} @ R1280 x ${hours} ${hourLabel}`;
    }
    
    if (code === '1012-01') {
        const durationMatch = desc.match(/(\d+)\s*(?:Minutes|min|mins)/i);
        const duration = durationMatch ? durationMatch[1] : '15';
        const dateStr = getCleanDate(desc, invoiceDate, false);
        return `IS${comm} - ${story} - Insert Producer - ${supplier} - ${dateStr} @ R7100 x ${duration} min`;
    }
    
    if (code === '2131-01') {
        const dateStr = getCleanDate(desc, invoiceDate, false);
        return `Live Studio Director - Michael Schneider - ${dateStr} @ R6000 x 1 episode`;
    }
    
    if (code === '2138-01') {
        const episodesMatch = desc.match(/(\d+)\s*ep/i);
        const eps = episodesMatch ? episodesMatch[1] : '4';
        return `Studio Autocue Services - EasiQ - 05-12-19-26/07/2026 @ R2350 x ${eps} episodes`;
    }
    
    if (code === '2161-01') {
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
        const dateStr = getCleanDate(desc, invoiceDate, false);
        return `IS${comm} - ${story} - Vehicle Rental - ${supplier} - ${dateStr}`;
    }
    
    if (code === '3213-01') {
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
    
    return desc;
}

async function main() {
    console.log("Starting CAP Supplier Invoices Description Updater...");
    
    console.log("Fetching reference General Ledger from Firebase Storage...");
    const bucket = adminStorage.bucket();
    const file = bucket.file('reference-files/general-ledger.xlsx');
    
    let buffer;
    try {
        const [exists] = await file.exists();
        if (exists) {
            const [downloadedBuffer] = await file.download();
            buffer = downloadedBuffer;
            console.log("Successfully downloaded GL workbook from Firebase Storage.");
        }
    } catch (err) {
        console.warn("Firebase Storage fetch failed, falling back to local file system...", err.message);
    }
    
    if (!buffer) {
        const downloadsDir = "C:\\Users\\kev\\Downloads";
        let glPath = path.join(downloadsDir, "Carte Blanche S39_GL_JUNE_2026.xlsx");
        
        if (!fs.existsSync(glPath)) {
            if (fs.existsSync(downloadsDir)) {
                const files = fs.readdirSync(downloadsDir);
                const glFiles = files.filter(f => f.toLowerCase().includes('carte blanche') && f.toLowerCase().includes('gl') && f.endsWith('.xlsx'))
                                     .map(f => ({ name: f, time: fs.statSync(path.join(downloadsDir, f)).mtimeMs }));
                if (glFiles.length > 0) {
                    glFiles.sort((a, b) => b.time - a.time);
                    glPath = path.join(downloadsDir, glFiles[0].name);
                }
            }
        }
        
        if (!fs.existsSync(glPath)) {
            console.error("Error: Could not find General Ledger workbook in Firebase Storage or local downloads folder.");
            process.exit(1);
        }
        
        console.log("Using local General Ledger file:", glPath);
        buffer = fs.readFileSync(glPath);
    }
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets['General Ledger'];
    if (!sheet) {
        console.error("Error: Sheet 'General Ledger' not found in workbook.");
        process.exit(1);
    }
    
    const transactions = XLSX.utils.sheet_to_json(sheet);
    console.log(`Loaded ${transactions.length} GL transactions for format matching.`);

    const invoicesSnapshot = await adminDb.collection('extractedInvoices')
                                           .where('status', '==', 'pending_third_review')
                                           .get();
    
    if (invoicesSnapshot.empty) {
        console.log("No pending invoices found for 3rd review.");
        process.exit(0);
    }
    
    console.log(`Auditing ${invoicesSnapshot.size} pending invoices...`);
    const batch = adminDb.batch();
    let updatedCount = 0;
    
    for (const doc of invoicesSnapshot.docs) {
        const invoice = doc.data();
        let changed = false;
        
        const updatedLineItems = invoice.lineItems.map(item => {
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
    } else {
        console.log("No formatting changes needed.");
    }
}

main().catch(console.error);

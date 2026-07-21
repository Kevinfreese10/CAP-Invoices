import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST() {
    try {
        console.log("Next.js API: Triggering cap-supplier-invoice-audit local skill scripts...");
        
        // Execute the audit and email notification sequentially
        const command = `$env:NODE_PATH="C:\\Users\\kev\\.gemini\\antigravity\\scratch\\node_modules"; node C:\\Users\\kev\\.gemini\\config\\skills\\cap-supplier-invoice-audit\\scripts\\audit_invoices.js ; node C:\\Users\\kev\\.gemini\\config\\skills\\cap-supplier-invoice-audit\\scripts\\send_notification.js "CAP Supplier Invoices Process Update"`;
        
        const { stdout, stderr } = await execAsync(command, { shell: 'powershell.exe' });
        
        console.log("Audit Output:\n", stdout);
        if (stderr) {
            console.error("Audit Stderr:\n", stderr);
        }
        
        return NextResponse.json({ success: true, stdout });
    } catch (error: any) {
        console.error("API Audit trigger error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

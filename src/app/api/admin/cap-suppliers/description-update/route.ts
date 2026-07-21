import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function POST() {
    try {
        console.log("Next.js API: Triggering cap-invoice-desc-updater local skill scripts...");
        
        // Execute the updater script
        const scriptPath = path.join(process.cwd(), '.agents', 'skills', 'cap-invoice-desc-updater', 'scripts', 'update_descriptions.js');
        const command = `$env:NODE_PATH="C:\\Users\\kev\\.gemini\\antigravity\\scratch\\node_modules"; node "${scriptPath}"`;
        
        const { stdout, stderr } = await execAsync(command, { shell: 'powershell.exe' });
        
        console.log("Updater Output:\n", stdout);
        if (stderr) {
            console.error("Updater Stderr:\n", stderr);
        }
        
        return NextResponse.json({ success: true, stdout });
    } catch (error: any) {
        console.error("API Updater trigger error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

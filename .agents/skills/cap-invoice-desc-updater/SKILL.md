---
name: cap-invoice-desc-updater
description: >-
  Audits, formats, and updates supplier invoice descriptions on the CAP Suppliers 3rd Review page to match the General Ledger standard formatting.
---

# CAP Invoice Description Updater

## Overview
This skill audits pending supplier invoices on the CAP Suppliers web portal, retrieves matching account templates from the General Ledger (GL) file, formats the description text to align with the standard conventions, writes them to the portal, and sends email notifications.

## Dependencies
None.

## Quick Start
To trigger this skill, ask the agent:
`Run the CAP supplier invoice description updater using the general ledger at "C:\Users\kev\Downloads\Carte Blanche S39_GL_JUNE_2026.xlsx"`

## Formatting Templates
Use the following templates based on the **Allocated Account Code**:

| Account Code | Account Name | Description Template Format |
| :--- | :--- | :--- |
| **1012-01** | Insert Producers | `IS[Comm#] - [Story] - Insert Producer - [Supplier] - [DD/MM/YYYY] @ R7100 x [Qty] min` |
| **2138-01** | Autocue Operator | `Studio Autocue Services - EasiQ - [Saturdays/Dates] @ R[Rate] x [Qty] episodes` |
| **2161-01** | ENG DOP | DOP: `IS[Comm#] - [Story] - DOP - [Supplier] - [DD/MM/YY] @ R[Rate] x [Qty] day`<br>Cam Gear: `IS[Comm#] - [Story] - Cam Gear - [Supplier] - [DD/MM/YY] @ R[Rate] x [Qty] day`<br>Cam Assist: `IS[Comm#] - [Story] - Cam Assist - [Supplier] - [DD/MM/YY] @ R[Rate] x [Qty] day` |
| **3202-01** | Vehicle Rental: Inserts | `IS[Comm#] - [Story] - Vehicle Rental - [Driver] - [DD/MM/YYYY] [Supplier]` |
| **3216-01** | Mileage & Fuel Claims | `IS[Comm#] - [Story] - Mileage - [Supplier/Driver] - [DD/MM/YYYY] - [Route] @ R[Rate] x [KMs]kms` |
| **3302-01** | Air Tickets: Inserts | Air Ticket: `IS[Comm#] - [Story] - Air Ticket - [Passenger] - [DD/MM/YYYY] [Route]`<br>Airport Tax: `IS[Comm#] - [Story] - Airport Tax - [Passenger] - [DD/MM/YYYY] [Route]` |
| **3302-03** | Air Tickets: Studio | Air Ticket: `Studio Anchor Travel - Air Ticket - Erin Bates - [DD-DD/MM/YYYY] [Route]`<br>Airport Tax: `Studio Anchor Travel - Airport Tax - Erin Bates - [DD-DD/MM/YYYY] [Route]` |
| **3307-01** | Excess Baggage | `IS[Comm#] - [Story] - Excess Baggage - [Passenger] - [DD/MM/YYYY] [Details]` |
| **3321-02** | Accommodation: Inserts | `IS[Comm#] - [Story] - Accommodation - Izani Embassy - [Guests] - [DD-DD/MM/YYYY] @ [Hotel]` |
| **4103-01** | Editor: Inserts Freelance | `IS[Comm#] - [Story] - Insert Edit - [Supplier] - [DD/MM/YY] @ R4900 x [Qty] day` |
| **4105-01** | Transcripts | `IS[Comm#] - [Story] - Transcription - Scribe Now - [Dates] @ R[Rate] x [Qty] hours` |
| **4121-03** | AFM: VO Recordings | `IS[Comm#] - [Story] - Insert VO RX - [Supplier] - [DD/MM/YY] @ R1280 x [Qty] hour` |
| **4121-04** | AFM: Final Mix | `IS[Comm#] - [Story] - Insert AFM - [Supplier] - [DD/MM/YY] @ R1280 x [Qty] hours` |
| **1038-01** | Research & Development | `R&D - [Details] - [Supplier] - [DD/MM/YYYY] @ [Rate] x [Qty]` |

## Workflow

### 1. Identify & Match
1. Navigate to the **3rd Review** page (`https://www.cap.myacc.co.za/admin/cap-suppliers/third-review`).
2. Read all pending invoices.
3. For each invoice, download and inspect the PDF if necessary, or extract details from the captured fields (supplier name, commission #, story, account code, amount).
4. Match against the formatting templates above. Double check the General Ledger sheet `General Ledger` in the S39 Excel file for any specific supplier spelling (e.g. `Slipdisk Prod` vs `Slipdisk Productions`).

### 2. Enter and Save
1. Construct the updated description string.
2. Select the corresponding input textbox on the portal.
3. Call the value setter and dispatch `input` and `change` events.
4. Click the **Save All Descriptions** button.
5. Reload the webpage to verify that the updated descriptions persist.

### 3. Notify & Log
1. Prepare a run report summary.
2. Run the email dispatcher script `C:\Users\kev\.gemini\antigravity\scratch\send_status_email.js` using the saved email credentials to notify Winifred and Kevin.
3. Append a log entry to `walkthrough.md`.

## Common Mistakes
* **Typo in Supplier Spelling**: Always check the GL file for exact name spellings (e.g., using `Slipdisk Prod` instead of `Slipdisk` or `Slipdisk Productions` for edit lines).
* **Missing DOM Events**: Standard value assignment `el.value = val` is not enough. You must dispatch `input` and `change` events so React/Vue registers the change.
* **Incorrect Date Format**: Double-check if the template uses `DD/MM/YYYY` or `DD/MM/YY` and match it exactly.

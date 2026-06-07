/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface BankDetails {
  id?: string; // Unique index for identifying other accounts
  bankName: string;
  branch: string;
  accountNumber: string;
  ifscCode: string;
}

export interface CompanyConfig {
  id?: string; // Unique identity to swap multiple profiles
  name: string;
  logoUrl?: string;
  address: string;
  contactNumber: string;
  email?: string;
  gstin: string;
  pan: string;
  bankDetails: BankDetails;
  signatureUrl?: string; // Data URL for seal or signature
  hideCompanyNameWithLogo?: boolean; // Toggle to hide text company name if logo contains name
}

export interface Client {
  id: string; // Unique ID
  name: string; // e.g. The Manager, LIC of India
  address: string; // Full billing address
  gstin: string;
  pan?: string;
  zone: string; // e.g. "Salem DO", "Kottayam DO"
}

export interface Genset {
  id: string;
  clientId: string; // Associated client
  siteName: string; // e.g. Namakkal, Salem North, Thiruvella
  capacity: string; // e.g. "100 KVA", "30 KVA"
  dieselQuantityPerHour: number; // e.g. 16.9, 5.8
  gstType: "CGST_SGST" | "IGST"; // Based on state boundaries
  meterFormat?: "HH:MM" | "DECIMAL"; // e.g. "HH:MM" or "DECIMAL"
  companyId?: string; // Target Company Configured
  bankAccountId?: string; // Target bank details
  zoneName?: string; // Linked subzone name for fuel rates
}

export interface ZonePriceConfig {
  id: string; // Unique key, e.g. "Salem-26-04" for Salem DO April 2026
  zoneName: string; // e.g. "Salem", "Namakkal", "Pathanam", "Kottayam", "Idukki", "Alapuzha"
  monthKey: string; // YYYY-MM
  price1st: number; // Price on 1st of month
  priceLast: number; // Price on last of month
  averagePrice: number; // Average price used for calculations
}

export interface LogEntry {
  id: string;
  date?: string; // e.g. "2026-04-12"
  startTime: string; // e.g. "10:00"
  endTime: string; // e.g. "10:18"
  durationMinutes: number; // calculated minutes
}

export interface SiteLog {
  id: string; // unique site log id for a month
  gensetId: string;
  monthKey: string; // YYYY-MM
  startMeter: string; // e.g. "933.7" or "197.09"
  endMeter: string; // e.g. "934.6" or "205.59"
  entries: LogEntry[];
  billNo?: string; // Optional user override/custom entry for billing
  billDate?: string; // Optional user override/custom entry for billing
  isSubmitted?: boolean; // Submit flag for audit submission lockdown
  isPaid?: boolean; // Optional payment status
  paymentDate?: string; // Optional date payment was received
  paymentRef?: string; // Optional transaction ID or check number
  paymentAmount?: number; // Optional amount received
  paymentBankId?: string; // Opt linked bank account received into
}

export interface AppDatabase {
  company: CompanyConfig;
  companies?: CompanyConfig[]; // Dynamic array supporting multiple companies
  bankAccounts?: BankDetails[]; // Dynamic array supporting multiple bank accounts
  clients: Client[];
  gensets: Genset[];
  zonePrices: ZonePriceConfig[];
  siteLogs: SiteLog[];
}

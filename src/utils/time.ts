/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Parses a meter reading string into total minutes.
 * Supports:
 * - "100:34" (Actual time format: HH:MM)
 * - "100.2" (Decimal format where .1 = 6 minutes, i.e., standard decimal hours)
 */
export function parseMeterToMinutes(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;

  if (trimmed.includes(':')) {
    // HH:MM format
    const parts = trimmed.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  } else {
    // Decimal format
    const num = parseFloat(trimmed);
    if (isNaN(num)) return 0;
    // Multiplied by 60 to get minutes
    return Math.round(num * 60);
  }
}

/**
 * Formats total minutes into ACTUAL time format (e.g. "100:34").
 */
export function formatMinutesToTime(totalMinutes: number): string {
  const isNegative = totalMinutes < 0;
  const absMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absMinutes / 60);
  const minutes = absMinutes % 60;
  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  return `${isNegative ? '-' : ''}${hStr}:${mStr}`;
}

/**
 * Formats total minutes to DECIMAL format (e.g. "100.57" or "100.2" where .1 = 6 mins).
 * We default to 1 decimal place if it represents an exact 10-minute/6-minute interval (like .5, .2),
 * or 2 decimal places for more precise readings.
 */
export function formatMinutesToDecimal(totalMinutes: number, decimals: number = 2): string {
  const hours = totalMinutes / 60;
  // If it's a neat integer, return .0
  if (totalMinutes % 60 === 0) {
    return hours.toFixed(1);
  }
  
  // Calculate with requested precision
  const formatted = hours.toFixed(decimals);
  // If formatted ends with .00, simplify to .0
  if (formatted.endsWith('.00')) {
    return hours.toFixed(1);
  }
  return formatted;
}

/**
 * Calculates duration between two time strings ("HH:MM") in minutes.
 * Supports cross-midnight calculations if end < start, but default is same day.
 */
export function calculateDurationMinutes(start: string, end: string): number {
  if (!start || !end) return 0;
  
  const [sH, sM] = start.split(':').map(n => parseInt(n, 10) || 0);
  const [eH, eM] = end.split(':').map(n => parseInt(n, 10) || 0);
  
  const startM = sH * 60 + sM;
  let endM = eH * 60 + eM;
  
  if (endM < startM) {
    // cross midnight
    endM += 24 * 60;
  }
  
  return endM - startM;
}

/**
 * Formats a raw number to currency format (Indian Rupees)
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Converts numbers into Indian English words (for invoice printing)
 */
export function convertNumberToWords(num: number): string {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const roundNum = Math.round(num);
  if (roundNum === 0) return 'Zero';

  function numToWords(n: number): string {
    let str = '';
    if (n > 99) {
      str += a[Math.floor(n / 100)] + 'Hundred ';
      n %= 100;
      if (n > 0) str += 'and ';
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  }

  let result = '';
  let temp = roundNum;

  // Crores
  if (temp >= 10000000) {
    result += numToWords(Math.floor(temp / 10000000)) + 'Crore ';
    temp %= 10000000;
  }
  // Lakhs
  if (temp >= 100000) {
    result += numToWords(Math.floor(temp / 100000)) + 'Lakh ';
    temp %= 100000;
  }
  // Thousands
  if (temp >= 1000) {
    result += numToWords(Math.floor(temp / 1000)) + 'Thousand ';
    temp %= 1000;
  }
  // Remaining
  if (temp > 0) {
    result += numToWords(temp);
  }

  return 'Rupees ' + result.trim() + ' Only';
}

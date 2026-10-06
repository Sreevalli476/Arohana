import { createWorker } from 'tesseract.js';
import { DocumentOCRResult } from '../types';

/**
 * Image compressor to ensure base64 size stays well under ~700 KB Firestore limit
 */
export async function compressImageToBase64(file: File, maxDimension = 1200, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Regex patterns for Indian identity & vehicle documents
 */
export const INDIAN_DOC_PATTERNS = {
  // Indian Vehicle Registration: e.g. DL 01 AB 1234 or MH12DE9876 or KA05M1234
  VEHICLE_RC: /\b([A-Z]{2}[ -]?[0-9]{1,2}[ -]?[A-Z]{1,3}[ -]?[0-9]{4})\b/i,
  // Indian Driving License: e.g. DL-1420110012345 or KA01 20210001234 or RJ14/2018/1234567
  DRIVING_LICENSE: /\b([A-Z]{2}[ -]?[0-9]{2}[ -]?[0-9]{11}|[A-Z]{2}[0-9]{2}[ /]?[0-9]{4}[ /]?[0-9]{7})\b/i,
  // Indian Aadhaar (12 digits, often 4-4-4) or Voter ID
  AADHAAR_OR_VOTER: /\b(\d{4}[ -]\d{4}[ -]\d{4}|[A-Z]{3}[0-9]{7})\b/,
  // Date patterns: DD/MM/YYYY or DD-MM-YYYY
  DATE: /\b(\d{2}[-/.]\d{2}[-/.]\d{4})\b/g,
  // Expiry date context keyword
  EXPIRY_KEYWORD: /(?:valid(?:ity)?\s*(?:upto|till|to)?|expires?|expiry\s*(?:date)?|valid\s*through)\s*[:.-]?\s*(\d{2}[-/.]\d{2}[-/.]\d{4})/i,
  // Issue date context keyword
  ISSUE_KEYWORD: /(?:issued?|issue\s*date|doi|date\s*of\s*issue)\s*[:.-]?\s*(\d{2}[-/.]\d{2}[-/.]\d{4})/i,
  // Name keyword context
  NAME_KEYWORD: /(?:name|holder(?:'?s)?\s*name|driver\s*name)\s*[:.-]?\s*([A-Z\s.]{3,35})/i,
};

/**
 * Runs client-side OCR on a document image and parses structured fields
 */
export async function performDocumentOCR(
  imageBase64: string,
  docType: 'govtId' | 'dl' | 'rc' | 'insurance',
  onProgress?: (progress: number, status: string) => void
): Promise<DocumentOCRResult> {
  const worker = await createWorker('eng');

  try {
    if (onProgress) {
      onProgress(30, 'Scanning document image...');
    }

    const ret = await worker.recognize(imageBase64);
    const text = ret.data.text || '';

    if (onProgress) {
      onProgress(80, 'Extracting document data...');
    }

    const result: DocumentOCRResult = {
      docType,
      rawText: text,
    };

    // Extract name if found
    const nameMatch = text.match(INDIAN_DOC_PATTERNS.NAME_KEYWORD);
    if (nameMatch && nameMatch[1]) {
      result.extractedName = cleanExtractedName(nameMatch[1]);
    } else {
      // Fallback: look for capitalized 2-3 word lines
      const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 3);
      for (const line of lines) {
        if (/^[A-Z][a-z]+ [A-Z][a-z]+( [A-Z][a-z]+)?$/.test(line) && !line.includes('INDIA') && !line.includes('GOVT')) {
          result.extractedName = line;
          break;
        }
      }
    }

    // Extract dates
    const expiryMatch = text.match(INDIAN_DOC_PATTERNS.EXPIRY_KEYWORD);
    if (expiryMatch && expiryMatch[1]) {
      result.expiryDate = expiryMatch[1];
      result.isExpired = checkDateExpired(expiryMatch[1]);
    } else {
      // Find all dates and pick later one as expiry
      const allDates = [...text.matchAll(INDIAN_DOC_PATTERNS.DATE)].map((m) => m[1]);
      if (allDates.length > 1) {
        result.expiryDate = allDates[allDates.length - 1];
        result.isExpired = checkDateExpired(result.expiryDate);
      }
    }

    const issueMatch = text.match(INDIAN_DOC_PATTERNS.ISSUE_KEYWORD);
    if (issueMatch && issueMatch[1]) {
      result.issueDate = issueMatch[1];
    }

    // Doc-specific regex
    if (docType === 'dl') {
      const dlMatch = text.match(INDIAN_DOC_PATTERNS.DRIVING_LICENSE);
      if (dlMatch && dlMatch[1]) {
        result.extractedNumber = dlMatch[1].replace(/[- /]/g, '').toUpperCase();
        result.isValidFormat = true;
      }
    } else if (docType === 'rc') {
      const rcMatch = text.match(INDIAN_DOC_PATTERNS.VEHICLE_RC);
      if (rcMatch && rcMatch[1]) {
        result.vehicleNumber = rcMatch[1].replace(/[- ]/g, '').toUpperCase();
        result.extractedNumber = result.vehicleNumber;
        result.isValidFormat = true;
      }
    } else if (docType === 'govtId') {
      const idMatch = text.match(INDIAN_DOC_PATTERNS.AADHAAR_OR_VOTER);
      if (idMatch && idMatch[1]) {
        result.extractedNumber = idMatch[1];
        result.isValidFormat = true;
      }
    } else if (docType === 'insurance') {
      // Look for Policy No
      const polMatch = text.match(/(?:policy\s*(?:no|number)?)\s*[:.-]?\s*([A-Z0-9\/-]{6,25})/i);
      if (polMatch && polMatch[1]) {
        result.extractedNumber = polMatch[1];
      }
    }

    if (onProgress) {
      onProgress(100, 'OCR completed');
    }

    await worker.terminate();
    return result;
  } catch (err) {
    await worker.terminate();
    throw err;
  }
}

function cleanExtractedName(str: string): string {
  return str.replace(/[^A-Za-z\s]/g, '').trim();
}

/**
 * Checks if DD/MM/YYYY date is in the past
 */
export function checkDateExpired(dateStr: string): boolean {
  try {
    const parts = dateStr.split(/[-/.]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const docDate = new Date(year, month, day);
      return docDate.getTime() < Date.now();
    }
  } catch {
    // If invalid date parsing
  }
  return false;
}

/**
 * Compares two names for high-confidence match
 */
export function compareNames(name1?: string, name2?: string): boolean {
  if (!name1 || !name2) return false;
  const n1 = name1.toLowerCase().replace(/[^a-z]/g, '');
  const n2 = name2.toLowerCase().replace(/[^a-z]/g, '');
  if (n1 === n2) return true;
  return n1.includes(n2) || n2.includes(n1);
}

/**
 * Normalizes Indian vehicle plate numbers: e.g. "dl-01-ab-1234" -> "DL01AB1234"
 */
export function normalizeVehiclePlate(plate?: string): string {
  if (!plate) return '';
  return plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

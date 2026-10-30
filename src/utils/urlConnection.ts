export interface CloudConnectionPayload {
  sheetUrl?: string;
  webhookUrl?: string;
  sheetName?: string;
  teamName?: string;
  databaseProvider?: 'firestore' | 'sheets';
  firestoreDocId?: string;
  firestoreCollection?: string;
  companyName?: string;
}

/**
 * Encodes connection parameters into an obfuscated/masked URL parameter string.
 * This prevents raw Google Sheets and Google Apps Script Webhook URLs or workspace IDs from being visible
 * in plain text in the browser address bar.
 */
export function encodeConnectionParams(payload: CloudConnectionPayload): string {
  try {
    if (!payload.sheetUrl && !payload.webhookUrl && !payload.firestoreDocId) return '';
    const clean: CloudConnectionPayload = {};
    if (payload.sheetUrl) clean.sheetUrl = payload.sheetUrl.trim();
    if (payload.webhookUrl) clean.webhookUrl = payload.webhookUrl.trim();
    if (payload.sheetName) clean.sheetName = payload.sheetName.trim();
    if (payload.teamName) clean.teamName = payload.teamName.trim();
    if (payload.databaseProvider) clean.databaseProvider = payload.databaseProvider;
    if (payload.firestoreDocId) clean.firestoreDocId = payload.firestoreDocId.trim();
    if (payload.firestoreCollection) clean.firestoreCollection = payload.firestoreCollection.trim();
    if (payload.companyName) clean.companyName = payload.companyName.trim();

    const jsonStr = JSON.stringify(clean);
    const utf8Bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    utf8Bytes.forEach((b) => {
      binary += String.fromCharCode(b);
    });
    const b64 = btoa(binary);

    // Obfuscate: reverse string and replace standard '=' padding
    const obfuscated = b64.replace(/=/g, '_').split('').reverse().join('');
    return obfuscated;
  } catch {
    return '';
  }
}

/**
 * Decodes an obfuscated/masked connection parameter string back into cloud connection parameters.
 */
export function decodeConnectionParams(cxStr: string): CloudConnectionPayload | null {
  try {
    if (!cxStr || typeof cxStr !== 'string') return null;
    // De-obfuscate: reverse back and restore '=' padding
    let b64 = cxStr.split('').reverse().join('').replace(/_/g, '=');
    while (b64.length % 4 !== 0) {
      b64 += '=';
    }

    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(jsonStr);

    if (parsed && typeof parsed === 'object' && (parsed.sheetUrl || parsed.webhookUrl || parsed.firestoreDocId)) {
      return {
        sheetUrl: typeof parsed.sheetUrl === 'string' ? parsed.sheetUrl : undefined,
        webhookUrl: typeof parsed.webhookUrl === 'string' ? parsed.webhookUrl : undefined,
        sheetName: typeof parsed.sheetName === 'string' ? parsed.sheetName : undefined,
        teamName: typeof parsed.teamName === 'string' ? parsed.teamName : undefined,
        databaseProvider: parsed.databaseProvider === 'firestore' || parsed.databaseProvider === 'sheets' ? parsed.databaseProvider : (parsed.firestoreDocId ? 'firestore' : undefined),
        firestoreDocId: typeof parsed.firestoreDocId === 'string' ? parsed.firestoreDocId : undefined,
        firestoreCollection: typeof parsed.firestoreCollection === 'string' ? parsed.firestoreCollection : undefined,
        companyName: typeof parsed.companyName === 'string' ? parsed.companyName : undefined,
      };
    }
  } catch {
    // Return null if decode fails
  }
  return null;
}

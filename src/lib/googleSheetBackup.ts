/**
 * Utility for backing up app data to a Google Sheet via a Google Apps Script Web App.
 */

export const backupToGoogleSheet = async (webhookUrl: string, payload: any): Promise<boolean> => {
  if (!webhookUrl || !webhookUrl.startsWith('https://script.google.com/')) {
    throw new Error('ទីតាំង URL មិនត្រឹមត្រូវ! សូមប្រាកដថាជាតំណភ្ជាប់របស់ Google Apps Script។');
  }

  try {
    // We use text/plain to avoid CORS preflight issues with Google Apps Script
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });
    
    // Since Google Apps Script Web Apps might redirect or have strict CORS,
    // we often can't read the response reliably if CORS isn't fully set up in the script.
    // Assuming the fetch doesn't throw a network error, we consider it a success.
    return true;
  } catch (error: any) {
    throw new Error('បរាជ័យក្នុងការបញ្ជូនទិន្នន័យ៖ ' + error.message);
  }
};

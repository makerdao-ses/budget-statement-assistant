import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = './token.json';
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
    try {
        const content = await fs.promises.readFile(TOKEN_PATH);
        const credentials = JSON.parse(content.toString());
        return google.auth.fromJSON(credentials);
    } catch (err) {
        return null;
    }
}

async function saveCredentials(client: any) {
    const content = await fs.promises.readFile(CREDENTIALS_PATH);
    const keys = JSON.parse(content.toString());
    const key = keys.installed || keys.web;
    const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
    });
    await fs.promises.writeFile(TOKEN_PATH, payload);
}

export async function authorize() {
    let client: any = await loadSavedCredentialsIfExist();
    if (client) {
        return client;
    }
    client = await authenticate({
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        keyfilePath: CREDENTIALS_PATH,
    });
    if (client.credentials) {
        await saveCredentials(client);
    }
    return client;
}

// SES "1OfROr_XNpWA4FksRrqrXtk3UJ7tPmJ4tR3mVk_Uu5KM"  // "1b. 🧪 Incubator - Monthly Payments"
// SF "1-9sH-zXYssfvWO7Z_OrOfikmClRAV5UnWkopQZWraao" // "Template"

export async function fetchData(sheetUrl: string) {
    try {
        const { spreadsheetId, sheetName }: any = await parseSpreadSheetLink(sheetUrl);
        const auth = await authorize();
        const sheets = google.sheets('v4');
        const range = `${sheetName}`
        const response = await sheets.spreadsheets.values.get({ auth, spreadsheetId, range, valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'SERIAL_NUMBER' })
        const rows: any = response.data.values
        if (rows.length == 0) {
            console.log('No data found.')
            return
        }
        return rows;
    } catch (err) {
        throw Error(err as any)
    }
}

async function parseSpreadSheetLink(sheetUrl: string) {
    try {
        const auth = await authorize();
        const pattern = /\/spreadsheets\/d\/([^\/]+)\/edit[^#]*(?:#gid=([0-9]+))?/gm
        let result = pattern.exec(sheetUrl)
        if (result == undefined) throw Error("Invalid sheet url");
        const spreadsheetId = result[1];
        const tabId = Number(result[2])

        // Getting Sheet Name
        const sheets = google.sheets('v4');
        const sheetNameResponse: any = await sheets.spreadsheets.get({ auth, spreadsheetId });
        if (sheetNameResponse == undefined) throw Error("Invalid sheet url");
        const sheetData = sheetNameResponse.data.sheets.filter((item: any) => {
            if (item.properties.sheetId == tabId)
                return item.properties.title
        })
        const sheetName = sheetData[0].properties.title;
        return { spreadsheetId, sheetName }
    } catch (error) {
        console.log(`The API returned an error ${error}`)
    }
}
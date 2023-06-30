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

export async function fetchData(spreadsheetId = "1t-EFCxkupELMI-CAuNFWsq84SCfSGRjKEcu0BsTMFS0", sheetName = "Template") {
    try {
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
        console.log(`The API returned an error: ${err}`)
        return
    }
}
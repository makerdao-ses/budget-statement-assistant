// import knex from 'knex';
import scopeArtifacts from './scopeArtifactsData.js';
import fs from 'fs';
import knex from 'knex';


// Connect to database selected in the .env file
const db = knex({
    client: 'pg',
    connection: process.env.PG_CONNECTION_STRING,
});


// Support functions

function structureData(data: any) {
    let hierarchy: any = {};
    let currentL0: string = "", currentL1: string = "", currentL2: string = "", currentL3: string = "", currentL4: string = "";

    // Filter out empty objects
    data = data.filter((item: any) => {
        return Object.values(item).some(value => value !== "");
    });

    data.forEach((item: any) => {
        if (item.L0) {
            currentL0 = item.L0;
            hierarchy[currentL0] = item;
        }
        if (item.L1) {
            currentL1 = item.L1;
            if (!hierarchy[currentL0]) {
                hierarchy[currentL0] = {};
            }
            hierarchy[currentL0][currentL1] = item;
        }
        if (item.L2) {
            currentL2 = item.L2;
            if (!hierarchy[currentL0][currentL1]) {
                hierarchy[currentL0][currentL1] = {};
            }
            hierarchy[currentL0][currentL1][currentL2] = item;
        }
        if (item.L3) {
            currentL3 = item.L3;
            if (!hierarchy[currentL0][currentL1][currentL2]) {
                hierarchy[currentL0][currentL1][currentL2] = {};
            }
            hierarchy[currentL0][currentL1][currentL2][currentL3] = item;
        }
        if (item.L4) {
            currentL4 = item.L4;
            if (!hierarchy[currentL0]) hierarchy[currentL0] = {};
            if (!hierarchy[currentL0][currentL1]) hierarchy[currentL0][currentL1] = {};
            if (!hierarchy[currentL0][currentL1][currentL2]) hierarchy[currentL0][currentL1][currentL2] = {};
            if (!hierarchy[currentL0][currentL1][currentL2][currentL3]) hierarchy[currentL0][currentL1][currentL2][currentL3] = {};
            hierarchy[currentL0][currentL1][currentL2][currentL3][currentL4] = item;
        }
    });
    return hierarchy;
}


const writeToFileSync = (data: any, fileName: string) => {
    fs.writeFile(`src/utils/scopeArtifacts/${fileName}.json`, JSON.stringify(data), (err) => {
        if (err) throw err;
        console.log('The file has been saved!');
    });
};

const formatToTimeZone = (date: string) => {
    if (date == '' || date == 'N/A' || date == undefined || date == 'Ongoing') {
        return null;
    } else {
        const tDate = new Date(date).toISOString();
        return tDate;
    }

}

async function processObject(obj: any, parentId: any, budgets: any[], budgetCaps: any[]) {

    for (let key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            let splitKey = key.split(')');
            let code = splitKey.length > 1 && splitKey[1] !== ' ' ? splitKey[0] : null;
            let name = splitKey[1] ? splitKey[1].trim() : key;
            let id = budgets.length + 1;

            budgets.push({
                id: id,
                parentId: parentId,
                name: name,
                code: code,
            });

            // Adding DAI budget caps
            let amount = obj[key]['Committed Budget (DAI) New '] || 0;
            if (amount !== 0) {
                budgetCaps.push({
                    budgetId: id,
                    amount,
                    currency: 'DAI',
                    start: formatToTimeZone(obj[key]['DAI Budget Start']) || null,
                    end: formatToTimeZone(obj[key]['DAI Budget End']) || null
                });
            }

            // Adding MKR budget caps
            amount = obj[key]['Committed Budget Grand Total  (MKR) '] || 0;
            if (amount !== 0) {
                budgetCaps.push({
                    budgetId: id,
                    amount,
                    currency: 'MKR',
                    start: formatToTimeZone(obj[key]['MKR Start']) || null,
                    end: formatToTimeZone(obj[key]['MKR End']) || null
                });
            }

            processObject(obj[key], id, budgets, budgetCaps);
        }
    }
}

const getBudgetData = async () => {
    let budgets: any = [];
    let budgetCaps: any = [];

    const structuredData = structureData(scopeArtifacts);
    await processObject(structuredData, null, budgets, budgetCaps);
    return { budgets, budgetCaps };
};



const insertBudgetsInDB = async () => {
    // Deleting all budgets and budgetCaps from DB before adding updated ones
    await db('BudgetCap').del();
    await db('Budget').del().returning('*');
    console.log('Deleted all budgets and budget caps from DB');

    const { budgets, budgetCaps } = await getBudgetData();
    // Inserting budgets
    const insertedBudgets = await db('Budget').insert(budgets).returning('*');
    console.log('Inserted budgets: ', insertedBudgets.length);

    // Inserting budget caps
    const insertedBudgetCaps = await db('BudgetCap').insert(budgetCaps).returning('*');
    console.log('Inserted budget caps: ', insertedBudgetCaps.length);
}


// Uncomment to write budgets and budgetCaps to file and inspect data

// const { budgets, budgetCaps } = await getBudgetData();
// writeToFileSync(budgets, 'budgets');
// writeToFileSync(budgetCaps, 'budgetCaps');


// To insert budgets and budgetCaps in DB
await insertBudgetsInDB();
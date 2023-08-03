// import knex from 'knex';
import scopeArtifacts from './scopeArtifactsData.js';
import fs from 'fs';


// Connect to database selected in the .env file
// const db = knex({
//     client: 'pg',
//     connection: process.env.PG_CONNECTION_STRING,
//     idleTimeoutMillis: 0,
// });

/* Required values to fill in DB:

Budget: 
    - parentId
    - name
    - code // can also be null
    - start
    - end

BudgetCap:
    - budgetId
    - expenseCategoryId // expected to be null
    - amount
    - currency
*/


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

async function processObject(obj: any, parentId: any, budgets: any[], budgetCaps: any[]) {

    for (let key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            let splitKey = key.split(')');
            let code = splitKey.length > 1 && splitKey[1] !== ' ' ? splitKey[0] : null;
            let name = splitKey[1] ? splitKey[1].trim() : key;
            let start = obj[key]['DAI Budget Start'] || '';
            let end = obj[key]['DAI Budget End'] || '';
            let id = budgets.length + 1;

            budgets.push({
                id: id,
                parentId: parentId,
                name: name,
                code: code,
                start: start,
                end: end
            });

            // Adding DAI budget caps
            let amount = obj[key]['Committed Budget (DAI) New '] || 0;
            if (amount !== 0) {
                budgetCaps.push({
                    budgetId: id,
                    amount,
                    currency: 'DAI'
                });
            }

            // Adding MKR budget caps
            amount = obj[key]['Committed Budget Grand Total  (MKR) '] || 0;
            if (amount !== 0) {
                budgetCaps.push({
                    budgetId: id,
                    amount,
                    currency: 'MKR'
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

const { budgets, budgetCaps } = await getBudgetData();

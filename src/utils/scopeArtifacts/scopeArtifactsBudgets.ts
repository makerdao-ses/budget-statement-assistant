// import knex from 'knex';
import scopeArtifacts from './scopeArtifactsData.js';
import fs from 'fs';


// Connect to database selected in the .env file
// const db = knex({
//     client: 'pg',
//     connection: process.env.PG_CONNECTION_STRING,
//     idleTimeoutMillis: 0,
// });

// console.log(scopeArtifacts)

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
    let currentL0: string, currentL1: string, currentL2: string, currentL3: string, currentL4;

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
        // if (item.L4) {
        //     currentL4 = item.L4;
        //     if (!hierarchy[currentL0][currentL1][currentL2][currentL3]) {
        //         hierarchy[currentL0][currentL1][currentL2][currentL3] = {};
        //     }
        //     hierarchy[currentL0][currentL1][currentL2][currentL3][currentL4] = item;
        // }
    });
    return hierarchy;
}

// let structuredData = structureData(scopeArtifacts);
// structuredData
// console.log(structuredData);

// const writeToFile = (data) => {
//     fs.writeFile('scopeArtifacts.json', JSON.stringify(data), (err) => {
//         if (err) throw err;
//         console.log('The file has been saved!');
//     });
// };

// writeToFile(structuredData);


const structuredJson = JSON.parse(fs.readFileSync('scopeArtifacts.json', 'utf8'));

let budgets = [];
let budgetCaps: any = [];

function processObject(obj: any, parentId: any) {
    for (let key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
            let splitKey = key.split(')');
            let code = splitKey[0];
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

            let amount = obj[key]['Committed Budget (DAI) New '] || 0;
            budgetCaps.push({
                budgetId: id,
                amount: amount,
                currency: 'DAI'
            });

            processObject(obj[key], id);
        }
    }
}

processObject(structuredJson, null);

console.log(budgetCaps);
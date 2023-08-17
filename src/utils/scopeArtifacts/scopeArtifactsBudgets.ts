import scopeArtifacts from './scopeArtifactsData.js';
import fs from 'fs';
import knex from 'knex';


/* 
This script is used to insert budgets and budget caps in the DB or to save them to a JSON file
Raw budgets data is taken from the scopeArtifactsData.js file
*/

class BudgetScript {

    db: any;

    constructor() {
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
    }

    public insertBudgetsInDB = async () => {
        // Deleting all budgets and budgetCaps from DB before adding updated ones
        await this.db('BudgetCap').del();
        await this.db('Budget').del().returning('*');
        console.log('Deleted all budgets and budget caps from DB');

        const { budgets, budgetCaps } = await this.getBudgetData();
        // Inserting budgets
        const insertedBudgets = await this.db('Budget').insert(budgets).returning('*');
        console.log('Inserted budgets: ', insertedBudgets.length);

        // Inserting budget caps
        const insertedBudgetCaps = await this.db('BudgetCap').insert(budgetCaps).returning('*');
        console.log('Inserted budget caps: ', insertedBudgetCaps.length);
    }

    public async saveToJSON() {
        const { budgets, budgetCaps } = await this.getBudgetData();
        this.saveToJson(budgets, 'budgets');
        this.saveToJson(budgetCaps, 'budgetCaps');
    }

    private getBudgetData = async () => {
        let budgets: any = [];
        let budgetCaps: any = [];

        const structuredData = this.structureData(scopeArtifacts);
        await this.processObject(structuredData, null, budgets, budgetCaps);
        return { budgets, budgetCaps };
    };


    private saveToJson = (data: any, fileName: string) => {
        fs.writeFile(`src/utils/scopeArtifacts/${fileName}.json`, JSON.stringify(data), (err) => {
            if (err) throw err;
            console.log(`The ${fileName} file has been saved!`);
        });
    };


    private structureData(data: any) {
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

    private formatToTimeZone = (inputDate: string) => {
        if (inputDate == '' || inputDate == 'N/A' || inputDate == undefined || inputDate == 'Ongoing') {
            return null;
        } else {
            const date = new Date(inputDate);
            date.setUTCHours(0, 0, 0, 0);
            date.setUTCDate(date.getUTCDate() + 1);
            const outputDate = date.toISOString();
            return outputDate;
        }

    }

    private async processObject(obj: any, parentId: any, budgets: any[], budgetCaps: any[]) {

        for (let key in obj) {
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                let splitKey = key.split(')');
                let code = splitKey.length > 1 && splitKey[1] !== '' ? splitKey[0] : null;
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
                        start: this.formatToTimeZone(obj[key]['DAI Budget Start']) || null,
                        end: this.formatToTimeZone(obj[key]['DAI Budget End']) || null
                    });
                }

                // Adding MKR budget caps
                amount = obj[key]['Committed Budget Grand Total  (MKR) '] || 0;
                if (amount !== 0) {
                    budgetCaps.push({
                        budgetId: id,
                        amount,
                        currency: 'MKR',
                        start: this.formatToTimeZone(obj[key]['MKR Start']) || null,
                        end: this.formatToTimeZone(obj[key]['MKR End']) || null
                    });
                }

                this.processObject(obj[key], id, budgets, budgetCaps);
            }
        }
    }

}

new BudgetScript().saveToJSON();
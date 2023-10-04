import scopeArtifacts from './scopeArtifactsData.js';
import fs from 'fs';
import knex from 'knex';
import { AnalyticsStore } from '../utils/analytics/AnalyticsStore.js';
import { AnalyticsPath } from '../utils/analytics/AnalyticsPath.js';
import { AnalyticsMetric } from '../utils/analytics/AnalyticsQuery.js';


/* 
This script is used to insert budgets and budget caps in the DB or to save them to a JSON file
Raw budgets data is taken from the scopeArtifactsData.js file
*/

type Budget = {
    id: number,
    parentId: number,
    name: string,
    code: string | null,
    budgetCode?: string,
}

class BudgetScript {

    db: any;

    constructor() {
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
    }

    public insertInAnalyticsStore = async () => {
        const { budgets, budgetCaps } = await this.getBudgetData(true);
        const store = new AnalyticsStore(this.db);

        const series: any[] = this.createSeries(budgets, budgetCaps);
        console.log('Series created: ', series.length)

        // clean old data from DB, 'atlasBudget/...' is the source of all budgets
        await store.clearSeriesBySource(AnalyticsPath.fromString('powerhouse'));

        // insert new data
        const insertedSeries = await store.addSeriesValues(series);
        console.log('Series added to DB: ', insertedSeries.length);

    }

    private createSeries = (budgets: any, budgetCaps: any) => {
        const series: any = [];
        budgets.forEach((budget: any) => {
            const selectedBudgetCaps: any = budgetCaps.filter((budgetCap: any) => budgetCap.budgetId === budget.id);
            const budgetSource = AnalyticsPath.fromString(`powerhouse/google-sheets/1deoWg8fda4dNgehkYJ6SQBDT8QcGJ-9rKDwHdh-ZMZg/274217432`);

            // Cannot add parent budgets with null starter dates. Only budgets with budget caps are added
            // series.push({
            //     start: null,
            //     end: null,
            //     source: budgetSource,
            //     value: 0,
            //     unit: null,
            //     metric: AnalyticsMetric.Budget,
            //     dimensions: {
            //         budget: budgetSource,
            //     }
            // });
            if (selectedBudgetCaps.length > 0) {
                selectedBudgetCaps.forEach((budgetCap: any) => {
                    const fn = budgetCap.start !== null && budgetCap.end !== null ? 'DssVest' : 'Single';
                    series.push({
                        start: budgetCap.start,
                        end: budgetCap.end,
                        source: budgetSource,
                        value: budgetCap.amount,
                        unit: budgetCap.currency,
                        metric: AnalyticsMetric.Budget,
                        fn: fn,
                        dimensions: {
                            budget: AnalyticsPath.fromString(budget.budgetCode || '')
                        }
                    });
                });
            }
        });
        return series;
    }

    public insertBudgetsInDB = async () => {
        // Deleting all budgets and budgetCaps from DB before adding updated ones
        await this.db('BudgetCap').del();
        await this.db('Budget').del().returning('*');
        console.log('Deleted all budgets and budget caps from DB');

        const { budgets, budgetCaps } = await this.getBudgetData(false);
        // Inserting budgets
        const insertedBudgets = await this.db('Budget').insert(budgets).returning('*');
        console.log('Inserted budgets: ', insertedBudgets.length);

        // Inserting budget caps
        const insertedBudgetCaps = await this.db('BudgetCap').insert(budgetCaps).returning('*');
        console.log('Inserted budget caps: ', insertedBudgetCaps.length);
    }

    public async saveToJSON() {
        const { budgets, budgetCaps } = await this.getBudgetData(false);
        this.saveToJson(budgets, 'budgets');
        this.saveToJson(budgetCaps, 'budgetCaps');
    }

    private getBudgetData = async (withBudgetCodes: boolean) => {
        let budgets: any = [];
        let budgetCaps: any = [];

        const structuredData = this.structureData(scopeArtifacts);
        await this.processObject(structuredData, null, budgets, budgetCaps, withBudgetCodes);
        return { budgets, budgetCaps };
    };


    private saveToJson = (data: any, fileName: string) => {
        fs.writeFile(`src/scopeArtifacts/${fileName}.json`, JSON.stringify(data), (err) => {
            if (err) throw err;
            console.log(`The ${fileName} file has been saved!`);
        });
    };


    // Structures the budgets data in a hierarchical way
    private structureData(data: any) {
        let hierarchy: any = {};
        let currentL0: string = "", currentL1: string = "", currentL2: string = "", currentL3: string = "", currentL4: string = "";

        // Filter out empty objects
        data = data.filter((item: any) => {
            return Object.values(item).some(value => value !== "");
        });


        let counter = 0;
        data.forEach((item: any, index: any) => {
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
                if (!hierarchy[currentL0][currentL1][currentL2][currentL3]) {
                    hierarchy[currentL0][currentL1][currentL2][currentL3] = {};
                    counter = 0;
                }
                // count the duplicate L3s
                hierarchy[currentL0][currentL1][currentL2][currentL3][item.L3 + counter++] = item;

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
        if (inputDate == '' ||
            inputDate == 'N/A' ||
            inputDate == undefined ||
            inputDate == 'Ongoing' ||
            inputDate == 'Ends when budget is used ' ||
            inputDate == 'Pending' ||
            inputDate == 'Pending ' ||
            inputDate == 'Ongoing bugbounty' ||
            inputDate == '?'
        ) {
            return null;
        } else {
            const date = new Date(inputDate.toString());
            date.setUTCHours(0, 0, 0, 0);
            date.setUTCDate(date.getUTCDate() + 1);
            const outputDate = date.toISOString();
            return outputDate;
        }

    }

    // Recursively processes the structured data and adds budgets and budget caps to the arrays
    private async processObject(obj: any, parentId: any, budgets: any[], budgetCaps: any[], withBudgetCodes: boolean) {

        for (let key in obj) {
            if (typeof obj[key] === 'object' && obj[key] != null) {
                let splitKey = key.split(')');
                let code = splitKey.length > 1 && splitKey[1] !== '' ? splitKey[0] : null;
                let name = splitKey[1] ? splitKey[1].trim() : key;
                let id = budgets.length + 1;

                let repeatableName = '';
                // Remove last charecter from name if it is a number
                if (!isNaN(name[name.length - 1] as any)) {
                    repeatableName = name.slice(0, -1);
                }

                const sameBudget = budgets.find((budget: any) => budget.name === repeatableName);
                if (sameBudget) {
                    id = sameBudget.id;
                }

                let budget: Budget = {
                    id: id,
                    parentId: parentId,
                    name: name,
                    code: code,
                }

                if (withBudgetCodes) {
                    budget = {
                        ...budget,
                        budgetCode: obj[key]['Budget Codes'],
                    }
                }

                if (!sameBudget) {
                    budgets.push(budget);
                }

                // Adding immediate DAI budget caps
                const immediateAmount = obj[key]['Immediate Budget (DAI)'];
                const startDate = this.formatToTimeZone(obj[key]['Approved by Excutive vote/Source of Truth']);
                if (immediateAmount !== 0 && immediateAmount !== '' && immediateAmount !== undefined && startDate !== null) {
                    budgetCaps.push({
                        budgetId: id,
                        amount: immediateAmount,
                        currency: 'DAI',
                        start: startDate,
                        end: null
                    });
                }

                // Adding DAI budget caps
                const daiAmount = obj[key]['Committed Budget (DAI) New '] || 0;
                const daiStart = this.formatToTimeZone(obj[key]['DAI Budget Start']) || null;
                const daiEnd = this.formatToTimeZone(obj[key]['DAI Budget End']) || null;
                if (daiAmount !== 0 && daiAmount !== immediateAmount && daiStart !== daiEnd) {
                    budgetCaps.push({
                        budgetId: id,
                        amount: daiAmount,
                        currency: 'DAI',
                        start: daiStart,
                        end: daiEnd
                    });
                }

                // Adding immediate MKR budget caps
                const immediateMKRAmount = obj[key]['Immediate Budget (MKR)'] || 0;
                const immediateMKRStart = this.formatToTimeZone(obj[key]['MKR Approved by Excutive vote ']);

                if (immediateMKRAmount !== 0 && immediateMKRAmount !== '' && immediateMKRAmount !== undefined && immediateMKRStart !== null) {
                    budgetCaps.push({
                        budgetId: id,
                        amount: immediateMKRAmount,
                        currency: 'MKR',
                        start: immediateMKRStart,
                        end: null
                    });
                }

                // Adding MKR budget caps
                const mkrAmount = obj[key]['Committed Budget Grand Total  (MKR) '] || 0;
                const mkrStart = this.formatToTimeZone(obj[key]['MKR Start']) || null;
                const mkrEnd = this.formatToTimeZone(obj[key]['MKR End']) || null;
                if (mkrAmount !== 0 && mkrStart !== mkrEnd) {
                    budgetCaps.push({
                        budgetId: id,
                        amount: mkrAmount,
                        currency: 'MKR',
                        start: mkrStart,
                        end: mkrEnd
                    });
                }

                this.processObject(obj[key], id, budgets, budgetCaps, withBudgetCodes);
            }
        }
    }

}

new BudgetScript().insertInAnalyticsStore()
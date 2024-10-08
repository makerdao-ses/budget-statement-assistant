import scopeArtifacts from './scopeArtifactsData.js';
import fs from 'fs';
import knex from 'knex';
import { AnalyticsStore } from '../utils/analytics/AnalyticsStore.js';
import { AnalyticsPath } from '../utils/analytics/AnalyticsPath.js';
import TeamBudgetPath from '../utils/updateTeamBudgetPath.js';

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
    image: string | null,
    description: string | null,
    subtitle: string | null,
}

export default class BudgetScript {

    db: any;

    constructor() {
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
    }

    public insertInAnalyticsStore = async () => {
        const { budgets, budgetCaps } = await this.getBudgetData();
        this.addBudgetPaths(budgets, null, "", "");

        const series: any[] = this.createSeries(budgets, budgetCaps);
        console.log('Scope Artifacts Series created: ', series.length)

        const store = new AnalyticsStore(this.db);
        await store.clearSeriesBySource(AnalyticsPath.fromString('powerhouse/google-sheets'), true);
        console.log('Removed old Scope Artifacts Series from DB')

        // insert new data
        await store.addSeriesValues(series);
        console.log('Scope Artifacts Series added to DB:');

        // update team budget paths
        const teamBudgetPath = new TeamBudgetPath();
        await teamBudgetPath.updateTeamBudgetPath();
        console.log('Updated team budget paths');
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
                    const selectedBudget = budgets.find((b: any) => b.id === budgetCap.budgetId);
                    const fn = budgetCap.start !== null && budgetCap.end !== null ? 'DssVest' : 'Single';
                    let serie: any = {
                        start: budgetCap.start,
                        end: budgetCap.end,
                        source: budgetSource,
                        value: budgetCap.amount,
                        unit: budgetCap.currency,
                        metric: "Budget",
                        fn: fn,
                        dimensions: {
                            budget: AnalyticsPath.fromString(budget.codePath),
                        },
                        dimensionMetadata: {
                            path: AnalyticsPath.fromString(budget.codePath),
                            icon: budget.image || null,
                            description: budget.description || null
                        }
                    }
                    // needs to expand char varying length in db to add image and description
                    // if (budget.image) {
                    //     serie = {
                    //         ...serie,
                    //         dimensions: {
                    //             ...serie.dimensions,
                    //             image: AnalyticsPath.fromString(budget.image),
                    //         }
                    //     }
                    // }
                    // if (budget.description) {
                    //     serie = {
                    //         ...serie,
                    //         dimensions: {
                    //             ...serie.dimensions,
                    //             description: AnalyticsPath.fromString(budget.description),
                    //         }
                    //     }
                    // }
                    series.push(serie);
                });
            }
        });
        return series;
    }

    addBudgetPaths(
        budgets: any[],
        parentId: number | string | null,
        idPath: string,
        codePath: string,
    ) {
        for (const budget of budgets) {
            if (budget.parentId == parentId) {
                budget.idPath = idPath + budget.id;
                budget.codePath = codePath + (budget.code || "");
                this.addBudgetPaths(
                    budgets,
                    budget.id,
                    budget.idPath + "/",
                    budget.codePath + "/",
                );
            }
        }
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
        fs.writeFile(`src/scopeArtifacts/${fileName}.json`, JSON.stringify(data), (err) => {
            if (err) throw err;
            console.log(`The ${fileName} file has been saved!`);
        });
    };


    // Structures the budgets data in a hierarchical way
    private structureData(data: any) {
        let hierarchy: any = {};
        let currentL0: string = "", currentL1: string = "", currentL2: string = "", currentL3: string = "", currentL4: string = "", currentL5: string = "";

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
                // hierarchy[currentL0][currentL1][currentL2][currentL3][item.L3 + counter++] = item;
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

            if (item.L5) {
                currentL5 = item.L5;
                if (!hierarchy[currentL0]) hierarchy[currentL0] = {};
                if (!hierarchy[currentL0][currentL1]) hierarchy[currentL0][currentL1] = {};
                if (!hierarchy[currentL0][currentL1][currentL2]) hierarchy[currentL0][currentL1][currentL2] = {};
                if (!hierarchy[currentL0][currentL1][currentL2][currentL3]) hierarchy[currentL0][currentL1][currentL2][currentL3] = {};
                if (!hierarchy[currentL0][currentL1][currentL2][currentL3][currentL4]) hierarchy[currentL0][currentL1][currentL2][currentL3][currentL4] = {};
                hierarchy[currentL0][currentL1][currentL2][currentL3][currentL4][currentL5] = item;
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
            inputDate == '?' ||
            inputDate == '-'
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
    private async processObject(obj: any, parentId: any, budgets: any[], budgetCaps: any[]) {

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
                    description: obj[key]['Atlas Reference/ Budget description'],
                    image: obj[key]['Image'],
                    subtitle: obj[key]['Budget subtitle ']
                }

                if(name == 'BALabs0') {
                    console.log(obj[key]['Atlas Reference/ Budget description']);
                }

                if (!sameBudget) {
                    budgets.push(budget);
                }

                // Adding immediate DAI budget caps
                const immediateAmount = obj[key]['Immediate Budget (DAI)'];
                const startDate = this.formatToTimeZone(obj[key]['Approved by Executive vote/Source of Truth']);
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

                // Adding SKY budget caps
                const skyAmount = obj[key]['SKY Commited Budget'] || 0;
                const skyStart = this.formatToTimeZone(obj[key]['SKY Start Date']) || null;
                const skyEnd = this.formatToTimeZone(obj[key]['SKY End Date']) || null;
                if (skyAmount !== 0 && skyStart !== skyEnd) {
                    budgetCaps.push({
                        budgetId: id,
                        amount: skyAmount,
                        currency: 'SKY',
                        start: skyStart,
                        end: skyEnd
                    });
                }

                this.processObject(obj[key], id, budgets, budgetCaps);
            }
        }
    }

};
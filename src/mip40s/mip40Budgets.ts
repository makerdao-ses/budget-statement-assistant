import { AnalyticsPath } from "../utils/analytics/AnalyticsPath.js"
import { AnalyticsMetric } from "../utils/analytics/AnalyticsQuery.js"
import { AnalyticsStore } from "../utils/analytics/AnalyticsStore.js"
import knex from 'knex';
import { eachMonthOfInterval } from "date-fns";

export default class Mip40BudgetScript {

    db: any;

    constructor() {
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
    }

    public insertInAnalyticsStore = async () => {


        const store = new AnalyticsStore(this.db);
        const series: any = await this.createSeries();
        console.log('Mip40 series created: ', series.length);

        // clean old data from DB, 'atlasBudget/...' is the source of all budgets
        await store.clearSeriesBySource(AnalyticsPath.fromString('powerhouse/legacy-api/mip40'));

        // insert new data
        const insertedSeries = await store.addSeriesValues(series);
        console.log('Mip40 series added to DB: ', insertedSeries.length);

    }

    private createSeries = async () => {
        const mip40Budgets = await this.getMip40Budgets();

        const series: any = [];

        for (const mip40Budget of mip40Budgets) {
            const { mip40BudgetPeriod, mip40Wallet } = mip40Budget;

            const cuCode = await this.getCuCode(mip40Budget.mip40Spn);
            const source = AnalyticsPath.fromString(`powerhouse/legacy-api/mip40/${mip40Budget.mip40Spn}`)

            // Skip if there is a budget period
            if (mip40BudgetPeriod.length === 0) continue;
            const { budgetPeriodStart, budgetPeriodEnd } = mip40BudgetPeriod[0];

            if (mip40Wallet.length > 0) {
                mip40Wallet.forEach((wallet: any) => {
                    // MKR Only Budget Serie
                    if (mip40Budget.mkrOnly) {
                        const mkrSerie = {
                            start: new Date(budgetPeriodStart),
                            end: new Date(budgetPeriodEnd),
                            source,
                            unit: 'MKR',
                            value: 0,
                            metric: AnalyticsMetric.Budget,
                            dimensions: {
                                budget: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                wallet: AnalyticsPath.fromString(`atlas/${wallet.name}`),

                            }
                        }
                        series.push(mkrSerie)
                    }
                    // DAI budget serie
                    if (!mip40Budget.mkrOnly && wallet.mip40BudgetLineItem.length > 0) {

                        // Get number of months in budget period
                        const nrOfmonths = eachMonthOfInterval({ start: new Date(budgetPeriodStart), end: new Date(budgetPeriodEnd) }).length;

                        wallet.mip40BudgetLineItem.forEach((lineItem: any) => {
                            const totalBudget = lineItem.budgetCap * nrOfmonths;
                            const headCount = lineItem.headcountExpense ? 'headcount' : 'non-headcount';
                            let serie = {
                                start: new Date(budgetPeriodStart),
                                end: new Date(budgetPeriodEnd),
                                source,
                                value: budgetPeriodStart !== null && budgetPeriodEnd !== null ? totalBudget : lineItem.budgetCap,
                                unit: 'DAI',
                                metric: AnalyticsMetric.Budget,
                                dimensions: {
                                    budget: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                    category: AnalyticsPath.fromString(`atlas/${headCount}/mip40/${mip40Budget.mip40Spn}/${wallet.address}/${lineItem.budgetCategory}`),
                                    wallet: AnalyticsPath.fromString(`atlas/${wallet.name}`),
                                }
                            }
                            series.push(serie);
                        })
                    }
                });
            }
        }

        return series;
    }


    private getMip40Budgets = async () => {
        const query = `
            query Mip40s {
                mip40s {
                id
                cuMipId
                mip40Spn
                mkrOnly
                mkrProgramLength
                mip40BudgetPeriod {
                    id
                    mip40Id
                    budgetPeriodStart
                    budgetPeriodEnd
                    ftes
                }
                mip40Wallet {
                    id
                    mip40Id
                    address
                    name
                    signersTotal
                    signersRequired
                    clawbackLimit
                    mip40BudgetLineItem {
                    id
                    mip40WalletId
                    position
                    budgetCategory
                    budgetCap
                    canonicalBudgetCategory
                    group
                    headcountExpense
                    }
                }
                }
            }
        `;

        try {
            const response = await fetch('https://publish-dev-vpighsmr70zxa92r9w.herokuapp.com/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ query }),
            });
            const data = await response.json();
            return data.data.mip40s;
        } catch (error) {
            console.error(error)
        }
    }

    private getCuCode = async (mipCode: string) => {
        const cuId = await this.db('CuMip').where('mipCode', mipCode).select('cuId');
        const cu = await this.db('CoreUnit').where('id', cuId[0].cuId).select('code');
        return cu[0].code;
    }
}

new Mip40BudgetScript().insertInAnalyticsStore();
import { AnalyticsPath } from "../utils/analytics/AnalyticsPath.js"
import { AnalyticsStore } from "../utils/analytics/AnalyticsStore.js"
import knex from 'knex';
import { eachMonthOfInterval, startOfMonth, endOfMonth, parseISO, addMonths, format } from "date-fns";

export default class Mip40BudgetScript {

    db: any;
    mip40Spn: string | undefined;

    constructor(mip40Spn: string | undefined) {
        this.mip40Spn = mip40Spn;
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
    }

    public insertInAnalyticsStore = async () => {
        const store = new AnalyticsStore(this.db);
        const series: any = await this.createSeries();
        console.log('Mip40 series created: ', series.length);


        let path = 'powerhouse/legacy-api/mip40';
        if (this.mip40Spn) {
            path = path + '/' + this.mip40Spn;
        }
        // clean old mip40 series
        await store.clearSeriesBySource(AnalyticsPath.fromString(path), true);

        // insert new data
        await store.addSeriesValues(series);
        console.log('Mip40 series added to DB');
    }

    private createSeries = async () => {
        let mip40Budgets = await this.getMip40Budgets();
        if (this.mip40Spn) {
            mip40Budgets = mip40Budgets.filter((mip40Budget: any) => mip40Budget.mip40Spn === this.mip40Spn);
        }

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
                            metric: 'Budget',
                            dimensions: {
                                budget: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                wallet: AnalyticsPath.fromString(`atlas/${wallet.name}`),

                            },
                            dimensionMetadata: {
                                path: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                label: mip40Budget.mip40Spn || null
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

                            if (nrOfmonths > 1) {
                                const monthly = this.getListOfMonths(parseISO(budgetPeriodStart), parseISO(budgetPeriodEnd));
                                for (let i = 0; i < nrOfmonths; i++) {
                                    let serie = {
                                        start: monthly[i].periodStart,
                                        end: monthly[i].periodEnd,
                                        source,
                                        value: lineItem.budgetCap,
                                        unit: 'DAI',
                                        metric: 'Budget',
                                        dimensions: {
                                            budget: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                            category: AnalyticsPath.fromString(`atlas/${headCount}/mip40/${mip40Budget.mip40Spn}/${wallet.address}/${lineItem.budgetCategory}`),
                                            wallet: AnalyticsPath.fromString(`atlas/${wallet.name}`),
                                        },
                                        dimensionMetadata: {
                                            path: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                            label: mip40Budget.mip40Spn || null
                                        }
                                    }
                                    series.push(serie);
                                }
                            } else {
                                let serie = {
                                    start: new Date(budgetPeriodStart),
                                    end: new Date(budgetPeriodEnd),
                                    source,
                                    value: budgetPeriodStart !== null && budgetPeriodEnd !== null ? totalBudget : lineItem.budgetCap,
                                    unit: 'DAI',
                                    metric: 'Budget',
                                    dimensions: {
                                        budget: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                        category: AnalyticsPath.fromString(`atlas/${headCount}/mip40/${mip40Budget.mip40Spn}/${wallet.address}/${lineItem.budgetCategory}`),
                                        wallet: AnalyticsPath.fromString(`atlas/${wallet.name}`),
                                    },
                                    dimensionMetadata: {
                                        path: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                        label: mip40Budget.mip40Spn || null
                                    }
                                }
                                series.push(serie);
                            }
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
            const response = await fetch('https://ecosystem-dashboard.herokuapp.com/graphql', {
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

    private getListOfMonths = (periodStart: Date, periodEnd: Date) => {

        let currentMonth = startOfMonth(periodStart);
        const endMonth = startOfMonth(periodEnd);

        const periods = [];

        while (currentMonth <= endMonth) {
            const startOfMonthDate = currentMonth;
            const endOfMonthDate = startOfMonth(addMonths(currentMonth, 1));

            periods.push({
                periodStart: format(startOfMonthDate, 'yyyy-MM-dd'),
                periodEnd: format(endOfMonthDate, 'yyyy-MM-dd')
            });

            // Move to the next month
            currentMonth = addMonths(currentMonth, 1);
        }

        return periods;
    }
};
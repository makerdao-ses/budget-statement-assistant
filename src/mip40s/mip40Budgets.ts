import { AnalyticsPath } from "../utils/analytics/AnalyticsPath.js"
import { AnalyticsStore } from "../utils/analytics/AnalyticsStore.js"
import knex from 'knex';
import { eachMonthOfInterval, startOfMonth, isWithinInterval, isBefore, isAfter, isEqual, subDays, parseISO, addMonths, format } from "date-fns";

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
        let cuMips = await this.getMip40Budgets();
        
        // Group cuMips by cuId
        const groupedCuMips = cuMips.reduce((acc: any, cuMip: any) => {
            if (!acc[cuMip.cuId]) {
                acc[cuMip.cuId] = [];
            }
            acc[cuMip.cuId].push(cuMip);
            return acc;
        }, {});

        // Fix overlapping periods for each group
        let fixedCuMips: any[] = [];
        for (const cuId in groupedCuMips) {
            fixedCuMips = [...fixedCuMips, ...this.fixOverlappingPeriods(groupedCuMips[cuId], cuId)];
        }

        if (this.mip40Spn) {
            fixedCuMips = fixedCuMips.filter((cuMip: any) => cuMip.mip40[0]?.mip40Spn === this.mip40Spn);
        }

        const series: any = [];

        for (const cuMip of fixedCuMips) {
            const mip40Budget = cuMip.mip40[0];
            if (!mip40Budget) continue;

            const { mip40BudgetPeriod, mip40Wallet } = mip40Budget;

            const cuCode = await this.getCuCode(mip40Budget.mip40Spn);
            const source = AnalyticsPath.fromString(`powerhouse/legacy-api/mip40/${mip40Budget.mip40Spn}`)

            // Skip if there is no budget period
            if (!mip40BudgetPeriod || mip40BudgetPeriod.length === 0) {
                // console.log(`Skipping MIP ${mip40Budget.mip40Spn} due to missing budget period`);
                continue;
            }
            const { budgetPeriodStart, budgetPeriodEnd } = mip40BudgetPeriod[0];

            if (!budgetPeriodStart || !budgetPeriodEnd) {
                // console.log(`Invalid budget period for MIP ${mip40Budget.mip40Spn}: ${budgetPeriodStart} - ${budgetPeriodEnd}`);
                continue;
            }

            const startDate = new Date(budgetPeriodStart);
            const endDate = new Date(budgetPeriodEnd);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                // console.log(`Invalid date for MIP ${mip40Budget.mip40Spn}: ${budgetPeriodStart} - ${budgetPeriodEnd}`);
                continue;
            }

            if (isAfter(startDate, endDate)) {
                // console.log(`Start date is after end date for MIP ${mip40Budget.mip40Spn}: ${budgetPeriodStart} - ${budgetPeriodEnd}`);
                continue;
            }

            if (mip40Wallet.length > 0) {
                mip40Wallet.forEach((wallet: any) => {
                    // MKR Only Budget Serie
                    if (mip40Budget.mkrOnly) {
                        const mkrSerie = {
                            start: startDate,
                            end: endDate,
                            source,
                            unit: 'MKR',
                            value: 0,
                            metric: 'Budget',
                            dimensions: {
                                budget: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                wallet: AnalyticsPath.fromString(`atlas/${wallet.name}`),
                                spn: AnalyticsPath.fromString(`atlas/legacy/${mip40Budget.mip40Spn}`),
                            },
                            // dimensionMetadata: {
                            //     path: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                            //     label: mip40Budget.mip40Spn || null
                            // }
                        }
                        series.push(mkrSerie)
                    }
                    // DAI budget serie
                    if (!mip40Budget.mkrOnly && wallet.mip40BudgetLineItem.length > 0) {
                        try {
                            // Get number of months in budget period
                            const nrOfmonths = eachMonthOfInterval({ start: startDate, end: endDate }).length;

                            wallet.mip40BudgetLineItem.forEach((lineItem: any) => {
                                const totalBudget = lineItem.budgetCap * nrOfmonths;
                                const headCount = lineItem.headcountExpense ? 'headcount' : 'non-headcount';

                                if (nrOfmonths > 1) {
                                    const monthly = this.getListOfMonths(startDate, endDate);
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
                                                spn: AnalyticsPath.fromString(`atlas/legacy/${mip40Budget.mip40Spn}`),
                                            },
                                            // dimensionMetadata: {
                                            //     path: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                            //     label: mip40Budget.mip40Spn || null
                                            // }
                                        }
                                        series.push(serie);
                                    }
                                } else {
                                    let serie = {
                                        start: startDate,
                                        end: endDate,
                                        source,
                                        value: totalBudget,
                                        unit: 'DAI',
                                        metric: 'Budget',
                                        dimensions: {
                                            budget: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                            category: AnalyticsPath.fromString(`atlas/${headCount}/mip40/${mip40Budget.mip40Spn}/${wallet.address}/${lineItem.budgetCategory}`),
                                            wallet: AnalyticsPath.fromString(`atlas/${wallet.name}`),
                                            spn: AnalyticsPath.fromString(`atlas/legacy/${mip40Budget.mip40Spn}`),
                                        },
                                        // dimensionMetadata: {
                                        //     path: AnalyticsPath.fromString(`atlas/legacy/core-units/${cuCode}`),
                                        //     label: mip40Budget.mip40Spn || null
                                        // }
                                    }
                                    series.push(serie);
                                }
                            })
                        } catch (error) {
                            console.error(`Error processing MIP ${mip40Budget.mip40Spn}:`, error);
                        }
                    }
                });
            }
        }

        return series;
    }

    private fixOverlappingPeriods = (cuMips: any, cuId: string) => {
        // Separate MKR-only and non-MKR-only MIPs
        const mkrOnlyMips = cuMips.filter((cuMip: any) =>
            cuMip.cuId === cuId &&
            cuMip.mip40 &&
            cuMip.mip40.length > 0 &&
            cuMip.mip40[0].mkrOnly
        );

        const nonMkrOnlyMips = cuMips.filter((cuMip: any) =>
            cuMip.cuId === cuId &&
            cuMip.mip40 &&
            cuMip.mip40.length > 0 &&
            !cuMip.mip40[0].mkrOnly
        );

        // Function to sort and fix overlaps
        const sortAndFixOverlaps = (mips: any[]) => {
            mips.sort((a: any, b: any) => {
                const aStart = a.mip40[0]?.mip40BudgetPeriod?.[0]?.budgetPeriodStart;
                const bStart = b.mip40[0]?.mip40BudgetPeriod?.[0]?.budgetPeriodStart;
                if (!aStart || !bStart) return 0;
                return new Date(aStart).getTime() - new Date(bStart).getTime();
            });

            for (let i = 0; i < mips.length - 1; i++) {
                const currentMip = mips[i].mip40[0];
                const nextMip = mips[i + 1].mip40[0];

                if (!currentMip?.mip40BudgetPeriod?.[0] || !nextMip?.mip40BudgetPeriod?.[0]) continue;

                const currentEnd = new Date(currentMip.mip40BudgetPeriod[0].budgetPeriodEnd);
                const nextStart = new Date(nextMip.mip40BudgetPeriod[0].budgetPeriodStart);

                if (isAfter(currentEnd, nextStart) || isEqual(currentEnd, nextStart)) {
                    currentMip.mip40BudgetPeriod[0].budgetPeriodEnd = subDays(nextStart, 1).toISOString().split('T')[0];
                    // console.log(`Overlap fixed for ${currentMip.mkrOnly ? 'MKR-only' : 'non-MKR-only'} MIP ${currentMip.mip40Spn} and ${nextMip.mip40Spn}`);
                }
            }

            return mips;
        };

        // Fix overlaps for MKR-only and non-MKR-only MIPs separately
        const fixedMkrOnlyMips = sortAndFixOverlaps(mkrOnlyMips);
        const fixedNonMkrOnlyMips = sortAndFixOverlaps(nonMkrOnlyMips);

        // Log the fixed periods
        [...fixedMkrOnlyMips, ...fixedNonMkrOnlyMips].forEach((mip: any) => {
            const { mip40BudgetPeriod, mip40Spn, mkrOnly } = mip.mip40[0];
            if (mip40BudgetPeriod && mip40BudgetPeriod[0]) {
                // console.log(`${mkrOnly ? 'MKR-only' : 'Non-MKR-only'} ${mip40Spn}: ${mip40BudgetPeriod[0].budgetPeriodStart} - ${mip40BudgetPeriod[0].budgetPeriodEnd}`);
            }
        });

        // Return the combined fixed MIPs
        return [...fixedMkrOnlyMips, ...fixedNonMkrOnlyMips];
    }

    private getMip40Budgets = async () => {
        const query = `
            query CuMips {
                cuMips {
                    id
                    cuId
                    mip40 {
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
            return data.data.cuMips;
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
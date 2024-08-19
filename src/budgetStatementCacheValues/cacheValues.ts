import knex, { Knex } from 'knex';
import AnalyticsModel from '../utils/analytics/AnalyticsDBModel.js';

export default class BudgetStatementCacheValues {

    db: any;
    analyticsModel: any;

    constructor() {
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
        this.analyticsModel = AnalyticsModel(this.db);
    }

    public async insertCacheValues() {

        const rowsToInsert = await this.getAnalyticsBySnapshot();
        if (rowsToInsert.length < 1) return;
        //Before inserting, truncate the table
        await this.truncateTable();
        console.log('Truncated BudgetStatementCacheValues');
        const result = await this.insertRows(rowsToInsert);
        console.log('Inserted', result.length, 'rows into BudgetStatementCacheValues');
        process.exit(0);
    };

    private async truncateTable() {
        return await this.db('BudgetStatementCacheValues').truncate();
    }

    private async getSnapshots() {

        const result = await this.db('Snapshot')
            .select('*');

        const snapshots = result.map((snapshot: any) => {
            // Add one hour to the date
            snapshot.month.setUTCHours(snapshot.month.getUTCHours() + 1);
            return {
                ...snapshot,
                month: snapshot.month.toISOString().slice(0, 7).split('-').join('/'),
            }
        });
        return snapshots;


    }

    private async getAnalyticsBySnapshot() {

        // Get snapshots
        const snapshotResult = await this.getSnapshots();

        const rowsToInsert: any[] = [];

        for (const snapshot of snapshotResult) {
            const analytics = await this.getAnalytics(snapshot.month, snapshot.ownerType, snapshot.ownerId);
            const comparisonValues = analytics.find((a: any) => a.period === snapshot.month);

            rowsToInsert.push({
                snapshotId: snapshot.id,
                month: snapshot.month,
                currency: 'DAI',
                reportedActuals: parseFloat((comparisonValues?.actuals ?? 0).toFixed(4)),
                onChainOnlyAmount: parseFloat(comparisonValues?.paymentsOnChain ?? 0).toFixed(4),
                onChainOnlyDifference: this.calcDifference(comparisonValues?.paymentsOnChain ?? 0, comparisonValues?.actuals ?? 0),
                offChainIncludedAmount: parseFloat(comparisonValues?.paymentsOffChain ?? 0),
                offChainIncludedDifference: this.calcDifference(comparisonValues?.paymentsOffChain ?? 0, comparisonValues?.actuals ?? 0),
                ownerId: snapshot.ownerId,
            });
        }

        return rowsToInsert;

    };

    private async getAnalytics(start: string, ownerType: string, ownerId: string) {

        // if end is null then set it to the start month + 2
        let end = null;
        const endDate = new Date(start);
        endDate.setMonth(endDate.getMonth() + 4);
        end = endDate.toISOString().slice(0, 7);

        const filter = {
            start,
            end: end,
            granularity: 'total',
            metrics: ['Actuals', 'PaymentsOnChain', 'PaymentsOffChainIncluded'],
            dimensions: [
                { name: 'report', select: `atlas/${ownerType}/${ownerId}`, lod: 5 }
            ],
            currency: 'DAI'
        }

        const queryEngine = this.analyticsModel
        const results = await queryEngine.query(filter);

        if (!results || results.length < 1) return [];

        const result: any = results[0]?.rows.reduce((acc: any, r: any) => {
            const period = r.dimensions.report.path.split('/').slice(-2).join('/'); // Extracts '2023/07' from 'atlas/CoreUnit/1/2023/07'
            if (!acc[period]) {
                acc[period] = {
                    period,
                    actuals: null,
                    paymentsOnChain: null,
                    paymentsOffChain: null,
                };
            }
            if (r.metric == 'Actuals') acc[period].actuals = r.sum;
            if (r.metric == 'PaymentsOnChain') acc[period].paymentsOnChain = r.sum;
            if (r.metric == 'PaymentsOffChainIncluded') acc[period].paymentsOffChain = r.sum;
            return acc;
        }, {});

        const finalResult: any = Object.values(result);

        return finalResult;

    }

    private calcDifference = (a: number, b: number) => {
        if (!a || !b) return 0;
        return (Math.abs(a) / Math.abs(b)) - 1;
    }

    private async insertRows(rows: any) {
        return await this.db('BudgetStatementCacheValues').insert(rows).returning('id');
    }


}

// const cacheValues = new BudgetStatementCacheValues();
// await cacheValues.insertCacheValues();



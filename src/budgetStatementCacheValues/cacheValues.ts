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
        console.log('rowsToInsert', rowsToInsert.length)
        const result = await this.insertRows(rowsToInsert);
        console.log('Inserted', result.length, 'rows into BudgetStatementCacheValues');
        process.exit(0);
    };

    private async getSnapshots() {

        const result = await this.db('Snapshot')
            .select('id', 'month', 'end', 'ownerType', 'ownerId');

        const snapshots = result.map((snapshot: any) => {
            return {
                ...snapshot,
                month: snapshot.month.toISOString().slice(0, 7).split('-').join('/'),
            }
        });
        console.log(snapshots.length)
        snapshots.forEach((snapshot: any) => {
            if(snapshot.month == null) {
                console.log('found null month', snapshot.id, snapshot.ownerType, snapshot.ownerId)
            }
        });
        return snapshots;


    }

    private async getAnalyticsBySnapshot() {

        /*

        snapshotId
        month
        currency
        reportedActuals
        onChainOnlyAmount
        onChainOnlyDifference
        offChainIncludedAmount
        offChainIncludedDifference
        
        */

        // Get snapshots
        const snapshotResult = await this.getSnapshots();
        const analytics = await this.getAnalytics(snapshotResult[0].month, snapshotResult[0].ownerType, snapshotResult[0].ownerId);

        if (analytics.length < 1) return [];

        const rowsToinsert = snapshotResult.map((snapshot: any) => {
            const comparissonValues = analytics.find((row: any) => {
                return row.period === snapshot.month;
            })

            if (!comparissonValues) return null;

            return {
                snapshotId: snapshot.id,
                month: snapshot.month,
                currency: 'DAI',
                reportedActuals: comparissonValues.actuals ?? 0,
                onChainOnlyAmount: comparissonValues.paymentsOnChain ?? 0,
                onChainOnlyDifference: this.calcDifference(comparissonValues.paymentsOnChain ?? 0, comparissonValues.actuals ?? 0),
                offChainIncludedAmount: comparissonValues.paymentsOffChain ?? 0,
                offChainIncludedDifference: this.calcDifference(comparissonValues.paymentsOffChain ?? 0, comparissonValues.actuals ?? 0),
                ownerId: snapshot.ownerId,
            }
        })
        .map((item: any) => {
            return {
                ...item,
                month: new Date(item.month.split('/').join('-') + '-01').toISOString().split('T')[0],
            }
        });

        return rowsToinsert;

    };

    private async getAnalytics(start: string, ownerType: string, ownerId: string) {

        // if end is null then set it to the start month + 2
        let end = null;
        const endDate = new Date(start);
        endDate.setMonth(endDate.getMonth() + 2);
        end = endDate.toISOString().slice(0, 7).split('-').join('/');

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
            if (r.metric == 'Actuals') acc[period].actuals = r.value;
            if (r.metric == 'PaymentsOnChain') acc[period].paymentsOnChain = r.value;
            if (r.metric == 'PaymentsOffChainIncluded') acc[period].paymentsOffChain = r.value;
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
        console.log('rows', rows[0])
        return await this.db('BudgetStatementCacheValues').insert(rows).returning('id');
    }


}

const cacheValues = new BudgetStatementCacheValues();
cacheValues.insertCacheValues();

/*

snapshotId
month
currency
reportedActuals
onChainOnlyAmount
onChainOnlyDifference
offChainIncludedAmount
offChainIncludedDifference

*/


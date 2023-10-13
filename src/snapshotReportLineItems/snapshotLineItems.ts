import { AnalyticsPath } from "../utils/analytics/AnalyticsPath.js";
import { AnalyticsMetric } from "../utils/analytics/AnalyticsQuery.js";
import { AnalyticsStore } from "../utils/analytics/AnalyticsStore.js";
import knex from 'knex';

class SnapshotLineItemsScript {

    db: any;

    constructor() {
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
    }

    public insertInAnalyticsStore = async () => {
        const series = await this.createSeries();
        console.log('created series', series.length);
        const store = new AnalyticsStore(this.db);

        // clean old lineItem series
        await store.clearSeriesBySource(AnalyticsPath.fromString('powerhouse/legacy-api/snapshot-reports'));

        // insert new data
        const insertedSeries = await store.addSeriesValues(series);
        console.log('inserted series', insertedSeries.length);

        // exit the process
        process.exit();
    }

    private createSeries = async () => {
        const snapshots = await this.getSnapshotLineItems();

        const series: any = [];

        for (let i = 0; i < snapshots.length; i++) {
            const snapshot = snapshots[i];
            const budgetType = await this.getBudgetType(snapshot.ownerType, snapshot.ownerId);

            const serie = {
                start: snapshot.timestamp,
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/snapshot-reports/${snapshot.id}`),
                unit: snapshot.token,
                value: snapshot.amount,
                metric: AnalyticsMetric.PaymentsOnChain,
                fn: 'Single',
                dimensions: {
                    wallet: AnalyticsPath.fromString(`atlas/${snapshot.accountAddress}`),
                    transactionType: AnalyticsPath.fromString(`atlas/${snapshot.txLabel}`),
                    budget: AnalyticsPath.fromString(`atlas/${budgetType}`),
                }
            };
            series.push(serie);
        }
        return series;
    }

    private getBudgetType = async (ownerType: string, ownerId: number) => {
        const cu = await this.db('CoreUnit').where('id', ownerId).select('code');

        switch (ownerType) {
            case 'CoreUnit': return `legacy/core-units/${cu[0].code}`;
            case 'Delegates': return 'legacy/recognized-delegates';
            case 'EcosystemActor': return `scopes/SUP/incubation/${cu[0].code}`;
            case 'Keepers': return 'legacy/keepers';
            case 'SpecialPurposeFund': return 'legacy/spfs';
            case 'AlignedDelegates': return 'immutable/ads'
            default: return 'atlas/snapshot/unknown';
        }
    }

    private getSnapshotLineItems = async () => {
        const result = await this.db('Snapshot')
            .join('SnapshotAccount', 'SnapshotAccount.snapshotId', 'Snapshot.id')
            .join('SnapshotAccountTransaction', 'SnapshotAccountTransaction.snapshotAccountId', 'SnapshotAccount.id')
            .where('SnapshotAccount.accountType', 'singular')
            .where('SnapshotAccount.offChain', false);

        return result;
    }
}

new SnapshotLineItemsScript().insertInAnalyticsStore();
import { AnalyticsPath } from "../utils/analytics/AnalyticsPath.js";
import { AnalyticsStore } from "../utils/analytics/AnalyticsStore.js";
import knex from 'knex';

export default class SnapshotLineItemsScript {

    db: any;
    snapshotId: number | undefined;

    constructor(snapshotId: number | undefined) {
        this.snapshotId = snapshotId;
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
    }

    public insertInAnalyticsStore = async () => {
        const series = await this.createSeries();
        console.log('Snapshot lineitems series created', series.length);
        const store = new AnalyticsStore(this.db);

        // clean old lineItem series
        await store.clearSeriesBySource(AnalyticsPath.fromString('powerhouse/legacy-api/snapshot-reports'), true);

        // insert new data
        await store.addSeriesValues(series);
        console.log('Snapshot lineitems inserted series');

    }

    private createSeries = async () => {
        const snapshotsOnChain = await this.getSnapshotLineItems();
        const snapshotsOffChain = await this.getSnapshotLineItemsOffChain();
        const snapshotsProtocolNetOutFlow = await this.getSnapshotLineItemsProtocolNetOutfLow();

        const series: any = [];

        // adding on-chain snapshots
        for (let i = 0; i < snapshotsOnChain.length; i++) {
            const snapshot = snapshotsOnChain[i];
            const budgetType = await this.getBudgetType(snapshot.ownerType, snapshot.ownerId);

            const serie = {
                start: snapshot.timestamp,
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/snapshot-reports/${snapshot.snapshotId}`),
                unit: snapshot.token,
                value: snapshot.amount,
                metric: 'PaymentsOnChain',
                fn: 'Single',
                dimensions: {
                    wallet: AnalyticsPath.fromString(`atlas/${snapshot.accountAddress}`),
                    transactionType: AnalyticsPath.fromString(`atlas/${snapshot.txLabel}`),
                    budget: AnalyticsPath.fromString(`atlas/${budgetType}`),
                    report: AnalyticsPath.fromString(`atlas/${snapshot.ownerType}/${snapshot.ownerId}/${this.getYearAndMonth(snapshot.month)}`),
                }
            };
            series.push(serie);
        }

        // adding off-chain snapshots
        for (let i = 0; i < snapshotsOffChain.length; i++) {
            const snapshot = snapshotsOffChain[i];
            const budgetType = await this.getBudgetType(snapshot.ownerType, snapshot.ownerId);

            const serie = {
                start: snapshot.timestamp,
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/snapshot-reports/${snapshot.snapshotId}`),
                unit: snapshot.token,
                value: snapshot.amount,
                metric: 'PaymentsOffChainIncluded',
                fn: 'Single',
                dimensions: {
                    wallet: AnalyticsPath.fromString(`atlas/${snapshot.accountAddress}`),
                    transactionType: AnalyticsPath.fromString(`atlas/${snapshot.txLabel}`),
                    budget: AnalyticsPath.fromString(`atlas/${budgetType}`),
                    report: AnalyticsPath.fromString(`atlas/${snapshot.ownerType}/${snapshot.ownerId}/${this.getYearAndMonth(snapshot.month)}`),
                }
            };
            series.push(serie);
        }

        // adding protocol net outflow snapshots
        for (let i = 0; i < snapshotsProtocolNetOutFlow.length; i++) {
            const snapshot = snapshotsProtocolNetOutFlow[i];
            const budgetType = await this.getBudgetType(snapshot.ownerType, snapshot.ownerId);

            const serie = {
                start: snapshot.timestamp,
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/snapshot-reports/${snapshot.snapshotId}`),
                unit: snapshot.token,
                value: snapshot.amount,
                metric: 'ProtocolNetOutflow',
                fn: 'Single',
                dimensions: {
                    wallet: AnalyticsPath.fromString(`atlas/${snapshot.accountAddress}`),
                    transactionType: AnalyticsPath.fromString(`atlas/${snapshot.txLabel}`),
                    budget: AnalyticsPath.fromString(`atlas/${budgetType}`),
                    report: AnalyticsPath.fromString(`atlas/${snapshot.ownerType}/${snapshot.ownerId}/${this.getYearAndMonth(snapshot.month)}`),
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
            case 'AlignedDelegates': return 'immutable/ads';
            default: {
                return `snapshot/unknown/${ownerType}/${cu[0].code}]}`;
            }
        }
    }

    private getYearAndMonth(dateString: Date) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based in JavaScript
        return `${year}/${month}`;
    }

    private getSnapshotLineItems = async () => {
        const baseQuery = this.db('Snapshot')
            .select('snapshotId', 'timestamp', 'amount', 'token', 'accountAddress', 'txLabel', 'ownerType', 'ownerId', 'month')
            .join('SnapshotAccount', 'SnapshotAccount.snapshotId', 'Snapshot.id')
            .join('SnapshotAccountTransaction', 'SnapshotAccountTransaction.snapshotAccountId', 'SnapshotAccount.id')
            .where('SnapshotAccount.accountType', 'singular')
            .where('SnapshotAccount.offChain', false);

        if (this.snapshotId) {
            baseQuery.where('Snapshot.id', this.snapshotId);
        }

        return await baseQuery;
    }

    private getSnapshotLineItemsOffChain = async () => {
        const baseQuery = this.db('Snapshot')
            .select('snapshotId', 'timestamp', 'amount', 'token', 'accountAddress', 'txLabel', 'ownerType', 'ownerId', 'month')
            .join('SnapshotAccount', 'SnapshotAccount.snapshotId', 'Snapshot.id')
            .join('SnapshotAccountTransaction', 'SnapshotAccountTransaction.snapshotAccountId', 'SnapshotAccount.id')
            .where('SnapshotAccount.accountType', 'singular');

        if (this.snapshotId) {
            baseQuery.where('Snapshot.id', this.snapshotId);
        }

        return await baseQuery;
    }

    private getSnapshotLineItemsProtocolNetOutfLow = async () => {
        const baseQuery = this.db('Snapshot')
            .select('snapshotId', 'timestamp', 'amount', 'token', 'accountAddress', 'txLabel', 'ownerType', 'ownerId', 'month')
            .join('SnapshotAccount', 'SnapshotAccount.snapshotId', 'Snapshot.id')
            .join('SnapshotAccountTransaction', 'SnapshotAccountTransaction.snapshotAccountId', 'SnapshotAccount.id')
            .where('SnapshotAccount.accountType', 'singular')
            .where('SnapshotAccount.upstreamAccountId', null);

        if (this.snapshotId) {
            baseQuery.where('Snapshot.id', this.snapshotId);
        }

        return await baseQuery;
    }
};
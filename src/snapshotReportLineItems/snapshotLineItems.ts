import { AnalyticsPath } from "../utils/analytics/AnalyticsPath.js";
import { AnalyticsStore } from "../utils/analytics/AnalyticsStore.js";
import knex, { Knex } from 'knex';
import accounts from "./accounts.js"

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
        if (this.snapshotId) {
            await store.clearSeriesBySource(AnalyticsPath.fromString(`powerhouse/legacy-api/snapshot-reports/${this.snapshotId}`), true);
        } else {
            await store.clearSeriesBySource(AnalyticsPath.fromString('powerhouse/legacy-api/snapshot-reports'), true);
        }

        // insert new data
        await store.addSeriesValues(series);
        console.log('Snapshot lineitems inserted series');

        // Update materialized view with latest changes in the series
        await this.db.raw('REFRESH MATERIALIZED VIEW "BudgetPathMap"')
        console.log('Refreshed Materialized View BudgetPathMap');
    }

    private createSeries = async () => {
        const snapshotsOnChain = await this.getSnapshotLineItems();
        const snapshotsOffChain = await this.getSnapshotLineItemsOffChain();
        const snapshotsProtocolNetOutFlow = await this.getSnapshotLineItemsProtocolNetOutfLow();
        const auditorSnapshots = await this.getAuditorSnapshots();

        const series: any = [];

        // adding on-chain snapshots
        for (let i = 0; i < snapshotsOnChain.length; i++) {
            const snapshot = snapshotsOnChain[i];
            const budgetType = await this.getBudgetType(
                snapshot.ownerType,
                snapshot.ownerId,
                snapshot.accountLabel,
                snapshot.accountAddress,
                snapshot.timestamp
            );

            const serie = {
                start: snapshot.timestamp,
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/snapshot-reports/${snapshot.snapshotId}`),
                unit: snapshot.token,
                value: snapshot.amount * -1,
                metric: 'PaymentsOnChain',
                fn: 'Single',
                dimensions: {
                    wallet: AnalyticsPath.fromString(`atlas/${snapshot.accountAddress}`),
                    transactionType: AnalyticsPath.fromString(`atlas/${snapshot.txLabel}`),
                    budget: AnalyticsPath.fromString(`${budgetType}`),
                    report: AnalyticsPath.fromString(`atlas/${snapshot.ownerType}/${snapshot.ownerId}/${this.getYearAndMonth(snapshot.month)}`),
                }
            };
            series.push(serie);
        }

        // adding off-chain snapshots
        for (let i = 0; i < snapshotsOffChain.length; i++) {
            const snapshot = snapshotsOffChain[i];
            const budgetType = await this.getBudgetType(
                snapshot.ownerType,
                snapshot.ownerId,
                snapshot.accountLabel,
                snapshot.accountAddress,
                snapshot.timestamp
            );

            const serie = {
                start: snapshot.timestamp,
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/snapshot-reports/${snapshot.snapshotId}`),
                unit: snapshot.token,
                value: snapshot.amount * -1,
                metric: 'PaymentsOffChainIncluded',
                fn: 'Single',
                dimensions: {
                    wallet: AnalyticsPath.fromString(`atlas/${snapshot.accountAddress}`),
                    transactionType: AnalyticsPath.fromString(`atlas/${snapshot.txLabel}`),
                    budget: AnalyticsPath.fromString(`${budgetType}`),
                    report: AnalyticsPath.fromString(`atlas/${snapshot.ownerType}/${snapshot.ownerId}/${this.getYearAndMonth(snapshot.month)}`),
                }
            };
            series.push(serie);
        }

        // adding protocol net outflow snapshots
        for (let i = 0; i < snapshotsProtocolNetOutFlow.length; i++) {
            const snapshot = snapshotsProtocolNetOutFlow[i];
            const budgetType = await this.getBudgetType(
                snapshot.ownerType,
                snapshot.ownerId,
                snapshot.accountLabel,
                snapshot.accountAddress,
                snapshot.timestamp
            );

            const serie = {
                start: snapshot.timestamp,
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/snapshot-reports/${snapshot.snapshotId}`),
                unit: snapshot.token,
                value: snapshot.amount * -1,
                metric: 'ProtocolNetOutflow',
                fn: 'Single',
                dimensions: {
                    wallet: AnalyticsPath.fromString(`atlas/${snapshot.accountAddress}`),
                    transactionType: AnalyticsPath.fromString(`atlas/${snapshot.txLabel}`),
                    budget: AnalyticsPath.fromString(`${budgetType}`),
                    report: AnalyticsPath.fromString(`atlas/${snapshot.ownerType}/${snapshot.ownerId}/${this.getYearAndMonth(snapshot.month)}`),
                }
            };
            series.push(serie);
        }

        // adding AuditorNetOutflow
        for (let i = 0; i < auditorSnapshots.length; i++) {
            const snapshot = auditorSnapshots[i];
            const budgetType = await this.getBudgetType(
                snapshot.ownerType,
                snapshot.ownerId,
                snapshot.accountLabel,
                snapshot.accountAddress,
                snapshot.timestamp
            );

            const serie = {
                start: snapshot.timestamp,
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/snapshot-reports/${snapshot.snapshotId}`),
                unit: snapshot.token,
                value: snapshot.amount * -1,
                metric: 'AuditorNetOutflow',
                fn: 'Single',
                dimensions: {
                    wallet: AnalyticsPath.fromString(`atlas/${snapshot.accountAddress}`),
                    transactionType: AnalyticsPath.fromString(`atlas/${snapshot.txLabel}`),
                    budget: AnalyticsPath.fromString(`${budgetType}`),
                    report: AnalyticsPath.fromString(`atlas/${snapshot.ownerType}/${snapshot.ownerId}/${this.getYearAndMonth(snapshot.month)}`),
                }
            };
            series.push(serie);
        }


        return series;
    }

    private getBudgetType = async (
        ownerType: string,
        ownerId: number,
        accountLabel: string,
        accountAddress: string,
        timestamp: Date
    ) => {
        const cu = await this.db('CoreUnit').where('id', ownerId).select('code');

        // Date when keepers change under new budget path
        const isOldKeeperPath = timestamp < new Date('2023-05-24');

        const teamCode = await this.getTeamInfo(ownerId);
        const account = accounts.find(account => account['budget path 3'] === teamCode);
        if (account?.BudgetPath) {
            return `${account.BudgetPath}`;
        }

        switch (ownerType) {
            case 'CoreUnit': return `atlas/legacy/core-units/${cu[0].code}`;
            case 'Delegates': return 'atlas/legacy/recognized-delegates';
            case 'EcosystemActor': return `atlas/scopes/SUP/INC/${cu[0].code}`;
            case 'Keepers': {
                return isOldKeeperPath ? 'atlas/legacy/keepers' : 'atlas/scopes/PRO/KPRS';
            }
            case 'SpecialPurposeFund': return 'atlas/legacy/spfs';
            case 'AlignedDelegates': {
                return 'atlas/immutable/aligned-delegates';
            }
            case 'Scopes': {
                return `atlas/scopes/${cu[0].code}`;
            }
            default: {
                return `atlas/snapshot/unknown/${ownerType}/${cu[0]?.code}]}`;
            }
        }
    }

    private getTeamInfo = async (ownerId: number) => {
        const team = await this.db('CoreUnit').where('id', ownerId).select('code');
        if (team.length > 0) {
            return team[0].code;
        }
        return null;
    };

    private getYearAndMonth(dateString: Date) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are 0-based in JavaScript
        return `${year}/${month}`;
    }

    private getSnapshotLineItems = async () => {
        const baseQuery = this.db('Snapshot')
            .select('snapshotId', 'timestamp', 'amount', 'token', 'accountAddress', 'txLabel', 'ownerType', 'ownerId', 'month', 'accountLabel')
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
            .select('snapshotId', 'timestamp', 'amount', 'token', 'accountAddress', 'txLabel', 'ownerType', 'ownerId', 'month', 'accountLabel')
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
            .select('snapshotId', 'timestamp', 'amount', 'token', 'accountAddress', 'txLabel', 'ownerType', 'ownerId', 'month', 'accountLabel')
            .join('SnapshotAccount', 'SnapshotAccount.snapshotId', 'Snapshot.id')
            .join('SnapshotAccountTransaction', 'SnapshotAccountTransaction.snapshotAccountId', 'SnapshotAccount.id')
            .where('SnapshotAccount.accountType', 'singular')
            .where('SnapshotAccount.upstreamAccountId', null);

        if (this.snapshotId) {
            baseQuery.where('Snapshot.id', this.snapshotId);
        }

        return await baseQuery;
    }

    private getAuditorSnapshots = async () => {
        const auditors = accounts
            .filter(acc => acc.Type === 'Auditor')
            .map(acc => acc.Address);

        const protocols = accounts
            .filter(acc => acc.Type === 'Protocol')
            .map(acc => acc.Address);

        const baseQuery = this.db('Snapshot')
            .select('snapshotId', 'timestamp', 'amount', 'token', 'accountAddress', 'txLabel', 'ownerType', 'ownerId', 'month', 'accountLabel')
            .join('SnapshotAccount', 'SnapshotAccount.snapshotId', 'Snapshot.id')
            .join('SnapshotAccountTransaction', 'SnapshotAccountTransaction.snapshotAccountId', 'SnapshotAccount.id')
            .where(function (this: Knex.QueryBuilder) {
                this.whereIn('SnapshotAccount.accountAddress', auditors)
                    .andWhereNot('SnapshotAccountTransaction.counterParty', protocols)
                    .orWhere(function (this: Knex.QueryBuilder) {
                        this.whereIn('SnapshotAccount.accountAddress', protocols)
                            .andWhereNot('SnapshotAccountTransaction.counterParty', auditors)
                    });
            });

        if (this.snapshotId) {
            baseQuery.where('Snapshot.id', this.snapshotId);
        }

        return await baseQuery;
    }
};
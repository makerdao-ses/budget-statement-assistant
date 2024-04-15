import { AnalyticsPath } from '../utils/analytics/AnalyticsPath.js';
import { AnalyticsStore } from '../utils/analytics/AnalyticsStore.js';
import knex, { Knex } from 'knex';

export default class LineItemsScript {
    db: any;
    budgetStatementId: number | undefined;

    constructor(budgetStatementId: number | undefined) {
        this.budgetStatementId = budgetStatementId;
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
    }

    public insertInAnalyticsStore = async () => {
        const series = await this.createSeries();
        console.log('Budget statement lineitems series created: ', series.length);
        const store = new AnalyticsStore(this.db);

        // clean old lineItem series
        let path = 'powerhouse/legacy-api/budget-statements';
        if (this.budgetStatementId) {
            path = path + '/' + this.budgetStatementId;
        }
        await store.clearSeriesBySource(AnalyticsPath.fromString(path), true);

        // insert new data
        await store.addSeriesValues(series);
        console.log('Succesfully inserted in DB');

        // Update materialized view with latest changes in the series
        await this.db.raw('REFRESH MATERIALIZED VIEW "BudgetPathMap"')
        console.log('Refreshed Materialized View BudgetPathMap');
    };

    private createSeries = async () => {
        const lineItems = await this.getAllLineItems();
        const series: any = [];

        let addedFteMonths = new Set<string>();
        for (let i = 0; i < lineItems.length; i++) {
            const lineItem = lineItems[i];
            const headCount = lineItem.headcountExpense ? 'headcount' : 'non-headcount';
            const { code, ownerType, budgetStatementId, wallet, ftes, ownerId } = (await this.getOwner(lineItem.budgetStatementWalletId)) as any;
            // UTCing the date to avoid timezone issues
            lineItem.month = new Date(Date.UTC(lineItem.month.getFullYear(), lineItem.month.getMonth(), lineItem.month.getDate()));
            if (ftes && !addedFteMonths.has(lineItem.month.toISOString())) {
                const fteSerie = {
                    start: new Date(lineItem.month),
                    end: null,
                    source: AnalyticsPath.fromString(`powerhouse/legacy-api/budget-statements/${budgetStatementId}`),
                    value: ftes,
                    unit: 'FTE',
                    metric: 'Contributors',
                    dimensions: {
                        budget: AnalyticsPath.fromString(`atlas/${this.getBudgetType(ownerType, code, new Date(lineItem.month))}`),
                        category: AnalyticsPath.fromString(`atlas/${headCount}/${lineItem.canonicalBudgetCategory}`),
                        report: AnalyticsPath.fromString(`atlas/${ownerType}/${ownerId}/${this.getYearAndMonth(new Date(lineItem.month))}`)
                    },
                };
                series.push(fteSerie);
                addedFteMonths.add(lineItem.month.toISOString());
            }
            const serie = {
                start: new Date(lineItem.month),
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/budget-statements/${budgetStatementId}`),
                unit: lineItem.currency,
                value: lineItem.actual || 0,
                metric: 'Actuals',
                dimensions: {
                    budget: AnalyticsPath.fromString(`atlas/${this.getBudgetType(ownerType, code, new Date(lineItem.month))}`),
                    category: AnalyticsPath.fromString(`atlas/${headCount}/${lineItem.canonicalBudgetCategory}`),
                    wallet: AnalyticsPath.fromString(`atlas/${wallet}`),
                    project: AnalyticsPath.fromString(`atlas/${lineItem.group}`),
                    report: AnalyticsPath.fromString(`atlas/${ownerType}/${ownerId}/${this.getYearAndMonth(new Date(lineItem.month))}`)
                },
            };
            series.push(serie);
        }

        // add forecasts
        const forcastLineItems = await this.getAllForecastsLineItems();
        for (let i = 0; i < forcastLineItems.length; i++) {
            const { BSLI_month, BS_month, address, group, canonicalBudgetCategory, currency, forecast, ownerType, ownerCode, headcountExpense, ownerId } = forcastLineItems[i];
            const headCount = headcountExpense ? 'headcount' : 'non-headcount';
            const basePath = `powerhouse/legacy-api/budget-statements/${address}/${BSLI_month.toISOString().substring(0, 10)}`;
            const serie = {
                start: BSLI_month,
                bsMonth: BS_month,
                end: null,
                source: AnalyticsPath.fromString(`${basePath}${group ? `/${group}` : '/'}${canonicalBudgetCategory ? `/${canonicalBudgetCategory}` : `/`}`),
                unit: currency,
                value: forecast || 0,
                metric: 'Forecast',
                dimensions: {
                    budget: AnalyticsPath.fromString(`atlas/${this.getBudgetType(ownerType, ownerCode, new Date(BSLI_month))}`),
                    category: AnalyticsPath.fromString(`atlas/${headCount}/${canonicalBudgetCategory}`),
                    wallet: AnalyticsPath.fromString(`atlas/${address}`),
                    project: AnalyticsPath.fromString(`atlas/${group}`),
                    report: AnalyticsPath.fromString(`atlas/${ownerType}/${ownerId}/${this.getYearAndMonth(new Date(BSLI_month))}`)
                },
            };

            // skip if there is already a series with the same source and later reported forecasts
            if (series.filter((s: any) => s.source.toString().indexOf(basePath) !== -1 && s.bsMonth > serie.bsMonth).length > 0) {
                continue;
            }

            series.push(serie);
        }

        // add budget statements with empty fields to link them later with snapshots
        const budgetStatements = await this.getAllBudgetStatements();
        for (let i = 0; i < budgetStatements.length; i++) {
            const { id, month, ownerType, ownerCode } = budgetStatements[i];
            const utcedMonth = new Date(Date.UTC(month.getFullYear(), month.getMonth(), month.getDate()));
            const serie = {
                start: new Date(utcedMonth),
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/budget-statements/${id}`),
                unit: 'DAI',
                value: 0,
                metric: 'Actuals',
                dimensions: {
                    budget: AnalyticsPath.fromString(`atlas/${this.getBudgetType(ownerType, ownerCode, utcedMonth)}`),
                },
            };
            series.push(serie);
        }

        return series;
    };

    private getBudgetType = (
        ownerType: string,
        code: string,
        date: Date
    ) => {
        // Date when keepers change under new budget path
        const isOldKeeperPath = date < new Date('2023-05-24');
        switch (ownerType) {
            case 'CoreUnit':
                return `legacy/core-units/${code}`;
            case 'Delegates':
                return 'legacy/recognized-delegates';
            case 'EcosystemActor':
                return `scopes/SUP/INC/${code}`;
            case 'Keepers': {
                return isOldKeeperPath ? 'legacy/keepers' : 'scopes/PRO/KPRS';
            }
            case 'SpecialPurposeFund':
                return 'legacy/spfs';
            case 'AlignedDelegates':
                return 'immutable/aligned-delegates';
            default:
                return 'legacy/core-units';
        }
    };

    private getAllLineItems = async () => {
        const query = this.db('BudgetStatementLineItem')
            .join('BudgetStatementWallet', 'BudgetStatementWallet.id', 'BudgetStatementLineItem.budgetStatementWalletId')
            .join('BudgetStatement', {
                'BudgetStatementWallet.budgetStatementId': 'BudgetStatement.id',
                'BudgetStatementLineItem.month': 'BudgetStatement.month',
            })
            .select('BudgetStatementLineItem.*');
        if (this.budgetStatementId) {
            query.where('BudgetStatementWallet.budgetStatementId', this.budgetStatementId);
        }
        return await query;
    };

    private getAllForecastsLineItems = async () => {
        const query = this.db('BudgetStatementLineItem')
            .join('BudgetStatementWallet', 'BudgetStatementWallet.id', 'BudgetStatementLineItem.budgetStatementWalletId')
            .join(this.db.raw('"BudgetStatement" ON "BudgetStatementWallet"."budgetStatementId" = "BudgetStatement"."id" AND "BudgetStatementLineItem"."month" > "BudgetStatement"."month"'))
            .select(['*', 'BudgetStatementLineItem.month as BSLI_month', 'BudgetStatement.month as BS_month'])
            .orderBy('BudgetStatement.month', 'desc');
        if (this.budgetStatementId) {
            query.where('BudgetStatementWallet.budgetStatementId', this.budgetStatementId);
        }

        return await query;
    };

    private getAllBudgetStatements = async () => {
        return await this.db('BudgetStatement')
            .select('*');
    }

    private getOwner = async (budgetStatementWalletId: string) => {
        const result = await this.db('BudgetStatementWallet')
            .where('BudgetStatementWallet.id', budgetStatementWalletId)
            .leftJoin('BudgetStatement', 'BudgetStatement.id', 'BudgetStatementWallet.budgetStatementId')
            .leftJoin('BudgetStatementFtes', 'BudgetStatementFtes.budgetStatementId', 'BudgetStatement.id')
            .leftJoin('CoreUnit', function (this: any) {
                this.on('CoreUnit.id', '=', 'BudgetStatement.ownerId')
            })
            .select(
                this.db.raw('CASE WHEN "BudgetStatement"."ownerId" IS NULL THEN ? ELSE "CoreUnit"."code" END as "code"', ['Delegates']),
                this.db.raw('CASE WHEN "BudgetStatement"."ownerId" IS NULL THEN ? ELSE "CoreUnit"."type" END as "type"', ['Delegates']),
                'BudgetStatementWallet.budgetStatementId',
                'BudgetStatementWallet.address',
                'BudgetStatementFtes.ftes',
                "BudgetStatement.ownerId"
            );

        return {
            code: result[0].code,
            ownerType: result[0].type,
            budgetStatementId: result[0].budgetStatementId,
            wallet: result[0].address,
            ftes: result[0].ftes,
            ownerId: result[0].ownerId
        };

    };

    private getYearAndMonth(dateString: Date) {
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        return `${year}/${month}`;
    }
}

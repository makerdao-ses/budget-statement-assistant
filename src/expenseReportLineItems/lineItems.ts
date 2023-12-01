import { AnalyticsPath } from '../utils/analytics/AnalyticsPath.js';
import { AnalyticsMetric } from '../utils/analytics/AnalyticsQuery.js';
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
        const insertedSeries = await store.addSeriesValues(series);
        console.log('Succesfully inserted in DB', insertedSeries.length);
    };

    private createSeries = async () => {
        const lineItems = await this.getAllLineItems();
        const series: any = [];

        let addedFteMonths = new Set<string>();
        for (let i = 0; i < lineItems.length; i++) {
            const lineItem = lineItems[i];
            const headCount = lineItem.headcountExpense ? 'headcount' : 'non-headcount';
            const { code, ownerType, budgetStatementId, wallet, ftes } = (await this.getOwner(lineItem.budgetStatementWalletId)) as any;
            // UTCing the date to avoid timezone issues
            lineItem.month = new Date(Date.UTC(lineItem.month.getFullYear(), lineItem.month.getMonth(), lineItem.month.getDate()));
            if (ftes && !addedFteMonths.has(lineItem.month.toISOString())) {
                const fteSerie = {
                    start: new Date(lineItem.month),
                    end: null,
                    source: AnalyticsPath.fromString(`powerhouse/legacy-api/budget-statements/${budgetStatementId}`),
                    value: ftes,
                    metric: AnalyticsMetric.FTEs,
                    dimensions: {
                        budget: AnalyticsPath.fromString(`atlas/${this.getBudgetType(ownerType, code)}`),
                        category: AnalyticsPath.fromString(`atlas/${headCount}/${lineItem.canonicalBudgetCategory}`),
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
                metric: AnalyticsMetric.Actuals,
                dimensions: {
                    budget: AnalyticsPath.fromString(`atlas/${this.getBudgetType(ownerType, code)}`),
                    category: AnalyticsPath.fromString(`atlas/${headCount}/${lineItem.canonicalBudgetCategory}`),
                    wallet: AnalyticsPath.fromString(`atlas/${wallet}`),
                    project: AnalyticsPath.fromString(`${lineItem.group}`),
                },
            };
            series.push(serie);
        }

        // add forecasts
        const forcastLineItems = await this.getAllForecastsLineItems();
        // const forecastSeries = [];
        for (let i = 0; i < forcastLineItems.length; i++) {
            const lineItem = forcastLineItems[i];
            const headCount = lineItem.headcountExpense ? 'headcount' : 'non-headcount';
            const { code, ownerType, wallet } = (await this.getOwner(lineItem.budgetStatementWalletId)) as any;

            // UTCing the date to avoid timezone issues
            lineItem.month = new Date(Date.UTC(lineItem.BSLI_month.getFullYear(), lineItem.BSLI_month.getMonth(), lineItem.BSLI_month.getDate()));
            const basePath = `powerhouse/legacy-api/budget-statements/${lineItem.address}/${lineItem.month.toISOString().substring(0, 10)}`;
            const serie = {
                start: new Date(lineItem.month),
                bsMonth: new Date(lineItem.BS_month),
                end: null,
                source: AnalyticsPath.fromString(`${basePath}/${lineItem.group ? lineItem.group + '/' : ''}${lineItem.canonicalBudgetCategory ?? ''}`),
                unit: lineItem.currency,
                value: lineItem.forecast || 0,
                metric: AnalyticsMetric.Forecast,
                dimensions: {
                    budget: AnalyticsPath.fromString(`atlas/${this.getBudgetType(ownerType, code)}`),
                    category: AnalyticsPath.fromString(`atlas/${headCount}/${lineItem.canonicalBudgetCategory}`),
                    wallet: AnalyticsPath.fromString(`atlas/${wallet}`),
                    project: AnalyticsPath.fromString(`${lineItem.group}`),
                },
            };

            // skip if there is already a series with the same source and later reported forecasts
            if (series.filter((s: any) => s.source.toString().indexOf(basePath) !== -1 && s.bsMonth > lineItem.BS_month).length > 0) {
                continue;
            }

            series.push(serie);
        }

        return series;
    };

    private getBudgetType = (ownerType: string, code: string) => {
        switch (ownerType) {
            case 'CoreUnit':
                return `legacy/core-units/${code}`;
            case 'Delegates':
                return 'legacy/recognized-delegates';
            case 'EcosystemActor':
                return `scopes/SUP/incubation/${code}`;
            case 'Keepers':
                return 'legacy/keespers';
            case 'SpecialPurposeFund':
                return 'legacy/spfs';
            case 'AlignedDelegates':
                return '/immutable/ads';
            default:
                return 'core-units';
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
        const query = this.db('BudgetStatementLineItem').join('BudgetStatementWallet', 'BudgetStatementWallet.id', 'BudgetStatementLineItem.budgetStatementWalletId').join(this.db.raw('"BudgetStatement" ON "BudgetStatementWallet"."budgetStatementId" = "BudgetStatement"."id" AND "BudgetStatementLineItem"."month" > "BudgetStatement"."month"')).select(['*', 'BudgetStatementLineItem.month as BSLI_month', 'BudgetStatement.month as BS_month']).orderBy('BudgetStatement.month', 'desc');
        if (this.budgetStatementId) {
            query.where('BudgetStatementWallet.budgetStatementId', this.budgetStatementId);
        }

        return await query;
    };

    private getOwner = async (budgetStatementWalletId: string) => {
        const result = await this.db('BudgetStatementWallet').where('BudgetStatementWallet.id', budgetStatementWalletId).join('BudgetStatement', 'BudgetStatement.id', 'BudgetStatementWallet.budgetStatementId').join('CoreUnit', 'CoreUnit.id', 'BudgetStatement.ownerId').join('BudgetStatementFtes', 'BudgetStatementFtes.budgetStatementId', 'BudgetStatement.id').select('CoreUnit.code', 'CoreUnit.type', 'BudgetStatementWallet.budgetStatementId', 'BudgetStatementWallet.address', 'BudgetStatementFtes.ftes');
        if (result.length === 0) {
            const bStatement = await this.db('BudgetStatementWallet').where('BudgetStatementWallet.id', budgetStatementWalletId).select('budgetStatementId', 'address');
            return { code: 'Delegates', ownerType: 'Delegates', budgetStatementId: bStatement[0].budgetStatementId, wallet: bStatement[0].address };
        } else {
            return {
                code: result[0].code,
                ownerType: result[0].type,
                budgetStatementId: result[0].budgetStatementId,
                wallet: result[0].address,
                ftes: result[0].ftes,
            };
        }
    };
}

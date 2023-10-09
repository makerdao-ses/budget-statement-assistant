import { AnalyticsPath } from "../utils/analytics/AnalyticsPath.js"
import { AnalyticsMetric } from "../utils/analytics/AnalyticsQuery.js"
import { AnalyticsStore } from "../utils/analytics/AnalyticsStore.js"
import knex from 'knex';


class LineItemsScript {

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
        await store.clearSeriesBySource(AnalyticsPath.fromString('powerhouse/legacy-api/budget-statements'));

        // insert new data
        const insertedSeries = await store.addSeriesValues(series);
        console.log('inserted series', insertedSeries.length);

        // exit the process
        process.exit();
    }

    private createSeries = async () => {
        const lineItems = await this.getLineItems();
        const series: any = [];

        for (let i = 0; i < lineItems.length; i++) {
            const lineItem = lineItems[i];
            const headCount = lineItem.headcountExpense ? 'headcount' : 'non-headcount';
            const { code, ownerType, budgetStatementId, wallet } = await this.getOwner(lineItem.budgetStatementWalletId) as any;
            const serie = {
                start: new Date(lineItem.month),
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/budget-statements/${budgetStatementId}`),
                unit: lineItem.currency,
                value: lineItem.actual,
                metric: AnalyticsMetric.Actuals,
                dimensions: {
                    budget: AnalyticsPath.fromString(`atlas/${this.getBudgetType(ownerType, code)}`),
                    category: AnalyticsPath.fromString(`atlas/${headCount}/${lineItem.canonicalBudgetCategory}`),
                    wallet: AnalyticsPath.fromString(`atlas/${wallet}`),
                    project: AnalyticsPath.fromString(`${lineItem.group}`),
                }
            };
            series.push(serie)
        }

        return series;
    }

    private getBudgetType = (ownerType: string, code: string) => {
        switch (ownerType) {
            case 'CoreUnit': return `legacy/core-units/${code}`;
            case 'Delegates': return 'legacy/recognized-delegates';
            case 'EcosystemActor': return `scopes/SUP/incubation/${code}`;
            case 'Keepers': return 'legacy/keespers';
            case 'SpecialPurposeFund': return 'legacy/spfs';
            case 'AlignedDelegates': return '/immutable/ads'
            default: return 'core-units';
        }
    }


    private getLineItems = async () => {
        const lineItems = await this.db('BudgetStatementLineItem').where('actual', '>', 0).select('*');
        return lineItems;
    }

    private getOwner = async (budgetStatementWalletId: string) => {
        const result = await this.db('BudgetStatementWallet').where('BudgetStatementWallet.id', budgetStatementWalletId)
            .join('BudgetStatement', 'BudgetStatement.id', 'BudgetStatementWallet.budgetStatementId')
            .join('CoreUnit', 'CoreUnit.id', 'BudgetStatement.ownerId')
            .select('CoreUnit.code', 'CoreUnit.type', 'BudgetStatementWallet.budgetStatementId', 'BudgetStatementWallet.address');
        if (result.length === 0) {
            const bStatement = await this.db('BudgetStatementWallet').where('BudgetStatementWallet.id', budgetStatementWalletId).select('budgetStatementId', 'address');
            return { code: 'Delegates', ownerType: 'Delegates', budgetStatementId: bStatement[0].budgetStatementId, wallet: bStatement[0].address };
        } else {
            return {
                code: result[0].code,
                ownerType: result[0].type,
                budgetStatementId: result[0].budgetStatementId,
                wallet: result[0].address
            }

        }
    }

}

new LineItemsScript().insertInAnalyticsStore();
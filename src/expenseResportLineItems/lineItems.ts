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
        console.log('created series', series[0].source.toString());
        const store = new AnalyticsStore(this.db);
        
        // // clean old lineItem series
        // await store.clearSeriesBySource(AnalyticsPath.fromString('expenseReportLineItems'));

        // // insert new data
        // const insertedSeries = await store.addSeriesValues(series);
        // console.log('inserted series', insertedSeries.length);

    }

    private createSeries = async () => {
        const lineItems = await this.getLineItems();
        const series: any = [];

        for (let i = 0; i < lineItems.length; i++) {
            const lineItem = lineItems[i];
            const {code, budgetStatementId} = await this.getOwner(lineItem.budgetStatementWalletId) as any;
            const serie = {
                start: new Date(lineItem.month),
                end: null,
                source: AnalyticsPath.fromString(`powerhouse/legacy-api/budget-statements/${budgetStatementId}`),
                unit: lineItem.currency,
                value: lineItem.actual,
                metric: AnalyticsMetric.Actuals,
                dimensions: {
                    category: AnalyticsPath.fromString(`expenseReportLineItems/${code}/${lineItem.canonicalBudgetCategory}`)
                }
            };
            series.push(serie)
        }

        return series;
    }


    private getLineItems = async () => {
        const lineItems = await this.db('BudgetStatementLineItem').where('actual', '>', 0).select('*');
        return lineItems;
    }

    private getOwner = async (budgetStatementWalletId: string) => {
        const result = await this.db('BudgetStatementWallet').where('BudgetStatementWallet.id', budgetStatementWalletId)
            .join('BudgetStatement', 'BudgetStatement.id', 'BudgetStatementWallet.budgetStatementId')
            .join('CoreUnit', 'CoreUnit.id', 'BudgetStatement.ownerId')
            .select('CoreUnit.code', 'BudgetStatementWallet.budgetStatementId');
        if (result.length === 0) {
            return 'Delegates'
        } else {
            return {code: result[0].code, budgetStatementId: result[0].budgetStatementId}
        }
    }

}

new LineItemsScript().insertInAnalyticsStore();
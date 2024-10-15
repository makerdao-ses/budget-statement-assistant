import BudgetStatementCacheValues from "../budgetStatementCacheValues/cacheValues.js";
import LineItemsScript from "../expenseReportLineItems/lineItems.js";

class AutoAnalytics {

    constructor() {
    }

    async run() {
        const statementsToUpdate = await this.validateNumbers()
        await this.updateBudgetStatementAnalytics(statementsToUpdate)
    }

    async validateNumbers() {
        const budgetStatements = await this.getBudgetStatement(undefined);
        const reports = [];
        const statementsToUpdate = [];

        for (const budgetStatement of budgetStatements) {
            const { id, forecastExpenses, actualExpenses, budgetStatementWallet, month } = budgetStatement;
            const bsMonth = month;
            let totalActuals = 0;
            let totalForecasts = 0;

            if (!budgetStatementWallet.some((wallet: any) => wallet.budgetStatementLineItem.length > 0)) {
                continue; // Skip to the next budget statement if there are no line items
            }

            for (const wallet of budgetStatementWallet) {
                for (const lineItem of wallet.budgetStatementLineItem) {
                    if (bsMonth === lineItem.month) {
                        totalActuals += lineItem.actual;
                        totalForecasts += lineItem.forecast;
                    }
                }
            }

            const report = {
                budgetStatementId: id,
                actuals: {
                    analytics: Math.floor(actualExpenses ?? 0),
                    operational: Math.floor(totalActuals ?? 0),
                    difference: Math.floor((totalActuals ?? 0) - (actualExpenses ?? 0))
                }
            };

            reports.push(report);

            const tolerance = 1; // or any small value appropriate for your use case
            if (Math.abs(report.actuals.difference) <= tolerance) {
                report.actuals.difference = 0;
            }

            if (report.actuals.difference !== 0) {
                statementsToUpdate.push(id);
            }
        }

        console.log('Validation Reports:', reports.length);
        console.log('Budget Statements to Update:', statementsToUpdate.length, statementsToUpdate);

        return statementsToUpdate;
    }

    async updateBudgetStatementAnalytics(ids: string[]) {
        if (ids.length === 0) {
            console.log('No budget statements to update');
            process.exit(0);
        }

        for (const id of ids) {
            const lineItemsScript = new LineItemsScript(Number(id));
            await lineItemsScript.insertInAnalyticsStore();
        }
        await new LineItemsScript(undefined).updateMaterializedView();
        await new BudgetStatementCacheValues().insertCacheValues();
        console.log('Analytics for Budget Statements updated');
        process.exit(0);
    }

    async clearCache() {
        
    }

    async getBudgetStatement(id: string | undefined) {
        const query = `
            query BudgetStatements($filter: BudgetStatementFilter) {
                budgetStatements(filter: $filter) {
                    id
                    month
                    forecastExpenses
                    actualExpenses
                    budgetStatementWallet {
                        id
                        budgetStatementLineItem {
                            id
                            actual
                            forecast
                            month
                        }
                    }
                }
            }
        `;

        const variables = {
            filter: {
                ownerType: ["CoreUnit", "EcosystemActor", "AlignedDelegates"]
            }
        };

        if (id) {
            (variables.filter as any).id = id;
        }

        const requestBody = {
            query,
            variables
        };

        try {
            // https://ecosystem-dashboard.herokuapp.com/graphql
            // https://publish-dev-vpighsmr70zxa92r9w.herokuapp.com/graphql
            const response = await fetch('http://localhost:4000/graphql', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            const data = await response.json();
            return data.data.budgetStatements;
        } catch (error) {
            console.error(error)
        }
    }
}

new AutoAnalytics().run()
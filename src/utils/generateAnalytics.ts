import BudgetScript from "../scopeArtifacts/scopeArtifactsBudgets.js";
import Mip40BudgetScript from "../mip40s/mip40Budgets.js";
import SnapshotLineItemsScript from "../snapshotReportLineItems/snapshotLineItems.js";
import LineItemsScript from "../expenseReportLineItems/lineItems.js";
import BudgetStatementCacheValues from '../budgetStatementCacheValues/cacheValues.js';


// Script that aggregates all analytics scripts into one command with dynamic options for path and type of analytics to run
export async function generateAnalytics(path?: string,) {

    // extract path from process.argv
    const segments = path?.split('/') || []

    // call the correct script based on path
    switch (getSelectedPath(segments)) {
        case 'budget-statements':
            let pathParameter = undefined;
            if (!isNaN(Number(segments[segments.length - 1]))) {
                pathParameter = Number(segments[segments.length - 1]);
            }
            const budgetScript = new LineItemsScript(pathParameter);
            await budgetScript.insertInAnalyticsStore();
            await budgetScript.updateMaterializedView();
            break;
        case 'mip40':
            let mip40PathParameter = undefined;
            if (segments[segments.length - 1] !== 'mip40' && typeof segments[segments.length - 1] === 'string') {
                mip40PathParameter = segments[segments.length - 1];
            }
            const mip40Script = new Mip40BudgetScript(mip40PathParameter);
            await mip40Script.insertInAnalyticsStore();
            break;
        case 'snapshot-reports':
            let snapshotPathParameter = undefined;
            if (!isNaN(Number(segments[segments.length - 1]))) {
                snapshotPathParameter = Number(segments[segments.length - 1]);
            }
            const snapshotScript = new SnapshotLineItemsScript(snapshotPathParameter);
            await snapshotScript.insertInAnalyticsStore();
            break;
        case 'google-sheets':
            const googleSheetsScript = new BudgetScript();
            await googleSheetsScript.insertInAnalyticsStore();
            break;
        case 'powerhouse':
            await new BudgetScript().insertInAnalyticsStore();
            await new Mip40BudgetScript(undefined).insertInAnalyticsStore();
            await new LineItemsScript(undefined).insertInAnalyticsStore();
            await new SnapshotLineItemsScript(undefined).insertInAnalyticsStore();
            break;
        default:
            console.error(
                'Invalid path, make sure to choose one of the following: budget-statements, mip40, snapshot-reports, google-sheets'
                , '\n example: yarn generate-analytics powerhouse/legacy-api/budget-statements/414'
            );
            break;
    }

    console.log('Updating cache values')
    await new BudgetStatementCacheValues().insertCacheValues();
    process.exit(0);

}

const getSelectedPath = (segments: string[]) => {
    if (segments[0] !== 'powerhouse') {
        return null;
    }
    return segments.find((segment) => {
        return segment === 'budget-statements' || segment === 'mip40' || segment === 'snapshot-reports' || segment === 'google-sheets' || (segment === 'powerhouse' && segments.length === 1)
    })
}

generateAnalytics(process.argv[2])
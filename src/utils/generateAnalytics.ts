import BudgetScript from "../scopeArtifacts/scopeArtifactsBudgets.js";
import Mip40BudgetScript from "../mip40s/mip40Budgets.js";
import SnapshotLineItemsScript from "../snapshotReportLineItems/snapshotLineItems.js";
import LineItemsScript from "../expenseReportLineItems/lineItems.js";


// Script that aggregates all analytics scripts into one command with dynamic options for path and type of analytics to run
export function generateAnalytics(path?: string,) {
    
    // paths
    // powerhouse/legacy-api/budget-statements
    // powerhouse/legacy-api/mip40
    // powerhouse/legacy-api/snapshot-reports
    // powerhouse/google-sheets

    // extract path from process.argv
    const paths = path?.split('/')
    console.log(paths)

    // call the correct script based on path
    


}

generateAnalytics(process.argv[2])
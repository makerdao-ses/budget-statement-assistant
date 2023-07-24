import {
    actions,
    BudgetStatementDocument,
    LineItem,
    BudgetStatement,
} from '@acaldas/document-model-libs/budget-statement';
import ColumnTagInterpreter from './columnTagIntepreter.js';
import { fetchData } from './utils/googleAuth.js';
import { run } from './utils/exportToFile.js';


// const document = new BudgetStatement()
// document.setOwner({ title: 'Sustainable Ecosystem Scaling CoreUnit', ref: "makerdao/core-unit", id: "SES-001" })
// document.addAccount([{ address: 'testAddress' }])
// document.saveToFile('test.json');

run()

// saving to file
/*
Script shuold create one document for every month.
For every gsheet add the associated account to the document, wallet and lineItems

Input params for the script
    - list of gsheet urls ( should include params as in budgetTool - walletAddress, walletName, currency)
    - owner (document.setOwner({ title: 'Sustainable Ecosystem Scaling CoreUnit', ref: "makerdao/core-unit", id: "SES-001" }))
    - account

Output:
- list of budgetStatement files each for their givem month containing relevant accounts and lineItems

Goal is to open these files in the connect app.

// once this first version is done, we can add the forecasted 3 months to the current month.

*/




// document.saveToFile('test.json');

// console.log(document.owner)

// const settings = { ... };
// const assistant = new BudgetStatementAssistant(settings);

/*
- Google auth data
- Mapping wallet address => google sheet url


assistant class with necessary properties
- gogle auth
- import lineItems


await assistant.importWalletLineItems(document, address);
*/
// document.addLineItem('0xb5eb779ce300024edb3df9b6c007e312584f6f4f',
//     [
//         {
//             actual: 12,
//             category: { ref: 'makerdao/expense-category', id: 'Compensation&Benefits', title: 'Compensation&Benefits' },
//             group: { ref: "makerdao/budget-category", id: "makerdao/core-unit/ses", title: 'SES' },
//             forecast: [{
//                 month: "2023-06",
//                 budgetCap: 122,
//                 value: 11
//             }]
//         },

//     ])


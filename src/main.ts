import { runWithParams, readFromFile } from './utils/exportToFile.js';

runWithParams(
    'https://docs.google.com/spreadsheets/d/1OfROr_XNpWA4FksRrqrXtk3UJ7tPmJ4tR3mVk_Uu5KM/edit?pli=1#gid=916656612',
    '0xb5eb779ce300024edb3df9b6c007e312584f6f4f',
    'Permanent Team',
    'DAI',
    'savedDocuments/2023-04.json/SES-001 - 2023-04 Expense Report.phbs.zip', // BudgetStatementDocument
    '2023-04'
);
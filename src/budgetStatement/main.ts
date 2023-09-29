import { ExportToFile } from './exportToFile.js';

const exportToFile = new ExportToFile('Sustainable Ecosystem Scaling CoreUnit', 'makerdao/core-unit', 'SES-001');

// Permanent Team
exportToFile.runWithParams(
    'https://docs.google.com/spreadsheets/d/1OfROr_XNpWA4FksRrqrXtk3UJ7tPmJ4tR3mVk_Uu5KM/edit?pli=1#gid=916656612',
    '0xb5eb779ce300024edb3df9b6c007e312584f6f4f',
    'Permanent Team',
    'DAI',
    'savedDocuments/SES-001 - 2023-04 Expense Report.phbs.zip', // BudgetStatementDocument
    '2023-04'
);



// Incubation Programne
// exportToFile.runWithParams(
//     'https://docs.google.com/spreadsheets/d/1OfROr_XNpWA4FksRrqrXtk3UJ7tPmJ4tR3mVk_Uu5KM/edit?pli=1#gid=1104141180',
//     '0x7c09ff9b59baaebfd721cbda3676826aa6d7bae8',
//     'Incubation Programne',
//     'DAI',
//     'savedDocuments/SES-001 - 2023-04 Expense Report.phbs.zip', // BudgetStatementDocument
//     '2023-04'
// );
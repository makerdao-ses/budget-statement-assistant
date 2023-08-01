import {
    BudgetStatement,
    BudgetStatementDocument
} from '@acaldas/document-model-libs/budget-statement';
import ColumnTagInterpreter from '../columnTagIntepreter.js';
import { fetchData } from './googleAuth.js';
import { isHeadcountExpense } from './expenseCategoryMap.js';

interface ICategoryData {
    actual: number;
    forecast: number;
    paid: number;
    currency: string;
    budget: number;
    group?: string;
    [key: string]: any; // add index signature
}

interface IData {
    [category: string]: IGroupData;
}
interface IGroupData {
    [date: string]: ICategoryData;
}

interface ILineItem {
    actual: number;
    budgetCap: number;
    category: { ref: string, id: string, title: string };
    forecast: {
        budgetCap: number
        month: string
        value: number
    }[];
    group: { ref: string, id: string, title: string, color: string } | null;
    headcountExpense: boolean;
    payment: number;
}

export const runWithParams = async (sheetUrl: string, walletAddress: string, walletName: string, currency: string, bsDocumentPath?: string, month?: string) => {
    const lineItems = await mapDataByMonth(sheetUrl)
    // console.log(lineItems[month as any])

    // verify if there's an exisiting budget statement
    const existingDocument = await readFromFile(bsDocumentPath);
    if (existingDocument && (existingDocument instanceof BudgetStatement)) {
        console.log('Existing budget statement found. Updating...')
        if (existingDocument.month == month) {
            updateExistingBudgetStatement(lineItems[month], existingDocument, walletAddress, walletName, month);
        }
    } else {
        console.log('Existing budget statement not found. Creating...')
        const budgetStatements = await createBudgetStatements(lineItems, walletAddress, walletName, month, bsDocumentPath);
        saveToFile(budgetStatements);
    }


    // const budgetStatements = await createBudgetStatements(lineItems, walletAddress, walletName, month);
    // const existingLineItem: any = budgetStatements[0].getLineItem(walletAddress, { category: 'Compensation & Benefits', group: 'Powerhouse' })
    // console.log(existingLineItem.actual)
    // console.log(budgetStatements[0].getLineItems(walletAddress))
    // saveToFile(budgetStatements);
}

const getParsedData = async (sheetUrl: string) => {
    const rawData = await fetchData(sheetUrl);
    const columnTagInterpreter = new ColumnTagInterpreter(rawData, "DAI")
    columnTagInterpreter.processData();
    const result = columnTagInterpreter.leveledMonthsByCategory;
    return result;
}

const mapDataByMonth = async (sheetUrl: string) => {
    // Getting and parsing data
    const parsedData = await getParsedData(sheetUrl);
    const parsedByMonth = addToOrganizedData(parsedData);
    const lineItems = await parseToLineItems(parsedByMonth);
    return lineItems;
}

const saveToFile = async (budgetStatements: any) => {
    // Saving to file
    try {
        budgetStatements.forEach(async (budgetStatement: any) => {
            await budgetStatement.saveToFile(`savedDocuments/${budgetStatement.month}.json`);
        });
        console.log(`${budgetStatements.length} files saved successfully in savedDocuments folder.`)
    } catch (error) {
        console.log(error)
    }

}

const createBudgetStatements = async (lineItems: any, walletAddress: string, walletName: string, month?: string, bsDocumentPath?: string) => {
    // Loading existing budget statement
    const existingDocument = await readFromFile(bsDocumentPath);

    // Populating budget statements
    const budgetStatements = [];
    if (month && lineItems[month]) {
        let document = createBudgetStatement(
            'Sustainable Ecosystem Scaling CoreUnit',
            "makerdao/core-unit",
            "SES-001",
            walletAddress,
            walletName,
            month,
            lineItems[month]
        )
        budgetStatements.push(document);
        return budgetStatements;
    } else {
        for (const monthInLineItem in lineItems) {
            let document = createBudgetStatement(
                'Sustainable Ecosystem Scaling CoreUnit',
                "makerdao/core-unit",
                "SES-001",
                walletAddress,
                walletName,
                monthInLineItem,
                lineItems[monthInLineItem],
            )
            budgetStatements.push(document);
        }
        return budgetStatements;
    }
}

const createBudgetStatement = (
    title: string,
    ref: string,
    id: string,
    address: string,
    walletName: string,
    month: string,
    monthLineItems: []
) => {
    let document = new BudgetStatement()
    document.setOwner({ title, ref, id })
    document.setName(`${id} - ${month} Expense Report`);
    document.addAccount([{ address, name: walletName }])
    document.addLineItem(address, monthLineItems)
    document.setMonth(month)
    return document;
}

const updateExistingBudgetStatement = (
    monthLineItems: [ILineItem],
    existingDocument: any,
    address: string,
    walletName: string,
    month: string
) => {
    const document = existingDocument;
    // check if account exists, if yes, update account, if not, add account
    document.getAccount(address)
    const existingAccount = document.getAccount(address);
    if (!existingAccount && existingAccount.name !== walletName) {
        document.addAccount([{ address, name: walletName }])
    }

    // check if owner needs to be updated
    // TO DO - check if owner is the same, if not, update owner
    const existingOwner = document.owner;

    // updating lineItems
    for (let monthLineItem of monthLineItems) {
        const existingLineItem = document.getLineItem(address, { category: monthLineItem.category.title, group: monthLineItem.group?.title });
        if (!existingLineItem) {
            console.log('Adding new lineItem', monthLineItem.category.title, monthLineItem.group?.title)
            document.addLineItem(address, monthLineItem)
        } else {
            console.log('updating lineItem', monthLineItem.category.title)
            document.updateLineItem(address, [{
                actual: monthLineItem.actual,
                budgetCap: monthLineItem.budgetCap,
                category: monthLineItem.category.title,
                forecast: monthLineItem.forecast,
                group: monthLineItem.group?.title,
                headCountExpense: monthLineItem.headcountExpense,
                payment: monthLineItem.payment,

            }])
        }
    }

    saveToFile([document]);


}


const addToOrganizedData = (data: IData) => {
    let organizedData: { [month: string]: any } = {};

    for (const category in data) {
        for (const group in data[category]) {
            for (const month in data[category][group]) {
                if (!organizedData[month]) {
                    organizedData[month] = {};
                }

                // Make sure we don't overwrite an existing category object
                if (!organizedData[month][category]) {
                    organizedData[month][category] = {};
                }

                // Add a new object for each group to the category object
                organizedData[month][category][group] = data[category][group][month];
            }
        }
    };

    return organizedData;

};

const parseToLineItems = (data: any) => {
    let lineItems: any = {};

    for (const month in data) {
        if (!lineItems.month) {
            lineItems[month] = [];
        }
        for (const category in data[month]) {
            for (const group in data[month][category]) {
                addNextThreeMonthsForecast(data, category, group, month)
                const bCap = typeof data[month][category][group].budget == 'number' ? data[month][category][group].budget : 0;
                const lineItem: ILineItem = {
                    actual: parseFloat(data[month][category][group].actual),
                    budgetCap: parseFloat(bCap),
                    category: { ref: "makerdao/expense-category", id: category, title: category },
                    forecast: addNextThreeMonthsForecast(data, category, group, month),
                    group: group == 'undefined' || group == '' ? null : { ref: "makerdao/budget-category", id: group, title: group, color: "#000000" },
                    headcountExpense: isHeadcountExpense(category),
                    payment: data[month][category][group].paid,
                };
                lineItems[month].push(lineItem);
            }
        }
    }

    return lineItems;
}

const getNextThreeMonths = (selectedMonth: string) => {
    if (selectedMonth !== undefined) {
        const date = selectedMonth;
        let monthsToUpload = [];
        monthsToUpload.push(date);

        const toNumber = date.split('-');
        let year = Number(toNumber[0])
        let month = Number(toNumber[1])
        let yearString = String(year);

        for (let i = 1; i <= 3; i++) {
            let newMonth = month + i;
            let leading0 = newMonth < 10 ? '0' : '';
            let monthString = leading0 + String(newMonth)

            if (newMonth > 12) {
                yearString = String(year + 1)
            }
            if (newMonth === 13) {
                monthString = '01'
            }
            if (newMonth === 14) {
                monthString = '02'
            }
            if (newMonth === 15) {
                monthString = '03'
            }
            let result = yearString.concat('-').concat(monthString)
            monthsToUpload.push(result)
        }
        return monthsToUpload;
    }
}

const addNextThreeMonthsForecast = (data: any, category: string, group: string, selectedMonth: string) => {
    const forecasts: { budgetCap: number, month: string, value: number }[] = [];

    const monthsToUpload = getNextThreeMonths(selectedMonth);

    for (const month of monthsToUpload as any) {
        const isDataPresent = Object.hasOwn(data, month);
        const forecast = {
            budgetCap: isDataPresent ? parseFloat(data[month][category][group].budget) : 0,
            month,
            value: isDataPresent ? parseFloat(data[month][category][group].forecast) : 0
        }
        forecasts.push(forecast)
    }

    return forecasts;
}

export const readFromFile = async (path: string | undefined) => {
    // Reading file
    try {
        if (path) {
            const document = await BudgetStatement.fromFile(path)
            return document;
        }
        return null;
    } catch (error) {
        console.log(error)
    }
}


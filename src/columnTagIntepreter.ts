export default class ColumnTagInterpreter {
    actualSignValue: number = 1;
    forecastSignValue: number = 1;
    currency: string = "DAI";
    rawData: any;
    filterIndex: any = null;
    // having multiple filter templates
    filters: any[] = [];
    parsedRows: any[] = [];
    filteredByMonth: any = {};
    budgets: any = {};
    filteredByCategoryMonth: any = {};
    accountedMonths: any[] = [];
    leveledMonthsByCategory: any = {};

    filterTemplate: any = {
        direct: {
            column: null,
            index: null,
            certain: false,
            labels: ['!direct', 'Direct'],
            parseFunction: 'tryParseBoolean'
        },
        forecast: {
            column: null,
            index: null,
            certain: false,
            labels: ['!forecast', 'Forecast'],
            parseFunction: 'tryParseNumber',
            signInitialized: false,
            signMultiplier: 1
        },
        estimate: {
            column: null,
            index: null,
            certain: false,
            labels: ['!estimate', 'Estimate'],
            parseFunction: 'tryParseNumber',
            signInitialized: false,
            signMultiplier: 1
        },
        actual: {
            column: null,
            index: null,
            certain: false,
            labels: ['!actual', 'Actual'],
            parseFunction: 'tryParseNumber',
            signInitialized: false,
            signMultiplier: 1
        },
        owed: {
            colum: null,
            index: null,
            certain: false,
            labels: ['!owed', 'Owed'],
            parseFunction: 'tryParseNumber',
            signInitialized: false,
            signMultiplier: 1
        },
        paid: {
            column: null,
            index: null,
            certain: false,
            labels: ['!paid', 'Paid'],
            parseFunction: 'tryParseNumber',
            signInitialized: false,
            signMultiplier: 1
        },
        budget: {
            column: null,
            index: null,
            certain: false,
            labels: ['!budget', 'Budget'],
            parseFunction: 'tryParseNumber'
        },
        category: {
            column: null,
            index: null,
            certain: false,
            labels: ['!category', 'Budget Category'],
            parseFunction: 'tryParseString'
        },
        month: {
            column: null,
            index: null,
            certain: false,
            labels: ['!month', 'Month'],
            parseFunction: 'tryParseMonth'
        },
        transaction: {
            column: null,
            index: null,
            certain: false,
            labels: ['!transaction', 'Transaction'],
            parseFunction: 'tryParseString'
        },
        group: {
            column: null,
            index: null,
            certain: false,
            labels: ['!group', 'Group'],
            parseFunction: 'tryParseString'
        },
        currency: {
            column: null,
            index: null,
            certain: false,
            labels: ['!currency', 'Currency'],
            parseFunction: 'tryParseString'
        }
    }

    constructor(rawData: any, currency: string) {
        this.rawData = rawData;
        this.currency = currency;
    }

    processData = () => {
        this.updateFilter()
        this.parseRowData()

        // Filtering by currency
        this.parsedRows = this.parsedRows.filter(row => {
            if (row.currency === this.currency) {
                return row
            }
        })
        this.filterByMonth()
        this.filteredByCategoryMonth = this.buildSESView(this.parsedRows)
        this.leveledMonthsByCategory = this.buildSFView(this.filteredByCategoryMonth)
        // console.log('leveledMonthsByCategory', this.leveledMonthsByCategory)
        // console.log('filteredByCategoryMonth', this.filteredByCategoryMonth)
    }

    updateFilter = () => {
        for (let i = 0; i < this.rawData.length; i++) {
            this.tryParseFilterRow(this.rawData[i], i)
        }

    }

    tryParseFilterRow = (arr: any, rowIndex: any) => {
        this.resetFilterIndex();
        for (let i = 0; i < arr.length; i++) {
            if (this.matchesFilterTag(arr[i], '!next')) {
                this.selectNextFilter();
            }
            // let filterArr: any = Object.entries(this.currentFilter())
            let filterArr: [string, { certain: boolean, column: number, index: number, labels: string[] }][] = Object.entries(this.currentFilter());
            for (let j = 0; j < filterArr.length; j++) {
                if (this.matchesFilterTag(arr[i], filterArr[j][1]['labels'][0])) {
                    this.currentFilter()[filterArr[j][0]].certain = true;
                    this.currentFilter()[filterArr[j][0]].column = i;
                    this.currentFilter()[filterArr[j][0]].index = rowIndex;
                    // console.log('Matched column', this.currentFilter()[filterArr[j][0]])
                }
            }
        }
    }

    resetFilterIndex() {
        if (this.filters.length < 1) {
            this.addNewFilter();
        } else {
            this.filterIndex = 0;
        }
    }

    addNewFilter() {
        let copy: any = JSON.parse(JSON.stringify(this.filterTemplate));
        this.filters.push(copy);
        this.filterIndex = this.filters.length - 1; // sets the index to filter 
    }

    matchesFilterTag(cellData: any, tag: any) {
        let t = cellData.toString().toLowerCase().trim();
        return t == tag

    }

    selectNextFilter(addNewIfNeeded = true) {
        if (this.filters.length < 1 || this.filterIndex === this.filters.length - 1) {
            if (addNewIfNeeded) {
                this.addNewFilter()
                return true;
            }
            return false;
        } else {
            this.filterIndex++;
            return true;
        }
    }

    currentFilter() {
        if (this.filters.length < 1) {
            this.selectNextFilter()
        }
        return this.filters[this.filterIndex]
    }

    parseRowData = () => {
        this.budgets = {}
        this.resetFilterIndex();

        do {
            // let arrFilter: any = Object.entries(this.currentFilter());
            let arrFilter: [string, { certain: boolean, column: number, index: number, labels: string[], parseFunction: any }][] = Object.entries(this.currentFilter());
            let arr: { [key: string]: any } = {};

            for (let i = 0; i < this.rawData.length; i++) {
                for (let item = 0; item < arrFilter.length; item++) {
                    if (arrFilter[item][1].certain) {
                        let cellValue = this.rawData[i][arrFilter[item][1].column];
                        if (arrFilter[item][1].parseFunction) {
                            arr[arrFilter[item][0]] = (this as any)[arrFilter[item][1].parseFunction](cellValue);
                            // arr[arrFilter[item][0]] = this[arrFilter[item][1].parseFunction](cellValue);
                        } else {
                            arr[arrFilter[item][0]] = cellValue;
                        }
                    }
                }
                if (this.isValidExpenseRow(arr)) {
                    let selectedFilter = JSON.parse(JSON.stringify(this.currentFilter()));

                    if ('actual' in arr) {
                        selectedFilter.actual.signInitialized = true;
                        selectedFilter.actual.signMultiplier = Math.sign(arr.actual);
                    }
                    if ('forecast' in arr) {
                        selectedFilter.forecast.signInitialized = true;
                        selectedFilter.forecast.signMultiplier = Math.sign(arr.forecast)
                    }
                    this.parsedRows.push(this.cleanExpenseRecord(arr, selectedFilter))
                    arr = {}
                } else if (this.isValidBudgetRow(arr)) {
                    this.processBudgetRow(arr, this.budgets)
                }
            }
        }

        while (this.selectNextFilter(false))

    }

    isValidExpenseRow(rowCandidate: any) {
        if (rowCandidate.category.toLowerCase() === 'budget') {
            return false;
        }
        return this.isValidMonth(rowCandidate.month) &&
            (
                this.isValidNumber(rowCandidate.actual) ||
                this.isValidNumber(rowCandidate.forecast) ||
                this.isValidNumber(rowCandidate.estimate) ||
                this.isValidNumber(rowCandidate.paid)
            );
    }

    isValidBudgetRow(rowCandidate: any) {
        return this.isValidMonth(rowCandidate.month) && this.isValidNumber(rowCandidate.budget);
    }

    isValidMonth(month: any) {
        return month instanceof Date;
    }

    isValidNumber(actual: any) {
        return typeof actual === 'number';
    }


    cleanExpenseRecord(parsedRecord: any, filter: any) {
        //Cleaning Month
        parsedRecord.monthString = this.getMonthString(parsedRecord.month)

        if (!filter.direct.certain) {
            parsedRecord.direct = true
        }

        // parsing empty string values
        let calculatedOwed = null;
        if (parsedRecord.estimate !== undefined) {
            parsedRecord.estimate = this.parseNumber(parsedRecord.estimate)
            calculatedOwed = parsedRecord.estimate
        }
        if (parsedRecord.actual !== undefined) {
            // parsedRecord.actual = this.parseNumber(parsedRecord.actual) * filter.actual.signMultiplier
            parsedRecord.actual = this.parseNumber(parsedRecord.actual)
            calculatedOwed = parsedRecord.actual
        }
        if (parsedRecord.owed !== undefined) {
            parsedRecord.owed = this.parseNumber(parsedRecord.owed)
        } else {
            parsedRecord.owed = calculatedOwed
        }

        if (!filter.paid.certain) {
            parsedRecord.paid = this.parseNumber(parsedRecord.actual)
        } else if (parsedRecord.paid !== undefined) {
            parsedRecord.paid = this.parseNumber(parsedRecord.paid)
        }
        if (parsedRecord.forecast !== undefined) {
            parsedRecord.forecast = this.parseNumber(parsedRecord.forecast)
        }
        if (parsedRecord.category === '') {
            parsedRecord.category = 'payment topup';
        }
        if (parsedRecord.currency === undefined) {
            parsedRecord.currency = this.currency;
        }
        return parsedRecord;
    }

    parseNumber = (anyNumber: any) => {
        const regex = /[^,]*/g;
        let number = anyNumber;
        if (!isNaN(anyNumber)) {
            return anyNumber
        }
        if (number === '') {
            return 0
        } else if (typeof anyNumber === 'string' || anyNumber instanceof String) {
            return parseFloat(number.match(regex).join(''));
        } else {
            return 0;
        }
    }

    getMonthString(dateObj: any) {
        let leading0 = dateObj.getMonth() + 1 < 10 ? '0' : ''
        return `${dateObj.getFullYear()}-${leading0}${dateObj.getMonth() + 1}`
    }

    processBudgetRow(parsedRecord: any, budgets: any) {
        this.cleanBudgetRecord(parsedRecord, budgets)
    }

    cleanBudgetRecord(parsedRecord: any, budgets: any) {

        parsedRecord.monthString = this.getMonthString(parsedRecord.month)

        if (parsedRecord.category === '') {
            parsedRecord.category = 'payment topup';
        }
        if (parsedRecord.budget !== undefined) {
            parsedRecord.budget = this.parseNumber(parsedRecord.budget)
            if (budgets[parsedRecord.monthString] === undefined) {
                budgets[parsedRecord.monthString] = {}
            }
            if (budgets[parsedRecord.monthString][parsedRecord.category] === undefined) {
                budgets[parsedRecord.monthString][parsedRecord.category] = 0;
            }
            budgets[parsedRecord.monthString][parsedRecord.category] += parsedRecord.budget
        }

        return parsedRecord
    }

    tryParseString(input: any) {
        if (!input) {
            return '';
        }
        return (input + '').trim();

    }

    tryParseMonth(serialNum: any) {
        serialNum = String(serialNum).split(".");
        let ogDate;
        let oneDay = 24 * 60 * 60 * 1000;
        let firstDate = new Date(1899, 11, 30);
        let days = parseFloat(serialNum[0]);
        if (isNaN(days) || days < 40000 || days > 50000) {
            return null;
        }
        let ms: any = 0;
        if (serialNum.length > 1) {
            ms = parseFloat(serialNum[1]) * oneDay;
            ms = String(ms).substring(0, 8);
        }
        firstDate.setDate(firstDate.getDate() + days);
        ogDate = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate(), 0, 0, 0, ms);
        return ogDate;
    }

    tryParseNumber(numberString: any) {
        const regex = /[^,]*/g;
        if (typeof numberString !== 'string' || numberString.length < 1) {
            if (numberString === '') {
                return 0
            }
            return numberString
        }

        let match: any = numberString.match(regex);
        let result: number = match ? parseFloat(match.join('')) : NaN;
        return isNaN(result) ? numberString : result;

    }

    filterByMonth = () => {
        const months = this.getMonths()

        for (let i = 0; i < months.length; i++) {
            let month = this.parsedRows.filter(object => {
                return object.monthString === months[i]
            })
            this.filteredByMonth[months[i]] = month;
        }

    }

    getMonths = () => {
        let duplicateTags = [];
        for (const object of this.parsedRows) {
            if (object.monthString !== undefined)
                duplicateTags.push(object.monthString)
        }
        return [...new Set(duplicateTags)];

    }

    buildSESView = (parsedRows: any) => {

        let result: any = {}
        let actualNegative = 0;
        let actualPositive = 0;
        let forecastNegative = 0;
        let forecastPositive = 0;
        for (let i = 0; i < parsedRows.length; i++) {
            let row = parsedRows[i]
            if (!result.hasOwnProperty(row.category)) {
                result[row.category] = {}
            }

            if (!result[row.category].hasOwnProperty(row.group)) {
                result[row.category][row.group] = {}
            }

            if (!result[row.category][row.group].hasOwnProperty(row.monthString)) {
                result[row.category][row.group][row.monthString] = {
                    actual: 0,
                    forecast: 0,
                    paid: 0,
                    budget: 0,
                    currency: row.currency ? row.currency : this.currency
                }
            }

            if (row.actual !== undefined) {
                if (Math.sign(row.actual) === -1) {
                    actualNegative++;
                }
                if (Math.sign(row.actual) === 1) {
                    actualPositive++;
                }
                result[row.category][row.group][row.monthString]['actual'] += row.actual
            }
            if (row.forecast !== undefined) {
                if (Math.sign(row.forecast) === -1) {
                    forecastNegative++;
                }
                if (Math.sign(row.forecast) === 1) {
                    forecastPositive++;
                }
                result[row.category][row.group][row.monthString]['forecast'] += row.forecast
            }
            if (row.paid !== undefined) {
                result[row.category][row.group][row.monthString]['paid'] += row.paid
            }
            if (row.budget !== undefined) {
                result[row.category][row.group][row.monthString]['budget'] += row.budget
            }
        }
        if (actualNegative > actualPositive) {
            this.actualSignValue = -1;
        }
        if (forecastNegative > forecastPositive) {
            this.forecastSignValue = -1;
        }

        for (const [key, value] of Object.entries(result)) {
            for (const [key1, value1] of Object.entries(result[key])) {
                for (const [key2, value2] of Object.entries(result[key][key1])) {
                    for (const [key3, value3] of Object.entries(result[key][key1][key2])) {
                        if (key3 === 'actual' || key3 === 'paid') {
                            result[key][key1][key2][key3] = result[key][key1][key2][key3] * this.actualSignValue;
                        }
                        if (key3 === 'forecast') {
                            result[key][key1][key2][key3] = result[key][key1][key2][key3] * this.forecastSignValue;
                        }
                    }
                }
            }
        }
        return result;
    }

    buildSFView(indexByCategoryByMonth: any) {
        let months = this.addThreeMonths(this.getMonths())
        let result = {};

        months.forEach(month => {
            result = this.addSfTableSection(result, indexByCategoryByMonth, month);
        })

        return result;
    }

    addThreeMonths(monthsArr: any) {
        let months = [...monthsArr]
        let lastMonth = months[months.length - 1]
        let toNumber = lastMonth.split('-');
        let year = Number(toNumber[0])
        let month = Number(toNumber[1])

        let leading0 = month < 10 ? '0' : '';

        let monthString = leading0 + String(month);
        let yearString = String(year);


        for (let i = 1; i <= 3; i++) {
            let newMonth = month + i;
            let leading0 = newMonth < 10 ? '0' : '';
            monthString = leading0 + String(newMonth)

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
            months.push(result)
        }
        return months;
    }

    addSfTableSection(sfTable: any, indexByCategoryByMonth: any, month: any) {
        let result = JSON.parse(JSON.stringify(sfTable));

        // not all categories have same month
        for (const category in indexByCategoryByMonth) {
            if (result[category] === undefined) {
                result[category] = {}
            }
            for (const group in indexByCategoryByMonth[category]) {
                if (result[category][group] === undefined) {
                    result[category][group] = {}
                }

                if (result[category][group][month] === undefined) {
                    result[category][group][month] = {}
                }

                if (indexByCategoryByMonth[category][group][month] === undefined) {
                    result[category][group][month]['actual'] = 0
                    result[category][group][month]['forecast'] = 0
                    result[category][group][month]['paid'] = 0
                    result[category][group][month].currency = this.currency
                } else {
                    result[category][group][month].actual = indexByCategoryByMonth[category][group][month]['actual']
                    result[category][group][month].forecast = indexByCategoryByMonth[category][group][month]['forecast']
                    result[category][group][month].paid = indexByCategoryByMonth[category][group][month]['paid']
                    result[category][group][month].currency = indexByCategoryByMonth[category][group][month]['currency']
                }
                if (this.budgets[month] === undefined || this.budgets[month][category] === undefined) {
                    if (indexByCategoryByMonth[category][group][month]?.budget !== undefined) {
                        result[category][group][month]['budget'] = indexByCategoryByMonth[category][group][month]?.budget
                    } else {
                        result[category][group][month]['budget'] = 0
                    }
                } else {
                    result[category][group][month].budget = this.budgets[month][category]
                }
            }
        }

        return result;
    }

}   
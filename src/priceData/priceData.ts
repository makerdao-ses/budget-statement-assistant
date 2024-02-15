import { AnalyticsPath } from "../utils/analytics/AnalyticsPath.js";
import { AnalyticsStore } from "../utils/analytics/AnalyticsStore.js";
import knex from 'knex';

export default class PriceDataScript {

  db: any;

  constructor() {
    this.db = knex({
      client: 'pg',
      connection: process.env.PG_CONNECTION_STRING,
    });
  }

  public insertInAnalyticsStore = async () => {
    const series = await this.createSeries();
    console.log('MKR.USD Price Data series created', series.length);
    const store = new AnalyticsStore(this.db);

    // clean old lineItem series
    // await store.clearSeriesBySource(AnalyticsPath.fromString('powerhouse/price-data/mkr-usd/day-average'), true);

    // insert new data
    await store.addSeriesValues(series);
    console.log('MKR.USD Price Data inserted series');

  }

  private createSeries = async () => {

    const days = await this.determineStartDate();
    const mkrPriceData = await this.getMkrPriceData(days);
    const filteredMkrPriceData = await this.filterMkrPriceData(mkrPriceData);
    const series: any = [];

    // adding mkr.usd price data
    for (let i = 0; i < filteredMkrPriceData.length; i++) {
      const data = filteredMkrPriceData[i];

      const serie = {
        start: data.start,
        end: this.addOneDay(data.start),
        source: AnalyticsPath.fromString(`powerhouse/price-data/mkr-usd/day-average/${data.start}`),
        unit: 'DAI',
        value: data.priceChange,
        metric: 'DailyMkrPriceChange ',
        fn: 'Single',
        dimensions: {
          priceData: AnalyticsPath.fromString(`atlas/price-data/mkr-usd/day-average`),
        }
      };
      series.push(serie);
    }

    return series;
  }

  private calculatePriceChange(mkrPriceData: any): Array<any> {
    const priceChange = [];
    for (let i = 0; i < mkrPriceData.length; i++) {
      if (i === 0) {
        priceChange.push({
          start: mkrPriceData[i].start,
          price: parseFloat(mkrPriceData[i].price.toFixed(2)),
          priceChange: parseFloat(mkrPriceData[i].price.toFixed(2)),
        });
      } else {
        priceChange.push({
          start: mkrPriceData[i].start,
          price: parseFloat(mkrPriceData[i].price.toFixed(2)),
          priceChange: parseFloat((mkrPriceData[i].price - mkrPriceData[i - 1].price).toFixed(2)),
        });
      }
    }
    return priceChange;
  }

  private async filterMkrPriceData(mkrPriceData: any) {
    const [dbDate] = await this.getLatestMkrPriceDatafromDB();

    if (!dbDate) {
      const noDBEntries = mkrPriceData.filter((data: any) => {
        return data.start.getHours() === 0 && data.start.getMinutes() === 0 && data.start.getSeconds() === 0
      })
      return this.calculatePriceChange(noDBEntries);
    }

    const withDBEntries = mkrPriceData.filter((data: any) => {
      const dataDate = data.start;
      return (
        dataDate.getDate() !== dbDate.start.getDate() ||
        dataDate.getMonth() !== dbDate.start.getMonth() ||
        dataDate.getFullYear() !== dbDate.start.getFullYear()
      ) && dataDate.getHours() === 0 && dataDate.getMinutes() === 0 && dataDate.getSeconds() === 0;
    });

    // compare dates and return the matching date: dbDate.start === data.start
    const previousDay = mkrPriceData.filter((data: any) => {
      const dataDate = data.start;
      return (
        dataDate.getDate() === dbDate.start.getDate() &&
        dataDate.getMonth() === dbDate.start.getMonth() &&
        dataDate.getFullYear() === dbDate.start.getFullYear()
      ) && dataDate.getHours() === 0 && dataDate.getMinutes() === 0 && dataDate.getSeconds() === 0;
    });

    const beforePriceChange = [...previousDay, ...withDBEntries];
    const calculatedPriceChange = this.calculatePriceChange(beforePriceChange);
    // remove the first element of the array    
    calculatedPriceChange.shift();
    return calculatedPriceChange;
  }

  private addOneDay(date: Date) {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 1);
    return newDate;
  }

  private async getMkrPriceData(days: number) {
    const url = `https://api.coingecko.com/api/v3/coins/maker/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const response = await fetch(url);
    const data = await response.json();
    return data.prices.map(([start, price]: any) => ({
      start: new Date(start),
      price,
    }));
  }

  private async determineStartDate() {
    const [dbDate] = await this.getLatestMkrPriceDatafromDB();
    if (dbDate) {
      return this.calculateDays(new Date(dbDate.start), new Date());
    } else {
      return this.calculateDays(new Date("2020-12-30"), new Date());
    }
  }

  private async getLatestMkrPriceDatafromDB() {
    return await this.db
      .select("start")
      .from("AnalyticsSeries")
      .where("metric", "DailyMkrPriceChange")
      .orderBy("id", "desc")
      .limit(1);
  }

  private calculateDays(start: any, end: any) {
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
};


new PriceDataScript().insertInAnalyticsStore();
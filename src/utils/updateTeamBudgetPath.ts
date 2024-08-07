import knex, { Knex } from 'knex';

export default class TeamBudgetPath {

    db: any;

    constructor() {
        this.db = knex({
            client: 'pg',
            connection: process.env.PG_CONNECTION_STRING,
        });
    }

    public async updateTeamBudgetPath() {
        const cus = await this.db('CoreUnit').select('code');
        for (const cu of cus) {
            const budgetPath = await this.getBudgetPath(cu.code);
            await this.db('CoreUnit')
                .where('code', cu.code)
                .update({ budgetPath });
        }
        console.log('Updated', cus.length, 'budget paths');
    };

    private async getBudgetPath(code: string) {
        const result = await this.db('AnalyticsDimension')
            .select('path')
            .where('dimension', 'budget')
            .andWhere('path', 'like', `%${code}%`);

        if (result.length > 0) {
            return result[0].path;
        }

        return null;
    }
}
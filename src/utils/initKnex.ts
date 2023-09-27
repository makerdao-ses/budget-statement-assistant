import knex from "knex";

export default () => {
    const knexConfig = {
        client: 'pg',
        connection: process.env.PG_CONNECTION_STRING,
    };

    return knex(knexConfig);
}
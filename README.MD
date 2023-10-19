# Powerhouse Budget Statement Assistant Scripts

A set of scripts that fetch data from different sources and parses this data to be exported or uploaded to other sources in the Powerhouse data structures.

## Getting Started

In order to run the scripts you need to:

- Create a Google `OAUTH 2.0 Client ID` credentials file and have it in the root of this repo, named `credentials.json`
  - Make sure to allow spreadsheet read access to your settings so that the script will be able to read from your spreadsheet.
  - Follow this [link](https://developers.google.com/identity/protocols/oauth2/native-app#uwp) for instructions.
- export the database connection as an `env` variable. The env var name being: `PG_CONNECTION_STRING`
- Run: `yarn install`
- Run: `yarn build`

## List of scripts

- **Budget Statement Expense Line Items**: fetches expense lineitems from a google spreadsheet, that Ecosysem Actors or Core Units within MakerDAO use to report their expenses, amd exports the summary into a [Budget Statement Document Model](https://github.com/powerhouse-inc/document-model-libs/tree/main/document-models/budget-statement).
  - In `src\budgetStatement\main.ts` change the params in the `ExportToFile` object and `runWithParams` function to match your needs.
  - Run `yarn budgetDocument` to run the script.

- **Analytics Generator Script** - generates analytics series into the database, it gets the below registered data types and parses it into the analytics series and uploads it to the respective tables in the database. Below is the list of different data types that you can add.

  - `budget-statements` line items: 
    - The path being: `powerhouse/legacy-api/budget-statements`, if you want to add only a specific budget statement then add a `/budgetStatementId` at the end of the path. Like so: `powerhouse/legacy-api/budget-statements/1`, `1` being the budget statement id.
  - `mip40` line items:
    - The path being: `powerhouse/legacy-api/mip40`, if you want to add only a specific mip40 then add a `/mip40Spn` at the end of the path. Like so: `powerhouse/legacy-api/mip40/MIP40c3SP26`, `MIP40c3SP26` being the mip40Spn.
  - `snapshot-reports` line items: 
    - The path being: `powerhouse/legacy-api/snapshot-reports`, if you want to add only a specific snapshot report then add a `/snapshotReportId` at the end of the path. Like so: `powerhouse/legacy-api/snapshot-reports/1`, `1` being the snapshot report id.
  - `google-sheet`: atlas budget scope artifacts google spreadsheet.
  - `powerhouse`: runs all analytics series scripts together.
    - By running `yarn generate-analytics powerhouse` you will run all the above scripts together.

To run the script, you need to write the specified path and then run the following command with the specified path:

```bash 
yarn generate-analytics <specified path>
```
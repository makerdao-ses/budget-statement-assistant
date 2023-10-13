



// Script that aggregates all analytics scripts into one command with dynamic options for path and type of analytics to run
export function generateAnalytics(path?: string,) {

    // extract path from process.argv
    const paths = path?.split('/')
    console.log(paths)


}

generateAnalytics(process.argv[2])
const path = require('path')

export default async (events, options) => {  
    const main = await import(path.resolve(__dirname, '../src/main.mjs'))
    return await(main.default(events, options))
}
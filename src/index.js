import { useEntities } from './entities.js'
import { useFiles } from './files.js'

const yaml = require('js-yaml')
const path= require('node:path')
const { mkdir, writeFile } = require('node:fs/promises')

export default async (events, options) => {  
    const { init } = events
    const { logger } = options
    logger.info('Mikser directus initalized')

    const workingFolder = path.resolve(options.env['MIKSER'] || 'mikser')
    await mkdir(workingFolder, { recursive: true })
       
    let mikser
    if (!options.env['MIKSER']) {
        try {
            mikser = await import(path.resolve('./node_modules/mikser-core/index.js'))
            mikser.setup({
                workingFolder,
                plugins: ['documents', 'yaml', 'files'],
                config: path.resolve('./mikser.config.js'),
                watch: true,
            })
        } catch (err) {
            logger.error('Mikser not found:', err.message)
        }
    } else {
        mikser = {
            options: {
                workingFolder,
                runtimeFolder: path.join(workingFolder, 'mikser', 'runtime'),
            }
        }
    }

    await mkdir(runtimeFolder, { recursive: true })
    const schemaFile = path.join(runtimeFolder, 'directus.yml')
    const schemaDump = yaml.dump(await options.getSchema())
    await writeFile(schemaFile, schemaDump, 'utf8')
    
    useEntities(mikser, events, options)
    useFiles(mikser, events, options)

    init('app.after', async () => {
        if (!options.env['MIKSER']) {
            try {
                mikser.start()
            } catch (err) {
                logger.error('Mikser not found:', err.message)
            }
        }
	})
}
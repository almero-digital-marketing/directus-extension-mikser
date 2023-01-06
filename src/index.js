const path = require('path')
const yaml = require('js-yaml')
const { mkdir, writeFile, unlink, rmdir } = require('fs/promises')
const _ = require('lodash')
require('deepdash')(_)
const hasha = require('hasha')
const glob = require('fast-glob')

export default async ({ action, init }, options) => {  
    console.log('Mikser directus initalized')
    const workingFolder = path.resolve(options.env['MIKSER'] || 'mikser')
    const runtimeFolder = path.join(workingFolder, options.env['MIKSER_RUNTIME'] || 'runtime')
    
	const schemaDump = yaml.dump(await options.getSchema())
	const schemaFile = path.join(runtimeFolder, 'directus.yml')
    await mkdir(runtimeFolder, { recursive: true })
    await writeFile(schemaFile, schemaDump, 'utf8')

    const { ItemsService } = options.services
    const defaultFields = [new Array(4).fill('*').join('.')]

    const entityFilesMap = {}
    const entityKeysMap = {}

    async function saveEntity(item, { collection, primary }, { target }) {
        if (!target) return

        const id = '/' + collection + '/' + item[primary]
		const meta = _.mapKeysDeep(item, (value, key) => _.camelCase(key))
        meta.href = meta.href || id

        const entity = path.join(target.replace('/mikser', ''), meta.destination || meta.url || meta.href)
        const entityFile = path.join(workingFolder, entity + '.directus.yml')
        
        entityKeysMap[collection + ':' + item[primary]] = entityFile
        const checksum = await hasha.async(JSON.stringify(meta))
        if (entityFilesMap[entityFile] != checksum) {
            entityFilesMap[entityFile] = checksum
            
            delete meta.target
            const entityDump = yaml.dump(meta)

            console.log('Saving entity:', entityFile)
            await mkdir(path.dirname(entityFile), { recursive: true })
            await writeFile(entityFile, entityDump, 'utf8')
        }
    }

    async function clearEntities() {
        const paths = await glob('**/*.directus.yml', { cwd: workingFolder })
        for (let entity of paths) {
            const entityFile = path.join(workingFolder, entity)
            if (!entityFilesMap[entityFile]) {
                console.log('Clearing entity:', entityFile)
                await unlink(entityFile)
                await rmdir(path.dirname(entityFile)).catch(() => {})
            }
        }
    }

    function getEntitySchema(collection) {
        const fields = collection.fields.fields?.defaultValue?.split(',').map(field => field.trim()) || defaultFields
        const target = collection.fields.target?.defaultValue
        return { fields, target } 
    }

    async function syncEntitiesCollection(entityCollection, schema) {
        const itemsService = new ItemsService(entityCollection.collection, { schema })
        const entitySchema = getEntitySchema(schema.collections[entityCollection.collection])
        const items = await itemsService.readByQuery({ 
            fields: entitySchema.fields,
            limit: -1
        })
        console.log(`Collection [${entityCollection.collection}]:`, items.length, entitySchema.fields)
        for(let item of items) {
            await saveEntity(item, entityCollection, entitySchema)
        }
}

	async function syncEntities() {
		const schema = await options.getSchema()
		let { collections } = schema
		const entityCollections = Object
		.keys(collections)
		.filter(key => key.indexOf('directus_') != 0)
		.map(key => collections[key])
		.filter(collection => collection.fields.target?.defaultValue.indexOf('/mikser') == 0)
	
		console.log('Entity collections:', entityCollections.map(entityCollection => entityCollection.collection).join(', '))
		for(let entityCollection of entityCollections) {
            await syncEntitiesCollection(entityCollection, schema)
		}
	}

    async function onItemsCreated({ collection, key }, { schema }) {
        const entityCollection = schema.collections[collection]
        const entitySchema = getEntitySchema(entityCollection)
        if (entitySchema.target?.indexOf('/mikser') != 0) return

        const itemsService = new ItemsService(collection, { schema })
        const item = await itemsService.readOne(key, { 
            fields: entitySchema.fields,
            limit: -1
        })
        await saveEntity(item, entityCollection, entitySchema)

    }

    async function otItemsUpdated({ collection, keys }, { schema }) {
        const entityCollection = schema.collections[collection]
        const entitySchema = getEntitySchema(entityCollection)
        if (entitySchema.target?.indexOf('/mikser') != 0) return
        
        const itemsService = new ItemsService(collection, { schema })
        const items = await itemsService.readMany(keys, { 
            fields: entitySchema.fields,
            limit: -1
        })
        for(let item of items) {
            await saveEntity(item, entityCollection, entitySchema)
        }
    }

    async function onItemsDeleted({ collection, keys }, { schema }) {
        const entityCollection = schema.collections[collection]
        const entitySchema = getEntitySchema(entityCollection)
        if (entitySchema.target?.indexOf('/mikser') != 0) return

        for (let key of keys) {
            let entityKey = collection + ':' + key
            const entityFile = entityKeysMap[entityKey]
            if (entityFile) {
                delete entityKeysMap[entityKey]
                delete entityFilesMap[entityFile]
                console.log('Deleting entity:', entityFile)
                await unlink(entityFile)    
            }
        }
    }

    action('items.create', onItemsCreated)
	action('items.update', otItemsUpdated)
	action('items.delete', onItemsDeleted)

    init('app.after', async () => {
        await syncEntities()
        await clearEntities()

		// await syncFiles()
	})

}
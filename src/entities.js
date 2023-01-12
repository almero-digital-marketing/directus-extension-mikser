const { mkdir, writeFile, unlink, rmdir } = require('fs/promises')
const _ = require('lodash')
require('deepdash')(_)
const hasha = require('hasha')
const glob = require('fast-glob')
const path = require('path')
const yaml = require('js-yaml')

export async function useEntities(mikser, { action, init }, options) {  
    const { services: { ItemsService }, logger } = options
    const defaultFields = [new Array(4).fill('*').join('.')]

    const entityFilesMap = {}
    const entityKeysMap = {}

    async function saveEntity(item, { collection, primary }, { target }) {
        if (!target) return

        const id = '/' + collection + '/' + item[primary]
		const meta = _.mapKeysDeep(item, (value, key) => _.camelCase(key))
        meta.href = meta.href || id

        const entity = path.join(target.replace('/mikser', ''), meta.destination || meta.url || meta.href)
        const entityFile = path.join(mikser.options.workingFolder, entity + '.directus.yml')
        
        entityKeysMap[collection + ':' + item[primary]] = entityFile
        const checksum = await hasha.async(JSON.stringify(meta), {algorithm: 'md5'})
        if (entityFilesMap[entityFile] != checksum) {
            entityFilesMap[entityFile] = checksum
            
            delete meta.target
            const entityDump = yaml.dump(meta)

            logger.info('Saving entity: %s', entityFile)
            await mkdir(path.dirname(entityFile), { recursive: true })
            await writeFile(entityFile, entityDump, 'utf8')
        }
    }

    async function clearEntities() {
        const paths = await glob('**/*.directus.yml', { cwd: mikser.options.workingFolder })
        for (let entity of paths) {
            const entityFile = path.join(mikser.options.workingFolder, entity)
            if (!entityFilesMap[entityFile]) {
                logger.info('Clearing entity: %s', entityFile)
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
        logger.info(`Collection [${entityCollection.collection}]: %s %s`, items.length, entitySchema.fields)
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
	
		logger.info('Entity collections: %s', entityCollections.map(entityCollection => entityCollection.collection).join(', '))
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
                logger.info('Deleting entity:', entityFile)
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
	})
}
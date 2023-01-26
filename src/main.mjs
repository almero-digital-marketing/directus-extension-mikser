import axios from 'axios'

export default async ({ action, init }, options) => {  
    const { logger } = options
    
    const headers = {}
    if (options.env['MIKSER_TOKEN']) {
        headers['Authorization'] = `Bearer ${options.env['MIKSER_TOKEN']}`
    }

    async function onItemsCreated({ collection, key }) {
        const url = `${options.env['MIKSER']}/api/webhooks/${collection}`
        try {
            logger.info('Mikser api create: %s %s', url, key)
            await axios.request({
                method: 'post',
                url,
                headers,
                data: {
                    id: key
                }
            })
       } catch (err) {
           logger.error('Mikser api create error: %s %s %s', url, key, err.message)
        }
    }

    async function onItemsUpdated({ collection, keys }) {
        const url = `${options.env['MIKSER']}/api/webhooks/${collection}`
        try {
            logger.info('Mikser api update: %s %s', url, keys)
            await axios.request({
                method: 'put',
                url,
                headers,
                data: {
                    ids: keys
                }
            })
       } catch (err) {
            logger.error('Mikser api update error: %s %s %s', url, keys, err.message)
       }
    }
    
    async function onItemsDeleted({ collection, keys }) {
        const url = `${options.env['MIKSER']}/api/webhooks/${collection}`
        try {
            logger.info('Mikser api delete: %s %s', url, keys)
            await axios.request({
                method: 'delete',
                url,
                headers,
                data: {
                    ids: keys
                }
            })
        } catch (err) {
           logger.error('Mikser api dalete error: %s %s %s', url, keys, err.message)
        }
    }

    async function onStart() {
        const url = `${options.env['MIKSER']}/api/webhooks/schedule`
        try {
            logger.info('Mikser api schedule: %s', url)
            await axios.request({
                method: 'post',
                url,
                headers,
                data: {
                    uri: options.env['MIKSER_URI'] || options.env['PUBLIC_URL']
                }
            })
        } catch (err) {
           logger.error('Mikser api schedule error: %s %s', url, err.message)
        }
    }

    if (options.env['MIKSER']) {
        logger.info('Mikser plugin initalized: %s', options.env['MIKSER'])
        
        action('items.create', onItemsCreated)
        action('items.update', onItemsUpdated)
        action('items.delete', onItemsDeleted)    

        action('server.start', onStart)
    } else {
        logger.error('Mikser not found')
    }
}
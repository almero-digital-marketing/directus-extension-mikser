import axios from 'axios'

export default async ({ action }, options) => {  
    const { logger } = options
    
    const headers = {}
    if (options.env['MIKSER_TOKEN']) {
        headers['Authorization'] = `Bearer ${options.env['MIKSER_TOKEN']}`
    }

    async function onItemsCreated({ collection, key }) {
        const url = `${options.env['MIKSER']}/api/webhooks/${collection}`
        try {
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

    if (options.env['MIKSER']) {
        logger.info('Mikser plugin initalized: %s', options.env['MIKSER'])
        
        action('items.create', onItemsCreated)
        action('items.update', onItemsUpdated)
        action('items.delete', onItemsDeleted)    
    } else {
        logger.error('Mikser not found')
    }
}
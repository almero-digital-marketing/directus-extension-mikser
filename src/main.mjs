import mikserWebhooks from 'mikser-io-webhooks'

export default async ({ action }, options) => {  
    if (options.env['MIKSER']) {
        const { logger } = options
        const webhooks = mikserWebhooks({ url: options.env['MIKSER'], token: options.env['MIKSER_TOKEN'], logger })
        
        action('items.create', async ({ collection, key }) => {
            await webhooks.created(collection, { id: key })
        })
        action('items.update', async ({ collection, keys }) => {
            for(let key of keys) {
                await webhooks.updated(collection, { id: key })
            }
        })
        action('items.delete', async ({ collection, keys }) => {
            for(let key of keys) {
                await webhooks.deleted(collection, { id: key })
            }
        })
        action('server.start', async () => {
            await webhooks.trigger(options.env['MIKSER_URI'] || options.env['PUBLIC_URL'])
        })
    } else {
        logger.error('Mikser not found')
    }
}
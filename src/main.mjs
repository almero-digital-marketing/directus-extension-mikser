import useMikserWebhooks from 'mikser-io-webhooks'
import useMikserSubscribe from 'mikser-io-subscribe'

export default async ({ action }, options) => {  
    if (options.env['MIKSER']) {
        const { logger } = options
        const mikserWebhooks = useMikserWebhooks({ url: options.env['MIKSER'], token: options.env['MIKSER_TOKEN'], logger })
        const mikserSubscribe = useMikserSubscribe({ url: options.env['MIKSER'], port: options.env['MIKSER_PORT'], token: options.env['MIKSER_TOKEN'], logger })
        
        action('items.create', async ({ collection, key }) => {
            await mikserWebhooks.created(collection, { id: key })
            mikserSubscribe.created(collection, { id: key })
        })
        action('items.update', async ({ collection, keys }) => {
            for(let key of keys) {
                await mikserWebhooks.updated(collection, { id: key })
                mikserSubscribe.updated(collection, { id: key })
            }
        })
        action('items.delete', async ({ collection, keys }) => {
            for(let key of keys) {
                await mikserWebhooks.deleted(collection, { id: key })
                mikserSubscribe.deleted(collection, { id: key })
            }
        })
        action('server.start', async () => {
            await mikserWebhooks.trigger(options.env['MIKSER_URI'] || options.env['PUBLIC_URL'])
        })
    } else {
        logger.error('Mikser not found')
    }
}
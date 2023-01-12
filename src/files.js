const glob = require('fast-glob')

export async function useFiles(mikser, { action, init }, options) {  

	const storageRoot = path.resolve(options.env['STORAGE_LOCAL_ROOT'])
	
    action('files.upload', console.log)
	action('files.update', console.log)
	action('files.delete', console.log)

    action('folders.create', console.log)
	action('folders.update', console.log)
	action('folders.delete', console.log)

	async function syncFiles() {
        const paths = await glob('**/*', { cwd: storageRoot })

	}

    init('app.after', async () => {
        await syncFiles()
        await clearFiles()
	})
}
#!/usr/bin/env node
const { Command } = require('commander')
const fs = require('fs')
const path = require('path')
const glob = require('glob')
const util = require('util')
const ignore = require('ignore').default
const chalk = require('chalk')
const HotGo = require('./lib')
const pkg = require('./package.json')

const program = new Command()

program
    .name('hotgo')
    .version(pkg.version)
    .description('Watch go file change and go run it.')
    .arguments('<entry> [dest]')
    .option('-w, --watch <path>', 'watch directory path or files.')
    .option('-c --config <file>', 'Specify configuration file.')
    .parse(process.argv)

const logger = {
    tag: '[hotgo]',
    error (msg) {
        console.error(chalk.red(`${this.tag} ${msg}`))
    },
    warn (msg) {
        console.error(chalk.yellow(`${this.tag} ${msg}`))
    },
    log (msg) {
        console.log(chalk.green(`${this.tag} ${msg}`))
    },
    info (msg) {
        console.log(chalk.gray(`${this.tag} ${msg}`))
    }
}

async function main () {
    if (!program.args[0]) {
        program.help()
        process.exit(0)
    }

    const cwd = process.cwd()
    const entry = path.relative(cwd, path.resolve(cwd, program.args[0]))
    let dest = program.args[1]
        ? path.resolve(cwd, program.args[1])
        : path.resolve(process.env.TMPDIR, path.basename(entry).replace(path.extname(entry), ''))

    if (process.platform === 'win32') {
        dest += '.exe'
    }

    let config = {
        restartable: 'rs',
        watch: program.watch ? [ program.watch ] : [],
        delay: 200
    }

    if (program.config) {
        const stat = fs.statSync(program.config)

        if (!stat.isFile()) {
            throw new Error(`${program.config} is not a file !`)
        }
        const text = fs.readFileSync(program.config, 'utf-8')
        try {
            config = { ...config, ...JSON.parse(text) }
        } catch (err) {
            throw new Error('Invalid configuration file !')
        }
    }

    let watchFiles = []

    if (config.watch.length > 0) {
        const ig = ignore().add(config.ignore || [])
        const fileSet = new Set()

        for (const i in config.watch) {
            const files = (await util.promisify(glob)(path.resolve(cwd, config.watch[i]))).map(e => path.relative(cwd, e))

            for (const j in files) {
                if (files[j] === '') {
                    fileSet.add('.')
                } else {
                    if (!ig.ignores(files[j])) {
                        fileSet.add(files[j])
                    }
                }
            }
        }
        watchFiles = [ ...fileSet ]
    }

    if (watchFiles.length > 0) {
        watchFiles.push(entry)
    }

    const go = new HotGo(entry, dest, watchFiles, config.delay)

    go.on('exit', (code) => {
        if (code === 0) {
            logger.log(`process exit(${code}), waiting for changes before restart`)
            return
        }
    
        logger.error(`process exit(${code}), waiting for changes before restart`)
    })

    go.on('start', (e) => {
        if (config.watch.length > 0) {
            logger.warn(`watching path(s): ${config.watch.join(',')}`)
        }
        e.change && logger.warn(`file(${e.change.event}): \`${e.change.filename}\``)
        logger.log(`starting \`${entry}\``)
        logger.log(`pid: ${e.process.pid}`)
        logger.log(`enter \`${config.restartable}\` to restart`)
    })

    go.on('error', err => {
        logger.error(err.message)
    })

    go.start()

    process.stdin.on('data', data => {
        const input = data.toString('utf-8').trim()

        if (input === config.restartable) {
            go.restart()
        } else {
            logger.log(`enter \`${config.restartable}\` to restart`)
        }
    })
}

main().catch(err => {
    logger.error(err.message)
    process.exit(1)
})

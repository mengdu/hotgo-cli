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
    .option('--execArgs <args>', 'Execution parameters.')
    .option('--buildArgs <args>', 'Build parameters.')
    .option('--env <envs>', 'Execution environment.')
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
    const tmpDir = process.env.TMP || process.env.TEMP || process.env.TMPDIR || '/tmp'
    const entry = path.relative(cwd, path.resolve(cwd, program.args[0]))
    let dest = program.args[1]
        ? path.resolve(cwd, program.args[1])
        : path.resolve(tmpDir, path.basename(entry).replace(path.extname(entry), ''))

    if (process.platform === 'win32') {
        dest += '.exe'
    }

    let config = {
        restartable: 'rs',
        watch: program.watch ? [ program.watch ] : [],
        delay: 500,
        buildArgs: [],
        execArgs: [],
        env: {}
    }

    // 载入配置文件
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

    if (program.buildArgs) {
        config.buildArgs.push(program.buildArgs)
    }

    if (program.execArgs) {
        config.execArgs.push(program.execArgs)
    }

    if (program.env) {
        program.env.split(',').forEach(e => {
            const item = e.split('=')
            if (item[0] && item[1]) {
                config.env[item[0].trim()] = item[1].trim()
            }
        })
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

    const go = new HotGo(entry, dest, {
        watchFiles,
        delay: config.delay,
        buildArgs: config.buildArgs,
        execArgs: config.execArgs,
        env: config.env
    })

    go.on('exit', (code) => {
        if (code === 0) {
            logger.log(`process exit(${code}), waiting for changes before restart`)
            return
        }
    
        logger.warn(`process exit(${code}), waiting for changes before restart`)
    })

    let restartCount = 0

    go.on('beforeBuild', e => {
        if (config.watch.length > 0) {
            logger.warn(`watching path(s): ${config.watch.join(',')}, total: ${watchFiles.length}`)
        }

        logger.log(`starting \`${entry}\``)
        logger.log(`build: ${e.build}`)

        if (restartCount++ > 0) {
            logger.log(`restart times ${restartCount - 1}`)
        }
    })

    go.on('start', (e) => {
        e.change && logger.warn(`file(${e.change.event}): \`${e.change.filename}\``)
        logger.log(`pid: ${e.process.pid}`)
        logger.log(`exec: ${e.exec}`)
        logger.log(`use time ${e.useTime}ms`)
        logger.log(`enter \`${config.restartable}\` to restart`)
    })

    go.on('error', err => {
        logger.error(err.message)
    })

    go.run()

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

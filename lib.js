const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const child_process = require('child_process')

/**
 * 防抖函数
 * **/
function debounce (fn, time, target = null) {
    let clock = null
    return (...args) => {
        clearTimeout(clock)
        clock = setTimeout(() => {
            fn.apply(target, args)
        }, time)
    }
}

module.exports = class HotGo extends EventEmitter {
    constructor (entry, dest, options = {}) {
        super()
        this.entry = entry
        this.dest = dest
        this.options = {
            delay: 100,
            watchFiles: [],
            buildArgs: [],
            execArgs: [],
            ...options
        }
        this.process = null

        const execArgs = []

        // 格式化参数
        for (const i in this.options.execArgs) {
            this.options.execArgs[i].split(/ +/).forEach(e => execArgs.push(e))
        }

        this.options.execArgs = execArgs

        this.on('change', (e) => {
            this.restart(e)
        })

        const notify = debounce((event, filename) => {
            this.emit('change', { event, filename })
        }, this.options.delay)

        const files = this.options.watchFiles

        for (const i in files) {
            fs.watch(files[i], (event, filename) => {
                notify(event, filename)
            })
        }
    }

    run (e) {
        // go build [-o output] [-i] [build flags] [packages]
        const buildArgs = [
            `-o ${this.dest}`,
            ...this.options.buildArgs,
            `${this.entry}`
        ].join(' ')

        const cmd = `go build ${buildArgs}`

        try {
            child_process.execSync(cmd)
        } catch (err) {
            this.emit('error', err)
            return
        }

        const execArgs = this.options.execArgs

        this.process = child_process.spawn(this.dest, execArgs, { stdio: 'inherit' })

        this.process.on('error', (err) => {
            this.emit('error', err)
        })
        this.process.on('exit', (code) => {
            this.emit('exit', code)
        })
        this.emit('start', { change: e, process: this.process, build: cmd, exec: this.process.spawnargs.join(' ') })
    }

    restart (e) {
        // 关闭上一个进程
        if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL')
        }

        this.run(e)
    }
}

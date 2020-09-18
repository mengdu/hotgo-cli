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
    constructor (entry, dest, watchFiles = [], delay = 100) {
        super()
        this.entry = entry
        this.dest = dest
        this.process = null

        this.on('change', (e) => {
            this.restart(e)
        })

        const notify = debounce((event, filename) => {
            this.emit('change', { event, filename })
        }, delay)

        const files = [ ...watchFiles ]

        for (const i in files) {
            fs.watch(files[i], (event, filename) => {
                notify(event, filename)
            })
        }
    }

    start (e) {
        child_process.execSync(`go build -o ${this.dest} ${this.entry}`)

        this.process = child_process.spawn(this.dest, { stdio: 'inherit' })

        this.process.on('error', (err) => {
            this.emit('error', err)
        })

        this.process.on('exit', (code) => {
            // .kill() 会出现null
            if (code === 'null') {
                this.emit('exit', code)
            }
        })

        this.emit('start', { change: e, process: this.process })
    }

    restart (e) {
        if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL')
        }

        this.start(e)
    }
}

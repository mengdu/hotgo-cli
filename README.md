# hotgo-cli

Watching go file change and go run it.

> Used instead of `go run main.go`

**Install**:

```ls
npm install -g hotgo-cli
```

**Usage**:

```sh
hotgo --watch="**/*.go" main.go
```

```txt
Usage: hotgo [options] <entry> [dest]

Watch go file change and go run it.

Options:
  -V, --version       output the version number
  -w, --watch <path>  watch directory path or files.
  -c --config <file>  Specify configuration file.
  -h, --help          display help for command
```

Specify configuration file `hotgo.jcon`.

```json
{
    "restartable": "rs",
    "ignore": [
        "node_modules",
        "*.js"
    ],
    "watch": [
        "**/*.json",
        "**/*.js"
    ]
}
```

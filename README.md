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
  --execArgs <args>   Execution parameters.
  --buildArgs <args>  Build parameters.
  --env <envs>        Execution environment.
  -h, --help          display help for command
```

Specify configuration file `hotgo.jcon`.

Example:

```json
{
    "restartable": "rs",
    "delay": 500,
    "ignore": [
        "node_modules",
        "*.js"
    ],
    "watch": [
        "**/*.json",
        "**/*.js"
    ],
    "buildArgs": [
        "-ldflags '-w -s'"
    ],
    "execArgs": [],
    "env": {
        "PORT": "4000"
    }
}
```

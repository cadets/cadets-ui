# Demo playground

This code exists to support the July PI meeting demo.
Changes with respect to the mainline code should be re-integrated "upstream"
after the demo.

## Installation

First, bring up a Neo4j instance containing OPUS data
(how to do this is outside of the scope of this particular README for now).
Then, install Python dependencies:

```terminal
$ pip install --user -r requirements.txt      # --user MAY be required
```

The `--user` flag may be required to avoid conflicts with a system package
manager.
For example, on FreeBSD, `pkg` can install many but not all of the required
packages and versions.
The `--user` flag allows local versions of the desired packages to be installed.
On MacOS with Homebrew, the machine owner can install to `/usr/local/Cellar`
using `pip` without the `--user` flag.

## Usage

Run the CADETS/OPUS GUI using the `cogui` command:

```terminal
$ ./cogui -h
cogui: CADETS/OPUS graphical user interface

Usage:
    cogui serve [--port=PORT] [options]

Commands:
    serve         Expose data through a local Web server

Options:
    -p,--port=PORT            TCP port to serve content on [default: 5000]

    --db-url=URL              Neo4j URL [default: bolt://localhost]
    --db-username=USERNAME    Neo4j username [default: neo4j]
    --db-password=PASSWORD    Neo4j password [default: opus]
$ ./cogui serve
 * Running on http://127.0.0.1:5000/ (Press CTRL+C to quit)
 * Restarting with stat
 * Debugger is active!
 * Debugger pin code: xxx-xxx-xxx
```

Connect to `localhost:5000` in a Web browser and start using the GUI!

# CADETS/OPUS UI

This is a Web-based UI for the CADETS/OPUS system.

## Getting started

### Install dependencies

This UI depends on:

* [Neo4J](http://neo4j.com/) (graph database)
* Node.JS
* `npm` (Node package manager)
* Python (v2.X, though v3 might also work?)
* [pip](https://pip.pypa.io/en/stable/installing) (already installed with Python 2 >= 2.7.9 or Python 3 >= 3.4)

You should start by installing all of these tools with your system's package manager ([`apt-get`](https://debian-handbook.info/browse/stable/sect.apt-get.html), [Chocolatey](https://chocolatey.org/), [Homebrew](https://brew.sh/), [`pkg`](https://www.freebsd.org/doc/handbook/pkgng-intro.html), …). Then, installing the UI's direct Node and Python dependencies is (almost) as simple as running `make deps`. For those who like using [Python virtual environments](http://python-guide-pt-br.readthedocs.io/en/latest/dev/virtualenvs), run your normal `virtualenv` commands before `make deps` (if you don't know what a `virtualenv` is, don't worry about it).

If your system package manager likes to manage Python packages and you're not using `virtualenv`, it would be a good idea to run `make` with the additional argument `PIP_FLAGS=--user`  or set such an environment variable. Otherwise, our use of `pip` might conflict with system-installed packages (which, at least on FreeBSD, are often older versions and less complete). On MacOS with Homebrew there shouldn't be any conflict, as the default `pip` is `/usr/local/bin/pip`, which installs packages in to a Homebrew-managed (and therefore user-writable) location.

Having understood the above, run `make deps`:

```shell
$ make deps
pip install -r requirements.txt
Collecting Flask-Bootstrap>=3.3 (from -r requirements.txt (line 2))
Collecting Flask-DotEnv>=0.1 (from -r requirements.txt (line 3))
  Downloading Flask-DotEnv-0.1.1.tar.gz
[...]
Successfully installed Flask-0.12.2 [...]
npm install
⸨        ░░░░░░░░░░⸩ ⠦ fetchMetadata: sill mapToRegistry uri https://registry
[...]
> fsevents@1.1.2 install /Users/jon/Documents/CADETS/ui/node_modules/fsevents
> node install

[...]
ui@0.1.0 /Users/jon/Documents/CADETS/ui
├─┬ css-loader@0.28.4
│ ├─┬ babel-code-frame@6.22.0
│ │ ├─┬ chalk@1.1.3
[...]

make deps  13.47s user 4.00s system 69% cpu 24.985 total
```

You have now successfully installed all Node and Python dependencies.

### Get data

In order to visualize OPUS provenance data, you will need a running Neo4j instance containing a graph database. Describing this process is out of scope for the UI, but we hope to have some public instructions to link to soon (and to provide some synthetic data as part of a "demo mode").

### Build demo UI

We use [`webpack`](https://webpack.js.org) to compile our scripts and style definitions into a form that is served to the browser by the Python-based Web server. To build these files once, run `make assets`:

```shell
$ make assets
npm run build_assets

> ui@0.1.0 build_assets /Users/jon/Documents/CADETS/ui
> webpack --progress --optimize-minimize

Hash: f33a0d19f532f7eee07c                                                      Version: webpack 2.7.0
Time: 7320ms
    Asset    Size  Chunks                    Chunk Names
bundle.js  308 kB       0  [emitted]  [big]  main
 [122] ./~/style-loader/lib/addStyles.js 8.7 kB {0} [built]
    + 111 hidden modules
```

The compiles our JavaScript files together with their dependencies into an optimized and "minified" file called `bundle.js` and transforms images into cache-friendly (but human-unfriendly) names like `1531d[…]2af.svg`. This content is optimized for serving quickly via the Web rather than debugging. A more developer-friendly way to build the assets is `make watch`, which compiles unoptimized versions of JavaScript and recompiles them whenever the source files change.

## Usage

Once the image, script and style assets have been compiled (or are being continuously rebuilt), run the CADETS/OPUS GUI using the `cogui` command:

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

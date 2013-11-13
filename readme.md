# walkner-hydro

Water pump station control and monitoring application in Node.js.

## Requirements

### Node.js

Node.js is a server side software system designed for writing scalable
Internet applications in JavaScript.

  * __Version__: 0.10.x
  * __Website__: http://nodejs.org/
  * __Download__: http://nodejs.org/download/
  * __Installation guide__: https://github.com/joyent/node/wiki/Installation

### MongoDB

MongoDB is a scalable, high-performance, open source NoSQL database.

  * __Version__: 2.4.x
  * __Website__: http://mongodb.org/
  * __Download__: http://www.mongodb.org/downloads
  * __Installation guide__: http://docs.mongodb.org/manual/installation/

### MODBUS PLC Simulator (optional)

MODBUS TCP protocol simulator for Windows. Can be used to test the application without any changes
to the configuration (if run on the same machine).

  * __Website__: http://www.plcsimulator.org/
  * __Download__: http://www.plcsimulator.org/downloads

## Installation

Clone the repository:

```
git clone http://github.com/morkai/walkner-hydro.git
```

or [download](https://github.com/morkai/walkner-hydro/zipball/master)
and extract it.

Go to the project's directory and install the dependencies:

```
cd walkner-hydro/
npm install -g grunt-cli
npm install
```

## Configuration

Application servers are started like so:

```
node walkner-hydro/backend/main.js <config-file.js>
```

where `<config-file.js>` is a path to a JavaScript file relative
to the `walkner-hydro/backend/main.js` file.

The JS config file should export at least two properties:

  - `id` - a string identifying the server process,

  - `modules` - a list of modules to start. A module can be an ID string or an object with
    `id` and `name` properties. If only the ID is specified, name is assumed to be equal to the ID.
    The `id` is a name of one of the files/directories under `walkner-hydro/backend/modules/`.
    The `name` is a unique name of the module used throughout the configuration (in case one module
    is started multiple times with different configuration).

Additionally, config file can export properties for each of the listed modules.
Property name must equal to the module `name` and its value must be an object that will be merged
with the module's default config and passed to the module instance.

Each application module may export the `DEFAULT_CONFIG` object which can be used to check what
options are available for configuration.

See an example config files under the `walkner-hydro/config/` directory.

## Building

To run the application in the production environment (`NODE_ENV=production`), an optimized version
of the `frontend/` directory must be generated by executing the following command:

`grunt build-frontend`

If the command finishes without an error, then a new directory named `frontend-build/` should appear
with:

  - all EJS templates compiled to JS AMD templates,
  - all MessageFormat JSON files compiled MessageFormat JS AMD files,
  - all JS and CSS files minified,
  - all used JS files concatenated into one file (`frontend-build/main.js`),
  - all used CSS files concatenated into one file (`frontend-build/assets/main.css`).

## Starting

### Manual

1. Start the MongoDB server.
2. Set the `NODE_ENV` environmental variable to `development` (default) or `production` (expects
   the `frontend-build/` directory).
3. Start the `controller` server: `node backend/main.js ../config/controller.js`
4. Start the `alarms` server: `node backend/main.js ../config/alarms.js`
5. Start the `frontend` server: `node backend/main.js ../config/frontend.js`
6. Optionally, for testing purposes, start the [MODBUS PLC Simulator](http://www.plcsimulator.org/).
7. Go to http://127.0.0.1/ or https://127.0.0.1/
8. Log in using `root`/`1337`.

### pm2

The three server processes can be managed by the [pm2](http://pm2.io/) (not available on Windows).
Install the `pm2` package (globally):

```
npm install -g pm2
```

Go to the `walkner-hydro/bin/` directory:

```
cd walkner-hydro/bin/
```

and execute:

```
pm2 start processes.json
```

To keep the processes alive after restarts (only on Ubuntu and CentOS),
execute the following command:

```
pm2 startup
```

## License

This project is released under the
[NPOSL-3.0](https://raw.github.com/morkai/walkner-hydro/master/license.md).
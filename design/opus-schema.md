# UI data schemas

This document describes data formats used in OPUS/UI interactions.

## OPUS

This is what OPUS knows about machines, processes, files, sockets and TCP
connections.
It is stored in a Neo4j database.


### Machines

| Name          | Type       | Description |
|---------------|------------|-------------|
| `id`          | `int`      | DB id for node |
| `external`    | `bool`     | false if we have traces from the host, true otherwise |
| `uuid`        | `str`      | *hostuuid |
| `ips`         | `list[str]`| List of ip addresses machine has been seen as |
| `timestamp`   | `int`      | cadets timestamp for first time machine was seen |


### Process

| Name          | Type       | Description |
|---------------|------------|-------------|
| `id`          | `int`      | DB id |
| `meta_login`  | `str`      | *login name of running user |
| `meta_{uid,euid,ruid,gid,egid,rgid}` | `int` | *{u,g}ids of process |
| `meta_ts`     | `int`      | timestamp of last metadata update |
| `pid`         | `int`      | process pid |
| `uuid`        | `str`      | process uuid |
| `cmdline`     | `str`      | process cmdline |
| `host`        | `str`      | host uuid |
| `anomalous`   | `bool`     | true if we see a process launch, false otherwise |
| `timestamp`   | `int`      | timestamp of first appearence |


### File

| Name          | Type       | Description |
|---------------|------------|-------------|
| `id`          | `int`      | DB id |
| `host`        | `str`      | host uuid |
| `name`        | `list[str]`| names the file has been reffered to by |
| `anomalous`   | `bool`     | `false` if we saw an open type operation, `true` if was created ex nihlo |
| `uuid`        | `str`      | file uuid |


### Socket
same as `File`, though name is either an IP+port in "0.0.0.0`:0" form or a path for local sockets


### Conn

| Name          | Type       | Description |
|---------------|------------|-------------|
| `id`          | `int`      | DB id |
| `server`      | `str`      | server side hostuuid |
| `server_ip`   | `str`      |             |
| `server_port` | `int`      |             |
| `client`      | `str`      | client side hostuuid |
| `client_ip`   | `str`      |             |
| `client_port` | `int`      |             |
| `method`      | `str`      | Method of reconciliation |
| `authority`   | `str`      | reconciler uuid |
| `confidence`  | float      | reconciliation confidence |


## UI

This is how the UI expects data returned from OPUS to be represented.
We use JSON as the default serialization mechanism since that's easy to convert
to JavaScript objects.

### Nodes

The JSON representation of nodes should be very similar to OPUS' native Neo4j representation.


#### Common fields

All node objects should have:

| Name          | Type           | Description                              |
|---------------|----------------|------------------------------------------|
| `id`          | `int`          | Opaque database ID (unique among nodes **and edges**)  |
| `type`        | `string`       | `machine`, `process`, `file-version`, `socket-version`, `connection` |


#### Machines

In addition to the common fields, a machine (`type = 'machine'`) should have the following fields:

| Name          | Type           | Description                              |
|---------------|----------------|------------------------------------------|
| `uuid`        | `string`       | UUIDv4
| `ips`         | `list[string]` | All known and previously-known IP addresses
| `names`       | `list[string]` | Names the machine been known by
| `first_seen`  | `int`          | UNIX timestamp
| `external`    | `bool`         | We have no traces from this machine


#### Process versions

| Name          | Type           | Description                              |
|---------------|----------------|------------------------------------------|
| `uuid`        | `string`       | UUID-ish string (may actually be host:uuid)
| `host`        | `string`       | UUID of host
| `pid`         | `int`          | UNIX pid
| `username`    | `string`       | Login for `uid`, if available (or `null`)
| `cmdline`     | `string`       | Invocation, if available (or `null`)
| `[er][ug]id`  | `int`          | UNIX [effective/real] [user/group] ID
| `last_update` | `int`          | UNIX timestamp of last `[er][ug]id` update
| `saw_creation`| `bool`         | We saw this **process's** (not just version's) creation


#### File versions

| Name          | Type           | Description                              |
|---------------|----------------|------------------------------------------|
| uuid          | `string`       | UUIDv4 (**or might it be UUID-ish?**)
| `host`        | `string`       | UUID of host
| `names`       | `list[string]` | Names the file has ever been referred to by
| `saw_creation`| `bool`         | We saw this **file's** opening

**Socket versions:**


#### Connections

TODO


### Edges

| Name          | Type           | Description                              |
|---------------|----------------|------------------------------------------|
| `id`          | `int`          | Opaque database ID (unique among nodes **and edges**)  |
| `type`        | `string`       | (see below)
| `source`      | `int`          | Origin node
| `target`      | `int`          | Destination node

Edge types may be:
* `parent`: process–process, roughly `fork(2)` + `exec(2)`
* `io`: process–file, e.g., `read(2)`, `write(2)`, `mmap(2)`
* `proc-metadata`: new process metadata
* `proc-change`: new process version
* `file-change`: new file (or socket) version
* `comm`: TODO

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

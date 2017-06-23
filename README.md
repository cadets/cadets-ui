# User interface for CADETS/OPUS

### Dependencies:
* Node
* npm
* python3
* virtualenv

### Build from source
* To build and run the application tied to a real neo4j db, run
```
make
```
and visit the website in your browser (in the default config,
http://localhost:8080)

* To build and run the server from stored output rather than live queries run
```
make synth
```
As sample stored data, we provide results from a query of all machines in a
trace. To see that, access http://localhost:8080/machines

* To just execute a build of the application without launching the server
immediately afterwards run
```
make build
```

* To record a new set of stored queries in the server run
```
make rec
```

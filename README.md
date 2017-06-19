# User interface for CADETS/OPUS

### Dependencies:
* Node
* npm
* python3.5
* virtualenv

### Build from source
To build and run the application run
```
make
```
and visit the website in your browser (in the default config,
http://localhost:8080)

To just execute a build of the application without launching the server immediately afterwards run
```
make build
```

To run the server from stored output rather than live queries run
```
make synth
```

To record a new set of stored queries in the server run
```
make rec
```

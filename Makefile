#Just a stub, jumpstarts other build processes

.PHONY: all build rec synth

all: build
	./run

rec: build
	./run --synth=synth --rec

synth: build
	./run --synth=synth

build: srv/venv www/js/bundle.js

www/js/bundle.js:
	./build -i

srv/venv:
	virtualenv -p python3.5 srv/venv
	./srv/install

%:
	@:

#Just a stub, jumpstarts other build processes

.PHONY: all build rec synth userjs

all: build
	./run

rec: build
	./run --synth=synth --rec

synth: build
	./run --synth=synth

build: srv/venv www/js/bundle.js node_modules/.bin

node_modules/.bin:
	./build -i

www/js/bundle.js: $(shell find lib -name "*.js")
	./build

srv/venv:
	virtualenv -p python2 srv/venv
	./srv/install

%:
	@:

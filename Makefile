#Just a stub, jumpstarts other build processes

.PHONY: all rec synth build

all: build
	./run

rec: build
	./run --synth=synth --rec

synth: build
	./run --synth=synth

build: srv/venv www/js/bundle.js

www/js/bundle.js: node_modules/.bin $(shell find lib -name "*.js")
	npm run build:www

node_modules/.bin:
	npm install

srv/venv:
	virtualenv -p python2 srv/venv
	./srv/install

%:
	@:

#Just a stub, jumpstarts other build processes

.PHONY: all npm

all:
	./build $(args)
npm:
	./build -i

%:
	@:

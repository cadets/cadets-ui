all: deps

WEBPACK?=	./node_modules/.bin/webpack

assets:
	npm run build_assets

deps:
	pip install ${PIP_FLAGS} -r requirements.txt
	npm install

watch:
	${WEBPACK} --watch


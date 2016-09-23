default:
	npm test

timings:
	./node_modules/.bin/mocha perf/*.ts --require ts-node/register

profile:
	./node_modules/.bin/mocha --prof perf/ProcessPerformanceTest.ts --require ts-node/register
	node --prof-process $$(ls -1tr isolate*.log | tail -1) > profile.txt


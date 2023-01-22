const Parser = require('./lib/parser');
const { log } = require('./lib/helper');

const url = process.argv[2] || null;

(async () => {
	if (!url) {
		log('Please specify URL of Youtube channel')
		return
	}
	await new Parser(url).parse()
})()
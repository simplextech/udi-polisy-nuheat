
const https = require('https');
const Polyglot = require('polyinterface');
const logger = Polyglot.logger;

module.exports = {
    api_call: async function(method, endpoint, data) {
        // let _data = null;

        const PATH = {
            AUTH: '/api/authenticate/user',
            THERMOSTATS: '/api/thermostats',
            THERMOSTAT: '/api/thermostat',
            }

        const options = {
            hostname: 'www.mynuheat.com',
            port: 443,
            path: PATH[endpoint],
            method: method,
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': data.length
            }
          }
    
          const req = https.request(options, res => {
            logger.info(`statusCode: ${res.statusCode}`)
    
            res.on('data', d => {
              let _data = JSON.parse(d);
              logger.info(_data);
              logger.info('SessionId: ' + _data.SessionId);
              return _data;
            })
          })
    
          req.on('error', error => {
            logger.info(error);
          })
          
          req.write(data);
          req.end();
    }
}
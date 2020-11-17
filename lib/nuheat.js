'use strict';

const https = require('https');
const axios = require('axios');
const querystring = require('querystring');
const storage = require('node-persist');
storage.init({dir: './storage'});

const baseUrl = 'https://www.mynuheat.com';

const URL = {
  AUTH: '/api/authenticate/user',
  THERMOSTATS: '/api/thermostats',
  THERMOSTAT: '/api/thermostat',
  }

module.exports = function(Polyglot, polyInterface) {
  const logger = Polyglot.logger;

  class NuheatInterface {
    constructor(polyInterface) {
      this.polyInterface = polyInterface;
    }

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async getReq(path, params, serialNumber) {
      let sessionId = await storage.getItem('sessionId');

      const config = {
        method: 'get',
        url: baseUrl + path,
        headers: {
          'Content-Type': 'application/json'
        },
        params: {
          sessionid: sessionId,
          serialnumber: serialNumber
        }
      }
      // logger.info('Axios Config: ' + JSON.stringify(config));

      let res = await axios.request(config);
      let data = null;

      if (res.status == 401) {
        await this.authenticate();
        res = await axios.request(config);
      } else {
        data = res.data;
        // logger.info('getReq data: ' + JSON.stringify(data));
      }
      
      return data;
    }

    async callAPI(path, method, params, serialNumber) {

      const URL = {
        AUTH: '/api/authenticate/user',
        THERMOSTATS: '/api/thermostats',
        THERMOSTAT: '/api/thermostat',
        }

      const options = {
        hostname: 'www.mynuheat.com',
        port: 443,
        path: URL[path] + '?' + params,
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
      }

      logger.info('Options: ' + JSON.stringify(options));

      let resData = null;
      const req = https.request(options, res => {
        logger.info(`statusCode: ${res.statusCode}`);

        res.on('data', d => {
          logger.info(d);
          // process.stdout.write(d);
          resData = JSON.parse(d);
        })
      })

      req.on('error', error => {
        logger.error(error);
      })

        // req.write(data);
        req.end();
    }

    async authenticate() {
      let username = this.polyInterface.getCustomParam('Username');
      let password = this.polyInterface.getCustomParam('Password');

      const config = {
        method: 'post',
        url: baseUrl + URL['AUTH'],
        headers: {
          'Content-Type': 'application/json'
        },
        data: {
          Email: username,
          Password: password,
          Confirm: password,
        }
      }

      // logger.info('Axios Config: ' + JSON.stringify(config));

      let res = await axios.request(config);
      let data = res.data
      // logger.info(JSON.stringify(data));
      let _saved = await storage.setItem('sessionId', data.SessionId);

      return _saved;

    }
  
    _authenticate() {
      let sessionId = null;

      let username = this.polyInterface.getCustomParam('Username');
      let password = this.polyInterface.getCustomParam('Password');

      const data = JSON.stringify({
        Email: username,
        Password: password,
        Confirm: password,
      })

      const options = {
          hostname: baseUrl,
          port: 443,
          path: '/api/authenticate/user',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': data.length
          }
        }
  
        const req = https.request(options, res => {
          logger.info(`statusCode: ${res.statusCode}`)
  
          res.on('data', d => {
            let _data = JSON.parse(d);
            // logger.info(_data);
            logger.info('SessionId: ' + _data.SessionId);
            // sessionId = _data.SessionId;
            storage.setItem('sessionId', _data.SessionId);
          })
        })
  
        req.on('error', error => {
          logger.info(error);
        })
        
        req.write(data);
        req.end();

        return true;
    }

    async thermostats() {
      let data = this.getReq('/api/thermostats');
      return data;
    }
  }

 
  return new NuheatInterface(polyInterface);
};

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

    CtoF(celsius) {
      // let _C = celsius / 100;
      let _F = Math.round(_C * 9/5 + 32, 10);
      return _F;
    }

    FtoC(fehrenheit) {
      let _C = parseInt(fehrenheit - 32 * 5/9, 10);
      return _C;
    }

    async getReq(path, serialNumber) {
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
      let data = null;
      try {
        let res = await axios.request(config);
        data = res.data
      }
      catch(err) {
        logger.error(err, 'StatusCode: ' + res.status);
      }
      
      // if (res.status == 401) {
      //   await this.authenticate();
      //   res = await axios.request(config);
      // } else {
      //   data = res.data;
      //   // logger.info('getReq data: ' + JSON.stringify(data));
      // }

      return data;
    }

    async postReq(path, serialNumber, setPoint) {
      let sessionId = await storage.getItem('sessionId');

      const config = {
        method: 'post',
        url: baseUrl + path,
        headers: {
          'Content-Type': 'application/json'
        },
        params: {
          sessionid: sessionId,
          serialnumber: serialNumber
        },
        data: {
          ScheduleMode: 3,
          SetPointTemp: setPoint
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
  
    async thermostats() {
      let data = this.getReq('/api/thermostats');
      return data;
    }

    async thermostat(serialNumber) {
      let data = this.getReq('/api/thermostat', serialNumber);
      return data;
    }

    async setPointHeat(serialNumber, setPoint) {
      let data = this.postReq('/api/thermostat', serialNumber, setPoint);
      return data;
    }
  }

 
  return new NuheatInterface(polyInterface);
};

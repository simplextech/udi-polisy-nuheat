'use strict';

const axios = require('axios');
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
      let _C = celsius / 100;
      let raw = (_C * 9/5) + 32;
      let F = Math.round(raw);
      return F;
    }

    FtoC(fehrenheit) {
      let _F = parseInt(fehrenheit, 10);
      let C = (_F - 32) * 5/9;
      return C;
    }

    JCtoC(json_celsius) {
      let _C = Math.round(json_celsius / 100, 10);
      return _C;
    }

    FtoJC(fehrenheit) {
      let _C = this.FtoC(fehrenheit);
      let _JC = Math.round(_C * 100);
      return _JC;
    }

    CtoJC(celsius) {
      let _JC = celsius * 100;
      return _JC;
    }

    AddMinutes(dt, minutes) {
      return new Date(dt.getTime() + minutes*60000);
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

      try {
        const res = await axios.request(config);
        return res.data;
      }
      catch(err) {
        logger.error(err);
      }
    }

    async postReq(path, serialNumber, setPoint, scheduleMode, holdUntil) {
      let sessionId = await storage.getItem('sessionId');
      let data = null;

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
          serialNumber: serialNumber,
          ScheduleMode: scheduleMode,
          SetPointTemp: setPoint,
          holdSetPointDateTime: holdUntil
        }
      }
      // logger.info('Axios Config: ' + JSON.stringify(config));

      try {
        const res = await axios.request(config);
        data = res.data;
      }
      catch(err) {
        logger.error(err);
        data = null
      }
      // logger.info('getReq data: ' + JSON.stringify(data));
      
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

      try {
        let res = await axios.request(config);
        let data = res.data
        let _saved = await storage.setItem('sessionId', data.SessionId);
        return _saved;
      } catch (error) {
        logger.error('Authentication Error: ', error);
      }
    }
  
    async thermostats() {
      let data = this.getReq('/api/thermostats');
      return data;
    }

    async thermostat(serialNumber) {
      let data = this.getReq('/api/thermostat', serialNumber);
      return data;
    }

    async setPointHeat(serialNumber, setPoint, holdUntil) {
      let data = this.postReq('/api/thermostat', serialNumber, setPoint, holdUntil);
      return data;
    }

    async setScheduleMode(serialNumber, scheduleMode) {
      let sessionId = await storage.getItem('sessionId');

      axios.post(baseUrl + '/api/thermostat?serialnumber=' + serialNumber + '&sessionid=' + sessionId, {
        scheduleMode: parseInt(scheduleMode, 10)
      })
      .then( function(response) {
        return response;
      })
    }

    async setAway(groupID, groupName) {
      let sessionId = await storage.getItem('sessionId');

      axios.post(baseUrl + '/api/groups/change?sessionid=' + sessionId, {
        GroupId: groupID,
        GroupName: groupName,
        AwayMode: true
      })
      .then( function(response) {
        return response;
      })
    }

    async setPresent(groupID, groupName) {
      let sessionId = await storage.getItem('sessionId');

      axios.post(baseUrl + '/api/groups/change?sessionid=' + sessionId, {
        GroupId: groupID,
        GroupName: groupName,
        AwayMode: false
      })
      .then( function(response) {
        return response;
      })
    }

  }

  return new NuheatInterface(polyInterface);
};

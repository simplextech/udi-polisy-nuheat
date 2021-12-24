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

    async inetCheck() {
      try {
        let data = await axios.get('http://www.google.com')
        if (data.status == 200) {
          return true;
        } else {
          return false;
        }
      } catch {
        logger.error('DNS is not resolving');
        return false;
      }
      
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
      let sessionId = null;
      try {
        sessionId = await storage.getItem('sessionId');
      } catch(error) {
        logger.error('getReq(): Failed retrieving sessionId');
      }

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

      if (sessionId != null) {
        try {
          const res = await axios.request(config);
          if (res.status == 200) {
            logger.info('getReq data: ' + JSON.stringify(res.data));
            return res.data;
          } else {
            return null;
          }
        }
        catch(error) {
          logger.error(error);
        }
      } else {
        logger.error('getReq(): sessionId null');
        return null;
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
      logger.info('PostReq data: ' + JSON.stringify(data));
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
        let data = res.data;
        let _saved = await storage.setItem('sessionId', data.SessionId);
        return _saved;
      } catch (error) {
        logger.error('Authentication Error: ', error);
        return;
      }
    }

    async thermostats() {
      let data;
      try {
        data = await this.getReq('/api/thermostats');
      } catch (error) {
        logger.error('thermostats(): Failed - ', error.message);
      }
      return data;
    }

    async thermostat(serialNumber) {
      let data;
      try {
        data = this.getReq('/api/thermostat', serialNumber);
      } catch(error) {
        logger.error('thermostat() Error: ', error)
      }
      return data;
    }

    async setPointHeat(serialNumber, setPoint, scheduleMode, holdUntil) {
      let sessionId = await storage.getItem('sessionId');

      axios.post(baseUrl + '/api/thermostat?serialnumber=' + serialNumber + '&sessionid=' + sessionId, {
        // serialNumber: serialNumber,
        ScheduleMode: scheduleMode,
        SetPointTemp: setPoint,
        holdSetPointDateTime: holdUntil
      })
      .then( function(response) {
        return response.status;
      })
      .catch( function(error) {
        logger.error('setPointHeat Failed: ', error);
      })
    }

    async setScheduleMode(serialNumber, scheduleMode) {
      let sessionId = await storage.getItem('sessionId');

      axios.post(baseUrl + '/api/thermostat?serialnumber=' + serialNumber + '&sessionid=' + sessionId, {
        scheduleMode: parseInt(scheduleMode, 10)
      })
      .then( function(response) {
        return response.status;
      })
      .catch( function(error) {
        logger.error('setScheduleMode Error: ', error);
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
        return response.status;
      })
      .catch( function(error) {
        logger.error('setScheduleMode Error: ', error);
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
        return response.status;
      })
      .catch( function(error) {
        logger.error('setScheduleMode Error: ', error);
      })
    }
  }

  return new NuheatInterface(polyInterface);
};

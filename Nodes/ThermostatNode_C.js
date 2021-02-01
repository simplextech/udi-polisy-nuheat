'use strict';

const nodeDefId = 'THERMOSTAT_C';

module.exports = function(Polyglot) {
  const logger = Polyglot.logger;

  class ThermostatNode_C extends Polyglot.Node {
    constructor(polyInterface, primary, address, name) {
      super(nodeDefId, polyInterface, primary, address, name);

      this.nuheat = require('../lib/nuheat.js')(Polyglot, polyInterface);

      this.commands = {
        QUERY: this.query,
        CLISPH: this.setPointHeat,
        SCHEDMODE: this.scheduleMode,
        HOLDUNTIL: this.holdUntil,
        AWAY: this.setAway,
        PRESENT: this.setPresent,
      };

      this.drivers = {
        ST: {value: '0', uom: 4},
        CLISPH: {value: '0', uom: 4},
        CLIMD: {value: '0', uom: 25},
        CLIHCS: {value: '0', uom: 66},
        GV0: {value: '0', uom: 19},
        GV1: {value: '0', uom: 44},
        GV2: {value: '1', uom: 20},
        GV3: {value: '0', uom: 2}
      };

      this.groupName = '';
      this.groupID = -1;
      this.query();
    }

    async query() {
      let statInfo = await this.nuheat.thermostat(this.address);

      if (statInfo === null || statInfo === undefined) {
        logger.error('Not Authenticated... Re-Authenticating...');
        this.nuheat.authenticate();
      } else {
        let temp = this.nuheat.JCtoC(statInfo.Temperature);
        let setPoint = this.nuheat.JCtoC(statInfo.SetPointTemp);
        let isHeating = 0;
        this.groupName = statInfo.GroupName;
        this.groupID = statInfo.GroupId;
        let groupAwayMode = 0;

        if (statInfo.Heating) {
          isHeating = 1;
        } else {
          isHeating = 0
        }

        if (statInfo.GroupAwayMode) {
          groupAwayMode = 1;
        } else {
          groupAwayMode = 0;
        }

        this.setDriver('ST', temp, true);
        this.setDriver('CLISPH', setPoint, true);
        this.setDriver('CLIMD', statInfo.ScheduleMode, true);
        this.setDriver('CLIHCS', isHeating, true);
        this.setDriver('GV3', groupAwayMode, true);
      }
    }

    setPointHeat(message) {
      let setPoint = this.nuheat.CtoJC(message.value);
      let holdMinutes = parseInt(this.drivers['GV2'].value, 10) * 60;
      let holdUntil = this.nuheat.AddMinutes(new Date(), holdMinutes).toISOString();
      let dt = new Date(holdUntil);
      let holdHour = dt.getHours();
      let holdMinute = dt.getMinutes();
      // let holdMinute = '00';
      logger.info('Hold Until ISO: ' + holdUntil);
      logger.info('Hold Until Time: ' + holdHour + ':' + holdMinute);

      let curMode = parseInt(this.drivers['CLIMD'].value, 10);
      switch(curMode) {
        case 1:
          this.setDriver('CLIMD', 2, true);
          this.setDriver('GV0', holdHour, true);
          this.setDriver('GV1', holdMinute, true);
          this.setDriver('CLISPH', message.value, true);
          this.nuheat.setPointHeat(this.address, setPoint, 2, holdUntil);
          break;
        case 2:
          this.setDriver('GV0', holdHour, true);
          this.setDriver('GV1', holdMinute, true);
          this.setDriver('CLISPH', message.value, true);
          this.nuheat.setPointHeat(this.address, setPoint, 2, holdUntil);
          break;
        case 3:
          this.setDriver('GV0', 0, true);
          this.setDriver('GV1', 0, true);
          this.setDriver('CLISPH', message.value, true);
          this.nuheat.setPointHeat(this.address, setPoint, 3, holdUntil);
          break;
      }
    }

    scheduleMode(message) {
      let ret = this.nuheat.setScheduleMode(this.address, message.value)
      this.setDriver('CLIMD', message.value, true);
      this.setDriver('GV0', 0, true);
      this.setDriver('GV1', 0, true);
    }

    holdUntil(message) {
      this.setDriver('GV2', message.value, true);
    }

    setAway() {
      if (this.groupID != -1) {
        let ret = this.nuheat.setAway(this.groupID, this.groupName);
        this.setDriver('GV3', 1, true);
      }
    }

    setPresent() {
      if (this.groupID != -1) {
        let ret = this.nuheat.setPresent(this.groupID, this.groupName);
        this.setDriver('GV3', 0, true);
      }
    }
    
  };

  ThermostatNode_C.nodeDefId = nodeDefId;

  return ThermostatNode_C;
};

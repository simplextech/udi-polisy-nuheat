'use strict';
// var helpers = require('../lib/helpers.js');
// const https = require('https');
const storage = require('node-persist');
storage.init({dir: './storage'});

const nodeDefId = 'CONTROLLER';

module.exports = function(Polyglot) {
  const logger = Polyglot.logger;

  const ThermostatNode_F = require('./ThermostatNode_F.js')(Polyglot);
  const ThermostatNode_C = require('./ThermostatNode_C.js')(Polyglot);

  class Controller extends Polyglot.Node {
    constructor(polyInterface, primary, address, name) {
      super(nodeDefId, polyInterface, primary, address, name);

      this.nuheat = require('../lib/nuheat.js')(Polyglot, polyInterface);

      this.commands = {
        // CREATE_NEW: this.onCreateNew,
        DISCOVER: this.onDiscover,
        UPDATE_PROFILE: this.onUpdateProfile,
        REMOVE_NOTICES: this.onRemoveNotices,
        QUERY: this.query,
      };

      this.drivers = {
        ST: { value: '1', uom: 2 }, // uom 2 = Boolean. '1' is True.
      };

      this.isController = true;
      this.sessionId = null;
    }

    // Creates a new node using ThermostatNode class, using a sequence number.
    // It needs to be an async function because we use the
    // this.polyInterface.addNode async function
    // async onCreateNew() {
    //   const prefix = 'node';
    //   const nodes = this.polyInterface.getNodes();

    //   // Finds the first available address and creates a node.
    //   for (let seq = 0; seq < 999; seq++) {
    //     // address will be <prefix><seq>
    //     const address = prefix + seq.toString().padStart(3, '0');

    //     if (!nodes[address]) {
    //       // ISY Address will be n<profileNum>_<prefix><seq>
    //       // name will be <prefix><seq>
    //       try {
    //         const result = await this.polyInterface.addNode(
    //           new ThermostatNode(this.polyInterface, this.address, address, address)
    //         );

    //         logger.info('Add node worked: %s', result);
    //       } catch (err) {
    //         logger.errorStack(err, 'Add node failed:');
    //       }
    //       break;
    //     }
    //   }
    // }

    // Here you could discover devices from a 3rd party API
    async onDiscover() {
      logger.info('Discovering');

      let sessionId = await storage.getItem('sessionId');
      // logger.info('Session File: ' + JSON.stringify(sessionId));

      if (!sessionId) {
        let auth = await this.nuheat.authenticate();
        logger.info('Controller Auth: ' + JSON.stringify(auth));
      }
      
      logger.info('Getting Thermostats');
      let tstats = await this.nuheat.thermostats();
      logger.info('Thermostat Data: ' + JSON.stringify(tstats));

      let groups = tstats.Groups;
      for (const group of groups) {
        logger.info('Group Name: ' + group.groupName);
        for (const stat of group.Thermostats) {
          logger.info('Room: ' + stat.Room);
          logger.info('Serial Number: ' + stat.SerialNumber);

          const name = stat.Room;
          const address = stat.SerialNumber.toString();
          const scale = this.polyInterface.getCustomParam('Scale');

          if (scale == 'Fahrenheit') {
            try {
              const result = await this.polyInterface.addNode(
                new ThermostatNode_F(this.polyInterface, address, address, name)
              );
      
              logger.info('Add node worked: %s', result);
            } catch (err) {
              logger.errorStack(err, 'Add node failed:');
            }
          } else {
            try {
              const result = await this.polyInterface.addNode(
                new ThermostatNode_C(this.polyInterface, address, address, name)
              );
      
              logger.info('Add node worked: %s', result);
            } catch (err) {
              logger.errorStack(err, 'Add node failed:');
            }
          }
        }
      }
    }

    // Sends the profile files to ISY
    onUpdateProfile() {
      this.polyInterface.updateProfile();
    }

    // Removes notices from the Polyglot UI
    onRemoveNotices() {
      this.polyInterface.removeNoticesAll();
    }

  };

  // Required so that the interface can find this Node class using the nodeDefId
  Controller.nodeDefId = nodeDefId;

  return Controller;
};

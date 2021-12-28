'use strict';

trapUncaughExceptions();

const fs = require('fs');
const markdown = require('markdown').markdown;
const AsyncLock = require('async-lock');
const axios = require('axios');

const Polyglot = require('polyinterface-v3');

const logger = Polyglot.logger;
const lock = new AsyncLock({ timeout: 500 });

const nuheat = require('./lib/nuheat.js')(Polyglot);
const ControllerNode = require('./Nodes/ControllerNode.js')(Polyglot);
const ThermostatNode_F = require('./Nodes/ThermostatNode_F.js')(Polyglot);
const ThermostatNode_C = require('./Nodes/ThermostatNode_C.js')(Polyglot);

const emailParam = 'Username';
const pwParam = 'Password';
const tempScale = 'Scale';

const defaultParams = {
  [emailParam]: 'john@doe.net',
  [pwParam]: 'password',
  [tempScale]: 'Fahrenheit'
};

logger.info('Starting Node Server');

const poly = new Polyglot.Interface([ControllerNode, ThermostatNode_F, ThermostatNode_C]);

poly.on('mqttConnected', function() {
  logger.info('MQTT Connection started');
});

poly.on('config', function(config) {
  const nodesCount = Object.keys(config.nodes).length;
  logger.info('Config received has %d nodes', nodesCount);

  if (config.isInitialConfig) {
    poly.removeNoticesAll();
    const md = fs.readFileSync('./configdoc.md');
    poly.setCustomParamsDoc(markdown.toHTML(md.toString()));
    
    if (!nodesCount) {
      try {
        logger.info('Auto-creating controller');
        callAsync(autoCreateController());
      } catch (err) {
        logger.error('Error while auto-creating controller node:', err);
      }
    
      // if (config.newParamsDetected) {
      //   logger.info('New parameters detected');
      // }
    }
  }
});

poly.on('customParams', function(params) {
  initializeCustomParams(params)
}); 

poly.on('poll', function(longPoll) {
  callAsync(doPoll(longPoll));
});

poly.on('stop', async function() {
  logger.info('Graceful stop');
  // await doPoll(false);
  // await doPoll(true);
  poly.stop();
});

poly.on('delete', function() {
  logger.info('Nodeserver is being deleted');
  poly.stop();
});

poly.on('mqttEnd', function() {
  logger.info('MQTT connection ended.');
});

poly.on('messageReceived', function(message) {
  if (!message['config']) {
    logger.debug('Message Received: %o', message);
  }
});

poly.on('messageSent', function(message) {
  logger.debug('Message Sent: %o', message);
});

async function doPoll(longPoll) {
  try {
    await lock.acquire('poll', async function () {
      // logger.info('%s', longPoll ? 'Long poll' : 'Short poll');
      const nodes = poly.getNodes();

      if (longPoll) {
        logger.info('Long Poll');
      } else {
        logger.info('Short Poll: Update nodes');
        if (nuheat.inetCheck()) {
          Object.keys(nodes).forEach(function (address) {
            if ('query' in nodes[address]) {
              nodes[address].query();
            }
          });
        } else {
          this.polyInterface.restart();
        }
      }
    });
  } catch (err) {
    logger.error('Error while polling: %s', err.message);
  }
}

async function autoCreateController() {
  try {
    await poly.addNode(
      new ControllerNode(poly, 'controller', 'controller', 'ST-NuHeat')
    );
  } catch (err) {
    logger.error('Error creating controller node');
  }

  // Add a notice in the UI for 5 seconds
  poly.addNoticeTemp('newController', 'Controller node initialized', 5);
}

function initializeCustomParams(currentParams) {
  const defaultParamKeys = Object.keys(defaultParams);
  const currentParamKeys = Object.keys(currentParams);

  // Get orphan keys from either currentParams or defaultParams
  const differentKeys = defaultParamKeys.concat(currentParamKeys)
    .filter(function(key) {
      return !(key in defaultParams) || !(key in currentParams);
  });

  if (differentKeys.length) {
    let customParams = {};

    // Only keeps params that exists in defaultParams
    // Sets the params to the existing value, or default value.
    defaultParamKeys.forEach(function(key) {
      customParams[key] = currentParams[key] ?
        currentParams[key] : defaultParams[key];
    });

    poly.saveCustomParams(customParams);
  }
}

function callAsync(promise) {
  (async function() {
    try {
      await promise;
    } catch (err) {
      logger.error('Error with async function: %s %s', err.message, err.stack);
    }
  })();
}

function trapUncaughExceptions() {
  process.on('uncaughtException', function(err) {
    logger.error(`uncaughtException REPORT THIS!: ${err.stack}`);
  });
}

function useCloud() {
  return process.env.MQTTENDPOINT && process.env.STAGE;
}

// Starts the NodeServer!
poly.start();

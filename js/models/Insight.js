'use strict';

var util = require('util');
var async = require('async');
var request = require('request');
var bitcore = require('bitcore');
var io = require('socket.io-client');
var log = require('../log');

var EventEmitter = require('events').EventEmitter;
var preconditions = require('preconditions').singleton();

/*
  This class lets interfaces with the blockchain, making general queries and
  subscribing to transactions on adressess and blocks.

  Opts: 
    - url
    - reconnection (optional)
    - reconnectionDelay (optional)

  Events:
    - tx: activity on subscribed address.
    - block: a new block that includes a subscribed address.
    - connect: the connection with the blockchain is ready.
    - disconnect: the connection with the blochckain is unavailable.  
*/

var Insight = function(opts) {
  preconditions.checkArgument(opts)
    .shouldBeObject(opts)
    .checkArgument(opts.url)

  this.status = this.STATUS.DISCONNECTED;
  this.subscribed = {};
  this.listeningBlocks = false;

  this.url = opts.url;
  this.opts = {
    'reconnection': opts.reconnection || true,
    'reconnectionDelay': opts.reconnectionDelay || 1000,
    'secure': opts.url.indexOf('https') === 0
  };


   if (opts.transports) {
     this.opts['transports'] =  opts.transports;
   }

  this.socket = this.getSocket();
}

util.inherits(Insight, EventEmitter);

Insight.prototype.STATUS = {
  CONNECTED: 'connected',
  DISCONNECTED: 'disconnected',
  DESTROYED: 'destroyed'
}

/** @private */
Insight.prototype.subscribeToBlocks = function() {
  var socket = this.getSocket();
  if (this.listeningBlocks || !socket.connected) return;

  var self = this;
  socket.on('block', function(blockHash) {
    self.emit('block', blockHash);
  });
  this.listeningBlocks = true;
}

/** @private */
Insight.prototype._getSocketIO = function(url, opts) {
  log.debug('Insight: Connecting to socket:', this.url, this.opts);
  return io(this.url, this.opts);
};


Insight.prototype._setMainHandlers = function(url, opts) {
  // Emmit connection events
  var self = this;
  this.socket.on('connect', function() {
    self.status = self.STATUS.CONNECTED;
    self.subscribeToBlocks();
    self.emit('connect', 0);
  });

  this.socket.on('connect_error', function() {
    if (self.status != self.STATUS.CONNECTED) return;
    self.status = self.STATUS.DISCONNECTED;
    self.emit('disconnect');
  });

  this.socket.on('connect_timeout', function() {
    if (self.status != self.STATUS.CONNECTED) return;
    self.status = self.STATUS.DISCONNECTED;
    self.emit('disconnect');
  });

  this.socket.on('reconnect', function(attempt) {
    if (self.status != self.STATUS.DISCONNECTED) return;
    self.emit('reconnect', attempt);
    self.reSubscribe();
    self.status = self.STATUS.CONNECTED;
  });
};


/** @private */
Insight.prototype.getSocket = function() {

  if (!this.socket) {
    this.socket = this._getSocketIO(this.url, this.opts);
    this._setMainHandlers();
  }
  return this.socket;
}

/** @private */
Insight.prototype.request = function(path, cb) {
  preconditions.checkArgument(path).shouldBeFunction(cb);
  request(this.url + path, cb);
}

/** @private */
Insight.prototype.requestPost = function(path, data, cb) {
  preconditions.checkArgument(path).checkArgument(data).shouldBeFunction(cb);
  request({
    method: "POST",
    url: this.url + path,
    json: data
  }, cb);
}

Insight.prototype.destroy = function() {
  var socket = this.getSocket();
  this.socket.disconnect();
  this.socket.removeAllListeners();
  this.socket = null;
  this.subscribed = {};
  this.status = this.STATUS.DESTROYED;
  this.removeAllListeners();
};

Insight.prototype.subscribe = function(addresses) {
  addresses = Array.isArray(addresses) ? addresses : [addresses];
  var self = this;

  function handlerFor(self, address) {
    return function(txid) {
      // verify the address is still subscribed
      if (!self.subscribed[address]) return;

      self.emit('tx', {
        address: address,
        txid: txid
      });
    }
  }

  var s = self.getSocket();
  addresses.forEach(function(address) {
    preconditions.checkArgument(new bitcore.Address(address).isValid());

    // skip already subscibed
    if (!self.subscribed[address]) {
      var handler = handlerFor(self, address);
      self.subscribed[address] = handler;
      log.debug('Subcribe to: ', address);

      s.emit('subscribe', address);
      s.on(address, handler);
    }
  });
};

Insight.prototype.getSubscriptions = function(addresses) {
  return this.subscribed;
}


Insight.prototype.reSubscribe = function() {
  log.debug('insight reSubscribe');
  var allAddresses = Object.keys(this.subscribed);
  this.subscribed = {};
  var s = this.socket;
  if (s) {
    s.removeAllListeners();
    this._setMainHandlers();
    this.subscribe(allAddresses);
    this.subscribeToBlocks();
  }
};


Insight.prototype.broadcast = function(rawtx, cb) {
  preconditions.checkArgument(rawtx);
  preconditions.shouldBeFunction(cb);

  this.requestPost('/api/tx/send', {
    rawtx: rawtx
  }, function(err, res, body) {
    if (err || res.status != 200) cb(err || res);
    cb(null, body ? body.txid : null);
  });
};

Insight.prototype.getTransaction = function(txid, cb) {
  preconditions.shouldBeFunction(cb);
  this.request('/api/tx/' + txid, function(err, res, body) {
    if (err || res.statusCode != 200 || !body) return cb(err || res);
    cb(null, JSON.parse(body));
  });
};

Insight.prototype.getTransactions = function(addresses, cb) {
  preconditions.shouldBeArray(addresses);
  preconditions.shouldBeFunction(cb);

  var self = this;
  if (!addresses.length) return cb(null, []);

  // Iterator: get a list of transaction ids for an address
  function getTransactionIds(address, next) {
    self.request('/api/addr/' + address, function(err, res, body) {
      if (err || res.statusCode != 200 || !body) return next(err || res);
      next(null, JSON.parse(body).transactions);
    });
  }

  async.map(addresses, getTransactionIds, function then(err, txids) {
    if (err) return cb(err);

    // txids it's a list of list, let's fix that:
    var txidsList = txids.reduce(function(a, r) {
      return r.concat(a);
    });

    // Remove duplicated txids
    txidsList = txidsList.filter(function(elem, pos, self) {
      return self.indexOf(elem) == pos;
    });

    // Now get the transactions for that list of txIds
    async.map(txidsList, self.getTransaction.bind(self), function then(err, txs) {
      if (err) return cb(err);
      cb(null, txs);
    });
  });
};

Insight.prototype.getUnspent = function(addresses, cb) {
  preconditions.shouldBeArray(addresses);
  preconditions.shouldBeFunction(cb);

  this.requestPost('/api/addrs/utxo', {
    addrs: addresses.join(',')
  }, function(err, res, body) {
    if (err || res.statusCode != 200) return cb(err || res);
    cb(null, body);
  });
};

Insight.prototype.getActivity = function(addresses, cb) {
  preconditions.shouldBeArray(addresses);

  this.getTransactions(addresses, function then(err, txs) {
    if (err) return cb(err);

    var flatArray = function(xss) {
      return xss.reduce(function(r, xs) {
        return r.concat(xs);
      }, []);
    };
    var getInputs = function(t) {
      return t.vin.map(function(vin) {
        return vin.addr
      });
    };
    var getOutputs = function(t) {
      return flatArray(
        t.vout.map(function(vout) {
          return vout.scriptPubKey.addresses;
        })
      );
    };

    var activityMap = new Array(addresses.length);
    var activeAddress = flatArray(txs.map(function(t) {
      return getInputs(t).concat(getOutputs(t));
    }));
    activeAddress.forEach(function(addr) {
      var index = addresses.indexOf(addr);
      if (index != -1) activityMap[index] = true;
    });

    cb(null, activityMap);
  });
};

module.exports = Insight;

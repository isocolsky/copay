'use strict';

// 62.9% typed (by google's closure-compiler account)

var _ = require('lodash');
var preconditions = require('preconditions').instance();

var bitcore = require('bitcore');
var HK = bitcore.HierarchicalKey;
var WalletKey = bitcore.WalletKey;
var networks = bitcore.networks;
var util = bitcore.util;
var BIP39 = bitcore.BIP39;
var BIP39WordlistEn = bitcore.BIP39WordlistEn;

var HDPath = require('./HDPath');

/**
 * @desc
 * Wrapper for bitcore.HierarchicalKey to be used inside of Copay.
 *
 * @param {Object} opts
 * @param {string} opts.networkName if set to 'testnet', use the test3 bitcoin
 *                                  network constants (livenet otherwise)
 * @param {string} opts.extendedPrivateKeyString if set, use this private key
 *                                               string, othewise create a new
 *                                               private key
 * @constructor
 */
function PrivateKey(opts) {
  opts = opts || {};
  this.network = opts.networkName === 'testnet' ?  networks.testnet : networks.livenet;
  if (opts.extendedPrivateKeyString) {
    this.extendedPrivateKeyMnemonic = opts.extendedPrivateKeyMnemonic;
    this.bip = new HK(opts.extendedPrivateKeyString);
  } else {
    this.extendedPrivateKeyMnemonic = opts.extendedPrivateKeyMnemonic || BIP39.mnemonic(BIP39WordlistEn, 256);
    var seed = BIP39.mnemonic2seed(this.extendedPrivateKeyMnemonic, '');
    this.bip = HK.seed(seed, this.network.name);
  }
  this.privateKeyCache = {};
  this.publicHex = this.deriveBIP45Branch().eckey.public.toString('hex');
};

/**
 * @desc Retrieve this derivated private key's public key in hexa format
 *
 * The value returned is calculated using the path from PrivateKey's
 * <tt>HDParams.IdFullBranch</tt>. This key is used to identify the copayer
 * (signing messages mostly).
 *
 * @returns {string} the public key in a hexadecimal string
 */
PrivateKey.prototype.getId = function() {
  if (!this.id) {
    this.cacheId();
  }
  return this.id;
};

/**
 * @desc Retrieve this private key's private key in hex format
 *
 * The value returned is calculated using the path from PrivateKey's
 * <tt>HDParams.IdFullBranch</tt>. This key is used to identify the copayer
 * (signing messages mostly).
 *
 * @returns {string} the private key in a hexadecimal string
 */
PrivateKey.prototype.getIdPriv = function() {
  if (!this.idpriv) {
    this.cacheId();
  }
  return this.idpriv;
};

/**
 * @desc Retrieve this private key's private key
 *
 * The value returned is calculated using the path from PrivateKey's
 * <tt>HDParams.IdFullBranch</tt>. This key is used to identify the copayer
 * (signing messages mostly).
 *
 * @returns {bitcore.PrivateKey} the private key
 */
PrivateKey.prototype.getIdKey = function() {
  if (!this.idkey) {
    this.cacheId();
  }
  return this.idkey;
};

/**
 * @desc Caches the result of deriving IdFullBranch
 *
 * @private
 */
PrivateKey.prototype.cacheId = function() {
  var path = HDPath.IdFullBranch;
  var idhk = this.bip.derive(path);
  this.idkey = idhk.eckey;
  this.id = idhk.eckey.public.toString('hex');
  this.idpriv = idhk.eckey.private.toString('hex');
};

/**
 * @desc Derive the master branch for Copay.
 */
PrivateKey.prototype.deriveBIP45Branch = function() {
  if (!this.bip45Branch) {
    this.bip45Branch = this.bip.derive(HDPath.BIP45_PUBLIC_PREFIX);
  }
  return this.bip45Branch;
};

/**
 * @desc Returns an object with information needed to rebuild a PrivateKey
 * (as most of its properties are derived from the extended private key). 
 *
 * @TODO: Figure out if this is the correct pattern
 * This is a static method and is probably used for serialization.
 *
 * @static
 * @param {Object} data
 * @param {*} data.networkName - a name for a bitcoin network
 * @param {*} data.extendedPrivateKeyString - a bip32 extended private key
 * @returns {Object} an object with two properties: networkName and
 *                   extendedPrivateKeyString, taken from the <tt>data</tt>
 *                   parameter.
 */
PrivateKey.trim = function(data) {
  var opts = {};
  ['networkName', 'extendedPrivateKeyString', 'extendedPrivateKeyMnemonic'].forEach(function(k){
    opts[k] = data[k];
  });
  return opts
};

/**
 * @desc Generate a private Key from a serialized object
 *
 * @TODO: This method uses PrivateKey.trim but it's actually not needed...
 *
 * @param {Object} data
 * @param {*} data.networkName - a name for a bitcoin network
 * @param {*} data.extendedPrivateKeyString - a bip32 extended private key
 * @returns {PrivateKey}
 */
PrivateKey.fromObj = function(obj) {
  return new PrivateKey(PrivateKey.trim(obj));
};

/**
 * @desc Serialize a private key, keeping only the data necessary to rebuild it
 *
 * @returns {Object}
 */
PrivateKey.prototype.toObj = function() {
  return {
    extendedPrivateKeyString: this.getExtendedPrivateKeyString(),
    networkName: this.network.name,
    extendedPrivateKeyMnemonic: this.extendedPrivateKeyMnemonic,
  };
};

/**
 * @desc Retrieve a BIP32 extended public key as generated by bitcore
 *
 * @returns {string}
 */
PrivateKey.prototype.getExtendedPublicKeyString = function() {
  return this.bip.extendedPublicKeyString();
};

/**
 * @desc Retrieve a BIP32 extended private key as generated by bitcore
 *
 * @returns {string}
 */
PrivateKey.prototype.getExtendedPrivateKeyString = function() {
  return this.bip.extendedPrivateKeyString();
};

/**
 * @desc
 * Retrieve a HierarchicalKey derived from the given path as generated by
 * bitcore
 * @param {string} path - a string for derivation (something like "m/234'/1/2")
 * @returns {bitcore.HierarchicalKey}
 */
PrivateKey.prototype._getHK = function(path) {
  if (_.isUndefined(path)) {
    return this.bip;
  }
  var ret = this.bip.derive(path);
  return ret;
};

/**
 * @desc
 * Retrieve an array of WalletKey derived from given paths. {@see PrivateKey#getForPath}
 *
 * @param {string[]} paths - the paths to derive
 * @returns {bitcore.WalletKey[]} - the derived keys
 */
PrivateKey.prototype.getForPaths = function(paths) {
  return paths.map(this.getForPath.bind(this));
};

/**
 * @desc
 * Retrieve a WalletKey derived from a path.
 *
 * @param {string} paths - the path to derive
 * @returns {bitcore.WalletKey} - the derived key
 */
PrivateKey.prototype.getForPath = function(path) {
  var pk = this.privateKeyCache[path];
  if (!pk) {
    var derivedHK = this._getHK(path);
    pk = this.privateKeyCache[path] = derivedHK.eckey.private.toString('hex');
  }
  var wk = new WalletKey({
    network: this.network
  });
  wk.fromObj({
    priv: pk
  });
  return wk;
};

/**
 * @desc
 * Retrieve a Branch for Copay using the given path
 *
 * @TODO: Investigate when is this called and if this is really needed
 *
 * @param {number} index - the index of the key to generate
 * @param {boolean} isChange - whether this is a change adderess or a receive
 * @param {number} cosigner - the cosigner index
 * @return {bitcore.HierarchicalKey}
 */
PrivateKey.prototype.get = function(index, isChange, cosigner) {

  // TODO: Add parameter validation?

  var path = HDPath.FullBranch(index, isChange, cosigner);
  return this.getForPath(path);
};

/**
 * @desc
 * Retrieve multiple branches for Copay up to the received indexes
 *
 * @TODO: Investigate when is this called and if this is really needed
 *
 * @param {number} receiveIndex - the number of receive addresses to generate
 * @param {number} changeIndex - the number of change addresses to generate
 * @param {number} cosigner - the cosigner index
 * @return {bitcore.HierarchicalKey}
 */
PrivateKey.prototype.getAll = function(receiveIndex, changeIndex, cosigner) {
  preconditions.checkArgument(!_.isUndefined(receiveIndex) && !_.isUndefined(changeIndex));

  var ret = [];
  for (var i = 0; i < receiveIndex; i++) {
    ret.push(this.get(i, false, cosigner));
  }
  for (var i = 0; i < changeIndex; i++) {
    ret.push(this.get(i, true, cosigner));
  }
  return ret;
};

module.exports = PrivateKey;

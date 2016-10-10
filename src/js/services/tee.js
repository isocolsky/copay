'use strict';

angular.module('copayApp.services')
  .factory('tee', function($log, $timeout, gettext, lodash, bitcore, hwWallet) {

    var root = {};
    var IntelWallet = require('intelWalletCon');
    var TEE_APP_ID = '63279de1b6cb4dcf8c206716bd318092f8c206716bd31809263279de1b6cb4dc';

    var walletEnclave = new IntelWallet.Wallet();
    var walletEnclaveStatus = walletEnclave.initializeEnclave();
    if (walletEnclaveStatus != 0) {
      $log.error('Failed to create Intel Wallet enclave');
    }

    root.getInfoForNewWallet = function(isMultisig, account, callback) {
      var opts = {};
      root.getEntropySource(isMultisig, account, function(err, entropySource) {
        if (err) return callback(err);

        opts.entropySource = entropySource;
        root.getXPubKey(hwWallet.getAddressPath('tee', isMultisig, account), function(data) {
          if (!data.success) {
            $log.warn(data.message);
            return callback(data);
          }
          opts.extendedPublicKey = data.xpubkey;
          opts.externalSource = 'tee';
          opts.account = account;
          opts.derivationStrategy = 'BIP44';

          return callback(null, opts);
        });
      });
    };

    root.getXPubKey = function(path, callback) {
      $log.debug('TEE deriving xPub path:', path);

      var walletId = root.createWallet(true, function(data) {

        var result = {
          success: false, 
          message: '',
          xpubkey: ''
        }

        if (data.success) {
          var xpubkey = walletEnclave.getPublicKey(path, data.walletId);

          if (xpubkey.status == 0) {
            result.success = true;
            result.message = 'OK';
            result.xpubkey = xpubkey.ExtendedPublicKey;
          } else {
            $log.error('Failed to get xpubkey from TEE wallet: ' + xpubkey.message + ' (status=' + xpubkey.status + ')');
          }
        } else {
          result.message = data.message;
        }

        callback(result);
      });
    };

    root.getEntropySource = function(isMultisig, account, callback) {
      root.getXPubKey(hwWallet.getEntropyPath('tee', isMultisig, account), function(data) {
        if (!data.success)
          return callback(hwWallet._err(data));

        return callback(null,  hwWallet.pubKeyToEntropySource(data.xpubkey));
      });
    };

    root.createWallet = function (testnet, callback) {
        var result = {
          success: false,
          message: '',
          walletId: ''
        };

        var args = {
          "Testnet" : testnet,
          "PINUnlockRequired" : false,
          "PINSignatureDataRequired" : false,
          "PINSignatureTransaction" : 0,
          "ExportCount" : 10,
          "MaxPINAttempts" : 3,
          "PINTimeout" : 30
        };

        var teeStatus = walletEnclave.createWallet(TEE_APP_ID, args);
        switch (teeStatus) {
          case 'CREATE_WALLET_FAILURE':
            result.message = teeStatus;
            $log.error(teeStatus);
            break;
          default:
            result.success = true;
            result.message = 'OK';
            result.walletId = teeStatus;
            $log.debug('TEE wallet created: ' + result.walletId);
        }
        callback(result);
    };

    return root;
});

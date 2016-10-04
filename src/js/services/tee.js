'use strict';

angular.module('copayApp.services')
  .factory('tee', function($log, $timeout, gettext, lodash, bitcore, hwWallet) {
    var root = {};

    var TEE_APP_ID = '63279de1b6cb4dcf8c206716bd318092f8c206716bd31809263279de1b6cb4dc';

    var IntelWallet = require('intelWalletCon');
    $log.debug(IntelWallet);

    root.createWallet = function (testnet) {
        root.wallet = new IntelWallet.Wallet();
        root.wallet.initializeEnclave();
        $log.debug(root.wallet);

        var args = {
                "Testnet" : testnet,
                "PINUnlockRequired" : false,
                "PINSignatureDataRequired" : false,
                "PINSignatureTransaction" : 0,
                "ExportCount" : 10,
                "MaxPINAttempts" : 3,
                "PINTimeout" : 30
            };
        return root.wallet.createWallet(TEE_APP_ID, args);
    };

    return root;
});

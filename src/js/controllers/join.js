'use strict';

angular.module('copayApp.controllers').controller('joinController',
  function($scope, $rootScope, $timeout, go, notification, profileService, configService, storageService, applicationService, gettext, lodash, ledger, trezor, platformInfo, derivationPathHelper, ongoingProcess, walletService) {

    var isChromeApp = platformInfo.isChromeApp;
    var isDevel = platformInfo.isDevel;

    var self = this;
    var defaults = configService.getDefaults();
    $scope.bwsurl = defaults.bws.url;
    $scope.derivationPath = derivationPathHelper.default;
    $scope.account = 1;

    this.onQrCodeScanned = function(data) {
      $scope.secret = data;
      $scope.joinForm.secret.$setViewValue(data);
      $scope.joinForm.secret.$render();
    };

    var updateSeedSourceSelect = function() {
      self.seedOptions = [{
        id: 'new',
        label: gettext('Random'),
      }, {
        id: 'set',
        label: gettext('Specify Recovery Phrase...'),
      }];
      $scope.seedSource = self.seedOptions[0];


      if (isChromeApp) {
        self.seedOptions.push({
          id: walletService.externalSource.ledger.id,
          label: walletService.externalSource.ledger.longName
        });
      }

      if (isChromeApp || isDevel) {
        self.seedOptions.push({
          id: walletService.externalSource.trezor.id,
          label: walletService.externalSource.ledger.longName
        });
      }
    };

    this.setSeedSource = function() {
      self.seedSourceId = $scope.seedSource.id;

      $timeout(function() {
        $rootScope.$apply();
      });
    };

    this.join = function(form) {
      if (form && form.$invalid) {
        self.error = gettext('Please enter the required fields');
        return;
      }

      var opts = {
        secret: form.secret.$modelValue,
        myName: form.myName.$modelValue,
        bwsurl: $scope.bwsurl,
      }

      var setSeed = self.seedSourceId == 'set';
      if (setSeed) {
        var words = form.privateKey.$modelValue;
        if (words.indexOf(' ') == -1 && words.indexOf('prv') == 1 && words.length > 108) {
          opts.extendedPrivateKey = words;
        } else {
          opts.mnemonic = words;
        }
        opts.passphrase = form.passphrase.$modelValue;

        var pathData = derivationPathHelper.parse($scope.derivationPath);
        if (!pathData) {
          this.error = gettext('Invalid derivation path');
          return;
        }
        opts.account = pathData.account;
        opts.networkName = pathData.networkName;
        opts.derivationStrategy = pathData.derivationStrategy;
      } else {
        opts.passphrase = form.createPassphrase.$modelValue;
      }

      opts.walletPrivKey = $scope._walletPrivKey; // Only for testing


      if (setSeed && !opts.mnemonic && !opts.extendedPrivateKey) {

        this.error = gettext('Please enter the wallet recovery phrase');
        return;
      }

      if (self.seedSourceId == walletService.externalSource.ledger.id || self.seedSourceId == walletService.externalSource.trezor.id) {
        var account = $scope.account;
        if (!account || account < 1) {
          this.error = gettext('Invalid account number');
          return;
        }

        if (self.seedSourceId == walletService.externalSource.trezor.id)
          account = account - 1;

        opts.account = account;
        ongoingProcess.set('connecting' + self.seedSourceId, true);
        var src = self.seedSourceId == walletService.externalSource.ledger.id ? ledger : trezor;

        src.getInfoForNewWallet(true, account, function(err, lopts) {
          ongoingProcess.set('connecting' + self.seedSourceId, false);
          if (err) {
            self.error = err;
            $scope.$apply();
            return;
          }
          opts = lodash.assign(lopts, opts);
          self._join(opts);
        });
      } else {

        self._join(opts);
      }
    };

    this._join = function(opts) {
      ongoingProcess.set('joiningWallet', true);
      $timeout(function() {
        profileService.joinWallet(opts, function(err) {
          ongoingProcess.set('joiningWallet', false);
          if (err) {
            self.error = err;
            $rootScope.$apply();
            return;
          }
          go.walletHome();
        });
      }, 100);
    };

    updateSeedSourceSelect();
    self.setSeedSource();
  });

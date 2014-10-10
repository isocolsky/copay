'use strict';

angular.module('copayApp.controllers').controller('CreateController',
  function($scope, $rootScope, $location, $timeout, identity, controllerUtils, Passphrase, backupService, notification) {
    controllerUtils.redirIfLogged();

    $rootScope.fromSetup = true;
    $scope.loading = false;
    $scope.walletPassword = $rootScope.walletPassword;
    $scope.isMobile = !!window.cordova;
    $scope.hideAdv = true;
    $scope.networkName = config.networkName;

    // ng-repeat defined number of times instead of repeating over array?
    $scope.getNumber = function(num) {
      return new Array(num);
    }

    $scope.totalCopayers = config.wallet.totalCopayers;
    $scope.TCValues = _.range(1, config.limits.totalCopayers + 1);

    var updateRCSelect = function(n) {
      var maxReq = copay.Wallet.getMaxRequiredCopayers(n);
      $scope.RCValues = _.range(1, maxReq + 1);
      $scope.requiredCopayers = Math.min(parseInt(n / 2 + 1), maxReq);
    };

    updateRCSelect($scope.totalCopayers);

    $scope.$watch('totalCopayers', function(tc) {
      updateRCSelect(tc);
    });

    $scope.create = function(form) {
      if (form && form.$invalid) {
        notification.error('Error', 'Please enter the required fields');
        return;
      }
      $scope.loading = true;
      Passphrase.getBase64Async($scope.walletPassword, function(passphrase) {
        var opts = {
          requiredCopayers: $scope.requiredCopayers,
          totalCopayers: $scope.totalCopayers,
          name: $scope.walletName,
          nickname: $scope.myNickname,
          passphrase: passphrase,
          privateKeyHex: $scope.private,
          networkName: $scope.networkName,
        };
        identity.create(opts, function(err, w) {
          controllerUtils.startNetwork(w, $scope);
        });
      });
    };

    $scope.isSetupWalletPage = 0;

    $scope.setupWallet = function() {
      $scope.isSetupWalletPage = !$scope.isSetupWalletPage;
    };

  });

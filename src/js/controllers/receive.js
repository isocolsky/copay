'use strict';

angular.module('copayApp.controllers').controller('receiveController',
  function($rootScope, $scope, $timeout, $modal, isCordova, isMobile, profileService, storageService) {
    var self = this;
    var fc = profileService.focusedClient;

    this.showAll = false;
    this.isCordova = isCordova;

    this.newAddress = function() {
      self.generatingAddress = true;
      profileService.focusedClient.createAddress(function(err, addr) {
        self.addr = addr.address;
        self.generatingAddress = false;
        $scope.$digest();

        storageService.storeLastAddress(fc.walletId, addr.address, function() {});
      });
    };

    this.getAddress = function() {
      storageService.getLastAddress(fc.walletId, function(err, addr) {
        if (addr) {
          self.addr = addr;
          $timeout(function() {
            $scope.$digest();
          });
        } else {
          self.newAddress();
        }
      })
    };

    this.copyAddress = function(addr) {
      if (isCordova) {
        window.cordova.plugins.clipboard.copy('bitcoin:' + addr);
        window.plugins.toast.showShortCenter('Copied to clipboard');
      }
    };

    this.shareAddress = function(addr) {
      if (isCordova) {
        if (isMobile.Android() || isMobile.Windows()) {
          window.ignoreMobilePause = true;
        }
        window.plugins.socialsharing.share('bitcoin:' + addr, null, null, null);
      }
    };

    this.openAddressModal = function(address) {
      var self = this;
      var ModalInstanceCtrl = function($scope, $modalInstance, address) {
        $scope.address = address;
        $scope.isCordova = self.isCordova;
        $scope.copyAddress = function(addr) {
          self.copyAddress(addr);
        };

        $scope.cancel = function() {
          $modalInstance.dismiss('cancel');
        };
      };

      $modal.open({
        templateUrl: 'views/modals/qr-address.html',
        windowClass: 'full',
        controller: ModalInstanceCtrl,
        resolve: {
          address: function() {
            return address;
          }
        }
      });
    };

    this.toggleShowAll = function() {
      this.showAll = !this.showAll;
      this.setAddressList();
    };

    this.setAddressList = function() {
      if (this.showAll) {
        var self = this;
        fc.getMainAddresses({}, function(err, addrs) {
          self.addresses = addrs;
          $scope.$digest();
        });
      } else {
        this.addresses = [];
      }
    };

  }
);

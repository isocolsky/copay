'use strict';

angular.module('copayApp.controllers').controller('preferencesExternalController', function($scope, lodash, profileService, walletService) {
  var fc = profileService.focusedClient;

  $scope.externalSource = lodash.find(walletService.externalSource, function(source) {
    return source.id == fc.getPrivKeyExternalSourceName();
  }).name;

  $scope.showMneumonic = function() {
  	walletService.showMneumonic(fc, function(err) {
  	  if (err) {
  	  	// TODO
  	  }
  	});
  };

});

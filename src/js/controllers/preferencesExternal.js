'use strict';

angular.module('copayApp.controllers').controller('preferencesExternalController', function($scope, $log, lodash, gettext, profileService, walletService) {
  var fc = profileService.focusedClient;

	$scope.error = null;
  $scope.externalSource = lodash.find(walletService.externalSource, function(source) {
    return source.id == fc.getPrivKeyExternalSourceName();
  }).name;

  $scope.showMneumonic = function() {
  	walletService.showMneumonic(fc, function(err) {
  	  if (err) {
  	  	$log.error('Error: failed to display wallet mneumonic (' + err + ')');
  	  	$scope.error = gettext('Error: cannot display wallet recovery phrase');
  	  }
  	});
  };

});

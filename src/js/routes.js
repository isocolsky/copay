'use strict';

var unsupported;

if (window && window.navigator) {
  var rxaosp = window.navigator.userAgent.match(/Android.*AppleWebKit\/([\d.]+)/);
  var isaosp = (rxaosp && rxaosp[1] < 537);
  if (!window.cordova && isaosp)
    unsupported = true;
}


//Setting up route
angular
  .module('copayApp')
  .config(function(localStorageServiceProvider, bwcServiceProvider, $stateProvider, $urlRouterProvider) {

    localStorageServiceProvider
      .setPrefix('copayApp')
      .setStorageType('localStorage')
      .setNotify(true, true);

    bwcServiceProvider.setBaseUrl('http://localhost:3001/copay/api');

    $urlRouterProvider.otherwise('/');

    $stateProvider
      .state('walletHome', {
        url: '/',
        controller: 'homeController',
        templateUrl: 'views/home.html',
        walletShouldBeComplete: true,
        needProfile: true
      })
      .state('createProfile', {
        url: '/createProfile',
        templateUrl: 'views/createProfile.html',
        needProfile: false
      })
      .state('unsupported', {
        url: '/unsupported',
        templateUrl: 'views/unsupported.html',
        needProfile: false
      })
      .state('uri-payment', {
        url: '/uri-payment/:data',
        controller: 'paymentUriController',
        needProfile: false
      })
      .state('selectWalletForPayment', {
        url: '/selectWalletForPayment',
        controller: 'walletForPaymentController',
        needProfile: false
      })
      .state('join', {
        url: '/join',
        controller: 'joinController',
        templateUrl: 'views/join.html',
        needProfile: true
      })
      .state('import', {
        url: '/import',
        controller: 'importController',
        templateUrl: 'views/import.html',
        needProfile: true
      })
      .state('importProfile', {
        url: '/importProfile',
        templateUrl: 'views/importProfile.html',
        needProfile: false
      })
      .state('create', {
        url: '/create',
        controller: 'createController',
        templateUrl: 'views/create.html',
        needProfile: true
      })
      .state('copayers', {
        url: '/copayers',
        controller: 'copayersController',
        templateUrl: 'views/copayers.html',
        needProfile: true
      })
      .state('profile', {
        url: '/profile',
        controller: 'profileController',
        templateUrl: 'views/profile.html',
        needProfile: true
      })

    .state('receive', {
        url: '/receive',
        controller: 'receiveController',
        templateUrl: 'views/receive.html',
        walletShouldBeComplete: true,
        needProfile: true
      })
      .state('history', {
        url: '/history',
        controller: 'historyController',
        templateUrl: 'views/history.html',
        walletShouldBeComplete: true,
        needProfile: true
      })
      .state('send', {
        url: '/send',
        controller: 'sendController',
        templateUrl: 'views/send.html',
        walletShouldBeComplete: true,
        needProfile: true
      })
      .state('preferences', {
        url: '/preferences',
        controller: 'preferencesController',
        templateUrl: 'views/preferences.html',
        walletShouldBeComplete: true,
        needProfile: true
      })
      .state('settings', {
        url: '/settings',
        controller: 'settingsController',
        templateUrl: 'views/settings.html',
        needProfile: false
      })
      .state('warning', {
        url: '/warning',
        controller: 'warningController',
        templateUrl: 'views/warning.html',
        needProfile: false
      })
      .state('add', {
        url: '/add',
        controller: 'addController',
        templateUrl: 'views/add.html',
        needProfile: true
      })
      .state('signout', {
        url: '/signout',
        controller: 'signoutController',
        needProfile: true
      });
  })
  .run(function($rootScope, $state, gettextCatalog, uriHandler, isCordova) {

    var userLang, androidLang;

    if (navigator && navigator.userAgent && (androidLang = navigator.userAgent.match(/android.*\W(\w\w)-(\w\w)\W/i))) {
      userLang = androidLang[1];
    } else {
      // works for iOS and Android 4.x
      userLang = navigator.userLanguage || navigator.language;
    }

    userLang = userLang ? (userLang.split('-', 1)[0] || 'en') : 'en';
    gettextCatalog.setCurrentLanguage(userLang);

    // Register URI handler, not for mobileApp
    if (!isCordova) {
      uriHandler.register();
    }

    $rootScope.$on('$stateChangeStart', function(event, toState, toParams, fromState, fromParams) {

      if (unsupported) {
        $state.transitionTo('unsupported');
        event.preventDefault();
      }

      if (!$rootScope.iden && toState.needProfile) {
        $state.transitionTo('createProfile');
        event.preventDefault();
      }
      if ($rootScope.wallet && !$rootScope.wallet.isComplete() && toState.walletShouldBeComplete) {
        $state.transitionTo('copayers');
        event.preventDefault();
      }
    });
  });
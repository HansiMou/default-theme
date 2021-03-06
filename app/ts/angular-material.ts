(()=> {
let w: any = window;
if (w.gamingPlatformInitFinished) {
  console.error("function gamingPlatformInitFinished is already defined! Overriding it...");
} 
w.gamingPlatformInitFinished = function () {
  let main = gamingPlatform.main;
  let translate = main.l10n().translate;
  let customize = main.game().customize;
  if (!customize) customize = (id: string, value: string) => value; // For old API without customize. TODO: remove in July 2016.
  
  if (w.platformTranslations) {
    main.l10n().setTranslations(w.platformTranslations);
  } else {
    console.error("platformTranslations wasn't defined!");
  }
  
  angular.module('whateverNameApp', ["gamingPlatformModule", 'ngMaterial'])
  .config(['$mdThemingProvider', '$mdIconProvider', 
    function ($mdThemingProvider: any, $mdIconProvider: any) {
      $mdThemingProvider
          .theme('default')
          .primaryPalette(customize('primaryPalette', 'blue'))
          .accentPalette(customize('accentPalette', 'red'));
    }])
  .directive('gpMatchListItem', 
    function () {
      return {
        templateUrl: 'html-templates/matchListItem.html',
        restrict: 'A',
      };
    })
  .run(['$rootScope', '$timeout', 
      '$mdSidenav', '$mdMedia', '$mdComponentRegistry',
      '$mdBottomSheet', '$mdDialog', '$mdMenu',
    function ($rootScope: any, $timeout: any, 
        $mdSidenav: any, $mdMedia: any, $mdComponentRegistry: any, 
        $mdBottomSheet: any, $mdDialog: any, $mdMenu: any) {
          
      function confirmDismiss(match: gamingPlatform.api.Match) {
        if (match.isOver()) {
          match.dismiss();
          return;
        }
        // Two getters
        $rootScope.getConfirmDismissMatch = ()=>match;
        $rootScope.confirmDismissDialogTitle = ()=>translate('SURE_YOU_WANT_TO_RESIGN', 
            {OPPONENTS_NAME: match.getOpponentNames()});
        // Two dialog actions
        $rootScope.closeConfirmDismissDialog = ()=>$mdDialog.cancel();
        $rootScope.dismissConfirmDismissMatch = ()=>{match.dismiss(); $mdDialog.cancel();};
       
        openDialogTemplate('html-templates/confirmDismissDialog.html');
      }
      
      function openDialogTemplate(templateUrl: string) {
        $mdDialog.show({
          clickOutsideToClose: true,
          templateUrl: templateUrl,
          scope: $rootScope,
          preserveScope: true,
        });
      }
      
      function openFeedbackDialog() {
        let title = translate('MODAL_TITLE_FEEDBACK_AND_BUGS');
        $mdDialog.show(
          $mdDialog.prompt()
            .clickOutsideToClose(true)
            .title(title)
            .textContent('')
            .ariaLabel(title)
            .ok(translate('MODAL_BUTTON_SEND_FEEDBACK_AND_BUGS'))
            .cancel(translate('MODAL_BUTTON_CLOSE'))
            // You can specify either sting with query selector
            .openFrom('#test_open_feedback_modal')
            // or an element
            .closeTo('#test_open_feedback_modal')
        ).then((feedback: string)=>main.sendFeedback(feedback));
      }
      
      function getOpponent(match: gamingPlatform.api.Match) {
        return match.getPlayers({limit:1, excludeMe: true, excludeSinglePlayer: true})[0];
      }
      
      function canShowPlayerBottomSheet(
          player: gamingPlatform.api.Player, match: gamingPlatform.api.Match) {
        if (match && match.isSinglePlayer()) return false;
        if (!player) player = getOpponent(match);
        return !(player.isMe() || player.isUnknown());
      }
      
      let playerInfoBottomSheetShowing = false;
      function showPlayerBottomSheet(
          player: gamingPlatform.api.Player, match: gamingPlatform.api.Match) {
        if (!canShowPlayerBottomSheet(player, match)) return;
        if (!player) player = getOpponent(match);
        
        playerInfoBottomSheetShowing = true;
        $mdBottomSheet.show({
          templateUrl: 'html-templates/playerInfoBottomSheet.html',
          controller: ''
        }).finally(function() {
          main.hideModal('playerInfoModal');
          playerInfoBottomSheetShowing = false;
        });
        $rootScope.playerInBottomSheet = ()=>player;
        let model = main.model();
        $rootScope.sendChatAndCloseBottomSheet = ()=>{$mdBottomSheet.hide(); main.sendChat(model.chatMessage, player, match);};
        model.chatMessage = "";
      }
      function playerInfoModalShowingChanged(newValue: boolean, oldValue: boolean) {
        main.log("playerInfoModalShowingChanged: newValue=", newValue, "playerInfoBottomSheetShowing=", playerInfoBottomSheetShowing, " oldValue=", oldValue)
        if (!newValue && playerInfoBottomSheetShowing) {
          $mdBottomSheet.hide();
          return;
        }
        if (newValue && !playerInfoBottomSheetShowing) {
          let player = main.playerInPlayerInfoModal();
          let match = main.matchInPlayerInfoModal();
          if (player) showPlayerBottomSheet(player, match);
        }
      }
      
      let gameOverDialogShowing = false;
      function gameOverModalShowingChanged(newValue: boolean, oldValue: boolean) {
        main.log("gameOverModalShowingChanged: newValue=", newValue, "gameOverDialogShowing=", gameOverDialogShowing, " oldValue=", oldValue)
        if (!newValue && gameOverDialogShowing) {
          $mdDialog.hide();
          return;
        }
        if (newValue && !gameOverDialogShowing) {
          gameOverDialogShowing = true;
          $mdDialog.show({
            clickOutsideToClose: true,
            templateUrl: 'html-templates/gameOverDialog.html',
            scope: $rootScope,
            preserveScope: true,
          }).finally(function() {
            main.closeGameOverModal();
            gameOverDialogShowing = false;
          }); 
        }
      }
      
      $rootScope['$mdSidenav'] = $mdSidenav;
      $rootScope['$mdMedia'] = $mdMedia;
      $rootScope['$mdBottomSheet'] = $mdBottomSheet;
      $rootScope['$mdDialog'] = $mdDialog;
      $rootScope['$mdMenu'] = $mdMenu;
      
      $rootScope['showPlayerBottomSheet'] = showPlayerBottomSheet;
      $rootScope['canShowPlayerBottomSheet'] = canShowPlayerBottomSheet;
      $rootScope['confirmDismiss'] = confirmDismiss;
      $rootScope['openFeedbackDialog'] = openFeedbackDialog;
      $rootScope.$watch("main.isModalShowing('gameOverModal')", gameOverModalShowingChanged);
      $rootScope.$watch("main.isModalShowing('playerInfoModal')", playerInfoModalShowingChanged);
      
      $rootScope.sideNavIsOpen = () => false; // overridden later.
      $mdComponentRegistry.when('left').then(function(sideNav: any) {
        $rootScope.sideNavIsOpen = () => $mdSidenav('left').isOpen() &&
            // When gt-xs, then the sideNav is always open (and sideNav.isOpen may return true/false regardless).
            !$mdMedia('gt-xs');
        if (main.isFirstTimeUser()) {
          main.passMessageToGame({SHOW_GAME_INSTRUCTIONS: true}); // Open the instructions (when you'll navigate to the playPage) on first use.
          $timeout(function () {
            openDialogTemplate('html-templates/facebookLoginDialog.html');
            //$mdSidenav('left').toggle();
          }, 500); // I wait half a second just for the user to see the game title for a bit.
        }
      });
    } 
  ]);
  angular.bootstrap(document, ["whateverNameApp"]);
};
})();
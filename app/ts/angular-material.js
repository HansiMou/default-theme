(function () {
    var w = window;
    if (w.gamingPlatformInitFinished) {
        console.error("function gamingPlatformInitFinished is already defined! Overriding it...");
    }
    w.gamingPlatformInitFinished = function () {
        var main = gamingPlatform.main;
        var translate = main.l10n().translate;
        var customize = main.game().customize;
        if (!customize)
            customize = function (id, value) { return value; }; // For old API without customize. TODO: remove in July 2016.
        if (w.platformTranslations) {
            main.l10n().setTranslations(w.platformTranslations);
        }
        else {
            console.error("platformTranslations wasn't defined!");
        }
        angular.module('whateverNameApp', ["gamingPlatformModule", 'ngMaterial'])
            .config(['$mdThemingProvider', '$mdIconProvider',
            function ($mdThemingProvider, $mdIconProvider) {
                $mdThemingProvider
                    .theme('default')
                    .primaryPalette(customize('primaryPalette', 'blue'))
                    .accentPalette(customize('accentPalette', 'red'));
            }])
            .directive('gpMatchListItem', function () {
            return {
                templateUrl: 'html-templates/matchListItem.html',
                restrict: 'A',
            };
        })
            .run(['$rootScope', '$timeout',
            '$mdSidenav', '$mdMedia', '$mdComponentRegistry',
            '$mdBottomSheet', '$mdDialog', '$mdMenu',
            function ($rootScope, $timeout, $mdSidenav, $mdMedia, $mdComponentRegistry, $mdBottomSheet, $mdDialog, $mdMenu) {
                function confirmDismiss(match) {
                    if (match.isOver()) {
                        match.dismiss();
                        return;
                    }
                    // Two getters
                    $rootScope.getConfirmDismissMatch = function () { return match; };
                    $rootScope.confirmDismissDialogTitle = function () { return translate('SURE_YOU_WANT_TO_RESIGN', { OPPONENTS_NAME: match.getOpponentNames() }); };
                    // Two dialog actions
                    $rootScope.closeConfirmDismissDialog = function () { return $mdDialog.cancel(); };
                    $rootScope.dismissConfirmDismissMatch = function () { match.dismiss(); $mdDialog.cancel(); };
                    openDialogTemplate('html-templates/confirmDismissDialog.html');
                }
                function openDialogTemplate(templateUrl) {
                    $mdDialog.show({
                        clickOutsideToClose: true,
                        templateUrl: templateUrl,
                        scope: $rootScope,
                        preserveScope: true,
                    });
                }
                function openFeedbackDialog() {
                    var title = translate('MODAL_TITLE_FEEDBACK_AND_BUGS');
                    $mdDialog.show($mdDialog.prompt()
                        .clickOutsideToClose(true)
                        .title(title)
                        .textContent('')
                        .ariaLabel(title)
                        .ok(translate('MODAL_BUTTON_SEND_FEEDBACK_AND_BUGS'))
                        .cancel(translate('MODAL_BUTTON_CLOSE'))
                        .openFrom('#test_open_feedback_modal')
                        .closeTo('#test_open_feedback_modal')).then(function (feedback) { return main.sendFeedback(feedback); });
                }
                function getOpponent(match) {
                    return match.getPlayers({ limit: 1, excludeMe: true })[0];
                }
                function canShowPlayerBottomSheet(player, match) {
                    if (!player)
                        player = getOpponent(match);
                    return !(player.isMe() || player.isUnknown());
                }
                var playerInfoBottomSheetShowing = false;
                function showPlayerBottomSheet(player, match) {
                    if (!player)
                        player = getOpponent(match);
                    if (player.isMe() || player.isUnknown())
                        return;
                    playerInfoBottomSheetShowing = true;
                    $mdBottomSheet.show({
                        templateUrl: 'html-templates/playerInfoBottomSheet.html',
                        controller: ''
                    }).finally(function () {
                        main.hideModal('playerInfoModal');
                        playerInfoBottomSheetShowing = false;
                    });
                    $rootScope.playerInBottomSheet = function () { return player; };
                    var model = main.model();
                    $rootScope.sendChatAndCloseBottomSheet = function () { $mdBottomSheet.hide(); main.sendChat(model.chatMessage, player, match); };
                    model.chatMessage = "";
                }
                function playerInfoModalShowingChanged(newValue, oldValue) {
                    main.log("playerInfoModalShowingChanged: newValue=", newValue, "playerInfoBottomSheetShowing=", playerInfoBottomSheetShowing, " oldValue=", oldValue);
                    if (!newValue && playerInfoBottomSheetShowing) {
                        $mdBottomSheet.hide();
                        return;
                    }
                    if (newValue && !playerInfoBottomSheetShowing) {
                        var player = main.playerInPlayerInfoModal();
                        var match = main.matchInPlayerInfoModal();
                        if (player)
                            showPlayerBottomSheet(player, match);
                    }
                }
                var gameOverDialogShowing = false;
                function gameOverModalShowingChanged(newValue, oldValue) {
                    main.log("gameOverModalShowingChanged: newValue=", newValue, "gameOverDialogShowing=", gameOverDialogShowing, " oldValue=", oldValue);
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
                        }).finally(function () {
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
                $rootScope.sideNavIsOpen = function () { return false; }; // overridden later.
                $mdComponentRegistry.when('left').then(function (sideNav) {
                    $rootScope.sideNavIsOpen = function () { return $mdSidenav('left').isOpen() &&
                        // When gt-xs, then the sideNav is always open (and sideNav.isOpen may return true/false regardless).
                        !$mdMedia('gt-xs'); };
                    if (main.isFirstTimeUser()) {
                        main.passMessageToGame({ SHOW_GAME_INSTRUCTIONS: true }); // Open the instructions (when you'll navigate to the playPage) on first use.
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
//# sourceMappingURL=angular-material.js.map
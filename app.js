/*

Copyright 2023 NeXY

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

*/

angular.module("beamng.apps").directive("replayCapturingAssistant", [
  "$filter",
  "$log",
  "$state",
  "$rootScope",
  function ($filter, $log, $state, $rootScope) {
    return {
      templateUrl: "/ui/modules/apps/RCA/app.html",
      replace: true,
      restrict: "EA",
      scope: true,
      link: function (scope, element, attrs) {
        // ------ App config ------

        const config = {
          css: {
            width: 1920,
            height: 1080,
          },
          debug: true,
        };

        // Greatest common divisor
        let gcd = function (a, b) {
          return b == 0 ? a : gcd(b, a % b);
        };


        // ------ RcA's variables ------

        // Pseudo enums
        scope.UI = {
          ALL: 1,
          RPL: 2,
        };

        scope.B = {
          AllUI: 1,
          RPLUI: 2,
        };

        scope.side = {
          UP: 1,
          DOWN: 2,
        };

        scope.defaultResolution = {
          width: config.css.width,
          height: config.css.height,
          GCD: gcd(config.css.width, config.css.height),
        };

        scope.frame = {
          W: scope.defaultResolution.width / scope.defaultResolution.GCD,
          H: scope.defaultResolution.height / scope.defaultResolution.GCD,
        };

        scope.customRatio = scope.frame;

        scope.linePos = {
          horizontal: scope.defaultResolution.width,
          vertical: scope.defaultResolution.height,
          verticalWidth: scope.defaultResolution.width,
          verticalLeft: 0,
        };

        // Data that is used in the HTML template
        scope.formElement = {
          UI: true,
          RPLUI: true,
          B1Border: 5,
          B2Border: 0,
          B3Border: 0,
          B4Border: 0,
          RDBottom: 0,
          RPLHBtnX: 10,
          RPLpositionX: 0,
          RPLpositionY: 0,
          UIButton: "Hide",
          CRWColor: "#acacac",
          CRHColor: "#acacac",
          hideBtnBorderRadius: 20,
          defaultRatio: `${scope.frame.W}:${scope.frame.H}`,
        };


        // -- Replay's variables --

        scope.state = "idle";
        scope.speed = 1;

        scope.renaming = false;
        scope.isSeeking = false;
        let lastSeek = 0;

        bngApi.engineLua("be:getFileStream():requestState()");
        let originalFilename = "";


        // ----------------------------------------------------------------

        let calcMaxRes = function (W, H) {
          if (
            ((scope.defaultResolution.height * W) / H) % 1 == 0 &&
            (scope.defaultResolution.height * W) / H <=
              scope.defaultResolution.width
          ) {
            return {
              width: (scope.defaultResolution.height * W) / H,
              height: scope.defaultResolution.height,
            };
          }
          if (
            ((scope.defaultResolution.width * H) / W) % 1 == 0 &&
            (scope.defaultResolution.width * H) / W <=
              scope.defaultResolution.height
          ) {
            return {
              height: (scope.defaultResolution.width * H) / W,
              width: scope.defaultResolution.width,
            };
          }

          for (let i = 1; true; i++) {
            if (
              W * (i + 1) > scope.defaultResolution.width ||
              H * (i + 1) > scope.defaultResolution.height
            ) {
              return {
                height: H * i,
                width: W * i,
              };
            }
          }
        };

        let setLineResolution = function (width, height) {
          scope.linePos.vertical =
            scope.defaultResolution.height -
            (scope.defaultResolution.height - height) / 2;
          scope.linePos.horizontal =
            scope.defaultResolution.width -
            (scope.defaultResolution.width - width) / 2;
          scope.linePos.verticalWidth = width;
          scope.linePos.verticalLeft =
            scope.defaultResolution.width - scope.linePos.horizontal;
        };


        // ------ Button's functions ------

        scope.setAspectRatio = function (val) {
          switch (val) {
            case 0:
              scope.frame.W =
                scope.defaultResolution.width / scope.defaultResolution.GCD;
              scope.frame.H =
                scope.defaultResolution.height / scope.defaultResolution.GCD;
              break;
            case 916:
              scope.frame.W = 9;
              scope.frame.H = 16;
              break;
            case 219:
              scope.frame.W = 21;
              scope.frame.H = 9;
              break;
            case 9195:
              scope.frame.W = 9;
              scope.frame.H = 19.5;
              break;
          }
          scope.update();
        };

        scope.setReversed = function () {
          let oldW = scope.frame.W;
          scope.frame.W = scope.frame.H;
          scope.frame.H = oldW;
          scope.update();
        };

        scope.changeW = function (val) {
          switch (val) {
            case scope.side.UP:
              if (scope.customRatio.W < 99) {
                scope.customRatio.W++;
              }
              break;
            case scope.side.DOWN:
              if (scope.customRatio.W > 1) {
                scope.customRatio.W--;
              }
              break;
          }
          scope.formElement.CRHColor = "#acacac";
          scope.formElement.CRWColor = "#e0e0e0";
        };

        scope.changeH = function (val) {
          switch (val) {
            case scope.side.UP:
              if (scope.customRatio.H < 99) {
                scope.customRatio.H++;
              }
              break;
            case scope.side.DOWN:
              if (scope.customRatio.H > 1) {
                scope.customRatio.H--;
              }
              break;
          }
          scope.formElement.CRWColor = "#acacac";
          scope.formElement.CRHColor = "#e0e0e0";
        };

        scope.setCustomRatio = function () {
          scope.frame.W = scope.customRatio.W;
          scope.frame.H = scope.customRatio.H;
          scope.update();
        };

        scope.mouseLeftZone = function () {
          scope.formElement.RPLHBtnX = 10;
          scope.formElement.hideBtnBorderRadius = 20;
          if (!scope.formElement.UI) {
            scope.formElement.UIButton = "Show";
          } else {
            scope.formElement.UIButton = "Hide";
          }
        };

        scope.mouseOnZone = function () {
          scope.formElement.RPLHBtnX = 37;
          scope.formElement.hideBtnBorderRadius = 0;
          scope.formElement.UIButton = "UI";
        };

        scope.hideOrShow = function (val) {
          switch (val) {
            case scope.UI.ALL:
              if (scope.formElement.UI) {
                scope.formElement.RDBottom = -70;
                scope.formElement.RPLpositionX = -380;
                scope.formElement.UI = false;
                scope.formElement.RPLUI = false;
              } else {
                scope.formElement.RDBottom = 0;
                scope.formElement.RPLpositionX = 0;
                scope.formElement.UI = true;
                scope.formElement.RPLUI = true;
              }
              break;

            case scope.UI.RPL:
              if (scope.formElement.RPLUI) {
                scope.formElement.RPLpositionX = -380;
                scope.formElement.RPLUI = false;
              } else {
                scope.formElement.RPLpositionX = 0;
                scope.formElement.RPLUI = true;
              }
              break;
          }
        };

        scope.hoverRenaming = function () {
          scope.$evalAsync(function () {
            if (!scope.renaming) return;
            bngApi.engineLua("setCEFFocus(true)");
          });
        };

        scope.startRenaming = function () {
          scope.$evalAsync(function () {
            bngApi.engineLua("setCEFFocus(true)");
            scope.renaming = true;
            originalFilename = scope.loadedFile;
          });
        };

        scope.listRecordings = function () {
          $state.go("menu.replay");
        };

        scope.cancelRename = function () {
          scope.$evalAsync(function () {
            scope.renaming = false;
            $log.debug("Cancelled rename");
            scope.loadedFile = originalFilename;
          });
        };

        scope.acceptRename = function () {
          scope.$evalAsync(function () {
            $log.debug(`Renaming ${originalFilename} to ${scope.loadedFile}`);
            scope.renaming = false;
            if (scope.loadedFile == originalFilename) return;
            bngApi.engineLua("be:getFileStream():stop()");
            bngApi.engineLua(
              `FS:renameFile("${originalFilename}", "${scope.loadedFile}")`
            );
            bngApi.engineLua(`FS:removeFile("${originalFilename}")`);
            scope.loadFile(scope.loadedFile);
          });
        };

        scope.toggleSpeed = function (val) {
          bngApi.engineLua("core_replay.toggleSpeed(" + val + ")");
        };

        scope.togglePlay = function () {
          bngApi.engineLua("core_replay.togglePlay()");
        };

        scope.toggleRecording = function () {
          bngApi.engineLua("core_replay.toggleRecording(true)");
        };

        scope.cancelRecording = function () {
          bngApi.engineLua("core_replay.cancelRecording()");
        };

        scope.loadFile = function (filename) {
          bngApi.engineLua(`core_replay.loadFile("${filename}")`);
        };

        scope.stop = function () {
          bngApi.engineLua("core_replay.stop()");
        };

        // ----------------------------------------------------------------

        scope.seek = function (val) {
          if (scope.state !== "playing") return;
          lastSeek = Date.now();
          bngApi.engineLua("core_replay.pause(true)");
          bngApi.engineLua(`core_replay.seek(${bngApi.serializeToLua(val)})`);
        };

        let rbtnBorderOff = function () {
          scope.formElement.B1Border = 0;
          scope.formElement.B2Border = 0;
          scope.formElement.B3Border = 0;
          scope.formElement.B4Border = 0;

          scope.formElement.CRWColor = "#acacac";
          scope.formElement.CRHColor = "#acacac";
        };

        let formUpdate = function () {
          if (scope.frame.W == 16 && scope.frame.H == 9) {
            rbtnBorderOff();
            scope.formElement.B1Border = 5;
          } else if (scope.frame.W == 9 && scope.frame.H == 16) {
            rbtnBorderOff();
            scope.formElement.B2Border = 5;
          } else if (scope.frame.W == 21 && scope.frame.H == 9) {
            rbtnBorderOff();
            scope.formElement.B3Border = 5;
          } else if (scope.frame.W == 9 && scope.frame.H == 19.5) {
            rbtnBorderOff();
            scope.formElement.B4Border = 5;
          } else {
            rbtnBorderOff();
          }
        };

        scope.update = function () {
          let res = calcMaxRes(scope.frame.W, scope.frame.H);
          setLineResolution(res.width, res.height);
          formUpdate();

          if (config.debug) {
            console.debug(scope.linePos.vertical);
            console.debug(scope.linePos.horizontal);
            console.debug(scope.linePos.verticalWidth);
            console.debug(scope.formElement.defaultRatio);
          }
        };

        scope.$on("replayStateChanged", function (event, val) {
          scope.$evalAsync(function () {
            if (!scope.renaming) scope.loadedFile = val.loadedFile;
            scope.positionSeconds = val.positionSeconds;
            scope.totalSeconds = val.totalSeconds;
            scope.speed = val.speed;
            scope.paused = val.paused;
            scope.fpsRec = val.fpsRec;
            scope.fpsPlay = val.fpsPlay;
            scope.state = val.state;
            scope.isSeeking = val.jumpOffset != 0;

            let msSinceSeek = Date.now() - lastSeek;
            if (msSinceSeek > 500) {
              scope.positionPercent =
                scope.totalSeconds == 0
                  ? 0
                  : scope.positionSeconds / scope.totalSeconds;
            } else {
              scope.isSeeking = true;
            }
          });
        });
      },
    };
  },
]);

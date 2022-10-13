import { registerSettings } from "./scripts/settings.mjs";
import { setHooks_characterFlags } from "./scripts/_characterFlags.mjs";
import { setHooks_createSheetCheckBox } from "./scripts/_createSheetCheckbox.mjs";
import { setHooks_gainLoseConcentrationTracker } from "./scripts/_gainLoseConcentrationTracker.mjs";
import { promptConcentrationSave, setHooks_promptCreator } from "./scripts/_promptCreator.mjs";
import { setHooks_promptListeners } from "./scripts/_promptListeners.mjs";
import { API } from "./scripts/_publicAPI.mjs";
import { rollConcentrationSave, setHooks_rollConcentrationSave } from "./scripts/_rollConcentrationSave.mjs";
import { setHooks_startConcentration } from "./scripts/_startConcentration.mjs";

Hooks.once("init", () => {
  console.log("ZHELL | Initializing Concentration Notifier");
  registerSettings();

  Actor.prototype.rollConcentrationSave = rollConcentrationSave;
  globalThis.CN = {
    isActorConcentrating: API.isActorConcentrating,
    isActorConcentratingOnItem: API.isActorConcentratingOnItem,
    isEffectConcentration: API.isEffectConcentration,
    breakConcentration: API.breakConcentration,
    waitForConcentrationStart: API.waitForConcentrationStart,
    promptConcentrationSave: promptConcentrationSave,
    redisplayCard: API.redisplayCard
  }

  setHooks_characterFlags();
  setHooks_createSheetCheckBox();
  setHooks_gainLoseConcentrationTracker();
  setHooks_promptCreator();
  setHooks_promptListeners();
  setHooks_rollConcentrationSave();
  setHooks_startConcentration();

});

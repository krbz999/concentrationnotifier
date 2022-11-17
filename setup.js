import { MODULE, registerSettings } from "./scripts/settings.mjs";
import { _characterFlags } from "./scripts/_characterFlags.mjs";
import { _createSheetCheckBox } from "./scripts/_createSheetCheckbox.mjs";
import { _gainConcentration, _loseConcentration } from "./scripts/_gainLoseConcentrationTracker.mjs";
import { promptConcentrationSave, _prePromptCreator, _promptCreator } from "./scripts/_promptCreator.mjs";
import { _clickPrompt } from "./scripts/_promptListeners.mjs";
import { API } from "./scripts/_publicAPI.mjs";
import { _abilityUseDialog, _preAbilityUseDialog } from "./scripts/_renderAbilityUseDialog.mjs";
import { rollConcentrationSave, _preRollConcentrationSave } from "./scripts/_rollConcentrationSave.mjs";
import { _applyButtonListeners, _startConcentration } from "./scripts/_startConcentration.mjs";

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

  if (game.settings.get(MODULE, "show_ability_use_warning")) {
    Hooks.on("dnd5e.preUseItem", _preAbilityUseDialog);
    Hooks.on("renderAbilityUseDialog", _abilityUseDialog);
  }
  if (game.settings.get(MODULE, "create_vae_quickButtons")) {
    Hooks.once("ready", _applyButtonListeners);
  }
});

Hooks.once("setup", _characterFlags);
Hooks.on("renderItemSheet", _createSheetCheckBox);
Hooks.on("createActiveEffect", _gainConcentration);
Hooks.on("deleteActiveEffect", _loseConcentration);
Hooks.on("preUpdateActor", _prePromptCreator);
Hooks.on("updateActor", _promptCreator);
Hooks.on("renderChatLog", _clickPrompt);
Hooks.on("renderChatPopout", _clickPrompt);
Hooks.on("dnd5e.preRollAbilitySave", _preRollConcentrationSave);
Hooks.on("dnd5e.useItem", _startConcentration);

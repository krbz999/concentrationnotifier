import {_characterFlags} from "./scripts/_characterFlags.mjs";
import {_addScrollConcentration, _createSheetCheckBox} from "./scripts/_createSheetCheckbox.mjs";
import {_gainConcentration, _loseConcentration} from "./scripts/_gainLoseConcentrationTracker.mjs";
import {_prePromptCreator, _promptCreator} from "./scripts/_promptCreator.mjs";
import {_clickPrompt} from "./scripts/_promptListeners.mjs";
import {_abilityUseDialog, _preAbilityUseDialog} from "./scripts/_renderAbilityUseDialog.mjs";
import {_startConcentration, _vaeButtons} from "./scripts/_startConcentration.mjs";

Hooks.once("init", () => {
  if (game.settings.get(MODULE, "show_ability_use_warning")) {
    Hooks.on("dnd5e.preUseItem", _preAbilityUseDialog);
    Hooks.on("renderAbilityUseDialog", _abilityUseDialog);
  }
  const vae = game.modules.get("visual-active-effects")?.active;
  if (vae && game.settings.get(MODULE, "create_vae_quickButtons")) {
    Hooks.on("visual-active-effects.createEffectButtons", _vaeButtons);
  }
});
Hooks.on("dnd5e.useItem", _startConcentration);

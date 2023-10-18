import {_startConcentration, _vaeButtons} from "./scripts/_startConcentration.mjs";

Hooks.once("init", () => {
  const vae = game.modules.get("visual-active-effects")?.active;
  if (vae && game.settings.get(MODULE, "create_vae_quickButtons")) {
    Hooks.on("visual-active-effects.createEffectButtons", _vaeButtons);
  }
});
Hooks.on("dnd5e.useItem", _startConcentration);

import { registerSettings } from "./scripts/settings.mjs";
import { promptConcentrationSave } from "./scripts/_promptCreator.mjs";
import { API } from "./scripts/_publicAPI.mjs";
import { rollConcentrationSave } from "./scripts/_rollConcentrationSave.mjs";

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
        promptConcentrationSave: promptConcentrationSave
    }
});

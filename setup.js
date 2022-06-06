import { CONST } from "./scripts/const.mjs";
import { registerSettings } from "./scripts/settings.mjs";
import { api } from "./scripts/api.mjs";

Hooks.once("init", () => {
    console.log(`${CONST.MODULE.SHORT} | Initializing ${CONST.MODULE.TITLE}`);
    registerSettings();
	
	api.register();
});
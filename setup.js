import { MODULE_TITLE, MODULE_TITLE_SHORT } from "./scripts/const.mjs";
import { registerSettings } from "./scripts/settings.mjs";

Hooks.on("init", () => {
    console.log(`${MODULE_TITLE_SHORT} | Initializing ${MODULE_TITLE}`);
    registerSettings();
});
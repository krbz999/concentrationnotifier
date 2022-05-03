import { CONST } from "./const.mjs";

export const SETTING_NAMES = {
	CONCENTRATION_ICON: "concentration_icon"
}

export function registerSettings() {
	_registerSettings();
}

function _registerSettings(){
	game.settings.register(CONST.MODULE.NAME, SETTING_NAMES.CONCENTRATION_ICON, {
		name: "Custom Icon",
		hint: "An image path here will replace the default icon used for the concentration effect.",
		scope: "world",
		config: true,
		type: String,
		default: "icons/magic/light/orb-lightbulb-gray.webp"
	});
}
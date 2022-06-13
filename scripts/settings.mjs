import { CONSTS } from "./const.mjs";

export function registerSettings() {
	_registerSettings();
}

function _registerSettings(){
	
	game.settings.register(CONSTS.MODULE.NAME, CONSTS.SETTINGS.CONCENTRATION_ICON, {
		name: "Custom Icon",
		hint: "An image path here will replace the default icon used for the concentration effect.",
		scope: "world",
		config: true,
		type: String,
		default: "icons/magic/light/orb-lightbulb-gray.webp"
	});
	
	game.settings.register(CONSTS.MODULE.NAME, CONSTS.SETTINGS.CONCENTRATION_ICON_ITEM, {
		name: "Use Item Icon",
		hint: "If checked, the image used for concentration effects will be overridden by the item's image.",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
	
	game.settings.register(CONSTS.MODULE.NAME, CONSTS.SETTINGS.PREPEND_EFFECT_LABELS, {
		name: "Prepend Effect Labels",
		hint: "If checked, concentration effects are prepended with 'Concentration' to distinguish them from other effects.",
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
	
}

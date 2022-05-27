import { CONST } from "./const.mjs";

export const SETTING_NAMES = {
	CONCENTRATION_ICON: "concentration_icon",
	CONCENTRATION_ICON_ITEM: "concentration_icon_item",
	PREPEND_EFFECT_LABELS: "prepend_effect_labels"
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
	
	game.settings.register(CONST.MODULE.NAME, SETTING_NAMES.CONCENTRATION_ICON_ITEM, {
		name: "Use Item Icon",
		hint: "If checked, the image used for concentration effects will be overridden by the item's image.",
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
	
	game.settings.register(CONST.MODULE.NAME, SETTING_NAMES.PREPEND_EFFECT_LABELS, {
		name: "Prepend Effect Labels",
		hint: "If checked, concentration effects are prepended with 'Concentration' to distinguish them from other effects.",
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
}
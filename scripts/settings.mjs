import { CONSTS } from "./const.mjs";

export function registerSettings() {
	_registerSettings();
}

function _registerSettings(){
	
	game.settings.register(CONSTS.MODULE.NAME, CONSTS.SETTINGS.CONCENTRATION_ICON, {
		name: game.i18n.localize("CN.SETTINGS.DEFAULT_ICON.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.DEFAULT_ICON.HINT"),
		scope: "world",
		config: true,
		type: String,
		default: "icons/magic/light/orb-lightbulb-gray.webp"
	});
	
	game.settings.register(CONSTS.MODULE.NAME, CONSTS.SETTINGS.CONCENTRATION_ICON_ITEM, {
		name: game.i18n.localize("CN.SETTINGS.ITEM_ICON.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.ITEM_ICON.HINT"),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});
	
	game.settings.register(CONSTS.MODULE.NAME, CONSTS.SETTINGS.PREPEND_EFFECT_LABELS, {
		name: game.i18n.localize("CN.SETTINGS.PREPEND.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.PREPEND.HINT"),
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
	
}

import { MODULE_NAME } from "./const.mjs";

export const SETTING_NAMES = {
	FORMULA_RECHARGE: "formulaRecharge"
}

export function registerSettings() {
	_registerSettings();
}

function _registerSettings(){
	game.settings.register(MODULE_NAME, SETTING_NAMES.FORMULA_RECHARGE, {
		name: "Add Formula Recharge",
		hint: "Add an additional field for Uses on dusk and dawn and have items recharge using that formula.",
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
}
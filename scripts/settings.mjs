export function registerSettings() {
	// custom icon.
	game.settings.register("concentrationnotifier", "concentration_icon", {
		name: game.i18n.localize("CN.SETTINGS.DEFAULT_ICON.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.DEFAULT_ICON.HINT"),
		scope: "world",
		config: true,
		type: String,
		default: "icons/magic/light/orb-lightbulb-gray.webp"
	});
	
	// whether to use the item's img.
	game.settings.register("concentrationnotifier", "concentration_icon_item", {
		name: game.i18n.localize("CN.SETTINGS.ITEM_ICON.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.ITEM_ICON.HINT"),
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
	
	// whether to prepend effect labels.
	game.settings.register("concentrationnotifier", "prepend_effect_labels", {
		name: game.i18n.localize("CN.SETTINGS.PREPEND.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.PREPEND.HINT"),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	// whether to add fancy stuff to effect descriptions.
	game.settings.register("concentrationnotifier", "verbose_tooltips", {
		name: game.i18n.localize("CN.SETTINGS.VERBOSE.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.VERBOSE.HINT"),
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
}

export const MODULE = "concentrationnotifier";

export function registerSettings() {
	// custom icon.
	game.settings.register(MODULE, "concentration_icon", {
		name: game.i18n.localize("CN.SETTINGS.DEFAULT_ICON.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.DEFAULT_ICON.HINT"),
		scope: "world",
		config: true,
		type: String,
		default: "icons/magic/light/orb-lightbulb-gray.webp"
	});
	
	// whether to use the item's img.
	game.settings.register(MODULE, "concentration_icon_item", {
		name: game.i18n.localize("CN.SETTINGS.ITEM_ICON.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.ITEM_ICON.HINT"),
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
	
	// whether to prepend effect labels.
	game.settings.register(MODULE, "prepend_effect_labels", {
		name: game.i18n.localize("CN.SETTINGS.PREPEND.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.PREPEND.HINT"),
		scope: "world",
		config: true,
		type: Boolean,
		default: false
	});

	// whether to add fancy stuff to effect descriptions.
	game.settings.register(MODULE, "verbose_tooltips", {
		name: game.i18n.localize("CN.SETTINGS.VERBOSE.NAME"),
		hint: game.i18n.localize("CN.SETTINGS.VERBOSE.HINT"),
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});

    // whether to always whisper messages
    game.settings.register(MODULE, "always_whisper_messages", {
        name: game.i18n.localize("CN.SETTINGS.WHISPER.NAME"),
        hint: game.i18n.localize("CN.SETTINGS.WHISPER.HINT"),
        scope: "world",
        config: true,
        type: Boolean,
        default: false
    });
}

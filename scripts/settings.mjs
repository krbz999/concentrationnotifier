export const MODULE = "concentrationnotifier";

export function registerSettings() {
  // custom icon.
  game.settings.register(MODULE, "concentration_icon", {
    name: "CN.SETTINGS.DEFAULT_ICON.NAME",
    hint: "CN.SETTINGS.DEFAULT_ICON.HINT",
    scope: "world",
    config: true,
    type: String,
    default: "icons/magic/light/orb-lightbulb-gray.webp"
  });

  // whether to use the item's img.
  game.settings.register(MODULE, "concentration_icon_item", {
    name: "CN.SETTINGS.ITEM_ICON.NAME",
    hint: "CN.SETTINGS.ITEM_ICON.HINT",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // whether to prepend effect labels.
  game.settings.register(MODULE, "prepend_effect_labels", {
    name: "CN.SETTINGS.PREPEND.NAME",
    hint: "CN.SETTINGS.PREPEND.HINT",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // whether to add fancy stuff to effect descriptions.
  game.settings.register(MODULE, "verbose_tooltips", {
    name: "CN.SETTINGS.VERBOSE.NAME",
    hint: "CN.SETTINGS.VERBOSE.HINT",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // whether to always whisper messages
  game.settings.register(MODULE, "always_whisper_messages", {
    name: "CN.SETTINGS.WHISPER.NAME",
    hint: "CN.SETTINGS.WHISPER.HINT",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // whether to show a warning that you are about to swap conc.
  game.settings.register(MODULE, "show_ability_use_warning", {
    name: "CN.SETTINGS.USE_WARNING.NAME",
    hint: "CN.SETTINGS.USE_WARNING.HINT",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });

  // create quick buttons for Visual Active Effects.
  game.settings.register(MODULE, "create_vae_quickButtons", {
    name: "CN.SETTINGS.VAE_BUTTONS.NAME",
    hint: "CN.SETTINGS.VAE_BUTTONS.HINT",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: true
  });
}

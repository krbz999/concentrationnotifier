export const MODULE = "concentrationnotifier";
export const CONCENTRATION_REASON = {
  NOT_REQUIRED: 0,
  NOT_CONCENTRATING: 1,
  DIFFERENT_ITEM: 2,
  DIFFERENT_LEVEL: 3,
  UPCASTABLE: 4
};

export function registerSettings() {
  // custom icon.
  game.settings.register(MODULE, "concentration_icon", {
    name: "CN.SettingDefaultIconName",
    hint: "CN.SettingDefaultIconHint",
    scope: "world",
    config: true,
    type: String,
    default: "icons/magic/light/orb-lightbulb-gray.webp"
  });

  // whether to use the item's img.
  game.settings.register(MODULE, "concentration_icon_item", {
    name: "CN.SettingUseItemIconName",
    hint: "CN.SettingUseItemIconHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // the default ability used for concentration.
  game.settings.register(MODULE, "defaultConcentrationAbility", {
    name: "CN.SettingDefaultConcentrationAbilityName",
    hint: "CN.SettingDefaultConcentrationAbilityHint",
    scope: "world",
    config: true,
    type: String,
    default: ("con" in CONFIG.DND5E.abilities) ? "con" : Object.keys(CONFIG.DND5E.abilities)[0],
    choices: Object.fromEntries(Object.entries(CONFIG.DND5E.abilities).map(([key, val]) => [key, val.label]))
  });

  // whether to prepend effect labels.
  game.settings.register(MODULE, "prepend_effect_labels", {
    name: "CN.SettingPrependLabelName",
    hint: "CN.SettingPrependLabelHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  // whether to show the started/ended concentration messages.
  game.settings.register(MODULE, "showGainLoseMessages", {
    name: "CN.SettingShowGainLoseConcentrationMessagesName",
    hint: "CN.SettingShowGainLoseConcentrationMessagesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  // whether to always whisper messages
  game.settings.register(MODULE, "always_whisper_messages", {
    name: "CN.SettingWhisperMessagesName",
    hint: "CN.SettingWhisperMessagesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // whether to show the end conc/delete templates buttons on start/end conc messages.
  game.settings.register(MODULE, "show_util_buttons", {
    name: "CN.SettingShowUtilButtonsName",
    hint: "CN.SettingShowUtilButtonsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  // whether to show a warning that you are about to swap conc.
  game.settings.register(MODULE, "show_ability_use_warning", {
    name: "CN.SettingAbilityUseWarningName",
    hint: "CN.SettingAbilityUseWarningHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  // create quick buttons for Visual Active Effects.
  game.settings.register(MODULE, "create_vae_quickButtons", {
    name: "CN.SettingVisualActiveEffectsButtonsName",
    hint: "CN.SettingVisualActiveEffectsButtonsHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: true
  });

  // Split item names at ":" for concentration effects.
  game.settings.register(MODULE, "splitItemNames", {
    name: "CN.SettingSplitItemNames",
    hint: "CN.SettingSplitItemNamesHint",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

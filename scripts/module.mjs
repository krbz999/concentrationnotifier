class Module {
  static ID = "concentrationnotifier";
  static STATUS = "concentrating";
  static get ICON() {
    return CONFIG.DND5E.statusEffects?.concentrating?.icon ?? "icons/magic/light/orb-lightbulb-gray.webp";
  }
  static REASON = {NOT_REQUIRED: 0, NOT_CONCENTRATING: 1, DIFFERENT_ITEM: 2, DIFFERENT_LEVEL: 3, UPCASTABLE: 4};
  static EFFECT_ID = "dnd5econcentrati";

  /**
   * An array to keep track of functions used to filter out whether an item should
   * be considered for regular concentration. If any of these functions explicitly
   * return `false`, an item will not require concentration by normal means.
   */
  static ITEM_FILTERS = [];

  /* ---------------------------- */
  /*                              */
  /*         MODULE SETUP         */
  /*                              */
  /* ---------------------------- */

  /** Initialize module. */
  static init() {
    this._characterFlags();
    this._registerSettings();
    Hooks.on("renderChatMessage", this._renderChatMessage.bind(this));
    Hooks.on("createActiveEffect", this._createActiveEffect.bind(this));
    Hooks.on("deleteActiveEffect", this._deleteActiveEffect.bind(this));
    Hooks.on("preUpdateActor", this._preUpdateActor.bind(this));
    Hooks.on("updateActor", this._updateActor.bind(this));
    Hooks.on("dnd5e.preUseItem", this._preUseItem.bind(this));
    Hooks.on("renderAbilityUseDialog", this._renderAbilityUseDialog.bind(this));
    Hooks.on("visual-active-effects.createEffectButtons", this._VAEcreateEffectButtons.bind(this));
    Hooks.on("dnd5e.useItem", this._useItem.bind(this));
    globalThis.CN = this;
    Actor.implementation.prototype.rollConcentrationSave = this._rollConcentrationSave;
  }

  /**
   * Create buttons for Visual Active Effects, with support for 'Roll Groups' and 'Effective Transferral'.
   * @param {ActiveEffect5e} effect     The effect being displayed in VAE.
   * @param {object[]} buttons          The current array of buttons, each with 'label' and 'callback'.
   */
  static _VAEcreateEffectButtons(effect, buttons) {
    const isConc = this.isEffectConcentration(effect);
    if (!isConc) return;
    const data = effect.flags[this.ID]?.data;
    const isItem = !!data;

    if (isItem) {
      const item = fromUuidSync(data.castData?.itemUuid);

      let clone;
      if (item) clone = item.clone(data.itemData, {keepId: true});
      else clone = new Item.implementation(data.itemData, {parent: effect.parent});

      clone.prepareData();
      clone.prepareFinalAttributes();

      /* Create attack roll button. */
      if (clone.hasAttack) {
        buttons.push({
          label: game.i18n.localize("DND5E.Attack"),
          callback: (event) => clone.rollAttack({event, spellLevel: data.castData.castLevel})
        });
      }

      /* Create damage roll buttons, with 'Roll Groups' support. */
      const rollGroups = game.modules.get("rollgroups")?.active;
      const groups = clone.flags.rollgroups?.config?.groups ?? [];
      const parts = clone.system.damage.parts.filter(([f]) => f);
      if (rollGroups && groups.length && (parts.length > 1)) {
        for (let i = 0; i < groups.length; i++) {
          const types = groups[i].parts.map(t => parts[t][1]);
          const label = types.every(t => t in CONFIG.DND5E.damageTypes) ? "Damage" : types.every(t => t in CONFIG.DND5E.damageTypes) ? "Healing" : "Mixed";
          buttons.push({
            label: `${game.i18n.localize(`ROLLGROUPS.${label}`)} (${groups[i].label})`,
            callback: (event) => clone.rollDamageGroup({event, rollgroup: i, spellLevel: data.castData.castLevel})
          });
        }
      } else if (clone.isHealing) {
        buttons.push({
          label: game.i18n.localize("DND5E.Healing"),
          callback: (event) => clone.rollDamage({event, spellLevel: data.castData.castLevel})
        })
      } else if (clone.hasDamage) {
        buttons.push({
          label: game.i18n.localize("DND5E.Damage"),
          callback: (event) => clone.rollDamage({event, spellLevel: data.castData.castLevel})
        })
      }

      /* Create button to create a measured template. */
      if (clone.hasAreaTarget) {
        buttons.push({
          label: game.i18n.localize("DND5E.PlaceTemplate"),
          callback: (event) => dnd5e.canvas.AbilityTemplate.fromItem(clone).drawPreview()
        });
      }

      /* Create button to display the item being concentrated on in chat. */
      buttons.push({
        label: game.i18n.localize("CN.DisplayItem"),
        callback: (event) => this.redisplayCard(effect.parent)
      });

      /* Create button for 'Effective Transferral' support. */
      if (game.modules.get("effective-transferral")?.active) {
        const effects = clone.effects.filter(e => {
          const _et = e.transfer === false;
          const _st = game.settings.get("effective-transferral", "includeEquipTransfer");
          const _eb = e.flags["effective-transferral"]?.transferBlock?.button;
          const _nb = game.settings.get("effective-transferral", "neverButtonTransfer");
          return (_et || _st) && (!_eb && !_nb);
        });
        if (effects.length) {
          buttons.push({
            label: game.i18n.localize("ET.Button.Label"),
            callback: (event) => ET.effectTransferTrigger(clone, "button", data.castData.castLevel)
          });
        }
      }
    }

    /* Create button for rolling concentration saving throw. */
    buttons.push({
      label: game.i18n.localize("DND5E.Concentration"),
      callback: (event) => effect.parent.rollConcentrationSave(null, {event})
    });
  }

  /**
   * Start the concentration when using an item if the actor is not concentrating at all, if they
   * are concentrating on a different item, or if it is the same item but cast at a different level.
   * @param {Item5e} item                         The item being used. If a spell, this is the upscaled version.
   * @returns {Promise<ActiveEffect5e|null>}      The active effect created on the actor, if any.
   */
  static async _useItem(item) {
    if (!item.isEmbedded) return null;
    if (item.actor.flags.dnd5e?.concentrationUnfocused) return null;

    const goodReason = [
      this.REASON.NOT_CONCENTRATING,
      this.REASON.DIFFERENT_ITEM,
      this.REASON.DIFFERENT_LEVEL
    ].includes(this._itemUseAffectsConcentration(item));
    if (!goodReason) return null;

    // Break the current concentration, but do not display a message.
    await this.breakConcentration(item.actor, {message: false});

    // Create the effect data and start concentrating on the new item.
    const effectData = await this._createEffectData(item);

    let keepId = false;
    if (!item.actor.effects.has(this.EFFECT_ID)) {
      keepId = true;
      effectData._id = this.EFFECT_ID;
    }
    return ActiveEffect.create(effectData, {parent: item.actor, keepId});
  }

  /**
   * Create the data for a new concentration effect.
   * @param {Item5e} item           The item on which to start concentrating.
   * @returns {Promise<object>}     An object of data for an active effect.
   */
  static async _createEffectData(item) {
    const baseItem = await fromUuid(item.uuid);
    const itemData = game.items.fromCompendium(item, {addFlags: false});
    const castData = {itemUuid: item.uuid};
    if (item.type === "spell") {
      itemData.system.level = baseItem?.system.level;
      castData.baseLevel = baseItem?.system.level;
      castData.castLevel = item.system.level;
    }
    const shortened = this._getShortName(item);
    const prepend = game.settings.get(this.ID, "prepend_effect_labels");
    return {
      icon: await this._getModuleImage(item),
      name: !prepend ? shortened : `${game.i18n.localize("DND5E.Concentration")} - ${shortened}`,
      origin: item.uuid,
      duration: this.getItemDuration(item),
      statuses: [this.STATUS],
      description: game.i18n.format("CN.YouAreConcentratingOnItem", {name: shortened}),
      flags: {
        [this.ID]: {data: {itemData, castData}},
        "visual-active-effects": {data: {content: item.system.description.value}}
      }
    };
  }

  /**
   * Helper function to generate the concentration effect's name.
   * @param {Item5e} item     The item for which to make an effect.
   * @returns {string}        The name for the effect.
   */
  static _getShortName(item) {
    const split = game.settings.get(this.ID, "splitItemNames") && item.name.includes(":");
    if (!split) return item.name;
    const parts = item.name.split(":");
    parts.shift();
    const name = parts.join(":").trim();
    return name ? name : item.name;
  }

  /**
   * Helper function to set the icon of the concentration effect.
   * @param {Item5e} item           The item being concentrated on.
   * @returns {Promise<string>}     The asset path used for the effect icon.
   */
  static async _getModuleImage(item) {
    // Case 1: The item has an image, and it is prioritised.
    const hasItemImage = await srcExists(item.img);
    if (hasItemImage && game.settings.get(this.ID, "concentration_icon_item")) return item.img;

    // Case 2: Use the image in the settings, if it exists.
    const moduleImage = game.settings.get(this.ID, "concentration_icon")?.trim();
    const exists = await srcExists(moduleImage);
    return exists ? moduleImage : this.ICON;
  }

  /**
   * Helper function to get the duration of the concentration effect to match its item.
   * @param {Item5e} item     The item being concentrated on.
   * @returns {object}        The duration object for an ActiveEffect.
   */
  static getItemDuration(item) {
    if (!item.system.activation?.type) return {};
    const duration = item.system.duration || {};
    if (!(duration.units in CONFIG.DND5E.scalarTimePeriods)) return {};
    let {value, units} = duration;
    if (units === "round") return {rounds: value};
    if (units === "turn") return {turns: value};
    value *= 60;
    if (units === "minute") return {seconds: value};
    value *= 60;
    if (units === "hour") return {seconds: value};
    value *= 24;
    if (units === "day") return {seconds: value};
    value *= 30;
    if (units === "month") return {seconds: value};
    value *= 12;
    if (units === "year") return {seconds: value};
    return {};
  }

  /**
   * When using an item that requires concentration, force the AbilityUseDialog to display
   * a warning about loss of concentration if the item being used is an entirely different
   * item than the one being concentrated on, if it's the same item but at a different level,
   * or if it's the same item but it can be upcast naturally, or to warn about not being
   * able to concentrate due to being 'unfocused'.
   * @param {Item5e} item       The item about to be used.
   * @param {object} config     The item usage configuration.
   */
  static _preUseItem(item, config) {
    if (!game.settings.get(this.ID, "show_ability_use_warning")) return;
    const force = [
      this.REASON.DIFFERENT_ITEM,
      this.REASON.DIFFERENT_LEVEL,
      this.REASON.UPCASTABLE
    ].includes(this._itemUseAffectsConcentration(item));
    const unfocused = item.requiresConcentration && item.actor.flags.dnd5e?.concentrationUnfocused;
    if (force || unfocused) config.concentration = true;
  }

  /**
   * If a reason was found to warn about the potential loss (or lack) of concentration
   * as a result of using this item (potentially at only a different level), inject the
   * warning into the AbilityUseDialog
   * @param {AbilityUseDialog} dialog     The dialog application instance.
   * @param {HTMLElement} html            The html of the dialog.
   */
  static _renderAbilityUseDialog(dialog, [html]) {
    if (!game.settings.get(this.ID, "show_ability_use_warning")) return;
    const reason = this._itemUseAffectsConcentration(dialog.item);
    if (reason === this.REASON.NOT_REQUIRED) return;
    const unfocused = dialog.item.actor.flags.dnd5e?.concentrationUnfocused;
    if ((reason === this.REASON.NOT_CONCENTRATING) && !unfocused) return;

    // Construct warning.
    const effect = this.isActorConcentrating(dialog.item.actor);
    const locale = this._getAbilityUseWarning(reason, dialog.item, effect ? effect : null);
    const div = document.createElement("DIV");
    div.innerHTML = `<p class="notification concentrationnotifier">${locale}</p>`;
    html.querySelector(".notes").after(div.firstElementChild);
    dialog.setPosition({height: "auto"});
  }

  /**
   * Helper method for localization string in the AbilityUseDialog warning, depending
   * on the reason that the new item may end concentration.
   * @param {number} reason               An integer from 'REASON'.
   * @param {Item5e} item                 The item triggering the AbilityUseDialog.
   * @param {ActiveEffect5e} [effect]     The actor's current concentration effect.
   * @returns {string}                    The warning message to display.
   */
  static _getAbilityUseWarning(reason, item, effect = null) {
    let string = "";
    if (item.actor.flags.dnd5e?.concentrationUnfocused) {
      string = `CN.AbilityDialogWarningUnfocused${(item.type === "spell") ? "Spell" : "Item"}`;
    } else if (reason === this.REASON.DIFFERENT_ITEM) {
      // This will end concentration on a different item.
      string = `CN.AbilityDialogWarning${(item.type === "spell") ? "Spell" : "Item"}`;
      if (!effect?.flags[this.ID]?.data?.itemData?.name) string += "NoItem";
    } else if ([this.REASON.DIFFERENT_LEVEL, this.REASON.UPCASTABLE].includes(reason)) {
      // This will end concentration on the same item, unless cast at the same level.
      string = "CN.AbilityDialogWarningSpellLevel";
    }
    return game.i18n.format(string, {
      item: effect?.flags[this.ID]?.data?.itemData?.name,
      level: effect?.flags[this.ID]?.data?.castData?.castLevel?.ordinalString()
    });
  }

  /**
   * New actor prototype method for rolling concentration saving throws.
   * @param {string} [ability]        A key from `CONFIG.DND5E.abilities`.
   * @param {object} [options={}]     Options that modify the roll.
   * @returns {Promise<D20Roll>}
   */
  static async _rollConcentrationSave(ability = null, options = {}) {
    if (!this.isOwner) return;
    const dnd = this.flags.dnd5e || {};
    ability ??= dnd.concentrationAbility ?? game.settings.get(Module.ID, "defaultConcentrationAbility");
    const config = {isConcSave: true, targetValue: 10, parts: []};

    // Apply reliable talent.
    if (dnd.concentrationReliable) config.reliableTalent = true;

    // Apply advantage.
    const {advantageMode} = CONFIG.Dice.D20Roll.determineAdvantageMode({event: options.event});
    if (dnd.concentrationAdvantage && (advantageMode !== CONFIG.Dice.D20Roll.ADV_MODE.DISADVANTAGE)) {
      config.advantage = true;
    }

    foundry.utils.mergeObject(config, options);

    const bonus = dnd.concentrationBonus && Roll.validate(`${dnd.concentrationBonus}`);
    if (bonus) config.parts.push(`${dnd.concentrationBonus}`);

    // Hook event for users to modify the saving throw before it is passed to the regular roll.
    if (Hooks.call(`${Module.ID}.preRollConcentrationSave`, this, config, ability) === false) return;

    const roll = await this.rollAbilitySave(ability, config);

    // Hook event that fires after the concentration save has been completed.
    if (roll) Hooks.callAll(`${Module.ID}.rollConcentrationSave`, this, roll, ability);

    return roll;
  }

  /**
   * When an actor is updated, store the changes to hit points for reference later.
   * @param {Actor5e} actor       The actor to be updated.
   * @param {object} update       The update to be performed.
   * @param {object} options      The update options.
   * @param {string} userId       The id of the user performing the update.
   */
  static _preUpdateActor(actor, update, options, userId) {
    if (options.isRest || options.isAdvancement) return;
    const healthA = actor.system.attributes?.hp || {};
    const healthB = update.system?.attributes?.hp || {};
    const totalA = (healthA.temp ?? 0) + (healthA.value ?? 0);
    const totalB = (healthB.temp ?? healthA.temp ?? 0) + (healthB.value ?? healthA.value ?? 0);
    const damage = totalA - totalB;

    const hook = (damage > 0) ? "preDamageActor" : (damage < 0) ? "preHealActor" : null;
    options[this.ID] = {save: damage > 0, damage: damage};

    // If damage taken or healing performed, call a hook. Explicitly return false to prevent the update.
    if (hook && (Hooks.call(`${this.ID}.${hook}`, actor, update, options, userId) === false)) return false;
  }

  /**
   * When an actor is updated, create a prompt for concentration saving throws if they were damaged.
   * @param {Actor5e} actor               The actor that was updated.
   * @param {object} update               The update that was performed.
   * @param {object} options              The update options.
   * @param {string} userId               The id of the user performing the update.
   * @returns {Promise<ChatMessage>}      The created chat message.
   */
  static async _updateActor(actor, update, options, userId) {
    if (game.user.id !== userId) return;
    const {save, damage} = options[this.ID] || {};
    if (!save) return;
    const effect = this.isActorConcentrating(actor);
    if (!effect) return;
    if (effect.flags[this.ID]?.data.castData.unbreakable) return;

    const data = this._getData(actor, effect, options);
    const messageData = {
      content: await renderTemplate(`modules/${this.ID}/templates/concentration-notify.hbs`, data),
      whisper: game.users.filter(u => actor.testUserPermission(u, "OWNER")).map(u => u.id),
      speaker: ChatMessage.implementation.getSpeaker({
        actor: actor,
        alias: game.i18n.localize("CN.ModuleTitle")
      }),
      flags: {core: {canPopout: true}, [this.ID]: {prompt: true, damage: damage}}
    };
    const hook = (damage > 0) ? "damageActor" : (damage < 0) ? "healActor" : null;
    if (hook) Hooks.callAll(`${this.ID}.${hook}`, actor, update, options, userId);
    return ChatMessage.implementation.create(messageData);
  }

  /**
   * Add character flags for concentration-related attributes.
   */
  static _characterFlags() {
    const abils = Object.entries(CONFIG.DND5E.abilities).map(v => {
      return [v[0], v[1].label];
    });
    const data = {
      /* Add bonus on top of the saving throw. */
      concentrationBonus: {type: String},
      /* Change the ability being used for the saving throw. */
      concentrationAbility: {type: String, choices: Object.fromEntries([['', null], ...abils])},
      /* Set a flag for having advantage on Concentration saves. */
      concentrationAdvantage: {type: Boolean},
      /* Set a flag for not being able to roll below 10. */
      concentrationReliable: {type: Boolean},
      /* Set a flag for not being able to concentrate on any items. */
      concentrationUnfocused: {type: Boolean}
    };
    Object.entries(data).forEach(([key, values]) => {
      CONFIG.DND5E.characterFlags[key] = {
        name: `CN.Flag${key.capitalize()}`,
        hint: `CN.Flag${key.capitalize()}Hint`,
        section: "DND5E.Concentration",
        ...values
      };
    });
  }

  /**
   * Register settings.
   */
  static _registerSettings() {
    [
      {key: "concentration_icon", name: "DefaultIcon", type: String, default: "icons/magic/light/orb-lightbulb-gray.webp"},
      {key: "concentration_icon_item", name: "UseItemIcon", type: Boolean, default: true},
      {
        key: "defaultConcentrationAbility", name: "DefaultConcentrationAbility", type: String,
        default: ("con" in CONFIG.DND5E.abilities) ? "con" : Object.keys(CONFIG.DND5E.abilities)[0],
        choices: Object.fromEntries(Object.entries(CONFIG.DND5E.abilities).map(([key, val]) => [key, val.label]))
      },
      {key: "prepend_effect_labels", name: "PrependLabel", type: Boolean, default: false},
      {key: "showGainLoseMessages", name: "ShowGainLoseConcentrationMessages", type: Boolean, default: true, requiresReload: true},
      {key: "always_whisper_messages", name: "WhisperMessages", type: Boolean, default: true},
      {key: "show_util_buttons", name: "ShowUtilButtons", type: Boolean, default: true},
      {key: "show_ability_use_warning", name: "AbilityUseWarning", type: Boolean, default: true, requiresReload: true},
      {key: "splitItemNames", name: "SplitItemNames", type: Boolean, default: true}
    ].forEach(d => {
      game.settings.register(this.ID, d.key, {
        name: `CN.Setting${d.name}`,
        hint: `CN.Setting${d.name}Hint`,
        scope: d.scope ?? "world",
        config: d.config ?? true,
        type: d.type,
        default: d.default ?? undefined,
        choices: d.choices ?? undefined,
        requiresReload: d.requiresReload ?? false
      });
    });
  }

  /**
   * Create a message in chat when an actor begins concentration on an item.
   * @param {ActiveEffect5e} effect     The effect that was created.
   * @param {object} options            The creation options.
   * @param {string} userId             The id of the user who created the effect.
   * @returns {Promise<ChatMessage>}
   */
  static async _createActiveEffect(effect, options, userId) {
    if (!game.settings.get(this.ID, "showGainLoseMessages")) return;
    return this._notifyConcentration(effect, options, userId, 1);
  }

  /**
   * Create a message in chat when an actor ends concentration on an item.
   * @param {ActiveEffect5e} effect     The effect that was deleted.
   * @param {object} options            The deletion options.
   * @param {string} userId             The id of the user who deleted the effect.
   * @returns {Promise<ChatMessage>}
   */
  static async _deleteActiveEffect(effect, options, userId) {
    if (!game.settings.get(this.ID, "showGainLoseMessages")) return;
    return this._notifyConcentration(effect, options, userId, 0);
  }

  /**
   * Create and send a message when an actor gains or loses concentration.
   * @param {ActiveEffect5e} effect     An active effect that is created or deleted on an actor.
   * @param {object} options            An object of creation or deletion options.
   * @param {string} userId             The id of the user that created or deleted the effect.
   * @param {number} type               Whether the effect is created (1) or deleted (0).
   * @returns {Promise<ChatMessage>}
   */
  static async _notifyConcentration(effect, options, userId, type) {
    if (game.user.id !== userId) return;
    if (options.concMessage === false) return;
    if (!this.isEffectConcentration(effect)) return;
    if (!(effect.parent instanceof CONFIG.Actor.documentClass)) return;

    const templateData = this._getData(effect.parent, effect, options, type);
    const template = `modules/${this.ID}/templates/concentration-notify.hbs`;
    const isPublic = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
    const alwaysWhisper = game.settings.get(this.ID, "always_whisper_messages");
    let whisper;
    if (isPublic && !alwaysWhisper) whisper = [];
    else whisper = game.users.filter(u => effect.parent.testUserPermission(u, "OWNER")).map(u => u.id);
    const messageData = {
      content: await renderTemplate(template, templateData),
      whisper: whisper,
      flags: {core: {canPopout: true}},
      speaker: ChatMessage.implementation.getSpeaker({
        actor: effect.parent,
        alias: game.i18n.localize("CN.ModuleTitle")
      })
    };
    return ChatMessage.implementation.create(messageData);
  }

  /**
   * Create the handlebars template data for prompts and notifications.
   * @param {Actor5e} actor             The actor being damaged, or the owner of the effect.
   * @param {ActiveEffect5e} effect     The concentration effect created or deleted or concentrated on.
   * @param {object} options            The actor update options, or the effect creation or deletion options.
   * @param {number|null} [type]        A number (1 or 0) for effects being created/deleted, otherwise undefined.
   */
  static _getData(actor, effect, options, type = null) {
    const data = effect.flags[this.ID]?.data ?? {};
    const detailsTemplate = `CN.NotifyConcentration${{0: "Ended", 1: "Begun"}[type] ?? "Challenge"}`;
    const damage = options[this.ID]?.damage ?? 10;
    const dc = Math.max(10, Math.floor(Math.abs(damage) / 2));
    const ability = this._getAbility(actor);
    const saveType = CONFIG.DND5E.abilities[ability].label;
    const origin = data.castData?.itemUuid;
    const detailsData = {
      itemName: data.itemData?.name,
      actorName: actor.name,
      dc: dc,
      damage: damage,
      saveType: saveType,
      itemUuid: origin
    };
    const details = game.i18n.format(detailsTemplate + (!origin ? "NoItem" : ""), detailsData);

    return {
      actor: actor,
      effect: effect,
      item: data.itemData,
      details: details,
      ability: ability,
      hasTemplates: !!canvas?.scene.templates.find(t => t.flags?.dnd5e?.origin === origin),
      origin: origin,
      dc: dc,
      saveType: saveType,
      showUtilButtons: game.settings.get(this.ID, "show_util_buttons"),
      showEnd: type === 1,
      isPrompt: type === null
    };
  }

  /**
   * Determine saving throw ability used by this actor.
   * @param {Actor5e} actor     An actor making a concentration saving throw.
   * @returns {string}          A key in `CONFIG.DND5E.abilities`.
   */
  static _getAbility(actor) {
    const config = CONFIG.DND5E.abilities;
    const flag = actor.flags.dnd5e?.concentrationAbility;
    if (flag in config) return flag;
    const sett = game.settings.get(this.ID, "defaultConcentrationAbility");
    if (sett in config) return sett;
    return "con";
  }

  /* ---------------------------- */
  /*                              */
  /*          API METHODS         */
  /*                              */
  /* ---------------------------- */

  /**
   * Redisplay the chat card of the item being concentrated on. If the item is a spell, display it at the correct level.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor that is concentrating.
   * @returns {Promise<ChatMessage>}
   */
  static async redisplayCard(caster) {
    const actor = this._getActor(caster);
    if (!actor) return null;
    const isConc = this.isActorConcentrating(actor);
    if (!isConc) {
      ui.notifications.warn(game.i18n.format("CN.WarningActorNotConcentrating", {name: actor.name}));
      return null;
    }

    const data = isConc.flags[this.ID].data;
    const item = await fromUuid(data.castData.itemUuid);
    let clone;
    if (item) clone = item.clone(data.itemData, {keepId: true});
    else clone = new Item.implementation(data.itemData, {parent: actor});
    if (clone.type === "spell") clone.updateSource({"system.level": data.castData.castLevel});

    if (!clone) {
      ui.notifications.warn("CN.ItemNotFound", {localize: true});
      return null;
    }

    clone.prepareData();
    clone.prepareFinalAttributes();
    return clone.displayCard({});
  }

  /**
   * Wait for concentration to be applied on an actor, optionally on a specific item.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor to wait for.
   * @param {Item5e} [item]                               The optional specific item.
   * @param {number} [max_wait=10000]                     The maximum time to wait.
   * @returns {Promise<ActiveEffect5e|boolean>}           The effect, if concentrating, otherwise false.
   */
  static async waitForConcentrationStart(caster, {item, max_wait = 10000} = {}) {
    const actor = this._getActor(caster);
    if (!actor) return false;

    let conc;
    let waited = 0;
    do {
      conc = (item ? this.isActorConcentratingOnItem : this.isActorConcentrating).call(this, actor, item);
      if (conc) return conc;
      await new Promise(r => setTimeout(r, 100));
      waited += 100;
    } while (!conc && (waited < max_wait));
    return conc ?? false;
  }

  /**
   * End all concentration effects on an actor.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor to end concentration.
   * @param {boolean} [message=true]                      Whether to display a message.
   * @returns {Promise<ActiveEffect5e[]>}                 The array of deleted effects.
   */
  static async breakConcentration(caster, {message = true} = {}) {
    const actor = this._getActor(caster);
    if (!actor) return [];
    const ids = actor.appliedEffects.reduce((acc, e) => {
      if (this.isEffectConcentration(e)) acc.push(e.id);
      return acc;
    }, []);
    return actor.deleteEmbeddedDocuments("ActiveEffect", ids, {concMessage: message});
  }

  /**
   * Is this effect a concentration effect?
   * @param {ActiveEffect5e} effect
   * @returns {boolean}
   */
  static isEffectConcentration(effect) {
    return effect.statuses.has(this.STATUS);
  }

  /**
   * Does this item require concentration?
   * @param {Item5e} item
   * @returns {boolean}
   */
  static itemRequiresConcentration(item) {
    const exclude = this.ITEM_FILTERS.some(f => f(item));
    if (exclude) return false;
    return item.requiresConcentration;
  }

  /**
   * Determine whether an actor is concentrating.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor to test.
   * @returns {ActiveEffect5e|boolean}                    The effect, if concentrating, otherwise false.
   */
  static isActorConcentrating(caster) {
    const actor = this._getActor(caster);
    if (!actor) return false;
    return actor.appliedEffects.find(e => e.statuses.has(this.STATUS)) ?? false;
  }

  /**
   * Determine whether an actor is concentrating on a specific item.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor to test.
   * @param {Item5e} item                                 The item to test concentration upon.
   * @returns {ActiveEffect5e|boolean}                    The effect, if concentrating, otherwise false.
   */
  static isActorConcentratingOnItem(caster, item) {
    const actor = this._getActor(caster);
    if (!actor) return false;
    return actor.appliedEffects.find(e => item.uuid === e.flags[this.ID]?.data?.castData?.itemUuid) ?? false;
  }

  /**
   * Return an actor, or false, from a given token, token document, or actor.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor.
   * @returns {Actor5e|boolean}
   */
  static _getActor(caster) {
    const classes = [CONFIG.Token.documentClass, CONFIG.Token.objectClass];
    const actor = classes.some(cls => caster instanceof cls) ? caster.actor : caster;
    return (actor instanceof CONFIG.Actor.documentClass) ? actor : false;
  }

  /**
   * Returns whether and why an item being used should affect current concentration. Used to determine
   * if concentration should be changed, and for the AbilityUseDialog to determine if it should display
   * a warning. If no specific reason for one or the other is found, the function returns false.
   * @param {Item5e} item           The item being used.
   * @returns {number|boolean}      An integer from 'REASON', or false.
   */
  static _itemUseAffectsConcentration(item) {
    const {level, preparation} = item.system;

    // Case 0: Does this item even require concentration? (Do Nothing)
    const requires = this.itemRequiresConcentration(item);
    if (!requires) return this.REASON.NOT_REQUIRED;

    /* The concentration effect already on the actor, if any. */
    const effect = this.isActorConcentrating(item.actor);

    // Case 1: Are you concentrating on something else?
    if (!effect) return this.REASON.NOT_CONCENTRATING;
    const cast = effect.flags[this.ID]?.data.castData ?? {};

    // Case 2: Are you concentrating on an entirely different item?
    if (cast.itemUuid !== item.uuid) return this.REASON.DIFFERENT_ITEM;

    // Case 3: Are you concentrating on the same item at a different spell level?
    if (cast.castLevel !== item.system.level) return this.REASON.DIFFERENT_LEVEL;

    // Case 4: You are concentrating on the same item, at the same level, but it can be upcast.
    if ((level > 0) && CONFIG.DND5E.spellUpcastModes.includes(preparation.mode)) return this.REASON.UPCASTABLE;

    // None of the above are true, so the usage is 'free' far as concentration is concerned.
    return this.REASON.NOT_REQUIRED;
  }

  /* ---------------------------- */
  /*                              */
  /*        CHATLOG METHODS       */
  /*                              */
  /* ---------------------------- */

  /**
   * Append chat log listeners to rendered chat messages.
   * @param {ChatMessage} message     The rendered chat message.
   * @param {HTMLElement} html        The element of the chat message.
   */
  static _renderChatMessage(message, [html]) {
    html.querySelectorAll(".concentrationnotifier [data-prompt]").forEach(n => {
      const owner = fromUuidSync(n.closest(`.${this.ID}`).dataset.uuid).isOwner;
      if (!owner) n.remove();
      else n.addEventListener("click", this._onChatCardAction.bind(this));
    });
  }

  /**
   * Handle disabling and enabling a chat card button.
   * @param {PointerEvent} event      The initiating click event.
   */
  static async _onChatCardAction(event) {
    const button = event.currentTarget;
    button.disabled = true;
    const action = button.dataset.prompt;
    if (action === "save") await this._onClickSave(event);
    else if (action === "end") await this._onClickEnd(event);
    else if (action === "templates") await this._onClickTemplates(event);
    button.disabled = false;
  }

  /**
   * Perform a saving throw to maintain concentration on the spell.
   * @param {PointerEvent} event      The initiating click event.
   * @returns {Promise<D20Roll>}      The rolled save.
   */
  static async _onClickSave(event) {
    const data = event.currentTarget.dataset;
    const actor = await fromUuid(data.uuid);
    return actor.rollConcentrationSave(data.ability, {targetValue: parseInt(data.dc), event});
  }

  /**
   * Prompt or immediately end the concentration.
   * @param {PointerEvent} event                The initiating click event.
   * @returns {Promise<ActiveEffect|null>}      The deleted effect.
   */
  static async _onClickEnd(event) {
    const uuid = event.currentTarget.dataset.uuid;
    const effect = await fromUuid(uuid);
    if (!effect) return null;
    if (event.shiftKey) return effect.delete();
    const name = effect.flags[this.ID]?.data.itemData.name ?? null;
    if (!name) return effect.deleteDialog();
    return Dialog.wait({
      title: game.i18n.format("CN.ConfirmEndConcentrationTitle", {name}),
      content: game.i18n.format("CN.ConfirmEndConcentrationText", {name}),
      buttons: {
        yes: {
          icon: "<i class='fa-solid fa-check'></i>",
          label: game.i18n.localize("Yes"),
          callback: effect.delete.bind(effect)
        },
        no: {
          icon: "<i class='fa-solid fa-times'></i>",
          label: game.i18n.localize("No")
        }
      },
      close: () => null
    }, {id: `${this.ID}-delete-${effect.id}`});
  }

  /**
   * Delete all related templates on the scene that you have permission to delete.
   * @param {PointerEvent} event                        The initiating click event.
   * @returns {Promise<MeasuredTemplateDocument[]>}     The deleted templates.
   */
  static async _onClickTemplates(event) {
    if (!canvas?.ready) return;
    const origin = event.currentTarget.dataset.origin;
    const ids = canvas.scene.templates.reduce((acc, t) => {
      if (t.isOwner && (t.flags.dnd5e?.origin === origin)) acc.push(t.id);
      return acc;
    }, []);
    return canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
  }

  /**
   * Factory method to extend the module for other concentration groupings.
   * @param {string} status         The sluggified string to use for statuses instead of 'concentration'.
   * @param {function} require      A function that is run to determine requiring this type of concentration.
   * @returns {Module|null}         A subclass of this module.
   */
  static extendModule(status, require) {
    if (!status || foundry.utils.getType(status) !== "string" || ["concentration", "concentrating"].includes(status)) {
      console.error(`${this.ID} | The provided new status '${status}' is not valid.`);
      return null;
    }

    if (!require || !(require instanceof Function)) {
      console.error(`${this.ID} | The provided function to determine requiring concentration is not valid.`);
      return null;
    }

    // Factory function.
    const build = () => class extends Module {
      /** @override */
      static STATUS = status;

      /** @override */
      static init() {
        Hooks.on("createActiveEffect", this._createActiveEffect.bind(this));
        Hooks.on("deleteActiveEffect", this._deleteActiveEffect.bind(this));
        Hooks.on("updateActor", this._updateActor.bind(this));
        Hooks.on("dnd5e.preUseItem", this._preUseItem.bind(this));
        Hooks.on("renderAbilityUseDialog", this._renderAbilityUseDialog.bind(this));
        Hooks.on("visual-active-effects.createEffectButtons", this._VAEcreateEffectButtons.bind(this));
        Hooks.on("dnd5e.useItem", this._useItem.bind(this));
      }

      /** @override */
      static itemRequiresConcentration = require;
    }

    const Cls = build(status, require);
    Cls.init();
    Module.ITEM_FILTERS.push(require);
    return Cls;
  }
}

Hooks.once("init", () => Module.init());

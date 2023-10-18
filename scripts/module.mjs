class Module {
  static ID = "concentrationnotifier";
  static STATUS = "concentration";
  static REASON = {NOT_REQUIRED: 0, NOT_CONCENTRATING: 1, DIFFERENT_ITEM: 2, DIFFERENT_LEVEL: 3, UPCASTABLE: 4};

  /* ---------------------------- */
  /*                              */
  /*         MODULE SETUP         */
  /*                              */
  /* ---------------------------- */

  /** Initialize module. */
  static init() {
    Module._characterFlags();
    Module._registerSettings();
    Hooks.on("renderItemSheet", Module._renderItemSheet);
    Hooks.on("dnd5e.createScrollFromSpell", Module._createScrollFromSpell);
    Hooks.on("renderChatMessage", Module._renderChatMessage);
    Hooks.on("createActiveEffect", Module._createActiveEffect);
    Hooks.on("deleteActiveEffect", Module._deleteActiveEffect);
    Hooks.on("preUpdateActor", Module._preUpdateActor);
    Hooks.on("updateActor", Module._updateActor);
    Hooks.on("dnd5e.preUseItem", Module._preUseItem);
    Hooks.on("renderAbilityUseDialog", Module._renderAbilityUseDialog);
    globalThis.CN = Module;
    Actor.implementation.prototype.rollConcentrationSave = Module._rollConcentrationSave;
  }

  /**
   * When using an item that requires concentration, force the AbilityUseDialog to display
   * a warning about loss of concentration if the item being used is an entirely different
   * item than the one being concentrated on, if it's the same item but at a different level,
   * or if it's the same item but it can be upcast naturally.
   * @TODO FIX IN 2.4
   * @param {Item5e} item       The item about to be used.
   * @param {object} config     The item usage configuration.
   */
  static _preUseItem(item, config) {
    if (!game.settings.get(Module.ID, "show_ability_use_warning")) return;
    const force = [
      Module.REASON.DIFFERENT_ITEM,
      Module.REASON.DIFFERENT_LEVEL,
      Module.REASON.UPCASTABLE
    ].includes(Module._itemUseAffectsConcentration(item));
    const unfocused = item.actor.flags.dnd5e?.concentrationUnfocused;
    if (force || unfocused) config.needsConfiguration = true;
  }

  /**
   * If a reason was found to warn about the potential loss (or lack) of concentration
   * as a result of using this item (potentially at only a different level), inject the
   * warning into the AbilityUseDialog
   * @param {AbilityUseDialog} dialog     The dialog application instance.
   * @param {HTMLElement} html            The html of the dialog.
   */
  static _renderAbilityUseDialog(dialog, [html]) {
    if (!game.settings.get(Module.ID, "show_ability_use_warning")) return;
    const reason = Module._itemUseAffectsConcentration(dialog.item);
    if (reason === Module.REASON.NOT_REQUIRED) return;
    const unfocused = dialog.item.actor.flags.dnd5e?.concentrationUnfocused;
    if ((reason === Module.REASON.NOT_CONCENTRATING) && !unfocused) return;

    // Construct warning.
    const effect = Module.isActorConcentrating(dialog.item.actor);
    const locale = Module._getAbilityUseWarning(reason, dialog.item, effect);
    const div = document.createElement("DIV");
    div.innerHTML = `<p class="notification concentrationnotifier">${locale}</p>`;
    html.querySelector(".notes").after(div.firstElementChild);
    dialog.setPosition({height: "auto"});
  }

  /**
   * Helper method for localization string in the AbilityUseDialog warning, depending
   * on the reason that the new item may end concentration.
   * @param {number} reason             An integer from 'REASON'.
   * @param {Item5e} item               The item triggering the AbilityUseDialog.
   * @param {ActiveEffect5e} effect     The actor's current concentration effect.
   * @returns {string}                  The warning message to display.
   */
  static _getAbilityUseWarning(reason, item, effect) {
    let string = "";
    if (item.actor.flags.dnd5e?.concentrationUnfocused) {
      string = `CN.AbilityDialogWarningUnfocused${(item.type === "spell") ? "Spell" : "Item"}`;
    } else if (reason === Module.REASON.DIFFERENT_ITEM) {
      // This will end concentration on a different item.
      string = `CN.AbilityDialogWarning${(item.type === "spell") ? "Spell" : "Item"}`;
    } else if ([Module.REASON.DIFFERENT_LEVEL, Module.REASON.UPCASTABLE].includes(reason)) {
      // This will end concentration on the same item, unless cast at the same level.
      string = "CN.AbilityDialogWarningSpellLevel";
    }
    return game.i18n.format(string, {
      item: effect.flags[Module.ID]?.data.itemData.name,
      level: effect.flags[Module.ID]?.data.castData.castLevel?.ordinalString()
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
    const config = {fumble: null, critical: null, isConcSave: true, targetValue: 10, parts: []};

    // Apply reliable talent and advantage.
    if (dnd.concentrationReliable) config.reliableTalent = true;
    if (dnd.concentrationAdvantage && !options.event?.ctrlKey) config.advantage = true;

    foundry.utils.mergeObject(config, options);

    const bonus = dnd.concentrationBonus && Roll.validate(dnd.concentrationBonus);
    if (bonus) config.parts.push(dnd.concentrationBonus);

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
    const healthA = actor.system.attributes?.hp || {};
    const healthB = update.system?.attributes?.hp || {};
    const totalA = (healthA.temp ?? 0) + (healthA.value ?? 0);
    const totalB = (healthB.temp ?? healthA.temp ?? 0) + (healthB.value ?? healthA.value ?? 0);
    const damage = totalA - totalB;

    const hook = (damage > 0) ? "preDamageActor" : (damage < 0) ? "preHealActor" : null;
    options[Module.ID] = {save: damage > 0, damage: damage};

    // If damage taken or healing performed, call a hook. Explicitly return false to prevent the update.
    if (hook && (Hooks.call(`${Module.ID}.${hook}`, actor, update, options, userId) === false)) return false;
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
    const {save, damage} = options[Module.ID] || {};
    if (!save) return;
    const effect = Module.isActorConcentrating(actor);
    if (!effect) return;
    if (effect.flags[Module.ID].data.castData.unbreakable) return;

    const data = Module._getData(actor, effect, options);
    const messageData = {
      content: await renderTemplate(`modules/${Module.ID}/templates/concentration-prompt.hbs`, data),
      whisper: game.users.filter(u => actor.testUserPermission(u, "OWNER")).map(u => u.id),
      speaker: ChatMessage.getSpeaker({alias: game.i18n.localize("CN.ModuleTitle")}),
      flags: {core: {canPopout: true}, [Module.ID]: {prompt: true, damage: damage}}
    };
    const hook = (damage > 0) ? "damageActor" : (damage < 0) ? "healActor" : null;
    if (hook) Hooks.callAll(`${Module.ID}.${hook}`, actor, update, options, userId);
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
      CONFIG.DND5E[key] = {
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
      {key: "create_vae_quickButtons", name: "VisualActiveEffectsButtons", type: Boolean, default: true, requiresReload: true},
      {key: "splitItemNames", name: "SplitItemNames", type: Boolean, default: true}
    ].forEach(d => {
      game.settings.register(Module.ID, d.key, {
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
   * Hook function to add a checkbox for concentration on non-spell items.
   * @param {ItemSheet5e} sheet     The item sheet.
   * @param {HTMLElement} html      The element of the sheet.
   */
  static async _renderItemSheet(sheet, [html]) {
    const item = sheet.document;
    if (item.type === "spell") return;
    const durationSelect = html.querySelector("[name='system.duration.units']");
    if (!durationSelect) return;

    // The current duration type must be in `CONFIG.DND5E.scalarTimePeriods`.
    if (!(item.system.duration?.units in CONFIG.DND5E.scalarTimePeriods)) return;

    const div = document.createElement("DIV");
    const template = `modules/${Module.ID}/templates/concentrationCheckbox.hbs`;
    div.innerHTML = await renderTemplate(template, {
      requiresConcentration: item.flags[Module.ID]?.data?.requiresConcentration
    });
    durationSelect.after(...div.children);
  }

  /**
   * Hook function to add the concentration value to created scrolls.
   * @param {Item5e|object} spell         The spell or item data to be made into a scroll.
   * @param {object} spellScrollData      The final item data used to make the scroll.
   */
  static _createScrollFromSpell(spell, spellScrollData) {
    const conc = spell.system?.components?.concentration;
    if (conc) foundry.utils.setProperty(spellScrollData, `flags.${Module.ID}.data.requiresConcentration`, true);
  }

  /**
   * Create a message in chat when an actor begins concentration on an item.
   * @param {ActiveEffect5e} effect     The effect that was created.
   * @param {object} options            The creation options.
   * @param {string} userId             The id of the user who created the effect.
   * @returns {Promise<ChatMessage>}
   */
  static async _createActiveEffect(effect, options, userId) {
    if (!game.settings.get(Module.ID, "showGainLoseMessages")) return;
    return Module._notifyConcentration(effect, options, userId, 1);
  }

  /**
   * Create a message in chat when an actor ends concentration on an item.
   * @param {ActiveEffect5e} effect     The effect that was deleted.
   * @param {object} options            The deletion options.
   * @param {string} userId             The id of the user who deleted the effect.
   * @returns {Promise<ChatMessage>}
   */
  static async _deleteActiveEffect(effect, options, userId) {
    if (!game.settings.get(Module.ID, "showGainLoseMessages")) return;
    return Module._notifyConcentration(effect, options, userId, 0);
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
    if (!Module.isEffectConcentration(effect)) return;
    if (!(effect.parent instanceof CONFIG.Actor.documentClass)) return;

    const templateData = Module._getData(effect.parent, effect, options, type);
    const template = `modules/${Module.ID}/templates/concentration-notify.hbs`;
    const isPublic = game.settings.get("core", "rollMode") === CONST.DICE_ROLL_MODES.PUBLIC;
    const alwaysWhisper = game.settings.get(Module.ID, "always_whisper_messages");
    let whisper;
    if (isPublic && !alwaysWhisper) whisper = [];
    else whisper = game.users.filter(u => effect.parent.testUserPermission(u, "OWNER")).map(u => u.id);
    const messageData = {
      content: await renderTemplate(template, templateData),
      whisper: whisper,
      flags: {core: {canPopout: true}},
      speaker: {alias: game.i18n.localize("CN.ModuleTitle")}
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
    const data = effect.flags[Module.ID].data;
    const detailsTemplate = `CN.NotifyConcentration${{0: "Ended", 1: "Begun"}[type] ?? "Challenge"}.hbs`;
    const damage = options[Module.ID]?.damage ?? 10;
    const dc = Math.max(10, Math.floor(Math.abs(damage) / 2));
    const ability = actor.flags.dnd5e?.concentrationAbility ?? game.settings.get(Module.ID, "defaultConcentrationAbility");
    const saveType = CONFIG.DND5E.abilities[ability].label;
    const detailsData = {
      itemName: data.itemData.name,
      actorName: actor.name,
      dc: dc,
      damage: damage,
      saveType: saveType,
      itemUuid: data.castData.itemUuid
    };
    const details = game.i18n.format(detailsTemplate, detailsData);
    const buttonSaveLabel = game.i18n.format("CN.ButtonSavingThrow", {dc: dc, saveType: saveType});

    return {
      details: details,
      buttonSaveLabel: buttonSaveLabel,
      hasTemplates: !!canvas?.scene.templates.find(t => t.flags?.dnd5e?.origin === data.castData.itemUuid),
      origin: data.castData.itemUuid,
      actorUuid: actor.uuid,
      effectUuid: effect.uuid,
      dc: dc,
      itemImg: data.itemData.img,
      itemUuid: data.castData.itemUuid,
      showUtilButtons: game.settings.get(Module.ID, "show_util_buttons"),
      showEnd: type === 1
    };
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
    const actor = Module._getActor(caster);
    if (!actor) return null;
    const isConc = Module.isActorConcentrating(actor);
    if (!isConc) {
      ui.notifications.warn(game.i18n.format("CN.WarningActorNotConcentrating", {name: actor.name}));
      return null;
    }

    const data = isConc.flags[Module.ID].data;
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
    const actor = Module._getActor(caster);
    if (!actor) return false;
    const getConc = item ? Module.isActorConcentratingOnItem : Module.isActorConcentrating;

    let conc = getConc(actor, item);
    let waited = 0;
    while (!conc && (waited < max_wait)) {
      await new Promise(r => setTimeout(r, 100));
      waited = waited + 100;
      conc = getConc(actor, item);
    }
    return conc ?? false;
  }

  /**
   * End all concentration effects on an actor.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor to end concentration.
   * @param {boolean} [message=true]                      Whether to display a message.
   * @returns {Promise<ActiveEffect5e[]>}                 The array of deleted effects.
   */
  static async breakConcentration(caster, {message = true} = {}) {
    const actor = Module._getActor(caster);
    if (!actor) return [];
    const ids = actor.appliedEffects.reduce((acc, e) => {
      if (Module.isEffectConcentration(e)) acc.push(e.id);
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
    return effect.statuses.has(Module.STATUS);
  }

  /**
   * Does this item require concentration?
   * @param {Item5e} item
   * @returns {boolean}
   */
  static itemRequiresConcentration(item) {
    const isSpell = item.type === "spell";
    if (isSpell) return item.system.components.concentration;

    const units = item.system.duration?.units in CONFIG.DND5E.scalarTimePeriods;
    return units && !!item.flags[Module.ID]?.data.requiresConcentration;
  }

  /**
   * Determine whether an actor is concentrating.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor to test.
   * @returns {ActiveEffect5e|boolean}                    The effect, if concentrating, otherwise false.
   */
  static isActorConcentrating(caster) {
    const actor = Module._getActor(caster);
    return actor ? actor.appliedEffects.find(e => e.statuses.has(Module.STATUS)) : false;
  }

  /**
   * Determine whether an actor is concentrating on a specific item.
   * @param {Token5e|TokenDocument5e|Actor5e} caster      The token, token document, or actor to test.
   * @param {Item5e} item                                 The item to test concentration upon.
   * @returns {ActiveEffect5e|boolean}                    The effect, if concentrating, otherwise false.
   */
  static isActorConcentratingOnItem(caster, item) {
    const actor = Module._getActor(caster);
    return actor ? actor.appliedEffects.find(e => item.uuid === e.flags[Module.ID]?.data?.castData?.itemUuid) : false;
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
    const requires = itemRequiresConcentration(item);
    if (!requires) return Module.REASON.NOT_REQUIRED;

    /* The concentration effect already on the actor, if any. */
    const effect = Module.isActorConcentrating(item.actor);

    // Case 1: Are you concentrating on something else?
    if (!effect) return Module.REASON.NOT_CONCENTRATING;
    const cast = effect.flags[Module.ID]?.data.castData ?? {};

    // Case 2: Are you concentrating on an entirely different item?
    if (cast.itemUuid !== item.uuid) return Module.REASON.DIFFERENT_ITEM;

    // Case 3: Are you concentrating on the same item at a different spell level?
    if (cast.castLevel !== item.system.level) return Module.REASON.DIFFERENT_LEVEL;

    // Case 4: You are concentrating on the same item, at the same level, but it can be upcast.
    if ((level > 0) && CONFIG.DND5E.spellUpcastModes.includes(preparation.mode)) return Module.REASON.UPCASTABLE;

    // None of the above are true, so the usage is 'free' far as concentration is concerned.
    return false;
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
      const action = n.dataset.prompt;
      if (action === "save") n.addEventListener("click", Module._onClickSave);
      else if (action === "end") n.addEventListener("click", Module._onClickEnd);
      else if (action === "templates") n.addEventListener("click", Module._onClickTemplates);
      else if (action === "item") n.addEventListener("click", Module._onClickItem);
    });
  }

  /**
   * Perform a saving throw to maintain concentration on the spell.
   * @param {PointerEvent} event      The initiating click event.
   * @returns {Promise<D20Roll>}      The rolled save.
   */
  static async _onClickSave(event) {
    const data = event.currentTarget.dataset;
    const actor = await fromUuid(data.uuid);
    return actor.rollConcentrationSave(data.ability, {targetValue: data.target, event});
  }

  /**
   * Prompt or immediately end the concentration.
   * @param {PointerEvent} event                The initiating click event.
   * @returns {Promise<ActiveEffect|null>}      The deleted effect.
   */
  static async _onClickEnd(event) {
    const uuid = event.currentTarget.dataset.uuid;
    const effect = await fromUuid(uuid);
    if (event.shiftKey) return effect.delete();
    const name = effect.flags[Module.ID].data.itemData.name;
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
      }
    }, {id: `${Module.ID}-delete-${effect.id}`}).render(true);
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
   * Render the item being concentrated on.
   * @param {PointerEvent} event          The initiating click event.
   * @returns {Promise<ItemSheet5e>}      The rendered item sheet.
   */
  static async _onClickItem(event) {
    const uuid = event.currentTarget.dataset.uuid;
    const item = await fromUuid(uuid);
    return item.sheet.render(true);
  }

  /* ---------------------------- */
  /*                              */
  /*      COLLECTION HANDLING     */
  /*                              */
  /* ---------------------------- */

  /**
   * A mapping of all currently concentrating actors. This collection is dynamically updated when effects change,
   * and should not be considered an ultimate truth.
   * @type {Collection<Actor5e>}
   */
  get collection() {
    const collection = this._collection ??= new foundry.utils.Collection();
    for (const key of collection.keys()) if (!Module.isActorConcentrating(collection.get(key))) collection.delete(key);
    return collection;
  }

  /**
   * Convert a key, which can be a document, to the uuid of an actor, if possible.
   * @param {Item5e|Token5e|TokenDocument5e|Actor5e|string} key     A document or uuid of an actor.
   * @returns {string|null}                                         An actor uuid.
   */
  _convertKey(key) {
    const classes = [CONFIG.Item.documentClass, CONFIG.Token.documentClass, CONFIG.Token.objectClass];
    if (classes.some(cls => key instanceof cls)) return key.actor?.uuid ?? null;
    else if (key instanceof CONFIG.Actor.documentClass) return key.uuid ?? null;
    return key;
  }

  /**
   * Get an actor from the collection of concentrating actors.
   * @param {Item5e|Token5e|TokenDocument5e|Actor5e|string} key     A document or uuid of an actor.
   * @returns {Actor5e}                                             The stored actor with this uuid.
   */
  get(key) {
    key = this._convertKey(key);
    return this.collection.get(key) ?? null;
  }

  /**
   * Set an actor in the collection of concentrating actors.
   * @param {Item5e|Token5e|TokenDocument5e|Actor5e|string} key     A document or uuid of an actor.
   */
  set(key) {
    key = this._convertKey(key);
    const actor = fromUuidSync(key);
    if (!(actor instanceof CONFIG.Actor.documentClass)) return null;
    return this.collection.set(key, actor);
  }
}

Hooks.once("init", Module.init);

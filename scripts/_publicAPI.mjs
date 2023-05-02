import {MODULE} from "./settings.mjs";

export class API {

  /**
   * Determine whether an actor is concentrating.
   * @param {Token|TokenDocument|Actor} caster      The token, token document, or actor to test.
   * @returns {ActiveEffect|boolean}                The effect, if concentrating, otherwise false.
   */
  static isActorConcentrating(caster) {
    return (caster.actor ?? caster).effects.find(API.isEffectConcentration) || false;
  }

  /**
   * Determine if you are concentrating on a specific item.
   * @param {Token|TokenDocument|Actor} caster      The token, token document, or actor to test.
   * @param {Item} item                             The item to test concentration upon.
   * @returns {ActiveEffect|boolean}                The effect, if concentrating, otherwise false.
   */
  static isActorConcentratingOnItem(caster, item) {
    const actor = caster.actor ?? caster;
    const effect = actor.effects.find(eff => {
      return item.uuid === eff.flags[MODULE]?.data?.castData?.itemUuid;
    });
    return effect || false;
  }

  /**
   * Determine if an effect is a concentration effect.
   * @param {ActiveEffect} effect     The active effect to test.
   * @returns {boolean}               Whether the effect has 'concentration' as a status.
   */
  static isEffectConcentration(effect) {
    return effect.statuses.has("concentration");
  }

  /**
   * End all concentration effects on an actor.
   * @param {Token|TokenDocument|Actor} caster      The token, token document, or actor to end concentration.
   * @param {boolean} message                       Whether to display a message.
   * @returns {ActiveEffect[]}                      An array of deleted effects.
   */
  static async breakConcentration(caster, {message = true} = {}) {
    const actor = caster.actor ?? caster;
    const ids = actor.effects.reduce((acc, e) => {
      if (API.isEffectConcentration(eff)) acc.push(e.id);
      return acc;
    }, []);
    return actor.deleteEmbeddedDocuments("ActiveEffect", ids, {concMessage: message});
  }

  /**
   * Wait for concentration to be applied on an actor, optionally on a specific item.
   * @param {Token|TokenDocument|Actor} caster      The token, token document, or actor to wait for.
   * @param {Item} [item]                           The optional specific item.
   * @param {number} [max_wait=10000]               The maximum time to wait.
   * @returns {ActiveEffect|boolean}                The effect, if concentrating, otherwise false.
   */
  static async waitForConcentrationStart(caster, {item, max_wait = 10000} = {}) {
    const actor = caster.actor ?? caster;
    const getConc = item ? API.isActorConcentratingOnItem : API.isActorConcentrating;

    let conc = getConc(actor, item);
    let waited = 0;
    while (!conc && (waited < max_wait)) {
      await new Promise(r => setTimeout(r, 100));
      waited = waited + 100;
      conc = getConc(actor, item);
    }
    return conc || false;
  }

  /**
   * Redisplay the chat card of the item being concentrated on.
   * If the item is a spell, display it at the correct level.
   * @param {Token|TokenDocument|Actor} caster      The token, token document, or actor that is concentrating.
   * @returns {ChatMessage}                         The created chat message.
   */
  static async redisplayCard(caster) {
    const actor = caster.actor ?? caster;
    const isConc = CN.isActorConcentrating(actor);
    if (!isConc) {
      const locale = game.i18n.format("CN.WarningActorNotConcentrating", {name: actor.name});
      ui.notifications.warn(locale);
      return null;
    }

    const data = isConc.flags[MODULE].data;
    const item = fromUuidSync(data.castData.itemUuid);
    const clone = item ? item.clone(data.itemData, {keepId: true}) : new Item.implementation(data.itemData, {parent: actor});
    if (clone.type === "spell") clone.updateSource({"system.level": data.castData.castLevel});

    if (!clone) {
      ui.notifications.warn("CN.ItemNotFound", {localize: true});
      return null;
    }

    clone.prepareFinalAttributes();
    return clone.displayCard({});
  }
}

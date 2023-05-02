import {MODULE} from "./settings.mjs";

/**
 * Hook function to append listener onto rendered chat messages.
 * @param {ChatMessage} message     The message rendered.
 * @param {html} html               The element of the message.
 */
export function _clickPrompt(message, html) {
  html[0].querySelector(".concentrationnotifier [data-prompt='saving-throw']")?.addEventListener("click", _onClickSavingThrow);
  html[0].querySelector(".concentrationnotifier [data-prompt='end-concentration']")?.addEventListener("click", _onClickEndConcentration);
  html[0].querySelector(".concentrationnotifier [data-prompt='remove-templates']")?.addEventListener("click", _onClickRemoveTemplates);
  html[0].querySelector(".concentrationnotifier [data-prompt='render-sheet']")?.addEventListener("click", _onClickRenderSheet);
}

/**
 * Perform a saving throw to maintain concentration on the spell.
 * @param {PointerEvent} event      The initiating click event.
 * @returns {Promise<D20Roll>}      The rolled save.
 */
function _onClickSavingThrow(event) {
  const data = event.currentTarget.dataset;
  const actor = fromUuidSync(data.actorUuid);
  return actor.rollConcentrationSave(data.saveType, {targetValue: data.dc, event});
}

/**
 * Prompt or immediately end the concentration.
 * @param {PointerEvent} event                  The initiating click event.
 * @returns {Promise<ActiveEffect>|Dialog}      The deleted effect, or the rendered prompt.
 */
function _onClickEndConcentration(event) {
  const effect = fromUuidSync(event.currentTarget.dataset.effectUuid);
  if (event.shiftKey) return effect.delete();

  const name = effect.flags[MODULE].data.itemData.name;
  const title = game.i18n.format("CN.ConfirmEndConcentrationTitle", {name});
  const content = game.i18n.format("CN.ConfirmEndConcentrationText", {name});
  const id = `${MODULE}-deletePrompt-${effect.uuid.replaceAll(".", "-")}`;
  return new Dialog({
    title, content, buttons: {
      yes: {
        icon: "<i class='fa-solid fa-check'></i>",
        label: game.i18n.localize("Yes"),
        callback: async () => {
          return effect.delete();
        }
      },
      no: {
        icon: "<i class='fa-solid fa-xmark'></i>",
        label: game.i18n.localize("No")
      }
    }
  }, {id}).render(true);
}

/**
 * Delete all related templates on the scene that you have permission to delete.
 * @param {PointerEvent} event                The initiating click event.
 * @returns {MeasuredTemplateDocument[]}      The deleted templates.
 */
function _onClickRemoveTemplates(event) {
  if (!canvas) return;
  const origin = event.currentTarget.dataset.origin;
  const ids = canvas.scene.templates.reduce((acc, t) => {
    if (t.isOwner && (t.flags.dnd5e?.origin === origin)) acc.push(t.id);
    return acc;
  }, []);
  return canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", ids);
}

/**
 * Render the item being concentrated on.
 * @param {PointerEvent} event      The initiating click event.
 * @returns {ItemSheet5e}           The rendered item sheet.
 */
function _onClickRenderSheet(event) {
  return fromUuidSync(event.currentTarget.dataset.itemUuid).sheet.render(true);
}

import {MODULE} from "./settings.mjs";

export function _clickPrompt(_, html) {
  html[0].addEventListener("click", (event) => {
    return clickConcentrationPrompt(event);
  });
}

async function clickConcentrationPrompt(event) {
  // get the target of the mouse click.
  let button = event.target?.closest(".concentrationnotifier .buttons > button");
  if (!button) button = event.target?.closest("[name='render-item-sheet']");
  if (!button) return;

  if (button.name === "saving-throw") {
    const caster = fromUuidSync(button.dataset.actorUuid);
    const actor = caster.actor ?? caster;
    return actor.rollConcentrationSave(button.dataset.saveType, {
      targetValue: button.dataset.dc
    });
  }
  else if (button.name === "delete-concentration") {
    const effect = fromUuidSync(button.dataset.effectUuid);
    return deleteDialog(effect, event);
  }
  else if (button.name === "remove-templates") {
    const templateIds = canvas?.scene.templates.filter(t => {
      return t.isOwner && t.flags.dnd5e?.origin === button.dataset.origin;
    }).map(t => t.id);
    return canvas?.scene.deleteEmbeddedDocuments("MeasuredTemplate", templateIds);
  }
  else if (button.name === "render-item-sheet") {
    const item = fromUuidSync(button.dataset.itemUuid);
    return item.sheet.render(true);
  }
}

async function deleteDialog(effect, event) {
  if (!effect) return;
  if (event.shiftKey) {
    return effect.delete();
  }
  const name = effect.flags[MODULE].data.itemData.name;
  new Dialog({
    title: game.i18n.format("CN.ConfirmEndConcentrationTitle", {name}),
    content: game.i18n.format("CN.ConfirmEndConcentrationText", {name}),
    buttons: {
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
  }).render(true);
}

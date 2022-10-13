import { MODULE } from "./settings.mjs";

export function setHooks_promptListeners() {

  Hooks.on("renderChatLog", (_, html) => {
    html[0].addEventListener("click", (event) => {
      return clickConcentrationPrompt(event);
    });
  });
  Hooks.on("renderChatPopout", (_, html) => {
    html[0].addEventListener("click", (event) => {
      return clickConcentrationPrompt(event);
    });
  });
}

async function clickConcentrationPrompt(event) {
  // get the target of the mouse click.
  let button = event.target?.closest("button");
  if (!button) button = event.target?.closest("[name='render-item-sheet']");
  if (!button) return;

  if (button.name === "saving-throw-button") {
    const { dc, saveType, actorUuid } = button.dataset;
    let actor = fromUuidSync(actorUuid);
    actor = actor?.actor ?? actor;
    return actor.rollConcentrationSave(saveType, { targetValue: dc });
  }
  else if (button.name === "delete-concentration-button") {
    const { effectUuid } = button.dataset;
    const effect = fromUuidSync(effectUuid);
    return deleteDialog(effect, event);
  }
  else if (button.name === "render-item-sheet") {
    const { itemUuid } = button.dataset;
    const item = fromUuidSync(itemUuid);
    return item.sheet.render(true);
  }
}

async function deleteDialog(effect, event) {
  if (!effect) return;
  if (event.shiftKey) {
    return effect.delete();
  }
  const name = effect.getFlag(MODULE, "data.itemData.name");
  const title = game.i18n.format("CN.DELETE_DIALOG_TITLE", { name });
  const content = game.i18n.format("CN.DELETE_DIALOG_TEXT", { name });
  const labelYes = game.i18n.localize("Yes");
  const labelNo = game.i18n.localize("No");
  new Dialog({
    title, content, buttons: {
      yes: {
        icon: "<i class='fa-solid fa-check'></i>",
        label: labelYes,
        callback: async () => {
          return effect.delete();
        }
      },
      no: {
        icon: "<i class='fa-solid fa-xmark'></i>",
        label: labelNo
      }
    }
  }).render(true);
}

import { CN } from "./concentration-notifier.mjs";

export class api {
	
	static register(){
		api.globals();
		Actor.prototype.rollConcentrationSave = CN.roll_concentration_save;
	}
	
	static globals(){
		globalThis.ConcentrationNotifier = {
			beginConcentration: CN.start_concentration_on_item,
			endConcentration: CN.end_concentration_on_actor,
			endConcentrationOnItem: CN.end_concentration_on_item,
			requestSavingThrow: CN.request_saving_throw,
			actorConcentratingOnItem: CN.actor_is_concentrating_on_item,
			actorConcentrating: CN.actor_is_concentrating_on_anything,
			determineConcentrationEffect: CN.effect_is_concentration_effect,
			awaitConcentrationOnItem: CN.wait_for_concentration_to_begin_on_item
		};
	}
	
}

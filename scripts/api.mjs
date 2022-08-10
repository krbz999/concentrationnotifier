import { CN_HELPERS as CN, CN_MAIN } from "./main.mjs";

export class api {
	
	static register(){
		api.globals();
		Actor.prototype.rollConcentrationSave = CN_MAIN.roll_concentration_save;
	}
	
	static globals(){
		globalThis.ConcentrationNotifier = {
			beginConcentration: CN.start_concentration_on_item,
			breakConcentration: CN.end_concentration_on_actor,
			breakConcentrationForItem: CN.end_concentration_on_item,
			isActorConcentrating: CN.actor_is_concentrating_on_anything,
			isActorConcentratingOnItem: CN.actor_is_concentrating_on_item,
			promptConcentrationSave: CN.request_saving_throw,
			isEffectConcentration: CN.effect_is_concentration_effect,
			waitForConcentrationStart: CN.wait_for_concentration_to_begin
		}
	}	
}

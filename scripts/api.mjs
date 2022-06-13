import { ConcentrationNotifier } from "./concentration-notifier.mjs";

export class api {
	
	static register(){
		api.globals();
	}
	
	static globals(){
		globalThis.ConcentrationNotifier = {
			applyConcentrationOnItem: ConcentrationNotifier.applyConcentrationOnItem,
			triggerSavingThrow: ConcentrationNotifier.triggerSavingThrow,
			concentratingOn: ConcentrationNotifier.concentratingOn,
			concentratingAny: ConcentrationNotifier.concentratingAny
		};
	}
}
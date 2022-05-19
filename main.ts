import { appendFile } from 'fs';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFolder } from 'obsidian';
import { json } from 'stream/consumers';
import { getApi, isPluginEnabled, registerApi } from "@aidenlx/folder-note-core";
import { stringify } from 'querystring';
import { debug } from 'console';
const fetch = require('node-fetch');

// Remember to rename these classes and interfaces!

interface RemoriaTechniquesForObsidianSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: RemoriaTechniquesForObsidianSettings = {
	mySetting: 'Techniques'
}

export default class RemoriaTechniquesForObsidian extends Plugin {
	settings: RemoriaTechniquesForObsidianSettings;

	async onload() {
		await this.loadSettings();

		// // This creates an icon in the left ribbon.
		// const ribbonIconEl = this.addRibbonIcon('install', 'Generate Technique Files With API Data', (evt: MouseEvent) => {
		// 	// Called when the user clicks the icon.
		// 	new Notice('This is a notice!');
		// });
		// // Perform additional things with the ribbon
		// ribbonIconEl.addClass('my-plugin-ribbon-class');

		// // This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		// const statusBarItemEl = this.addStatusBarItem();
		// statusBarItemEl.setText('Status Bar Text');

		this.addCommand({
			id: 'generate-technique-data-from-api',
			name: 'Generate technique data from API',
			callback: () => {
				this.fetchAPIData();
			}
		});

		// // This adds a simple command that can be triggered anywhere
		// this.addCommand({
		// 	id: 'open-sample-modal-simple',
		// 	name: 'Open sample modal (simple)',
		// 	callback: () => {
		// 		new RemoriaTechniquesForObsidianModal(this.app).open();
		// 	}
		// });
		// // This adds an editor command that can perform some operation on the current editor instance
		// this.addCommand({
		// 	id: 'sample-editor-command',
		// 	name: 'Sample editor command',
		// 	editorCallback: (editor: Editor, view: MarkdownView) => {
		// 		console.log(editor.getSelection());
		// 		editor.replaceSelection('Sample Editor Command');
		// 	}
		// });
		// // This adds a complex command that can check whether the current state of the app allows execution of the command
		// this.addCommand({
		// 	id: 'open-sample-modal-complex',
		// 	name: 'Open sample modal (complex)',
		// 	checkCallback: (checking: boolean) => {
		// 		// Conditions to check
		// 		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		// 		if (markdownView) {
		// 			// If checking is true, we're simply "checking" if the command can be run.
		// 			// If checking is false, then we want to actually perform the operation.
		// 			if (!checking) {
		// 				new RemoriaTechniquesForObsidianModal(this.app).open();
		// 			}

		// 			// This command will only show up in Command Palette when the check function returns true
		// 			return true;
		// 		}
		// 	}
		// });

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new RemoriaTechniquesForObsidianSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		// this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
		// 	console.log('click', evt);
		// });

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	makeRootTechniqueFileContent(technique_types : Array<string>) : string {
		var tech_list : string = '';
		technique_types.forEach((_t) => tech_list+='1. [['+_t+']]\n');
		return '#path_2\n\n# Technique Types:\n'+tech_list;
	}

	makeMasteryFileContent(mastery_name : string, cluster_names : Array<string>) : string {
		var cluster_list : string = ''
		cluster_names.forEach((_c) => cluster_list+='1. [['+_c+']]\n');
		var nice_name : string = mastery_name.replace(/([A-Z])/g, ' $1').trim(); //add spaces before capitals and then trim
		return '#path_2 #technique_type\n\n# '+nice_name+' Techniques\n## Clusters\n'+cluster_list;
	}

	makeClusterFileContent(cluster_name : string, technique_names : Array<string>) : string {
		var technique_list : string = '';
		technique_names.forEach((_t) => technique_list+='1. [['+_t+']]\n');
		return '#path_2 #technique_cluster #cluster_'+cluster_name.toLowerCase().trim().replace(' ','_')+'\n\n# '+cluster_name+'\n## '+cluster_name+' Techniques:\n'+technique_list;
	}

	makeTechniqueFileContent(json_data : any, cluster_name : string) : string {		
		return this.buildTechniqueTags(json_data,cluster_name)+this.buildTechniqueSummery(json_data)+this.buildTechniqueIncludeNodes(json_data);
	}

	buildTechniqueTags(json_data:any,cluster_name:string):string {
		var technique_name = json_data.name;
		return '#path_2 #technique #technique_'+technique_name.toLowerCase().trim().replace(' ','_').replace(':','')
		+' #cluster_'+cluster_name.toLowerCase().trim().replace(' ','_')+'\n';
	}

	buildTechniqueSummery(json_data:any):string {
		var technique_name = json_data.name;
		var technique_id = json_data.id;
		var technique_grade_type = json_data.grade_colour;
		var technique_grade_quality = json_data.grade_number;
		var technique_grade : string = technique_grade_type + " " + technique_grade_quality;
		var technique_total_points = json_data.total_points;
		var technique_total_levels = json_data.total_levels;
		var technique_full_stages = json_data.full_stage_number;
		var technique_requirements : Array<string> = json_data.requirements;
		var flat_requirements : string = '';
		technique_requirements.forEach((_ele) => flat_requirements+='    1. [['+_ele+']]\n');
		var technique_manual_locations : Array<string> = json_data.manual_location;
		var flat_locations : string = '';
		technique_manual_locations.forEach((_ele) => flat_locations+='    1. [['+_ele+']]\n');
		var technique_complete = json_data.finished;
		return '# '+technique_name
		+'\n## Summery:\n- API ID: '+technique_id+'\n- Grade: '+technique_grade+'\n- Total points: '+
		technique_total_points+'\n- Total levels: '+technique_total_levels+'\n- Number of full stages: '+
		technique_full_stages+'\n- Requirements:\n'+flat_requirements+'- Manual Locations:\n'+flat_locations+
		'- Technique Complete: '+technique_complete;
	}
	
	buildTechniqueIncludeNodes(json_data:any):string {
		enum IncreaseNodeTypes {
			CHARISMA_SCORE_INCREASE_NODE,
			COMPREHENSION_INCREASE_NODE,
			CONSTITUTION_SCORE_INCREASE_NODE,
			DAMAGE_REDUCTION_INCREASE_NODE,
			DEXTERITY_SCORE_INCREASE_NODE,
			INTELLIGENCE_SCORE_INCREASE_NODE,
			MAX_HEALTH_INCREASE_NODE,
			REACTION_INCREASE_NODE,
			STRENGTH_SCORE_INCREASE_NODE,
			WISDOM_SCORE_INCRASE_NODE,
			MAX_CHAIN_LENGTH_INCREASE_NODE,
			SWORD_DAMAGE_INCREASE,
			SWORD_HIT_INCREASE,

			BLADE_DAMAGE_INCREASE,
			BLADE_HIT_INCREASE,
			HEAVY_WEAPON_DAMAGE_INCREASE,
			HEAVY_WEAPON_HIT_INCREASE,
			HIDDEN_WEAPON_DAMAGE_INCREASE,
			HIDDEN_WEAPON_HIT_INCREASE,
			OFFHAND_WEAPON_DAMAGE_INCREASE,
			OFFHAND_WEAPON_HIT_INCREASE,
			LIGHT_WEAPON_DAMAGE_INCREASE,
			LIGHT_WEAPON_HIT_INCREASE,
			SILENT_WEAPON_DAMAGE_INCREASE,
			SILENT_WEAPON_HIT_INCREASE,
			THROWABLE_WEAPON_DAMAGE_INCREASE,
			THROWABLE_WEAPON_HIT_INCREASE,
			PALM_DAMAGE_INCREASE,
			PALM_HIT_INCREASE,
			FIST_DAMAGE_INCREASE,
			FIST_HIT_INCREASE,
			SPEAR_DAMAGE_INCREASE,
			SPEAR_HIT_INCREASE,
			BOW_DAMAGE_INCREASE,
			BOW_HIT_INCREASE,

			UNARMED_DAMAGE_INCREASE,
			UNARMED_HIT_INCREASE,

			MAX_MOVEMENT_SPEED_INCREASE,
			MAX_UNDERWATER_MOVEMENT_SPEED_INCREASE,
			THP_LONG_REST_RECOVERY_INCREASE,
			
			SOUL_ATTRIBUTE_MU_THRESHOLD_DECREASE_NODE,
			SOUL_ATTRIBUTE_MU_TOLERANCE_INCREASE_NODE,
			SOUL_ATTRIBUTE_NAU_THRESHOLD_DECREASE_NODE,
			SOUL_ATTRIBUTE_NAU_TOLERANCE_INCREASE_NODE,
			SOUL_ATTRIBUTE_PSI_THRESHOLD_DECREASE_NODE,
			SOUL_ATTRIBUTE_PSI_TOLERANCE_INCREASE_NODE,
			SOUL_ATTRIBUTE_RHO_THRESHOLD_DECREASE_NODE,
			SOUL_ATTRIBUTE_RHO_TOLERANCE_INCREASE_NODE,
			SOUL_ATTRIBUTE_YEW_THRESHOLD_DECREASE_NODE,
			SOUL_ATTRIBUTE_YEW_TOLERANCE_INCREASE_NODE,
			SOUL_ATTRIBUTE_ZET_THRESHOLD_DECREASE_NODE,
			SOUL_ATTRIBUTE_ZET_TOLERANCE_INCREASE_NODE,

			SOUL_ATTRIBUTE_PSI_PRIME_CONDENSING_CHANCE,
			SOUL_ATTRIBUTE_RHO_PRIME_CONDENSING_CHANCE,
			SOUL_ATTRIBUTE_YEW_PRIME_CONDENSING_CHANCE,
			SOUL_ATTRIBUTE_MU_PRIME_CONDENSING_CHANCE,
			SOUL_ATTRIBUTE_NAU_PRIME_CONDENSING_CHANCE,
			SOUL_ATTRIBUTE_ZET_PRIME_CONDENSING_CHANCE,

			BLADE_EDGE_DAMAGE_IN_FRACTURES_INCREASE
		}
		enum MasteryTypes {
			SMALL_SUCCESS,
			LARGE_SUCCESS,
			SMALL_PERFECTION,
			GREAT_PERFECTION,
			OBSCURE,
			DIVINE
		
		}

		var levelToIncreaseType = function (_level : any) : IncreaseNodeTypes {
			if (_level.level_type != "increase") {
				console.error("This level is not an increase level: "+_level.level_content); return;
			}
			
			if (_level.level_content.toLowerCase().contains("comprehension. (up to")) return IncreaseNodeTypes.COMPREHENSION_INCREASE_NODE;
			if (_level.level_content.toLowerCase().contains("wisdom score. (up to")  || _level.level_content.toLowerCase().contains("to wisdom. (to a minimum of")) return IncreaseNodeTypes.WISDOM_SCORE_INCRASE_NODE; 
			if (_level.level_content.toLowerCase().contains("dexterity score. (up to") || _level.level_content.toLowerCase().contains("to dexterity. (to a minimum of")) return IncreaseNodeTypes.DEXTERITY_SCORE_INCREASE_NODE; 
			if (_level.level_content.toLowerCase().contains("strength score. (up to")  || _level.level_content.toLowerCase().contains("to strength. (to a minimum of")) return IncreaseNodeTypes.STRENGTH_SCORE_INCREASE_NODE; 
			if (_level.level_content.toLowerCase().contains("constitution score. (up to")  || _level.level_content.toLowerCase().contains("to constitution. (to a minimum of")) return IncreaseNodeTypes.CONSTITUTION_SCORE_INCREASE_NODE; 
			if (_level.level_content.toLowerCase().contains("intelligence score. (up to")  || _level.level_content.toLowerCase().contains("to intelligence. (to a minimum of")) return IncreaseNodeTypes.INTELLIGENCE_SCORE_INCREASE_NODE; 
			if (_level.level_content.toLowerCase().contains("charisma score. (up to")  || _level.level_content.toLowerCase().contains("to charisma. (to a minimum of")) return IncreaseNodeTypes.CHARISMA_SCORE_INCREASE_NODE;
			if (_level.level_content.toLowerCase().contains("max hp. (up to") || _level.level_content.toLowerCase().contains("to your birds hp (up to")) return IncreaseNodeTypes.MAX_HEALTH_INCREASE_NODE; 
			if (_level.level_content.toLowerCase().contains("damage reduction. (up to")) return IncreaseNodeTypes.DAMAGE_REDUCTION_INCREASE_NODE;
			if (_level.level_content.toLowerCase().contains("reaction. (up to")) return IncreaseNodeTypes.REACTION_INCREASE_NODE; 
			if (_level.level_content.toLowerCase().contains("max chain length. (up to")) return IncreaseNodeTypes.MAX_CHAIN_LENGTH_INCREASE_NODE; 
			if (_level.level_content.toLowerCase().contains("sword dmg. (up to")) return IncreaseNodeTypes.SWORD_DAMAGE_INCREASE; 
			if (_level.level_content.toLowerCase().contains("sword hit rolls. (up to")) return IncreaseNodeTypes.SWORD_HIT_INCREASE;

			if (_level.level_content.toLowerCase().contains("bladed weapon dmg. (up to")) return IncreaseNodeTypes.BLADE_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("bladed weapon hit. (up to")) return IncreaseNodeTypes.BLADE_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("heavy weapon dmg. (up to")) return IncreaseNodeTypes.HEAVY_WEAPON_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("heavy weapon hit. (up to")) return IncreaseNodeTypes.HEAVY_WEAPON_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("hidden weapon dmg. (up to")) return IncreaseNodeTypes.HIDDEN_WEAPON_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("hidden weapon hit. (up to")) return IncreaseNodeTypes.HIDDEN_WEAPON_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("offhand weapon dmg. (up to")) return IncreaseNodeTypes.OFFHAND_WEAPON_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("offhand weapon hit. (up to")) return IncreaseNodeTypes.OFFHAND_WEAPON_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("light weapon dmg. (up to")) return IncreaseNodeTypes.LIGHT_WEAPON_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("light weapon hit. (up to")) return IncreaseNodeTypes.LIGHT_WEAPON_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("silent weapon dmg. (up to")) return IncreaseNodeTypes.SILENT_WEAPON_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("silent weapon hit. (up to")) return IncreaseNodeTypes.SILENT_WEAPON_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("throwable weapon dmg. (up to")) return IncreaseNodeTypes.THROWABLE_WEAPON_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("throwable weapon hit. (up to")) return IncreaseNodeTypes.THROWABLE_WEAPON_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("palm dmg. (up to")) return IncreaseNodeTypes.PALM_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("palm hit. (up to")) return IncreaseNodeTypes.PALM_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("fist dmg. (up to")) return IncreaseNodeTypes.FIST_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("fist hit. (up to")) return IncreaseNodeTypes.FIST_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("spear dmg. (up to")) return IncreaseNodeTypes.SPEAR_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("spear hit. (up to")) return IncreaseNodeTypes.SPEAR_HIT_INCREASE;
			if (_level.level_content.toLowerCase().contains("bow dmg. (up to")) return IncreaseNodeTypes.BOW_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("bow hit. (up to")) return IncreaseNodeTypes.BOW_HIT_INCREASE;

			if (_level.level_content.toLowerCase().contains("unarmed dmg. (up to")) return IncreaseNodeTypes.UNARMED_DAMAGE_INCREASE;
			if (_level.level_content.toLowerCase().contains("unarmed hit. (up to")) return IncreaseNodeTypes.UNARMED_HIT_INCREASE;

			if (_level.level_content.toLowerCase().contains("ft movement speed. (up to")) return IncreaseNodeTypes.MAX_MOVEMENT_SPEED_INCREASE;
			if (_level.level_content.toLowerCase().contains("ft underwater movement speed. (up to")) return IncreaseNodeTypes.MAX_UNDERWATER_MOVEMENT_SPEED_INCREASE;
			if (_level.level_content.toLowerCase().contains("hp long rest recovery increased by")) return IncreaseNodeTypes.THP_LONG_REST_RECOVERY_INCREASE;

			if (_level.level_content.toLowerCase().contains("soul attribute psi tolerance increased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_PSI_TOLERANCE_INCREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute psi threshold decreased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_PSI_THRESHOLD_DECREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute mu tolerance increased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_MU_TOLERANCE_INCREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute mu threshold decreased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_MU_THRESHOLD_DECREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute nau tolerance increased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_NAU_TOLERANCE_INCREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute nau threshold decreased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_NAU_THRESHOLD_DECREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute rho tolerance increased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_RHO_TOLERANCE_INCREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute rho threshold decreased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_RHO_THRESHOLD_DECREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute yew tolerance increased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_YEW_TOLERANCE_INCREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute yew threshold decreased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_YEW_THRESHOLD_DECREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute zet tolerance increased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_ZET_TOLERANCE_INCREASE_NODE;
			if (_level.level_content.toLowerCase().contains("soul attribute zet threshold decreased by [")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_ZET_THRESHOLD_DECREASE_NODE;

			if (_level.level_content.toLowerCase().contains("percent chance for psi soul to condense as prime psi soul. (up to")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_PSI_PRIME_CONDENSING_CHANCE;
			if (_level.level_content.toLowerCase().contains("percent chance for rho soul to condense as prime psi soul. (up to")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_RHO_PRIME_CONDENSING_CHANCE;
			if (_level.level_content.toLowerCase().contains("percent chance for yew soul to condense as prime psi soul. (up to")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_YEW_PRIME_CONDENSING_CHANCE;
			if (_level.level_content.toLowerCase().contains("percent chance for mu soul to condense as prime psi soul. (up to")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_MU_PRIME_CONDENSING_CHANCE;
			if (_level.level_content.toLowerCase().contains("percent chance for nau soul to condense as prime psi soul. (up to")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_NAU_PRIME_CONDENSING_CHANCE;
			if (_level.level_content.toLowerCase().contains("percent chance for zet soul to condense as prime psi soul. (up to")) return IncreaseNodeTypes.SOUL_ATTRIBUTE_ZET_PRIME_CONDENSING_CHANCE;

			if (_level.level_content.toLowerCase().contains("edge damage to blades in fractures. (up to")) return IncreaseNodeTypes.BLADE_EDGE_DAMAGE_IN_FRACTURES_INCREASE;

	
			console.error("No case for "+_level.level_content+" currently registered in levelToIncreaseType.");
		}

		var increaseTypeToString = function (_t:IncreaseNodeTypes) : string {
			switch (_t) {
				case IncreaseNodeTypes.CHARISMA_SCORE_INCREASE_NODE: return "Charisma Score Increase Node";
				case IncreaseNodeTypes.COMPREHENSION_INCREASE_NODE: return "Comprehension Increase Node";
				case IncreaseNodeTypes.CONSTITUTION_SCORE_INCREASE_NODE: return "Constitution Score Increase Node";
				case IncreaseNodeTypes.DAMAGE_REDUCTION_INCREASE_NODE: return "Damage Reduction Increase Node";
				case IncreaseNodeTypes.DEXTERITY_SCORE_INCREASE_NODE: return "Dexterity Score Increase Node";
				case IncreaseNodeTypes.INTELLIGENCE_SCORE_INCREASE_NODE: return "Intelligence Score Increase Node";
				case IncreaseNodeTypes.MAX_HEALTH_INCREASE_NODE: return "Max Health Increase Node";
				case IncreaseNodeTypes.REACTION_INCREASE_NODE: return "Reaction Increase Node";
				case IncreaseNodeTypes.STRENGTH_SCORE_INCREASE_NODE: return "Strength Score Increase Node";
				case IncreaseNodeTypes.WISDOM_SCORE_INCRASE_NODE: return "Wisdom Score Increase Node";
				case IncreaseNodeTypes.MAX_CHAIN_LENGTH_INCREASE_NODE: return "Max Chain Length Increase Node";
				case IncreaseNodeTypes.SWORD_DAMAGE_INCREASE: return "Sword Damage Increase Node";
				case IncreaseNodeTypes.SWORD_HIT_INCREASE: return "Sword Hit Increase Node";

				case IncreaseNodeTypes.BLADE_DAMAGE_INCREASE: return "Blade Damage Increase Node";
				case IncreaseNodeTypes.BLADE_HIT_INCREASE: return "Blade Hit Increase Node";
				case IncreaseNodeTypes.HEAVY_WEAPON_DAMAGE_INCREASE: return "Heavy Weapon Damage Increase Node";
				case IncreaseNodeTypes.HEAVY_WEAPON_HIT_INCREASE: return "Heavy Weapon Hit Increase Node";
				case IncreaseNodeTypes.HIDDEN_WEAPON_DAMAGE_INCREASE: return "Hidden Weapon Damage Increase Node";
				case IncreaseNodeTypes.HIDDEN_WEAPON_HIT_INCREASE: return "Hidden Weapon Hit Increase Node";
				case IncreaseNodeTypes.OFFHAND_WEAPON_DAMAGE_INCREASE: return "Offhand Weapon Damage Increase Node";
				case IncreaseNodeTypes.OFFHAND_WEAPON_HIT_INCREASE: return "Offhand Weapon Hit Increase Node";
				case IncreaseNodeTypes.LIGHT_WEAPON_DAMAGE_INCREASE: return "Light Weapon Damage Increase Node";
				case IncreaseNodeTypes.LIGHT_WEAPON_HIT_INCREASE: return "Light Weapon Hit Increase Node";
				case IncreaseNodeTypes.SILENT_WEAPON_DAMAGE_INCREASE: return "Silent Weapon Damage Increase Node";
				case IncreaseNodeTypes.SILENT_WEAPON_HIT_INCREASE: return "Silent Weapon Hit Increase Node";
				case IncreaseNodeTypes.THROWABLE_WEAPON_DAMAGE_INCREASE: return "Throwable Weapon Damage Increase Node";
				case IncreaseNodeTypes.THROWABLE_WEAPON_HIT_INCREASE: return "Throwable Weapon Hit Increase Node";
				case IncreaseNodeTypes.PALM_DAMAGE_INCREASE: return "Palm Damage Increase Node";
				case IncreaseNodeTypes.PALM_HIT_INCREASE: return "Palm Hit Increase Node";
				case IncreaseNodeTypes.FIST_DAMAGE_INCREASE: return "Fist Damage Increase Node";
				case IncreaseNodeTypes.FIST_HIT_INCREASE: return "Fist Hit Increase Node";
				case IncreaseNodeTypes.SPEAR_DAMAGE_INCREASE: return "Spear Damage Increase Node";
				case IncreaseNodeTypes.SPEAR_HIT_INCREASE: return "Spear Hit Increase Node";
				case IncreaseNodeTypes.BOW_DAMAGE_INCREASE: return "Bow Damage Increase Node";
				case IncreaseNodeTypes.BOW_HIT_INCREASE: return "Bow Hit Increase Node";

				case IncreaseNodeTypes.UNARMED_DAMAGE_INCREASE: return "Unarmed Damage Increase Node";
				case IncreaseNodeTypes.UNARMED_HIT_INCREASE: return "Unarmed Hit Increase Node";

				case IncreaseNodeTypes.MAX_MOVEMENT_SPEED_INCREASE: return "Max Movement Speed Increase Node";
				case IncreaseNodeTypes.MAX_UNDERWATER_MOVEMENT_SPEED_INCREASE: return "Max Underwater Movement Speed Increase Node";
				case IncreaseNodeTypes.THP_LONG_REST_RECOVERY_INCREASE: return "THP Long Rest Recovery Increase Node";

				case IncreaseNodeTypes.SOUL_ATTRIBUTE_PSI_TOLERANCE_INCREASE_NODE: return "Soul Attribute Psi Tolerance Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_PSI_THRESHOLD_DECREASE_NODE: return "Soul Attribute Psi Threshold Decrease Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_MU_TOLERANCE_INCREASE_NODE: return "Soul Attribute Mu Tolerance Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_MU_THRESHOLD_DECREASE_NODE: return "Soul Attribute Mu Threshold Decrease Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_NAU_TOLERANCE_INCREASE_NODE: return "Soul Attribute Nau Tolerance Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_NAU_THRESHOLD_DECREASE_NODE: return "Soul Attribute Nau Threshold Decrease Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_RHO_TOLERANCE_INCREASE_NODE: return "Soul Attribute Rho Tolerance Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_RHO_THRESHOLD_DECREASE_NODE: return "Soul Attribute Rho Threshold Decrease Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_YEW_TOLERANCE_INCREASE_NODE: return "Soul Attribute Yew Tolerance Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_YEW_THRESHOLD_DECREASE_NODE: return "Soul Attribute Yew Threshold Decrease Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_ZET_TOLERANCE_INCREASE_NODE: return "Soul Attribute Zet Tolerance Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_ZET_THRESHOLD_DECREASE_NODE: return "Soul Attribute Zet Threshold Decrease Node";

				case IncreaseNodeTypes.SOUL_ATTRIBUTE_PSI_PRIME_CONDENSING_CHANCE: return "Soul Attribute Psi Prime Condensing Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_RHO_PRIME_CONDENSING_CHANCE: return "Soul Attribute Rho Prime Condensing Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_YEW_PRIME_CONDENSING_CHANCE: return "Soul Attribute Yew Prime Condensing Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_MU_PRIME_CONDENSING_CHANCE: return "Soul Attribute Mu Prime Condensing Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_NAU_PRIME_CONDENSING_CHANCE: return "Soul Attribute Nau Prime Condensing Increase Node";
				case IncreaseNodeTypes.SOUL_ATTRIBUTE_ZET_PRIME_CONDENSING_CHANCE: return "Soul Attribute Zet Prime Condensing Increase Node";

				case IncreaseNodeTypes.BLADE_EDGE_DAMAGE_IN_FRACTURES_INCREASE: return "Blade Edge Damage in Fracture Increase Node";

				default: console.error('Type '+_t+' is not registered in increaseTypeToString()'); 
			}
		};

		var getStringMasteryType = function (_t:MasteryTypes) : string {
			switch (_t) {
				case MasteryTypes.SMALL_SUCCESS: return "Small Success";
				case MasteryTypes.LARGE_SUCCESS: return "Large Success";
				case MasteryTypes.SMALL_PERFECTION: return "Small Perfection";
				case MasteryTypes.GREAT_PERFECTION: return "Great Perfection";
				case MasteryTypes.OBSCURE: return "Obscure";
				case MasteryTypes.DIVINE: return "Divine";
				default: console.error('Type '+_t+' is not registered in getStringMasteryType()'); 
			}
		};
		
		var nodes = new Map<MasteryTypes,Map<IncreaseNodeTypes,number>>();
		var index = 0;

		json_data.masteries.forEach((_m : any) => {
			nodes.set(index,new Map<null,null>());
			index++;
		});
		json_data.masteries.forEach((_m : any) => _m.stages.forEach((_s:any) => _s.levels.forEach((_l:any) => {if (_l.level_type == "increase") {
            if (!nodes.get(_m.type).has(levelToIncreaseType(_l))) {nodes.get(_m.type).set(levelToIncreaseType(_l),1);} 
		else {nodes.get(_m.type).set(levelToIncreaseType(_l), nodes.get(_m.type).get(levelToIncreaseType(_l))+1);}}})));
		
		var existing_types : Array<IncreaseNodeTypes> = [];

		Array.from(nodes.keys()).forEach((_k:any) => Array.from(nodes.get(_k).keys()).forEach((_lk:any) => {if (!existing_types.contains(_lk)) {existing_types.push(_lk);}}));
        
		var increase_to_mast = new Map<IncreaseNodeTypes,Map<MasteryTypes,number>>();
		
		existing_types.forEach((_t:IncreaseNodeTypes) => increase_to_mast.set(_t,new Map<null,null>()));
        Array.from(nodes.keys()).forEach(_k => Array.from(nodes.get(_k).keys()).forEach(_lk => {increase_to_mast.get(_lk).set(_k,nodes.get(_k).get(_lk))}));

        if (existing_types.length < 1) {
            console.log("This seems odd?");
            return '\n\n#### No stat increases.';
        }
		
		var out = "\n#### Included Increase Nodes:\n";

		existing_types.forEach(_t => {
            var quant_counter : string = '';
			increase_to_mast.get(_t).forEach((quant,mastery,map) => {quant_counter+='    - '+getStringMasteryType(mastery)+': '+quant+'\n'});


            out += '- [['+increaseTypeToString(_t)+' | '+increaseTypeToString(_t)+']]\n';
            out += quant_counter;
        });
		
		return out;
	}



	makeNodeFile(path : string, name : string, content : string) : void {
		this.app.vault.create(path+'/'+name+'.md','#generated_by_rto_plugin '+content);
	}

	async makeFolder(path : string, name: string, noteContent? : string) : Promise<void> {
		var make_note = false;
		var path_name = "";
		if (name.contains(":")) {
			path_name = name.replace(/:/g,"");
			console.warn("Technique name had a semi colon in its name. Folders cannot support this, so it was removed!");
		} else {
			path_name = name;
		}
		var truePath = path+'/'+path_name;
		if (noteContent != null) {
			make_note = true;
		}
		console.log("Attempting to make folder @ "+truePath);
		if (await this.app.vault.getAbstractFileByPath(truePath) != null) {
			console.log('Folder already existed, deleting now...');
			await this.app.vault.delete(await this.app.vault.getAbstractFileByPath(truePath),true);
		}

		await this.app.vault.createFolder(truePath);

		if (make_note) {
			this.makeNodeFile(truePath,path_name,noteContent);
		}
		
		// if (make_note) {
		// 	var folder : TFolder = await this.app.vault.getAbstractFileByPath(truePath); 
		// 	await getApi().CreateFolderNote(folder);
		// }
	}

	generateFilesFromJson(jsonData : any) {
		new Notice('API Data loaded using version: '+jsonData.version_number);
		var root_path = "Paths/Path 2 - Technique Mastery";

		console.log("========= Building Techniques from API data =========");
		
		//var masterys_and_clusters_combined : string[] = [];
		//jsonData.techniques.forEach((tech:any) => {masterys_and_clusters_combined.push(tech.cluster);},this);		
		//masterys_and_clusters_combined = [...new Set(masterys_and_clusters_combined)];
		//console.log(masterys_and_clusters_combined);


		var technique_map = new Map<string,Map<string,Array<any>>>();

		jsonData.techniques.forEach((tech:any) => {
			var masteryClusterPair = tech.cluster;
			var mastery_type : string = masteryClusterPair.split('-')[0].trim();
			var cluster_type : string = masteryClusterPair.split('-')[1].trim();
			var mastery_exists : boolean = technique_map.has(mastery_type);
			if (!mastery_exists) {
				console.log(mastery_type+ " not found...");
				technique_map.set(mastery_type,new Map<string,Array<any>>([[cluster_type,[tech]]]));
				console.log(mastery_type+ " made!");
			} else {
				console.log("Adding: " +cluster_type+ " (" + tech.name + ")");
				var cluster_exists : boolean = technique_map.get(mastery_type).has(cluster_type);
				//console.log("Cluster found: "+cluster_exists);
				if (!cluster_exists) {
					//console.debug("Got here instead?");
					technique_map.get(mastery_type).set(cluster_type,[tech]);
				} else {
					//console.debug("Got here?");
					technique_map.get(mastery_type).get(cluster_type).push(tech);
				}
			}
		});
		console.log(technique_map);

		
		var current_path : string = this.settings.mySetting;

		this.makeFolder(root_path,current_path,this.makeRootTechniqueFileContent(Array.from(technique_map.keys()))); //make root folder

		current_path = root_path+'/'+current_path;
		
		technique_map.forEach((cluster, m_type, map) => {
			this.makeFolder(current_path,m_type,this.makeMasteryFileContent(m_type,Array.from(cluster.keys())));
			var cluster_path = current_path+'/'+m_type;
			cluster.forEach((tech,cluster_name, map) => {
				var tech_names : Array<string> = tech.map((_m) => {return _m.name;});
				this.makeFolder(cluster_path,cluster_name,this.makeClusterFileContent(cluster_name,tech_names));
				var technique_path = cluster_path+'/'+cluster_name;
				tech.forEach((technique) => {
					this.makeFolder(technique_path,technique.name,this.makeTechniqueFileContent(technique,cluster_name));
				},this)
			});
		});

	}

	async fetchAPIData(): Promise<void> {
		new Notice('Attempting to fetch API data...');

		fetch('http://multiversewiki.com:8080/techniques')
		.then((res : any) => res.json())
		.then((json : any) => {
			this.generateFilesFromJson(json);
		});
	}
}

// class RemoriaTechniquesForObsidianModal extends Modal {
// 	constructor(app: App) {
// 		super(app);
// 	}

// 	onOpen() {
// 		const {contentEl} = this;
// 		contentEl.setText('Woah!');
// 	}

// 	onClose() {
// 		const {contentEl} = this;
// 		contentEl.empty();
// 	}
// }

class RemoriaTechniquesForObsidianSettingTab extends PluginSettingTab {
	plugin: RemoriaTechniquesForObsidian;

	constructor(app: App, plugin: RemoriaTechniquesForObsidian) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Remoria Techniques for Obsidian Settings'});

		new Setting(containerEl)
			.setName('Root File Name')
			.setDesc('This is the name of the root file')
			.addText(text => text
				.setPlaceholder('Techniques')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					console.log('RTO | Root file name: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));
	}
}

import { appendFile } from 'fs';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TAbstractFile, TFolder } from 'obsidian';
import { json } from 'stream/consumers';
import { getApi, isPluginEnabled, registerApi } from "@aidenlx/folder-note-core";
import { stringify } from 'querystring';
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

	makeNodeFile(path : string, name : string, content : string) : void {
		this.app.vault.create(path+'/'+name+'.md','#generated_by_rto_plugin '+content);
	}

	async makeFolder(path : string, name: string, noteContent? : string) : Promise<void> {
		var make_note = false;
		var truePath = path+'/'+name;
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
			this.makeNodeFile(truePath,name,noteContent);
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
				console.log("here with " +cluster_type+ " (" + tech.name + ")");
				var cluster_exists : boolean = technique_map.get(mastery_type).has(cluster_type);
				//console.log("Cluster found: "+cluster_exists);
				if (!cluster_exists) {
					console.debug("Got here instead?");
					technique_map.get(mastery_type).set(cluster_type,[tech]);
				} else {
					console.debug("Got here?");
					technique_map.get(mastery_type).get(cluster_type).push(tech);
				}
			}
		});
		console.log(technique_map);

		
		var current_path : string = this.settings.mySetting;

		this.makeFolder(root_path,current_path,this.makeRootTechniqueFileContent(Array.from(technique_map.keys()))); //make root folder

		current_path = root_path+'/'+current_path;
		
		technique_map.forEach((cluster, m_type, map) => {
			this.makeFolder(current_path,m_type,'hi');
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

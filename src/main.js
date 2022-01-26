const complexSettings = ['entities', 'state_filter'];
const entityCards = ['entities', 'glance'];

const TEMPLATER_CARD_VERSION = "0.1.0-alpha2";

import { LitElement, html, css } from "lit-element";
import { createCard, createEntityRow } from "card-tools/src/lovelace-element";
import { subscribeRenderTemplate } from "card-tools/src/templates";
import { TemplateHandler } from "./templates.js"

console.info(
  `%c  CARD-TEMPLATER  \n%c Version ${TEMPLATER_CARD_VERSION}  `,
  'color: yellow; font-weight: bold; background: navy',
  'color: white; font-weight: bold; background: black',
);

    class CardTemplater extends LitElement {
    
      setConfig(config) {
        if(!config || (!config.card && !config.entity_row))
          throw new Error("Invalid configuration");
        this._config = config;
        this.refresh = true;
        this.templateHandler = new TemplateHandler();
        this.updatePending = false;
        
        if(config.entity) this.entity = config.entity;
        
        if(config.entities){
          this.entities = this.processConfigEntities(config.entities);
        }
        else if(config.entity){
        	this.entities = this.processConfigEntities([config.entity]);
        }
        else{
          this.entities = [];
        }
        
        this.isEntityRow = !!config.entity_row;
        
        if(config.card){
        	this._cardConfig = this.getCleanConfig(config.card);
        	this.card = createCard(this._cardConfig);
        }
        else{
        	this._cardConfig = this.getCleanConfig(config.entity_row);
        	this.card = createEntityRow(this._cardConfig);
        }
        
        this.registeredTemplates = false;
        
        this.templateVariables = { 
    		user: {
    			name: null, 
				is_admin: false,
				is_owner: false
			},
			page: {
				...location,
				path: location.pathname			
			},
			theme: null
		};
        
        this.yaml = require('yaml');
      }
       
      createRenderRoot() {
        return this;
      }

      render() {
        return html`
          ${this.card}
        `;
      }
      
      static get properties() { return {
    	config: { type: Object },
    	_hass: { type: Object },
    	templateHandler: { type: Object }
  		};
  	  }
	
      updated(changedProps) {
    	super.updated(changedProps);
  	  }
	  
	  async connectedCallback() {
    	super.connectedCallback();
    	if(this.templateHandler){
    		await this.templateHandler.subscribe();
    	}
  	  }
  
	  async disconnectedCallback() {
	    if(this.templateHandler){
    		await this.templateHandler.unsubscribe();
    	}
  	  }
  	  
      processConfigEntities(entities) {
        if(!entities) return [];
        
        if (!Array.isArray(entities)) {
          throw new Error("Entities need to be an array");
        }
        
      return entities.map((entityConf, index) => {
        if (
              typeof entityConf === "object" &&
              !Array.isArray(entityConf) &&
              entityConf.type
            )
          {
              return entityConf;
          }
        if (typeof entityConf === "string") {
              entityConf = { entity: entityConf };
          } else if (typeof entityConf === "object" && !Array.isArray(entityConf)) {
              if (!entityConf.entity) {
                throw new Error(
                    `Entity object at position ${index} is missing entity field.`
                );
              }
          } else {
              throw new Error(`Invalid entity specified at position ${index}.`);
          }
        return entityConf;
        });
    }
	
	 getMockedState(stateObj, state, attributes){
  		var newStateObj = {};
  		Object.assign(newStateObj, stateObj);
  		newStateObj.attributes = {};
  		Object.assign(newStateObj.attributes, stateObj.attributes);
  		
  		if(state) {
  			newStateObj.state = state;
  		}
  		
  		if(attributes) {
  			Object.assign(newStateObj.attributes, attributes);
  		}
  		
  		return newStateObj;
  	}
  
     async applyStateTemplates() {
        if(this._mockHass) {
          for(const entityConf of this.entities) {
            if(entityConf.state_template || entityConf.attributes) {
              let stateObj = this._hass.states[entityConf.entity];
              if(stateObj) {
              	let state = entityConf.state_template ? this.templateHandler.getTemplateResult(entityConf.state_template) : null;
              	let attributes = entityConf.attributes ? await this.getCardConfig(entityConf.attributes) : null;
              	let mockState = this.getMockedState(stateObj, state, attributes);
                this._mockHass.states[entityConf.entity] = mockState;
              }
            }
          }
        }
     }
     
     async registerStateTemplates(hass) {
     	let entity_ids = (this.entities && this.entities.map(i => i.entity).join()) || [];
        for(const entityConf of this.entities) {
        	if(entityConf.state_template || entityConf.attributes) {
            	if(entityConf.state_template){
              		this.templateHandler.registerTemplate(entityConf.state_template, this.templateVariables, entity_ids, () => { this.updatePending = true; }, hass.connection);
            	}
            	if(entityConf.attributes){
            		this.registerConfigTemplates(entityConf.attributes, hass);
            	}
        	}
    	}
	}
	

	 set isPanel(isPanel){ 	
	 	this._isPanel = isPanel;
	 }
	 
	 updateTemplateVariables(){
	 	this.templateVariables.user.name = this._hass.user.name;
    	this.templateVariables.user.is_admin = this._hass.user.is_admin;
    	this.templateVariables.user.is_owner = this._hass.user.is_owner;
    	Object.assign(this.templateVariables.page, location);
    	this.templateVariables.page.path = location.pathname;
    	this.templateVariables.theme = this._hass.selectedTheme ? this._hass.selectedTheme : this._hass.themes.default_theme;
	 }
	 
     set hass(hass) {
        this.oldStates = this._hass != null ? this._hass.states : {};

        this._hass = hass;
        
        let mockedEntityIds = (this.entities && this.entities.filter(i => i.state_template || i.attributes).map(i => i.entity).join()) || [];
        
        let existingStates = this._mockHass ? this._mockHass.states : [];
        
        this._mockHass = {};
        Object.assign(this._mockHass, hass);
        this._mockHass.states = JSON.parse(JSON.stringify(this._hass.states));
    	
    	this.updateTemplateVariables();
    	
    	if(!this.registeredTemplates){
    		let rawConfig = this._config.card || this._config.entity_row;
    		this.registerConfigTemplates(rawConfig, hass);
    		this.registerStateTemplates(hass);
    		this.registeredTemplates = true;
    	}
		
        if(this.card)
        { 
          if(this.updatePending)
          {
          	this.updatePending = false;
        	this.getCardConfig(this._config.card ? this._config.card : this._config.entity_row).then(config =>{
              this.applyStateTemplates().then(() => {
                  this._cardConfig = config;
                  this.card = createCard(this._cardConfig);
                  setTimeout(() => {
                  	this.card.isPanel = (this._isPanel == true);
                  	this.card.hass = this._mockHass;
                    this.requestUpdate();
                  }, 100);
                });
            });
          }
          else{
            // Combine previously mocked states with any new state updates
            
            var mockedKeys = Object.keys(existingStates).filter(i => mockedEntityIds.includes(i));
            
            const newStates = Object.keys(this._mockHass.states)
  				.filter(key => !mockedKeys.includes(key))
  				.reduce((obj, key) => {
    				obj[key] = this._mockHass.states[key];
    				return obj;
  				}, {});
            
            this._mockHass.states = { ...existingStates,  ...newStates};
            this.card.isPanel = (this._isPanel == true);
            this.card.hass = this._mockHass;
            
            this.requestUpdate();
          }
        }
      }
      
      getCleanConfig(rawConfig, topLevel = true) {
        var cardConfig = rawConfig instanceof Array ? [] : {};
        for (const [original_key, original_value] of Object.entries(rawConfig)) {
            let key = original_key;
            let value = original_value;
            
            if(key.endsWith("_template")){
                key = key.replace(/^(.*)_template$/,"$1");
                if(key == "entity"){
                  return null;
                }
                else if(complexSettings.includes(key)){
                  value = [];
                }
                else if(key == "type"){
                  value = "entities"; // Avoid issues if templating card type
                }
                else{
                  value = "-";
                }
            }
            else if(key.endsWith("_template!")){
                key = key.replace(/^(.*_template)!$/,"$1");
            }
            
            if(typeof value === "object"){
              let isArray = (value instanceof Array);  
              value = this.getCleanConfig(value, false);
              
              if(isArray){
                let new_value = [];

                for(const [item_index, item_value] of Object.entries(value)){
                  if(item_value["string"]) {
                    new_value[item_index] = item_value["string"]
                  }
                  else{
                    new_value[item_index] = item_value;
                  }
                }

                value = new_value;
              }
            }
            
            if(value != null){
              cardConfig[key] = value;
            }
          }
        
        if(topLevel){
        	if(this.isEntityRow){
        		if(!cardConfig.entity) cardConfig.entity = this.entity;
        	}
        	else if(cardConfig.type && entityCards.includes(cardConfig.type) && !cardConfig.entities) {
        		cardConfig.entities = this.entities;
        	}
        }
        
        return cardConfig;
    }
    
    registerConfigTemplates(rawConfig, hass){
        var cardConfig = rawConfig instanceof Array ? [] : {};
        let entity_ids = (this.entities && this.entities.map(i => i.entity).join()) || [];
        for (const [original_key, original_value] of Object.entries(rawConfig)) {
            let key = original_key;
            let value = original_value;
            
            if(key.endsWith("_template")){
                this.templateHandler.registerTemplate(value, this.templateVariables, entity_ids, () => { this.updatePending = true; }, hass.connection);
            }
            
            if(typeof value === "object"){
              this.registerConfigTemplates(value, hass);
            }
        }
    }
    
    async getCardConfig(rawConfig, topLevel = true){ 
        var cardConfig = rawConfig instanceof Array ? [] : {};
        for (const [original_key, original_value] of Object.entries(rawConfig)) {
            let key = original_key;
            let value = original_value;
            
            if(key.endsWith("_template")){
                
                key = key.replace(/^(.*)_template$/,"$1");
                if(this._hass && value){
                    value = this.templateHandler.getTemplateResult(value);
                    
                    if(value == 'null' || value == 'None'){ 
                    	value = null;
                    }
                    
                    if(value != null && (typeof value === "string" || value instanceof String)){
                    	// Special processing for string types (when using legacy templates)               	
                    	let lowerCaseValue = value.toLowerCase();
                    	if(lowerCaseValue == "true" || lowerCaseValue == "false"){ // Special processing for "true"/"false" values
                    		value = (lowerCaseValue == "true");
                    	}
                    	else if(complexSettings.includes(key))
                    	{
                    		value = (this.yaml) ? this.yaml.parse(value) : null;
                      	} else if(/^[-]?\d+(\.\d+)?(e-?\d+)?$/.test(value)) { // Special processing for numbers
                        	value = parseFloat(value);
                      	}
                    }                  
                }
                          
                if(!this._hass || (typeof value === 'undefined' || value === null)){
                  if(key == "entity"){
                    return null;
                  }
                  else if(key == "type"){
                    value = "entities"; // Avoid issues if templating card type
                  }
                  else if(complexSettings.includes(key)){
                    value = [];
                  }
                  else{
                    value = "-";
                  }
                }
            }
			else if(key.endsWith("_template!")){
                key = key.replace(/^(.*_template)!$/,"$1");
            }
            
            if(typeof value === "object"){
                
              let isArray = (value instanceof Array);  
              value = await this.getCardConfig(value, false);
              
              if(isArray){
                let new_value = [];

                for(const [item_index, item_value] of Object.entries(value)){
                  if(item_value["string"]) {
                    new_value[item_index] = item_value["string"]
                  }
                  else{
                    new_value[item_index] = item_value;
                  }
                }
                value = new_value;
              }
            }
            
            if(value != null){
              cardConfig[key] = value;
            }
          }
        
        if(topLevel){
        	if(this.isEntityRow){
        		if(!cardConfig.entity) cardConfig.entity = this.entity;
        	}
        	else if(cardConfig.type && entityCards.includes(cardConfig.type) && !cardConfig.entities) {
        		cardConfig.entities = this.entities;
        	}
        }
        
        return cardConfig;
      }
    }
    
    customElements.define('card-templater', CardTemplater);
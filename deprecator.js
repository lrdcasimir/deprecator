/**
 * A CSS Deprecator, scans the DOM for elements consuming deprecated styles and marks them with a visible stamp in the browser
 *
 * Usage: 
 *   var deprecator = new CSSDeprecator();
 *   deprecator.deprecateCSSFile("deprecator.css");
 *   deprecator.showDeprecatedStamps();
 *
 * TODO Support for deprecating multiple CSS files.
 */
 
var CSSDeprecator = function(){
		
	this.stylesheets = document.styleSheets;
	this.deprecatedRules = [];
	this.validRules = [];
	this.allRules = {};
	this.specificityIndex = [];
			
	
	
	var computeSelectorSpecificity = function (selectorText) {
		var idPattern     = new RegExp("[#][^#\\.\\s]+", "g");
		var classPattern  = new RegExp("([\.][^#\.\s]+)", "g")
		var tagPattern    = new RegExp("(^|\\s)[^#\\.]+(\\s|$)", "g");
		var specificity   = 0;
		var matches       = [];
		while(matches = idPattern.exec(selectorText)){
			specificity += 100;
		}
		while(matches = classPattern.exec(selectorText)){
			specificity += 10;
		}
		while(matches = tagPattern.exec(selectorText)){
			specificity += 1;
		}
		return specificity;
	}
	
	var compareSpecificity = function(selectorA, selectorB){
		if(selectorA.specificity == undefined 
			|| selectorB.specificity == undefined){
			return null;
		}
		return selectorA.specificity - selectorB.specificity;
	}

	/**
	 * Build a sorted array of selectors by specificity
	 * This allows non-deprecated selectors with higher 
	 * specificity to override deprecated rules.
	 **/
	this.sortIndices = function(){
		this.specificityIndex.sort(compareSpecificity);
	}
	
	/**
	 * Parse all stylesheets and mark deprecated rules
	 */
	this.parseStylesheets = function(cssFilename){
		var instance = this;
		$.each(instance.stylesheets, function (i, sheet) {
		    if(sheet.href.indexOf(cssFilename) != -1){
		        instance.deprecatedRules.push.apply(instance.deprecatedRules, 
					sheet.cssRules);
		    } else {
		    	instance.validRules.push.apply(instance.validRules, 
					sheet.cssRules);
		    }
		});
	};
	
	this.analyzeDeprecatedStyles = function () {
		var instance = this;
		$.each(instance.deprecatedRules, function (i, rule) {
			//split grouped selectors to accurately compute specificity
			var ruleSelectors = rule.selectorText.split(",");
			$.each(ruleSelectors, function(i, selector){
				var selectorText = selector.trim();
				instance.allRules[selectorText] = {};
			    instance.allRules[selectorText].elem = $(selectorText);
				instance.allRules[selectorText].rule = rule;
				instance.allRules[selectorText].properties = {};
				instance.allRules[selectorText].specificity 
					= computeSelectorSpecificity(selectorText);
				instance.allRules[selectorText].deprecated = true;
				instance.allRules[selectorText].selectorText = selectorText; 
				instance.specificityIndex.push(instance.allRules[selectorText]);
			
				var itemIndex = 0;
				while(itemIndex < rule.style.length){
					var itemBlock = function (property){
						instance.allRules[selectorText].properties[property] = 
							rule.style.getPropertyValue(property);
					}(rule.style[itemIndex++]);
				}
			})
		});
	};
	
	this.analyzeValidStyles = function () {
		var instance = this;
		$.each(this.validRules, function(i, rule){
			//split grouped selectors to accuratele compute specificity
			var selectors = rule.selectorText.split(",");
			$.each(selectors, function(i, selector){
				var selectorText = selector.trim();
				//if a selector matches a deprecated selector exactly
				//then undeprecate duplicated properties
				if(instance.allRules[rule.selectorText] != undefined 
					&& instance.allRules[rule.selectorText].deprecated == true){
					var itemIndex = 0;
					while(itemIndex < rule.style.length){
						var itemBlock = function (prop) {
							if(instance.allRules[rule.selectorText].properties[prop]
								 != undefined){
								delete instance.allRules[rule.selectorText].properties[prop];
							}
						}(rule.style[itemIndex++]);
					}
				} else {
					instance.allRules[selectorText] = {};
				    instance.allRules[selectorText].elem = $(selectorText);
					instance.allRules[selectorText].rule = rule;
					instance.allRules[selectorText].properties = {};
					instance.allRules[selectorText].specificity 
						= computeSelectorSpecificity(selectorText);
					instance.allRules[selectorText].deprecated = false;
					instance.allRules[selectorText].selectorText = selectorText; 
					instance.specificityIndex.push(instance.allRules[selectorText]);
					
					var itemIndex = 0;
					while(itemIndex < rule.style.length){
						var itemBlock = function (property){
							instance.allRules[selectorText].properties[property] = 
								rule.style.getPropertyValue(property);
						}(rule.style[itemIndex++]);
					}
				}
			});
		});
	};
	
	/**
	 * Apply overlay to any elements still considered "consumes_deprecated" 
	 * after all styles have been parsed
	 */
	this.stampDeprecatedElements = function () {
		$(".consumes_deprecated").css("position", "relative");
		var deprecatedOverlay = $("<div class=\"deprecated-overlay\">"+
		"<div class=\"banner\">This element consumes deprecated styles!</div></div>");
		deprecatedOverlay
		.css("background-color", "#000")
		.css("opacity", "0.4")
		.css("position", "absolute")
		.css("font-size", "11px")
		.css("left","0px")
		.css("top", "0px")
		.css("padding", ".9em");
		deprecatedOverlay.find(".banner")
		.css("webkit-transform","rotate(5deg)")
		.css("moz-transform", "rotate(5deg)")
		.css("ms-transform", "rotate(5deg)")
		.css("transform", "rotate(5deg)")
		.css("background-color", "#EE2222");;
		$(".consumes_deprecated").append(deprecatedOverlay);
	};
	
	/**
	 * Iterate selectors by specificity and apply "consumes_deprecated" as necessary
	 */
	this.computeDeprecatedConsumers = function () {
		var instance = this;
		$.each(instance.specificityIndex, function(index, ruleTuple){
			var selector = ruleTuple.selectorText;
			ruleTuple.rule;
			//check elements for style equal to deprecated properties
			ruleTuple.elem.each(function(i,htmlElem){
				var itemIndex = 0;
				var eStyle = window.getComputedStyle(htmlElem);
				var deprecated_properties =
					 $(htmlElem).data("deprecated_properties") || {};
				while(itemIndex < eStyle.length){
					var itemBlock = function (prop) {
						if(ruleTuple.properties[prop] != undefined && 
							eStyle.getPropertyValue(prop) == ruleTuple.properties[prop] &&
							ruleTuple.deprecated == true){
								console.log("deprecated property:" + prop + " with spec "
								+ ruleTuple.specificity);
								$(htmlElem).addClass("consumes_deprecated");
								deprecated_properties[prop] = true;
						} else if(ruleTuple.properties[prop] != undefined &&
							deprecated_properties[prop] != undefined &&
							ruleTuple.deprecated == false) {
								console.log("overriding deprecated:"  + prop + " with spec "
								+ ruleTuple.specificity);
								delete deprecated_properties[prop];
								if(Object.keys(deprecated_properties).length < 1){
									$(htmlElem).removeClass("consumes_deprecated");
								}
						}
					}(eStyle[itemIndex++]);
				}
				$(htmlElem).data("deprecated_properties", deprecated_properties);
			});
		});	
	};
};

CSSDeprecator.prototype.deprecateCSSFile= function(cssFilename){
	this.parseStylesheets(cssFilename);
};

CSSDeprecator.prototype.showDeprecatedStamps = function(){
	this.analyzeDeprecatedStyles();
	this.analyzeValidStyles();
	this.sortIndices();
	this.computeDeprecatedConsumers();
	this.stampDeprecatedElements();
};




$(document).ready(function(){
	var deprecator = new CSSDeprecator();
	deprecator.deprecateCSSFile("deprecator.css");
	deprecator.showDeprecatedStamps();
	
});


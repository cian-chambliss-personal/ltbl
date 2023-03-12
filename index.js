const chalk = require("chalk");
const { get } = require("http");
const { resolve } = require("path");
const { off } = require("process");

module.exports = function ltbl(settings) {
    /*
      State machine for parseCommand

      stateMachine = {
         state : 0 , // index
         execute : function(statemachine,command) {
                // return "retry";
                // return "abort";
                return "next";
            
         }
      }
     */
    var Game = require('./Game');
    var singleton = { 
        chalk: chalk,
        settings : settings,
        outputText: function(txt) {
            console.log(txt);
        },
        game: new Game(settings),
        stateMachine : null,
        godGame: null,
        helper: require("./helper.js")({spellCorrect:settings.spellCorrect}),
        render: function() {} ,
        defineLocation: function() {},
        describeLocation: function() {},
        describeItem: function() {},
        lookupItem :  function() {},
        lookupItemArr : function() {},
        lookupItemLow :  function() {},
        findItems:  function() {},
        removeItem:  function() {},
        setLocationType: function() {},
        findNPC : function() {},
        findNPCs: function() {},
        describeNPC : function() {},
        defineScript : function() {},
        processScript : function() {},
        processAction: function() {},
        getConvoObjectPtr: function() {},
        thenDo : function() {},
        orDo : function() {},
        scoreDo: function() {},
        navigate: function() {},
        dontSee : function() {} , 
        dontSeeNpc : function() {} , 
        noUnderstand : function() {} , 
        noCareAbout : function() {},
        resources: require("./en-resources.json") ,
        annotate : function(expr) {
            if( singleton.game.pov.isGod ) {
                singleton.game.annotations.push(expr);
                return singleton.helper.superScript(""+singleton.game.annotations.length);
            }
            return "";
        },
        doAnnotation : function() {
        },
        spellCorrectText : function(description) {
            var parts = singleton.helper.getPartsOfSpeech(description,false,true);
            if( parts.mispelled.length > 0 ) {
                for(var i = 0; i < parts.mispelled.length ; ++i ) {
                    description = (" "+description+" ").split(" "+parts.mispelled[i].word+" ").join(chalk.red(" "+parts.mispelled[i].word+" ")).trim();
                }
            }
            return description;
        },
        spellcheckedText : function() {
        },
        directionsNames :["s","n","e","w","u","d","sw","se","nw","ne"],
        directionsHash: {
            "s": { primary: "s" },
            "n": { primary: "n" },
            "e": { primary: "e" },
            "w": { primary: "w" },
            "u": { primary: "u" },
            "d": { primary: "d" },
            "sw": { primary: "sw" },
            "se": { primary: "sw" },
            "nw": { primary: "nw" },
            "ne": { primary: "ne" },
            "south": { primary: "s" },
            "north": { primary: "n" },
            "east": { primary: "e" },
            "west": { primary: "w" },
            "up": { primary: "u" },
            "down": { primary: "d" },
            "southwest": { primary: "sw" },
            "southeast": { primary: "sw" },
            "northwest": { primary: "nw" },
            "northeast": { primary: "ne" },
            "south west": { primary: "sw" },
            "south east": { primary: "sw" },
            "north west": { primary: "nw" },
            "north east": { primary: "ne" },
            "in" : { primary: "i" },
            "out" : { primary: "o" }
        },
        isDirection : function (command) {
            return singleton.directionsHash[command];
        },
        invalidateMap: function() {}
    };
    //  Wire it up 
    singleton.stateMachine = require("./state-machine")({output : function(txt) {
        singleton.outputText(txt);
    }});
    singleton.render = require("./render-location.js")(singleton).render;
    singleton.defineLocation = require("./define-location.js")(singleton).locationDefine;
    var describeLocationIface = require("./describe-location.js")(singleton);
    singleton.describeLocation = describeLocationIface.describeLocation;
    singleton.setLocationType = describeLocationIface.setLocationType;
    singleton.describeItem = require("./describe-item.js")(singleton).describeItem;
    var itemIface = require("./item.js")(singleton);
    singleton.lookupItem = itemIface.lookupItem;
    singleton.lookupItemArr = itemIface.lookupItemArr;
    singleton.lookupItemLow = itemIface.lookupItemLow;
    singleton.findItems = itemIface.findItems;
    singleton.removeItem = itemIface.removeItem;
    var npcIface = require("./npc.js")(singleton);
    singleton.findNPC  = npcIface.findNPC;
    singleton.findNPCs = npcIface.findNPCs;
    singleton.describeNPC = npcIface.describeNPC;
    var scriptIface = require("./script.js")(singleton);
    singleton.defineScript = scriptIface.defineScript;
    singleton.processScript = scriptIface.processScript;
    singleton.processAction = scriptIface.processAction;
    singleton.getConvoObjectPtr = scriptIface.getConvoObjectPtr;
    singleton.thenDo = scriptIface.thenDo;
    singleton.orDo = scriptIface.orDo;
    singleton.scoreDo = scriptIface.scoreDo;
    singleton.navigate = require("./navigate.js")(singleton).navigate;
    var cantSeeIface = require("./cant-see.js")(singleton);
    singleton.dontSee = cantSeeIface.dontSee; 
    singleton.dontSeeNpc = cantSeeIface.dontSeeNpc;
    singleton.noUnderstand = cantSeeIface.noUnderstand;
    singleton.noCareAbout = cantSeeIface.noCareAbout;
    singleton.invalidateMap = function() {
        singleton.game.map = null;
        singleton.render(singleton.game.getLocation(singleton.game.pov.location),singleton.game.pov.location, 0);
    };
    singleton.spellcheckedText = require("./spellcheck-text")(singleton).spellcheckedText;
    singleton.doAnnotation = require("./annotation.js")(singleton).doAnnotation;
    var stateMachineFillin = singleton.stateMachine.fillin;
    var stateMachineFillinStart = singleton.stateMachine.fillinStart;
    var stateMachineFillinCreate = singleton.stateMachine.fillinCreate;
    var fs = require("fs");
    var helpText = require("./en-help.json");
    var camelCase = singleton.helper.camelCase;
    var extractNounAndAdj = singleton.helper.extractNounAndAdj;
    var extractScalar = singleton.helper.extractScalar;
    var isVerb = singleton.helper.isVerb;
    var singularFromPlural = singleton.helper.singularFromPlural;
    var pluralFromSingular = singleton.helper.pluralFromSingular;
    //---------------------------------------------------------------------------

   
    
    var voids = require("./void-location.js")();
    var godCommandPatterns = require("./god-commands.js")(singleton).godCommandPatterns;
    var commandPatterns =  require("./commands.js")(singleton).commandPatterns;
   
    var parseArg = function(game,pattern,findPatternArgs,argName,name,origCommand) {
        var objName = null;
        var argArr = pattern.match[argName];
        var checkNPC = false;
        if( !Array.isArray(argArr) ) {
            argArr = [argArr];
        }
        for( var i = 0 ; i < argArr.length ; ++i ) {
            var argType = argArr[i];
            if( argType == "name" || argType == "topic" ) {
                // Just use name (will be resolved late)            
                findPatternArgs[argName] = name;
                if( argArr.length > 1 ) {
                    findPatternArgs[argName+"Type"] = argType; 
                }
                return true;
            } else if( argType == "npc" || argType == "createnpc" ) {
                objName = singleton.findNPCs(name);
                if( objName.length == 1 ) {
                    objName = objName[0];
                    findPatternArgs[argName] = objName;
                    if( argArr.length > 1 ) {
                        findPatternArgs[argName+"Type"] = "npc"; 
                    }
                    return true;
                } else if( argType == "createnpc" ) {
                    // Add a state
                    if( !findPatternArgs.states ) {
                        findPatternArgs.states = [];
                    }
                    findPatternArgs[argName] = name;
                    createChoices = [{ text : 'Create new player called "'+name+'"' , value : "<createnpc>" }];
                    createChoices.push({text : 'Abort the command' , abort : true});
                    findPatternArgs.states.push({msg:(name+" does not exist"),prop:"new_"+argName,choices : createChoices });
                    if( argArr.length > 1 ) {
                        findPatternArgs[argName+"Type"] = "npc"; 
                    }
                    return true;
                } else {
                    checkNPC = true;
                }
            } else {
                if( argType == "*" || argType == "create" ) {
                    objName = singleton.lookupItem(game.pov.location,name);
                } else {
                    objName = singleton.lookupItem(game.pov.location,name,argType);
                }
                if( objName && objName != "?") {
                    findPatternArgs[argName] = objName;
                    if( argArr.length > 1 ) {
                        findPatternArgs[argName+"Type"] = "item"; 
                    }
                    return true;
                } else if( !objName ) {
                    if( argType == "create" ) {
                        // Add a state
                        if( !findPatternArgs.states ) {
                            findPatternArgs.states = [];
                        }
                        findPatternArgs[argName] = name;
                        var createChoices = null;
                        if( findPatternArgs[argName+"Scalar"]) {
                            createChoices = [{ text : 'Create a new object type for "'+name+'"' , value : "<createtype>" }]; 
                        } else {
                            createChoices = [{ text : 'Create new object for "'+name+'"' , value : "<create>" }];
                            // If items 
                            var findAll = singleton.lookupItem(game.pov.location,"{*}").split("\n");
                            if( findAll && findAll.length > 0 ) {
                                if( findAll.length > 1 ) {
                                    var subChoices = [];
                                    for( var i = 0 ; i < findAll.length ; ++i ) {
                                        subChoices.push({text : 'Alias for '+game.getItem(findAll[i]).name , value : findAll[i] });
                                    }
                                    subChoices.push({text : 'Return to top' , abort : true });
                                    createChoices.push({text : 'Object is Alias', msg : 'Object '+name, choices : subChoices });
                                } else if( findAll[0] && findAll[0] != '' ){
                                    createChoices.push({text : 'Alias for '+game.getItem(findAll[0]).name , value : findAll[0] });
                                }
                            }
                        }               
                        createChoices.push({text : 'Abort the command' , abort : true});
                        findPatternArgs.states.push({msg:(name+" does not exist"),prop:"new_"+argName,choices : createChoices });
                        if( argArr.length > 1 ) {
                            findPatternArgs[argName+"Type"] = "item"; 
                        }
                        return true;
                    }
                }
            }
        }
        if( checkNPC )
           singleton.dontSeeNpc(name,game.pov.location,origCommand); 
        else               
           singleton.dontSee(name,game.pov.location,origCommand);
        return false;
    };

    var nullPatternHandler = { eval : function() {} };
    var parseTemplate = function(def) {
        var tmpl = [];
        def = def.split("[");
        for( var i = 0 ; i < def.length ; ++i ) {
            if( def[i].length ) {
                if( i == 0 ) {
                    tmpl.push(def[i]);
                } else {
                    var sep = def[i].indexOf("]");
                    if( sep > 0 ) {
                        var partName = def[i].substring(0,sep);
                        var placeholder;
                        var typeIndex = partName.indexOf(":"); 
                        if( typeIndex > 0 ) {
                            placeholder = { part : partName.substring(0,typeIndex) , type : partName.substring(typeIndex+1) };
                        } else {
                            placeholder = { part : partName };
                        }
                        tmpl.push( placeholder );
                        sep = def[i].substring(sep+1);
                        if( sep.length ) {
                            tmpl.push(sep);
                        }
                    }
                }
            }
        }
        return tmpl;
    };
    var lookupCommandHandle = function(commands,cmd,findPatternArgs) {
        var findPattern = null;
        var firstWord = cmd.firstWord;
        var command = cmd.command;
        var origCommand = cmd.origCommand;
        var game = singleton.game;
        for( var i = 0 ; i < commands.length ; ++i ) {
            var _pattern =  commands[i];
            var preposition = null;
            var matchVerb = false;

            if( typeof(_pattern.match) == "string" ) {
                _pattern.match = parseTemplate(_pattern.match);
            }
            if( Array.isArray(_pattern.match) ) {
                var matched = true;
                var lastOffset = undefined;
                var fields = {};
                var pendingField = null;
                for( var j = 0 ; j < _pattern.match.length ; ++j ) {
                    if( typeof(_pattern.match[j]) == "string" ) {
                        var offset = command.indexOf(_pattern.match[j],lastOffset);
                        if( offset < 0 ) {
                            matched = false;
                            break;
                        } else {
                            if( pendingField ) {
                                if( lastOffset ) {
                                    fields[pendingField] = command.substring(lastOffset,offset).trim();
                                } else {
                                    fields[pendingField] = command.substring(0,offset).trim();
                                }
                                pendingField = null;
                            }
                            lastOffset = offset + _pattern.match[j].length;
                        }
                     } else {
                        pendingField = _pattern.match[j].part;
                    }
                }
                if( matched ) {
                    var patternTypes = {};
                    for( var j in fields ) {
                        findPatternArgs[j] = fields[j];
                    }
                    findPattern = _pattern;
                    if( pendingField ) {
                        fields[pendingField] = command.substring(lastOffset,offset).trim();
                    }
                    for( var j = 0 ; j < _pattern.length ; ++j  ) {
                        if( typeof(_pattern.match[j]) != "string" ) {
                            if( _pattern.match[j].type ) {
                                patternTypes[ _pattern.match[j].part ] = _pattern.match[j].type;
                                if( !parseArg(game,patternTypes,findPatternArgs,_pattern.match[j].part,fields[_pattern.match[j].part],origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }
                            }
                        }
                    }
                    break;
                }
            } else {
                if( Array.isArray(_pattern.match.verb) ) {
                    for( var j = 0 ; j < _pattern.match.verb.length ; ++j ) {
                        if( _pattern.match.verb[j] == firstWord ) {
                            findPatternArgs.verb = firstWord;
                            matchVerb = true;
                            break;
                        } 
                    }
                } else if( _pattern.match.verb == firstWord ) {
                    matchVerb = true;
                }
                if( matchVerb ) {
                    var object1 = singleton.helper.subSentence( command , 1) , object2;
                    if( _pattern.match.article ) {
                        var aList = [];
                        for(var j = 0 ; j < _pattern.match.article.length ; ++j ) {
                            if( _pattern.match.article[j] == " " ) {
                                if( object1.indexOf( " " ) ) {
                                    aList.push(" ");
                                }
                            } else if( object1.indexOf( " " + _pattern.match.article[j] + " ") >= 0 ) {
                                aList.push(" " + _pattern.match.article[j] + " ");
                                break;
                            }
                        }
                        var wList = singleton.helper.splitOnOneOf( object1 , aList );
                        if( wList.length > 1 ) {
                            findPatternArgs.article = aList[0];
                            object1 = wList[0];
                            wList[0] = "";
                            object2 = wList.join(" ").trim();
                            if( _pattern.match.subject ) {
                                if( !parseArg(game,_pattern,findPatternArgs,"subject",object1,origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }
                                if( _pattern.match.iObj ) {
                                    if( !parseArg(game,_pattern,findPatternArgs,"iObj",object2,origCommand) ) {
                                        findPattern = nullPatternHandler;
                                        break;
                                    }
                                    findPatternArgs.preposition = preposition;
                                    findPattern = _pattern;
                                    break;
                                } else if( _pattern.match.dObj ) {
                                    if( _pattern.match.dObjScalar ) {
                                        var es = extractScalar(object2,origCommand);
                                        object2 = es.obj;
                                        findPatternArgs.dObjScalar = es.scalar;
                                    }
                                    if( !parseArg(game,_pattern,findPatternArgs,"dObj",object2,origCommand) ) {
                                        findPattern = nullPatternHandler;
                                        break;
                                    }
                                    findPatternArgs.preposition = preposition;
                                    findPattern = _pattern;
                                    break;
                                }
                            } else if( _pattern.match.dObj ) {
                                if( _pattern.match.dObjScalar ) {
                                    var es = extractScalar(object1,origCommand);
                                    object1 = es.obj;
                                    findPatternArgs.dObjScalar = es.scalar;
                                }
                                if( !parseArg(game,_pattern,findPatternArgs,"dObj",object1,origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }
                                if( _pattern.match.iObj ) {
                                    if( !parseArg(game,_pattern,findPatternArgs,"iObj",object2,origCommand) ) {
                                        findPattern = nullPatternHandler;
                                        break;
                                    }
                                    findPatternArgs.preposition = preposition;
                                    findPattern = _pattern;                                            
                                    break;
                                }
                            }
                        }
                    } else if( _pattern.match.preposition ) {
                        preposition = null;
                        if( Array.isArray(_pattern.match.preposition) ) {                                
                            for( var j = 0 ; j < _pattern.match.preposition.length ; ++j ) {
                                var sep = command.indexOf(" "+_pattern.match.preposition[j]+" ");
                                if( sep > 0 ) {
                                    preposition = _pattern.match.preposition[j];
                                    break;
                                }
                            }
                        } else {
                            preposition = _pattern.match.preposition;
                        }
                        if( preposition ) {
                            var sep = object1.indexOf(" "+preposition+" ");
                            if( sep > 0 ) {
                                object2 = object1.substring(sep+preposition.length+2);
                                object1 = object1.substring(0,sep);
                                if( _pattern.match.subject ) {
                                    if( !parseArg(game,_pattern,findPatternArgs,"subject",object1,origCommand) ) {
                                        findPattern = nullPatternHandler;
                                        break;
                                    }
                                    if( _pattern.match.iObj ) {
                                        if( !parseArg(game,_pattern,findPatternArgs,"iObj",object2,origCommand) ) {
                                            findPattern = nullPatternHandler;
                                            break;
                                        }
                                        findPatternArgs.preposition = preposition;
                                        findPattern = _pattern;
                                        break;
                                    } else if( _pattern.match.dObj ) {
                                        if( _pattern.match.dObjScalar ) {
                                            var es = extractScalar(object2,origCommand);
                                            object2 = es.obj;
                                            findPatternArgs.dObjScalar = es.scalar;
                                        } 
                                        if( !parseArg(game,_pattern,findPatternArgs,"dObj",object2,origCommand) ) {
                                            findPattern = nullPatternHandler;
                                            break;
                                        }
                                        findPatternArgs.preposition = preposition;
                                        findPattern = _pattern;
                                        break;
                                    }
                                } else if( _pattern.match.dObj ) {
                                    if( _pattern.match.dObjScalar ) {
                                        var es = extractScalar(object1,origCommand);
                                        object1 = es.obj;
                                        findPatternArgs.dObjScalar = es.scalar;
                                    }
                                    if( !parseArg(game,_pattern,findPatternArgs,"dObj",object1,origCommand) ) {
                                        findPattern = nullPatternHandler;
                                        break;
                                    }
                                    if( _pattern.match.iObj ) {
                                        if( !parseArg(game,_pattern,findPatternArgs,"iObj",object2,origCommand) ) {
                                            findPattern = nullPatternHandler;
                                            break;
                                        }
                                        findPatternArgs.preposition = preposition;
                                        findPattern = _pattern;                                            
                                        break;
                                    }
                                }
                            } else if( _pattern.match.dObj 
                                && !_pattern.match.iObj
                                && !_pattern.match.subject
                                    ) {
                                        if( _pattern.match.dObjScalar ) {
                                            var es = extractScalar(object1,origCommand);
                                            object1 = es.obj;
                                            findPatternArgs.dObjScalar = es.scalar;
                                        }
                                    if( !parseArg(game,_pattern,findPatternArgs,"dObj",object1,origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }                            
                                findPatternArgs.preposition = preposition;
                                findPattern = _pattern;
                                break;                
                            } else if( !_pattern.match.dObj 
                                    && !_pattern.match.iObj
                                    && _pattern.match.subject
                                    ) {
                                if( !parseArg(game,_pattern,findPatternArgs,"subject",object1,origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }                            
                                findPatternArgs.preposition = preposition;
                                findPattern = _pattern;
                                break;                
                            } else {
                                preposition = null;
                            }
                        }
                    } else if( _pattern.match.dObj ) {
                        if( _pattern.match.dObjScalar ) {
                            var es = extractScalar(object1,origCommand);
                            object1 = es.obj;
                            findPatternArgs.dObjScalar = es.scalar;
                        }
                        if( !parseArg(game,_pattern,findPatternArgs,"dObj",object1,origCommand) ) {
                            findPattern = nullPatternHandler;
                            break;
                        }                            
                        findPattern = _pattern;
                        break;
                    } else if( _pattern.match.subject ) {
                        if( !parseArg(game,_pattern,findPatternArgs,"subject",object1,origCommand) ) {
                            findPattern = nullPatternHandler;
                            break;
                        }
                        findPattern = _pattern;
                        break;
                    } else if( _pattern.match.iObj ) {
                        if( !parseArg(game,_pattern,findPatternArgs,"iObj",object1,origCommand) ) {
                            findPattern = nullPatternHandler;
                            break;
                        }                            
                        findPattern = _pattern;
                        break;
                    } else if( _pattern.match.direction ) {
                        // Verb + direction
                        if( singleton.isDirection(object1) ) {
                            findPatternArgs.direction = singleton.isDirection(object1).primary;
                            findPattern = _pattern;
                            break;    
                        } else if( object1 != "" ) {
                            singleton.outputText("Expected a direction");
                            findPattern = nullPatternHandler;
                            break;
                        }
                    } else if( object1 == "" ) {
                        // Just a verb & nothing else supplied
                        findPattern = _pattern;
                        break;
                    }
                }
            }
        }
        return findPattern;
    };

    var parseCommand = function (command) {
        var game = singleton.game;
        if( game.stateMachine ) {
            // Set of prompts....
            if( command && command.length > 0 && !game.stateMachine.aborting )
               game.logCommand(command);
            var saveStatemachine = game.stateMachine;  
            var res = game.stateMachine.execute(game.stateMachine,command);
            if( res == "next") {
                game.stateMachine.state = game.stateMachine.state + 1;
            } else if( res != "retry" && saveStatemachine == game.stateMachine)
                game.stateMachine = null;
            return true;    
        } else {
            var origCommand = command;
            var lCase = command;
            lCase = lCase.toLowerCase();
            var lCaseWords =  lCase.split(" ");
            var firstWord = lCaseWords[0].trim(); 
            var firstPhrase = null;
            if( command && command.length > 0 )
               game.logCommand(command);
            if( game.pov ) {
                if( game.pov.isGod ) {
                    if( singleton.resources.godWordMap.firstWord[firstWord] ) {
                        firstWord = singleton.resources.godWordMap.firstWord[firstWord];
                    }
                    if( lCaseWords.length > 0 ) {
                        firstPhrase =  singleton.resources.godWordMap.firstTwoWord[lCaseWords[0]+" "+lCaseWords[1]];
                        if( firstPhrase ) {
                            command = firstPhrase+" "+singleton.helper.subSentence(command,2);
                            firstWord = firstPhrase;
                            lCase = command;
                            lCase = lCase.toLowerCase();
                            lCaseWords =  lCase.split(" ");
                        }
                    }    
                }
            }
            if( singleton.resources.wordMap.firstWord[firstWord] ) {
                firstWord = singleton.resources.wordMap.firstWord[firstWord];
            }
            // Override pattern
            if( lCaseWords.length > 0 ) {
                firstPhrase =  singleton.resources.wordMap.firstTwoWord[lCaseWords[0]+" "+lCaseWords[1]];
                if( firstPhrase ) {
                    command = firstPhrase+" "+singleton.helper.subSentence(command,2);
                    firstWord = firstPhrase;
                    lCase = command;
                    lCase = lCase.toLowerCase();
                    lCaseWords =  lCase.split(" ");
                }
            }
            if( firstWord == "!quit") {
                return false;
            } else if (lCase.trim() == "") {
                singleton.outputText("Pardon?");
                singleton.describeLocation();
            } else {                
                var findPatternArgs = {};
                var cmd = { firstWord : firstWord , command : command , origCommand : origCommand };
                var findPattern = null;
                if( game.pov.isGod ) {
                    findPattern = lookupCommandHandle(godCommandPatterns,cmd,findPatternArgs);
                }
                if( !findPattern ) {
                    findPattern = lookupCommandHandle(commandPatterns,cmd,findPatternArgs);
                }
                if( findPattern ) {
                    // Pattern matches handles patterns generally
                    if( findPatternArgs.states ) {
                        // Prompt for new elements
                        findPatternArgs.pattern = findPattern;                        
                        game.stateMachine = stateMachineFillinCreate(findPatternArgs,findPatternArgs.states,function(sm) {
                            var missingObjects = false;
                            var createObjects = [];
                            var createNPCs = [];
                            var objectTypes = {};
                            for(var prop in sm.data ) {
                                if( prop.substring(0,4) == "new_") {
                                    if( sm.data[prop] ) {
                                        if( sm.data[prop] == "<create>" || sm.data[prop] == "<createtype>" ) {
                                            if( sm.data[prop] == "<createtype>" ) {
                                                objectTypes[prop.substring(4)] = true;
                                            }
                                            createObjects.push(prop.substring(4));
                                        } else if( sm.data[prop] == "<createnpc>" ) {
                                            createNPCs.push(prop.substring(4));
                                        } else {
                                            var aliasName = sm.data[prop.substring(4)];
                                            var aliasItem = game.getItem(sm.data[prop]);
                                            sm.data[prop.substring(4)] = sm.data[prop];
                                            if( !aliasItem.alias ) {
                                                aliasItem.alias = [aliasName];
                                            } else {
                                                aliasItem.alias.push(aliasName);
                                            }
                                        }
                                    } else {
                                        missingObjects = true;
                                        break;
                                    }
                                }
                            }
                            if( missingObjects ) {
                                singleton.outputText("Objects were missing, aborted...")
                            } else {
                                for(var i = 0 ; i < createObjects.length ; ++i ) {
                                    var friendlyName = sm.data[createObjects[i]];                                    
                                    var name = extractNounAndAdj(friendlyName);
                                    if( !name ) {
                                        name = friendlyName;
                                    }
                                    if( objectTypes[createObjects[i]] ) {
                                        name = singularFromPlural(name);
                                        name = game.getUniqueItemName(name,"item");
                                        game.setItem(name,{ name: name , plural : pluralFromSingular(name) , multiple : true});
                                    } else {
                                        name = game.getUniqueItemName(name,"item",game.util.calcCommonPrefix(game.pov.location,game.pov.location));
                                        game.setItem(name,{ name: friendlyName });
                                    }
                                    sm.data[createObjects[i]] = name;
                                }
                                for( var i = 0 ; i < createNPCs.length ; ++i ) {
                                    var friendlyName = sm.data[createNPCs[i]];
                                    var newNPC = friendlyName.toLowerCase().trim();
                                    _npc = {
                                        name : newNPC ,
                                        description : friendlyName ,
                                        location : game.pov.location 
                                    };
                                    game.setNpc(camelCase(newNPC),_npc);
                                    sm.data[createNPCs[i]] = newNPC;
                                }
                                // Create game.items
                                sm.data.pattern.eval(sm.data);
                            }                            
                        });
                    } else if( game.pov.isGod && findPattern.godEval ) {
                        findPattern.godEval(findPatternArgs);
                    } else {
                        findPattern.eval(findPatternArgs);
                    }                    
                } else if (singleton.isDirection(lCase)) {
                    singleton.navigate( singleton.isDirection(lCase).primary );
                } else if (lCase == "location outside" || lCase == "is outside") {                    
                    singleton.setLocationType("outside");
                } else if (lCase == "location ship" || lCase == "is ship") {
                    singleton.setLocationType("ship");
                } else if (lCase == "location dark" || lCase == "is dark") {
                    singleton.setLocationType("dark");
                } else if (lCase == "location bottomless" || lCase == "is bottomless" ) {
                    singleton.setLocationType("bottomless");
                } else if (lCase == "location inside" || lCase == "is inside" ) {
                    if( game.pov.isGod && game.pov.location ) {
                        delete game.getLocation(game.pov.location).type;
                    } else {
                        singleton.setLocationType("inside");
                    }
                } else if (lCase == "location") {
                    if (game.pov.location) {
                        if (game.getLocation(game.pov.location).type) {
                            singleton.outputText("Location is " + game.getLocation(game.pov.location).type + ".");
                        } else {
                            singleton.outputText("Location is inside.");
                        }
                    } else {
                        singleton.outputText("You are nowhere.");
                    }
                } else if( firstWord == "then") {
                    // linear script
                   singleton.thenDo(command);
                } else if( firstWord == "or" ) {
                    // alt script
                    singleton.orDo(command);
                } else if( firstWord == "score") {
                    // linear script
                    singleton.scoreDo(command);
                } else if ( game.pov.isGod && firstWord == "!dump") {
                    command = singleton.helper.subSentence( command , 1).toLowerCase();
                    if( game.pov.isGod ) {
                        if( command && command.length )
                        {
                            var list = game.findLocations(command);
                            for( var i = 0 ; i < list.length ; ++i ) {
                                singleton.outputText(chalk.bold(list[i]));
                                console.dir(game.getLocation(list[i]),{ depth : 6 , colors : true});                                
                            }
                            list = singleton.findItems(command);
                            for( var i = 0 ; i < list.length ; ++i ) {
                                singleton.outputText(chalk.bold(list[i]));
                                console.dir(game.getItem(list[i]), { depth : 6 , colors : true});
                            }
                            list = singleton.findNPCs(command);
                            for( var i = 0 ; i < list.length ; ++i ) {
                                singleton.outputText(chalk.bold(list[i]));
                                console.dir(game.getNpc(list[i]), { depth : 6 , colors : true});
                            }
                        }
                        else
                        {
                            console.dir(game.metadata, { depth : 6 , colors : true} );
                            console.dir(game.locations, { depth : 6 , colors : true} );
                            console.dir(game.npc, { depth : 6 , colors : true} );
                            console.dir(game.items, { depth : 6 , colors : true} );
                        }
                    }
                } else if ( game.pov.isGod && firstWord == "nocare") {
                    // test 'I don't care for a room
                    if( game.pov.location ) {
                        singleton.outputText(singleton.noCareAbout(game.pov.location));
                    }
                } else if (firstWord == "map") {
                    if( game.pov.isGod ) {
                        command = singleton.helper.subSentence( command , 1).toLowerCase();
                        if( command == "show" )
                        {
                            if( !game.renderMap ) {
                                if (!game.map) {
                                    game.map = game.createMap();
                                } else if (game.pov.location && game.map.location.room != game.pov.location) {
                                    game.recalcLocation(game.map, game.pov.location);
                                }
                                game.renderMap =  game.renderMapLevelText(game.map);
                                singleton.describeLocation(false);
                            }
                        }
                        else if( command == "small" )
                        {
                            if( game.mapScale != "small" ) {
                                game.mapScale = "small" ;
                                game.renderMap =  game.renderMapLevelText(game.map);
                                singleton.describeLocation(false);
                            }
                        } else if( command == "normal" ) {
                            if( game.mapScale == "small" ) {
                                game.mapScale = null;
                                game.renderMap =  game.renderMapLevelText(game.map);
                                singleton.describeLocation(false);
                            }
                        }
                        else if( command == "!hide" )
                        {
                            if( game.renderMap ) {
                                game.renderMap = null;
                                console.clear();
                            }
                        }
                    } else {
                        singleton.outputText("You don't have a map");
                    }
                } else if ( firstWord == "b" ) {
                    if( game.pov.isGod ) {
                        var design = game.design;
                        if( design.lastNonVoid && game.pov.location ) {
                            if( game.getLocation(game.pov.location).type == "void" ) {
                                voids.clear(game);
                                game.pov.location = design.lastNonVoid;
                                singleton.describeLocation();
                            }
                        }
                    }
                } else if (firstWord == "pov") {
                    command = singleton.helper.subSentence( command , 1);
                    if( command && command.length ) {
                        if( command == game.god.name ) {
                            if( game.allowGodMode && singleton.godGame ) {
                                singleton.game = singleton.godGame;
                                game = singleton.godGame;
                                game.pov = game.god;
                                singleton.outputText("Ok you are god.");
                            } else {
                                singleton.outputText("God mode not available.");
                            }
                        } else if( command == game.actor.name ) {
                            if( game.pov.isGod ) {
                                if( singleton.godGame ) {
                                    // Work from a copy
                                    singleton.game = new Game(settings);
                                    game = singleton.game;
                                    game.cloneFrom(singleton.godGame);
                                    singleton.outputText("Ok you are playing the game.");
                                } else {
                                    game.state = {};
                                }
                                game.pov = game.actor;
                            } else {
                                singleton.outputText("POV command unavailable.");
                            }
                        } else if( game.allowGodMode ) {
                            if( singleton.findNPC(command) && singleton.godGame ) {
                                // Work from a copy
                                singleton.game = new Game(settings);
                                game = singleton.game;
                                game.cloneFrom(singleton.godGame);
                                game.pov = singleton.findNPC(command);
                                // what do we want to do as the player
                                singleton.outputText("Ok you are playing "+command+".");
                            } else {
                                singleton.outputText("POV unavailable.");
                            }
                        } else {
                            singleton.outputText("POV unavailable.");
                        }
                    } else {
                        singleton.outputText("You are "+game.pov.name);
                    }
                } else if (lCase == "save") {
                    game.saveFile();
                } else if (  '0' < firstWord[0] && firstWord[0] <= '9' && game.pov.isGod ) {
                    var index = Number.parseInt(firstWord);
                    if( index > game.annotations.length || index < 1 ) {
                        singleton.outputText("No footnote "+index+" defined");
                    } else {
                        singleton.doAnnotation(game.annotations[index-1]);
                    }
                } else if (firstWord == "help") {
                    if (lCase.split(" ").length > 1) {
                        lCase = lCase.split(" ")[1];
                        if( helpText.subtopic[lCase]) {
                            singleton.outputText(helpText.subtopic[lCase].help.join("\n"));                            
                        } else {
                            singleton.outputText("Unrecognized help category '"+lCase+"'\n"+helpText.help.join("\n"));
                        }
                    } else {
                        singleton.outputText(helpText.help.join("\n"));
                    }
                } else {
                    var verb = lCase.split(" ")[0];
                    var parts = game.digestSentence(command);
                    if ( isVerb(verb) ) {
                        // TBD register actions (and consequences)
                        /*
                        verbCommand.action = verb;
                        verbCommand.npc = null;
                        verbCommand.topic = null;    
                        verbCommand.preposition  = null;
                        command = command.split(" ");
                        command[0] = "";
                        command = command.join(" ").trim();
                        if( !processScript() ) {
                            if (game.pov.isGod ) {
                                defineScript();
                            } else {
                                noUnderstand();
                            }
                        }*/
                        command = command.split(" ");
                        command[0] = "";
                        command = command.join(" ").trim();
                        var handler = game.actions[verb];
                        if( handler || game.pov.isGod ) {
                            if( singleton.findNPC(command) ) {
                                game.verbCommand.npc = command;
                            } else {
                                game.verbCommand.npc = null;
                            }
                            game.verbCommand.action = verb;
                        }
                        if( handler ) {
                            // Lets match at action - i.e. press button, wind clock
                            if( !singleton.processScript() ) {
                                if( game.pov.isGod ) {
                                    singleton.defineScript();
                                } else {
                                    // Default response to action
                                    singleton.processAction(handler.response,game.verbCommand,game.verbCommand.action+game.verbCommand.npc);
                                }
                            }
                        } else if( game.pov.isGod ) {
                            game.stateMachine = stateMachineFillinCreate({},[
                                {msg:"Add the action (y/n):",prop:"addAction",yesNo : true}
                            ],function(sm) {
                                if( sm.data.addAction ) {
                                    game.actions[verb] = { response : { say : "Nothing appears to happen." } };
                                }
                            });
                        } else {
                             singleton.noUnderstand();
                        }
                    } else {
                        if( parts.length > 2 && parts[1] == "," ) {
                            // Commands map to 'tell'
                            if( parts[0] ) {
                                parseCommand("tell "+game.sentenceToString(parts,0,1)+" to "+game.sentenceToString(parts,2,parts.length));
                            }
                        } else {
                            singleton.outputText("Command not handled ");
                        }
                    }
                }
            }
        }
        return true;
    };
    //---------------------------------------------------------------------------
    // Load a Game from JSON
    var loadGame = function (onComplete) {
        var game = singleton.game;
        game.loadGame(function(err, loaded) {
            if( !loaded ) {
                game.god.location = "void1";
                game.pov = game.god;
                game.setLocation(game.god.location,{ "type" : "void" , "name" : "void" , "description" : "void" });
                game.map = game.createMap();
                game.renderMap =  game.renderMapLevelText();
            } else {
                if( settings.action == "play" || settings.action == "tads" || settings.action == "inform" ) {
                    game.pov = game.actor;
                    game.allowGodMode = false;
                    if( settings.action == "play" ) {
                        if( game.metadata.title)
                           singleton.outputText(chalk.bold(game.metadata.title))+"\n";
                        if( game.metadata.description )   
                           singleton.outputText(game.metadata.description)+"\n";
                        if( game.metadata.title || game.metadata.description )
                           singleton.outputText("\n");   
                    }
                } else if( game.allowGodMode && !singleton.godGame ) {
                    game.renderMap =  game.renderMapLevelText();
                    singleton.describeLocation(false);
                    singleton.godGame = game;
                }                
            }
            onComplete(err,loaded);
         } );
    };
    var exportTads = function (folder) {
        var generate = require("./generate-tads");
        var game = singleton.game;
        generate({ folder : folder , settings : settings , metadata : game.metadata, game : game , actor : game.actor, getLocation : function(name) { return game.getLocation(name); } , locations : game.locations , items : game.items , npc : game.npc });
    };
    var exportInform = function(folder) {
        var generate = require("./generate-inform");
        generate({ folder : folder , settings : settings , game : singleton.game });
    };
    var createDumpFile = function(err) {
        singleton.game.createDumpFile(err);
    };
    var stateMachineCommand = function(command) {
        var game = singleton.game;
        if( game.stateMachine ) {
            // Set of prompts....
            var saveStatemachine = game.stateMachine;  
            var res = game.stateMachine.execute(game.stateMachine,command);
            if( res == "next") {
                game.stateMachine.state = game.stateMachine.state + 1;
            } else if( res != "retry" && saveStatemachine == game.stateMachine)
                game.stateMachine = null;
            return true;    
        }
        return false;
    };
    var configDefaults = function(onComplete) {
        var game = singleton.game;
        game.loadConfig(function(err,data) {
            game.stateMachine = {
                state : 0 ,
                data : game.defaults ,
                states : [
                    { msg : "What is you name (byline)?" , prop : "author" , default :  game.defaults.author },
                    { msg : "What is you email?" , prop : "authorEmail" , default : game.defaults.authorEmail },
                ],
                execute : stateMachineFillin,
                start: stateMachineFillinStart,
                done: function(sm) { game.saveConfig(function() { singleton.outputText("Saved config."); }); }
            };
            game.stateMachine.start(game.stateMachine);
            onComplete(null,true);
        });
    };
    return {
        describe: singleton.describeLocation,
        parseCommand: parseCommand,
        loadGame: loadGame,
        config: configDefaults,
        stateMachineCommand: stateMachineCommand,
        exportTads: exportTads,
        exportInform: exportInform,
        createDumpFile: createDumpFile
    };
};

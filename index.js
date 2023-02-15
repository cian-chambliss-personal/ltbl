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
    var game = new Game(settings); 
    var singleton = { 
        chalk: chalk,
        settings : settings,
        outputText: function(txt) {
            console.log(txt);
        },
        game: game,
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
        dontSee : function() {} , 
        dontSeeNpc : function() {} , 
        noUnderstand : function() {} , 
        noCareAbout : function() {},
        resources: require("./en-resources.json") ,
        annotate : function(expr) {
            if( game.pov.isGod ) {
                game.annotations.push(expr);
                return singleton.helper.superScript(""+game.annotations.length);
            }
            return "";
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
        }
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
    var cantSeeIface = require("./cant-see.js")(singleton);
    singleton.dontSee = cantSeeIface.dontSee; 
    singleton.dontSeeNpc = cantSeeIface.dontSeeNpc;
    singleton.noUnderstand = cantSeeIface.noUnderstand;
    singleton.noCareAbout = cantSeeIface.noCareAbout;
    var stateMachineFillin = singleton.stateMachine.fillin;
    var stateMachineFillinStart = singleton.stateMachine.fillinStart;
    var stateMachineFillinCreate = singleton.stateMachine.fillinCreate;
    var fs = require("fs");
    var helpText = require("./en-help.json");
    
    var camelCase = singleton.helper.camelCase;
    var extractNounAndAdj = singleton.helper.extractNounAndAdj;
    var extractScalar = singleton.helper.extractScalar;
    var getPartsOfSpeech = singleton.helper.getPartsOfSpeech;
    var isVerb = singleton.helper.isVerb;
    var singularFromPlural = singleton.helper.singularFromPlural;
    var pluralFromSingular = singleton.helper.pluralFromSingular;
    var invalidateMap = function() {
        game.map = null;
        singleton.render(game.getLocation(game.pov.location),game.pov.location, 0);
    };
    var splitOnOneOf = function(text,words) {
        var newText;
        for(var i = 0 ; i < words.length ; ++i ) {
            newText = text.split(words[i]);
            if( newText.length > 1 )
                break;
        }
        return newText;                            
    };
    
    //---------------------------------------------------------------------------

       
    
    var allowPosture = function(itemptr,posture) {
        if( itemptr.postures ) {
            for( var i = 0 ; i < itemptr.postures.length ; ++i ) {
                if( itemptr.postures[i] == posture ) {
                    return true;
                }
            }
        }
        return false;
    };
    
    var voids = require("./void-location.js")();
    var getConvoObjectPtr = function(command) {
        if( game.verbCommand.action ) {        
            var _npc = singleton.findNPC(game.verbCommand.npc);
            if( _npc ) {
                var ptr = null;
                var rContainer = null;
                if( game.verbCommand.action == "talkto")  {
                    if( _npc.conversation.talkto ) {
                        rContainer = _npc.conversation.talkto;
                        ptr = rContainer.response;
                    }
                } else if( _npc.conversation[game.verbCommand.action] ) {
                    if( _npc.conversation[game.verbCommand.action][game.verbCommand.topic] ) {
                         rContainer = _npc.conversation[game.verbCommand.action][game.verbCommand.topic];
                         ptr = rContainer.response;
                    }
                }
                if( ptr ) {
                    if( typeof(ptr) == "string" ) {
                        ptr = { "say" : ptr };
                        if( rContainer ) {
                            rContainer.response = ptr;
                        }
                    } else if( ptr.then ) {
                        if( typeof(ptr.then[ ptr.then.length - 1 ]) == "string" ) {
                            ptr.then[ ptr.then.length - 1 ] = { "say" : ptr.then[ ptr.then.length - 1 ] };
                            ptr = ptr.then[ ptr.then.length - 1 ];
                        } else {
                            ptr = ptr.then[ ptr.then.length - 1 ];
                        }
                    } else if( ptr.or ) {
                        if( typeof(ptr.or[ ptr.or.length - 1 ]) == "string" ) {
                            ptr.then[ ptr.or.length - 1 ] = { "say" : ptr.or[ ptr.or.length - 1 ] };
                            ptr = ptr.or[ ptr.or.length - 1 ];
                        } else {
                            ptr = ptr.or[ ptr.or.length - 1 ];
                        }
                    }
                    return ptr;
                }
            }            
        }
        return null;
    };
    var spellcheckedText = function(obj,prop,prompt) {
        var choices = [];
        var parts = { mispelled : []};
        if( obj[prop] ) {
            parts = getPartsOfSpeech(obj[prop],false,true);
        }
        if( parts.mispelled.length > 0 ) {
            for(var i = 0; i < parts.mispelled.length ; ++i ) {
                choices.push({ text : 'Fix "'+parts.mispelled[i].word+'"' , value : parts.mispelled[i].word });
            }
            choices.push({text:prompt,value:"*"});
        }
        if( choices.length > 1 ) {
            game.stateMachine = stateMachineFillinCreate({word:'',fix:''},[
                {msg:"Change description:",prop:"word",choices:choices},
                { test : function(sm) { 
                        if(sm.data.word == "*") 
                               return "expand.entire";
                        var findWrd = sm.data.word;
                        var se = sm.states[1];
                        se.states[0].msg = findWrd;
                        for(var i = 0; i < parts.mispelled.length ; ++i ) {
                            if( parts.mispelled[i].word == findWrd ) {
                                var srcCorrect =parts.mispelled[i].corrections;
                                var correct = [];
                                for(var j = 0; j < srcCorrect.length ; ++j ) {
                                    var coorection =  srcCorrect[j];
                                    correct.push({ text : 'Replace "'+findWrd+'" with "'+coorection+'"', value : coorection } );
                                }
                                correct.push({ text : 'Make a custom fix', value : "?" } );
                                se.states[0].choices = correct;
                                break;
                            }
                        }
                        return "expand"; 
                    } , states : [ 
                        {msg:"??",prop:"fix",choices:[]},
                        {
                            test : function(sm) {
                                if( sm.data.fix == "?" ) { return "expand"; }
                                return "skip";
                            },
                            states : [ { msg: "Custom fix" , prop : "fix" } ]
                        }
                    ] , entire : [
                        {msg:prompt,prop:prop}
                    ]
                }
            ],function(sm) {
                if(sm.data.word == "*") {
                    if( sm.data[prop] ) {
                        obj[prop] = sm.data[prop];
                    }
                } else if(sm.data.fix) {
                    var desc = obj[prop];
                    obj[prop] = desc.split(sm.data.word).join(sm.data.fix);
                }
                game.map = null;
                singleton.render(game.getLocation(game.pov.location),game.pov.location, 0);
            });
        } else {
            game.stateMachine = stateMachineFillinCreate(obj,[ {msg:prompt,prop:prop} ],invalidateMap);
        }
    };
    var doAnnotation = function(anno) {
        if( anno.type == "item" ) {
            //{"type":"item","item":
            var ip = game.getItem(anno.item);
            game.annotations = [];
            if( ip ) {
                var noPostures = true;                
                if( ip.name ) {
                    singleton.outputText(chalk.bold("Name\n"+ip.name)+" "+singleton.annotate({"type":"item.name","item":anno.item}))
                } else {
                    singleton.outputText(chalk.bold("Name\nnone")+" "+singleton.annotate({"type":"item.name","item":anno.item}))
                }
                singleton.outputText(chalk.bold("Description"));
                if( ip.description ) {
                    singleton.outputText(ip.description+singleton.annotate({"type":"item.description","item":anno.item}))
                } else {
                    singleton.outputText("No description"+singleton.annotate({"type":"item.description","item":anno.item}))
                }
                singleton.outputText(chalk.bold("Content"));
                if( ip.content ) {
                    singleton.outputText(ip.content+singleton.annotate({"type":"item.content","item":anno.content}))
                } else {
                    singleton.outputText("No readable content"+singleton.annotate({"type":"item.content","item":anno.item}))
                }
                if( ip.postures ) {
                    if( ip.postures.length ) {
                        singleton.outputText(chalk.bold("Nested Room Supported Postures"))
                        singleton.outputText(ip.postures.join(",")+singleton.annotate({"type":"item.postures","item":anno.item}))
                        noPostures = false;
                    }
                }
                if( noPostures ) {
                    singleton.outputText("Not a Nested room"+singleton.annotate({"type":"item.postures","item":anno.item}))
                }
                /*
                if( ip.contains ) {
                    if( ip.contains.length ) {
                    }
                }
                if( ip.supports ) {
                }            
                if( ip.behind ) {
                }
                if( ip.under ) {
                }*/
              }
        } else if( anno.type == "item.name" ) {
            var ip = game.getItem(anno.item);
            if( ip ) {
                game.stateMachine = stateMachineFillinCreate(ip,[{msg:"Change item name:",prop:"name"}]);
            }
        } else if( anno.type == "item.description" ) {
            var ip = game.getItem(anno.item);
            if( ip ) {
                spellcheckedText(ip,"description","Change entire item description:");
            }
        } else if( anno.type == "item.content" ) {
            var ip = game.getItem(anno.item);
            if( ip ) {
                spellcheckedText(ip,"content","Change entire item readable content:");
            }
        } else if( anno.type == "item.postures" ) {
            var ip = game.getItem(anno.item);
            if( ip ) {
                game.stateMachine = stateMachineFillinCreate(ip,[{msg:"Supported postures:",prop:"postures",choices:singleton.resources.postureTypeList,multiple:true}]);
            }            
        } else if( anno.type == "dir" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    game.annotations = [];
                    singleton.outputText(chalk.bold("Location"));
                    singleton.outputText(dp.location+" "+singleton.annotate({"type":"dir.location","dir":anno.dir}))
                    singleton.outputText(chalk.bold("Type"));
                    if( dp.type ) {
                        singleton.outputText(dp.type+" "+singleton.annotate({"type":"dir.type","dir":anno.dir}))
                    } else {
                        singleton.outputText("Default "+singleton.annotate({"type":"dir.type","dir":anno.dir}))
                    }
                    if( dp.wall ) {
                        singleton.outputText("Wall: "+dp.wall+singleton.annotate({"type":"dir.wall","dir":anno.dir}));
                    } else {
                        if( loc.type == "outside" && game.getLocation(dp.location).type == "outside" ) {
                            singleton.outputText("Wall Default - none outside"+singleton.annotate({"type":"dir.wall","dir":anno.dir}));
                        } else {
                            singleton.outputText("Wall Default - inside wall"+singleton.annotate({"type":"dir.wall","dir":anno.dir}));
                        }
                    }
                    if( dp.door ) {
                        singleton.outputText(chalk.bold("Door Name"));
                        singleton.outputText(game.getDoor(dp.door).name+" "+singleton.annotate({"type":"door.name","door":dp.door}))
                        singleton.outputText(chalk.bold("Door Description"));
                        singleton.outputText(game.getDoor(dp.door).description+" "+singleton.annotate({"type":"door.description","door":dp.door}))
                    }
                }
            }
        } else if( anno.type == "location.name" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                game.stateMachine = stateMachineFillinCreate(loc,[{msg:"Change location name:",prop:"name"}],invalidateMap);
            }
        } else if( anno.type == "location.description" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                spellcheckedText(loc,"description","Change entire location description:");
            }
        } else if( anno.type == "location.type" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                game.stateMachine = stateMachineFillinCreate(loc,[{msg:"Change location type:",prop:"type",choices:singleton.resources.roomTypesMenu}],invalidateMap);
            }
        } else if( anno.type == "location.topLoc" ) {
            game.annotations = [];
            var loc =  game.getLocation(anno.location);
            if( loc ) {
                singleton.outputText(chalk.bold("Level Type"));
                singleton.outputText(loc.type+" "+singleton.annotate({"type":"topLoc.type","location":anno.location}))
                singleton.outputText(chalk.bold("Level Name"));
                singleton.outputText(loc.name+" "+singleton.annotate({"type":"topLoc.name","location":anno.location}))
            }
        } else if( anno.type == "dir.location" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    // TBD changing location could orphan rooms or
                    // mess up geography - we need some validation logic
                    // to prevent this
                }
            }
        } else if( anno.type == "dir.type" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    game.stateMachine = stateMachineFillinCreate(dp,[{msg:"Change location type:",prop:"type",choices:singleton.resources.dirTypesMenu}]);
                }
            }
        } else if( anno.type == "dir.wall" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    //stateMachine = stateMachineFillinCreate(dp,[{msg:"Change location type:",prop:"type",choices:dirTypesMenu}]);
                    ;
                }
            }
        } else if( anno.type == "door.name" ) {
            var dp = game.getDoor(anno.door);
            if(dp) {                
                game.stateMachine = stateMachineFillinCreate(dp,[{msg:"Change door name:",prop:"name"}]);
            }
        } else if( anno.type == "door.description" ) {
            var dp = game.getDoor(anno.door);
            if(dp) {                
                game.stateMachine = stateMachineFillinCreate(dp,[{msg:"Change door description:",prop:"description"}]);
            }
        } else if( anno.type == "npc" ) {
            var ni = game.getNpc(anno.npc);
            if( ni ) {
                game.annotations = [];
                singleton.outputText(chalk.bold("Name"));
                if( ni.name ) {
                    singleton.outputText(ni.name+" "+singleton.annotate({"type":"npc.name","npc":anno.npc}));
                } else {
                    singleton.outputText("No Name "+singleton.annotate({"type":"npc.name","npc":anno.npc}));
                }
                singleton.outputText(chalk.bold("Description"));
                if( ni.description ) {
                    singleton.outputText(ni.description+" "+singleton.annotate({"type":"npc.name","npc":anno.npc}));
                } else {
                    singleton.outputText("No Description "+singleton.annotate({"type":"npc.name","npc":anno.npc}));    
                }
            }
        } else if( anno.type == "npc.name" ) {
            var ni = game.getNpc(anno.npc);
            if( ni ) {
                game.stateMachine = stateMachineFillinCreate(ni,[{msg:"Change NPC name:",prop:"name"}]);
            }
        } else if( anno.type == "npc.description" ) {
            var ni = game.getNpc(anno.npc);
            if( ni ) {
                game.stateMachine = stateMachineFillinCreate(ni,[{msg:"Change NPC description:",prop:"description"}]);
            }
        } else if( anno.type == "conv" ) {
            //{ type:"conv" , game.npc : vc.npc , action : vc.action , preposition  : vc.preposition , topic : vc.topic }
        }
    };
    var godCommandPatterns = [
        {
            match : {
                verb : [ "!drop","!put","!hide" ],
                dObjScalar : true,
                dObj : "create" ,
                iObj : "create" ,
                preposition : ["on","from","in","inside","under","behind"]
            } , 
            eval : function(args) {
                var ip = game.getItem(args.iObj);
                if( args.new_iObj ) {
                    // we need to put the iObj in location
                    var pLoc = game.getLocation(game.pov.location);
                    var foundItem = false;
                    if( !pLoc.contains ) {
                        pLoc.contains = [];
                    }
                    for( var i = 0 ; i < pLoc.contains.length ; ++i ) {
                        if( pLoc.contains[i].item == args.iObj ) {
                            foundItem = true;
                        }
                    }
                    if( !foundItem ) {
                        pLoc.contains.push({item:args.iObj})
                    }
                } else if( !ip ) {
                    singleton.outputText(args.iObj+" was not found!");
                }
                var listName = null;
                if( args.preposition == "on") {
                    listName = "supports";                    
                } else if( args.preposition == "under") {
                    listName = "under";
                } else if( args.preposition == "behind") {
                    listName = "behind";
                } else {
                    listName = "contains";
                }
                if( !ip[listName] ) {
                    ip[listName] = [];
                }
                if( args.verb == "!hide" ) {
                    ip[listName].push({ item : args.dObj , hidden : true });
                } else {
                    ip[listName].push({ item : args.dObj });
                }
                singleton.outputText("Ok");
            },
        },
        {
            match : {
                verb : [ "!drop" ],
                dObjScalar : true,
                dObj : "create" ,
            } , 
            eval : function(args) {
                if( args.new_dObj ) {
                    var pLoc = game.getLocation(game.pov.location);
                    if( !pLoc.contains ) {
                        pLoc.contains = [];
                    }
                    var ip =  {item:args.dObj};
                    if( args.dObjScalar ) {
                        ip.scalar = args.dObjScalar;
                    }
                    pLoc.contains.push(ip);
                    var ip = game.getItem(args.dObj);
                    singleton.outputText(ip.name+" has been placed in "+pLoc.name);
                }
            }
        },
        {
            match : {
                verb : ["!give","!show"],
                dObj : "*",
                subject : "createnpc",
                article : ["the","a","an","my"," "]
            } ,
            eval : function(args) {
                if( args.verb == "!give" )
                    game.verbCommand.action = "give";
                else
                    game.verbCommand.action = "show";
                game.verbCommand.npc = args.subject;
                game.verbCommand.topic = args.dObj;
                if( !singleton.processScript() ) {
                    singleton.defineScript();
                }
            }
        },
        {
            match : {
                verb : ["!talkto","!ask","!tell"],
                dObj : "topic",
                subject : "createnpc",
                preposition: ["about","for"]
            } ,
            eval : function(args) {
                if( args.verb == "!talkto" )
                    game.verbCommand.action = "talkto";
                else if( args.verb == "!tell" )
                    game.verbCommand.action = "tell";
                else
                    game.verbCommand.action = "ask";
                game.verbCommand.npc = args.subject;
                game.verbCommand.topic = args.dObj;
                game.verbCommand.preposition = args.preposition;
                if( !singleton.processScript() ) {
                    singleton.defineScript();
                }
            }
        },
        {
            match : {
                verb : ["!talkto","!hi","!bye","!leave","!notice"],
                subject : "createnpc"
            } ,
            eval : function(args) {
                if( args.verb == "!hi" )
                    game.verbCommand.action = "hi";
                else if( args.verb == "!bye" )
                    game.verbCommand.action = "bye";
                else if( args.verb == "!leave" )
                    game.verbCommand.action = "leave";
                else if( args.verb == "!notice" )
                    game.verbCommand.action = "notice";
                else
                    game.verbCommand.action = "talkto";
                game.verbCommand.npc = args.subject;
                game.verbCommand.topic = null;
                game.verbCommand.preposition = null;
                if( !singleton.processScript() ) {
                    singleton.defineScript();
                }
            }
        },
        {
            match : {
                verb : "!makedoor",
                direction: true
            },
            eval : function(args) {
                if (game.getLocation(game.pov.location)) {
                    var nextLoc = game.getLocation(game.pov.location)[args.direction];
                    if (nextLoc) {
                        var design = game.design;
                        design.lastDirection = args.direction;
                        design.lastLocation = game.pov.location;
                        game.pov.location = nextLoc.location;
                        game.stateMachine = stateMachineFillinCreate({},[
                            {msg:"Door name:",prop:"name"}
                        ],function(sm) {
                            if( sm.data.name  && sm.data.name.length > 1  ) {
                                var name = extractNounAndAdj(sm.data.name);
                                name = game.getUniqueItemName(name,"door",game.util.calcCommonPrefix(game.pov.location,design.lastLocation));
                                game.setDoor(name,{ name: sm.data.name , type : "door" });
                                game.getLocation(design.lastLocation)[design.lastDirection].door = name;
                                game.getLocation(game.pov.location)[game.util.reverseDirection(design.lastDirection)].door = name;
                                game.pov.location = design.lastLocation;
                                game.map = null;
                                singleton.describeLocation();
                            }
                        });
                    } else {
                        singleton.outputText("There is no opening to the "+args.direction);
                    }
                } else {
                    singleton.outputText("There is no starting location.");
                }
            }
        },
        {
            match : {
                verb : "!makedoor"
            },
            eval : function(args) {
                var design = game.design;
                if( design.lastDirection && design.lastLocation  ) {
                    game.stateMachine = stateMachineFillinCreate({},[
                        {msg:"Door name:",prop:"name"}
                    ],function(sm) {
                        if( sm.data.name  && sm.data.name.length > 1  ) {
                            var name = extractNounAndAdj(sm.data.name);
                            var lastLocDir = null;
                            var curLocDir = null;
                            name = game.getUniqueItemName(name,"door",game.util.calcCommonPrefix(game.pov.location,design.lastLocation));
                            game.setDoor(name,{ name: sm.data.name , type : "door"});
                            lastLocDir = game.getLocation(design.lastLocation)[design.lastDirection];
                            curLocDir = game.getLocation(game.pov.location)[game.util.reverseDirection(design.lastDirection)]
                            if( !lastLocDir
                            && !curLocDir 
                                ) {
                                game.getLocation(design.lastLocation)[design.lastDirection] = { location : game.pov.location , door : name };
                                game.getLocation(game.pov.location)[game.util.reverseDirection(design.lastDirection)] = { location : design.lastLocation , door : name};
                            } else if( lastLocDir && curLocDir ) {
                                lastLocDir.door = name;
                                curLocDir.door = name;
                            } else {
                                singleton.outputText("Locations are not paired from "+design.lastDirection);
                            }
                            game.map = null;
                            singleton.describeLocation();
                        }
                    });
                } else {
                    singleton.outputText("There is no ending location. lastLocation="+design.lastLocation+" lastDirection="+design.lastDirection+ " game.pov.location="+game.pov.location);
                }
            }
        },
        {
            match : {
                verb : [ "!makepath","!makepassage","!makestairs"]
            },
            eval : function(args) {
                var design = game.design;
                if( design.lastLocation ) {
                    var dirCType = args.verb.substring(5);
                    if( game.getLocation(design.lastLocation)[design.lastDirection] ) {
                        game.getLocation(design.lastLocation)[design.lastDirection].type = dirCType;
                        game.getLocation(game.pov.location)[game.util.reverseDirection(design.lastDirection)].type = dirCType;
                    } else if( !game.getLocation(game.pov.location)[game.util.reverseDirection(design.lastDirection)] ) {
                        game.getLocation(design.lastLocation)[design.lastDirection] = { location : game.pov.location , type : dirCType};
                        game.getLocation(game.pov.location)[game.util.reverseDirection(design.lastDirection)] = {location : design.lastLocation , type : dirCType};
                    }
                } else {
                    singleton.outputText("There is no starting location.");
                }
            }
        },
        {
            match: {
                verb : "!understand",
                dObj : "name",
                preposition: "as",
                iObj : ["*","npc"]
            },
            eval : function(args) {
                var ip = null;
                if( args.iObjType == "npc") {
                    ip = game.getNpc(args.iObj);
                } else {
                    ip = game.getItem(args.iObj);
                }
                if( ip ) {
                    var alreadySet = false;
                    if( !ip.alias ) {
                        ip.alias = [];
                    }
                    for( var i = 0 ; i < ip.alias.length ; ++i ) {
                        if( ip.alias[i] == args.dObj ) {
                            alreadySet = true;
                            break;
                        }
                    }
                    if( alreadySet ) {
                        singleton.outputText(ip.name+" already known as "+args.iObj);
                    } else {
                        ip.alias.push(args.dObj);
                        singleton.outputText("Ok, "+ip.name+" can be called "+args.dObj);
                    }
                }
            }
        }
    ];


    var takeFromContainerHandler = function(args) {
        var ip = game.getItem(args.iObj);
        var from = null;
        var prop = null;
        if( ip.supports && (args.preposition == "on"||args.preposition == "from") ) {
            from = singleton.lookupItemArr(args.dObj,ip.supports);
            if( from )
                prop = "supports";
        }
        if( ip.behind && (args.preposition == "behind"||args.preposition == "from") && !from ) {
            from = singleton.lookupItemArr(args.dObj,ip.behind);
            if( from )
                prop = "behind";
        }
        if( ip.under && (args.preposition == "under"||args.preposition == "from") && !from ) {
            from = singleton.lookupItemArr(args.dObj,ip.under);
            if( from )
                prop = "under";
        }
        if( ip.contains && (args.preposition == "in"||args.preposition == "contains"||args.preposition == "from") && !from ) {
            from = singleton.lookupItemArr(args.dObj,ip.contains);
            if( from )
                prop = "contains";
        }
        if( !from && args.preposition == "from" ) {
            if( ip.supports ) {
                args.preposition = "on";
            } else if( !ip.contains && ip.behind ) {
                args.preposition = "behind";
            } else if( !ip.contains && ip.under ) {
                args.preposition = "under";
            }
        }
        if( from ) {
            var listPtr = ip[prop];
            for (var i = 0; i < listPtr.length; ++i) {
                if (listPtr[i].item == from) {
                    if( !game.pov.inventory ) {
                        game.pov.inventory = [];
                    }
                    game.pov.inventory.push(listPtr[i]);
                    ip[prop].splice(i, 1);                            
                    singleton.outputText("Taken.");
                    break;
                }
            }
        } else if(args.preposition == "on") {
            singleton.outputText("There is no "+args.dObj+" on "+ip.name);                    
        } else if(args.preposition == "behind") {
            singleton.outputText("There is no "+args.dObj+" behind "+ip.name);                    
        } else if(args.preposition == "under") {
            singleton.outputText("There is no "+args.dObj+" under "+ip.name);                    
        } else {
            singleton.outputText("There is no "+args.dObj+" in "+ip.name);
        }
    };

    // Command patterns
    var commandPatterns = [
        {
            match : {
                verb : "!look"
            }, 
            eval : function(args) {
                singleton.describeLocation(true);
            }
        },
        {
            match : {
                verb : "!inventory"
            }, 
            eval : function(args) {
                if (game.pov.inventory.length == 0) {
                    singleton.outputText("You are carrying nothing.");
                } else {
                    game.annotations = [];
                    singleton.outputText("You are carrying:");
                    for (var i = 0; i < game.pov.inventory.length; ++i) {
                        singleton.outputText(game.getItem(game.pov.inventory[i].item).name+singleton.annotate({"type":"item","item":game.pov.inventory[i].item}));
                    }
                }
            }
        },        
        {
            match : {
                verb : "!examine",
                dObj : ["*","npc"],
                preposition : ["on","under","behind","in","inside"]
            }, 
            eval : function(args) {
                if( args.dObjType == "npc" ) {
                    singleton.describeNPC(args.dObj,args.preposition);
                } else {
                    singleton.describeItem(args.dObj,args.preposition);
                }
            }
        } ,
        {
            match : {
                verb : "!examine",
                dObj : ["*","npc"]
            }, 
            eval : function(args) {
                if( args.dObjType == "npc" ) {
                    singleton.describeNPC(args.dObj);
                } else {
                    singleton.describeItem(args.dObj);
                }                
            }
        } ,
        {
            match : {
                verb : "!examine",
                dObj : "npc"
            }, 
            eval : function(args) {
                console.dir(args);                
            }
        } ,
        {
            match : {
                verb : "!search",
                dObj : "*",
                preposition : ["on","under","behind","in","inside"]
            }, 
            eval : function(args) {
                singleton.describeItem(args.dObj,args.preposition,true);
            }
        } ,
        {
            match : {
                verb : "!search",
                dObj : "*"
            }, 
            eval : function(args) {
                singleton.describeItem(args.dObj,null,true);
            }
        } ,
        {
            match : {
                verb : "!take",
                dObj : "name",
                iObj : "*" ,
                preposition : ["on","from","in","under","behind"]
            } , 
            eval : takeFromContainerHandler
        },
        { 
            match : {
                verb : "!take",
                dObj : "noactor"
            } , 
            eval : function(args) {
                var where = game.getLocation(game.pov.location);
                var taken = false;
                for (var i = 0; i < where.contains.length; ++i) {
                    if (where.contains[i].item == args.dObj) {
                        if( !game.pov.inventory ) {
                            game.pov.inventory = [];
                        }
                        game.pov.inventory.push(where.contains[i]);
                        where.contains.splice(i, 1);
                        if (where.contains.length == 0) {
                            delete where.contains;
                        }
                        singleton.outputText("Taken.");
                        taken = true;
                        break;
                    }
                }
                if( !taken ) {
                    var disclosedList = game.state[game.pov.location+"_disclosed"];
                    if( disclosedList ) {
                        var path = disclosedList[args.dObj];
                        if( path ) {
                            var sep = path.indexOf(" ");
                            if( sep > 0 ) {
                                args.preposition = path.substring(0,sep);
                                if( args.preposition == "supports") {
                                    args.preposition = "on";
                                }
                                args.iObj  = path.substring(sep+1).trim();
                                args.dObj  = game.getItem(args.dObj).name;
                                takeFromContainerHandler(args);
                            }
                        }                        
                    }
                }
            }
        },
        {
            match : {
                verb : [ "!drop","!put","!hide" ],
                dObj : "actor" ,
                iObj : "*" ,
                preposition : ["on","from","in","inside","under","behind"]
            } , 
            eval : function(args) {
                var where = game.getItem(args.iObj);
                var what = game.getItem(args.dObj);
                var holder = "contains";
                if( args.preposition == "on" ) {
                    holder = "supports";
                } else if( args.preposition == "under" ) {
                    holder = "under";
                } else if( args.preposition == "behind" ) {
                    holder = "behind";                    
                }
                if (where) {
                    if (where[holder]) {
                        var found = false;
                        var dropped = game.dropObject(dObj);
                        singleton.outputText(dropped.response);
                        if( dropped.found ) {                            
                            if (args.verb == "!hide") {
                                objRef.hidden = true;
                            } else if (objRef.hidden) {
                                delete objRef.hidden;
                            }
                            where[holder].push(objRef);
                        }        
                    } else {
                        singleton.outputText("You cannot place "+what.name+" "+args.preposition+" "+where.name);
                    }
                } else {
                    singleton.outputText("You don't see "+ args.iObj+"!");   
                }
            }
        },
        {
            match : {
                verb : [ "!drop" ],
                dObj : "actor" ,
            } , 
            eval : function(args) {                
                var where = game.getLocation(game.pov.location);
                for (var i = 0; i < game.pov.inventory.length; ++i) {
                    if (game.pov.inventory[i].item == args.dObj) {
                        if( !where.contains ) {
                            where.contains = [];
                        }                
                        where.contains.push(game.pov.inventory[i]);
                        game.pov.inventory.splice(i, 1);
                        break;
                    }
                }
            }
        },
        { 
            match : {
                verb : "!open",
                dObj : "*"
            } , 
            eval : function(args) {
                var objState = game.getObjectState(args.dObj);
                var ip = game.getItem(args.dObj);
                var itemStateAccess = null;
                var itemStateLock = null;
                if( objState ) {
                    itemStateAccess = objState.access;
                    itemStateLock = objState.lock;
                }
                if( itemStateAccess == "open" ) {
                    singleton.outputText("The " + ip.name + " is already open");
                } else if( itemStateLock == "locked" ) {
                    singleton.outputText("The " + ip.name + " is locked");
                } else if( itemStateAccess == "closed" ) {
                    game.setObjectState(args.dObj,"access","open");
                    singleton.outputText("Ok, you opened the " + ip.name);
                } else {
                    singleton.outputText(ip.name + " cannot be opened.");
                }
           }
        },
        {
            match : {
                verb : "!close",
                dObj : "*"
            } ,
            eval : function(args) {
                var objState = game.getObjectState(args.dObj);
                var ip = game.getItem(args.dObj);
                var itemStateAccess = null;
                var itemStateLock = null;
                if( objState ) {
                    itemStateAccess = objState.access;
                    itemStateLock = objState.lock;
                }
                if( itemStateAccess == "open" ) {
                    game.setObjectState(args.dObj,"access","closed");
                    singleton.outputText("Ok, you closed the " + ip.name);
                } else if( itemStateAccess == "closed" ) {
                    singleton.outputText("The " + ip.name + " is already closed");
                } else if( itemStateLock == "locked" ) {
                    singleton.outputText("The " + ip.name + " is not open");
                } else {
                    singleton.outputText(ip.name + " cannot be closed.");
                }
            }
        },
        {
            match : {
                verb : "!lock",
                preposition: ["with","using"],
                dObj : "*",
                iObj : "actor"
            } ,
            eval : function(args) {
                var objState = game.getObjectState(args.dObj);
                var ip = game.getItem(args.dObj);
                var kp = game.getItem(args.iObj);
                var itemStateAccess = null;
                var itemStateLock = null;
                if( objState ) {
                    itemStateAccess = objState.access;
                    itemStateLock = objState.lock;
                }
                if( ip.key != args.iObj ) {
                    if( ip.key ) {
                        singleton.outputText("The " + kp.name + " doesn't fit "+ip.dObj);
                    } else {
                        singleton.outputText("The " + kp.name + " cannot be locked");
                    }
                } else if( itemStateLock == "locked" ) {
                    singleton.outputText("The " + ip.name + " is already locked");
                } else if( itemStateAccess == "open" ) {
                    game.setObjectState(args.dObj,"access","closed");
                    game.setObjectState(args.dObj,"lock","locked");
                    singleton.outputText("First closing, " + ip.name + " is now locked");
                } else {
                    game.setObjectState(args.dObj,"lock","locked");
                    singleton.outputText("Ok, " + ip.name + " is now locked");
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                var kp = game.getItem(args.iObj);
                ip.key = args.iObj;
                ip.state = "locked";
                singleton.outputText("Ok, " + ip.name + " is now keyed to "+kp.name);
            }
        },
        {
            match : {
                verb : "!unlock",
                preposition: "with",
                dObj : "*",
                iObj : "actor"
            } ,
            eval : function(args) {
                var objState = game.getObjectState(args.dObj);
                var ip = game.getItem(args.dObj);
                var kp = game.getItem(args.iObj);
                var itemStateLock = null;
                if( objState ) {
                    itemStateLock = objState.lock;
                }                
                if( ip.key != args.iObj ) {
                    if( ip.key ) {
                        singleton.outputText("The " + kp.name + " doesn't fit "+ip.dObj);
                    } else {
                        singleton.outputText("The " + kp.name + " cannot be unlocked");
                    }
                } else if( itemStateLock != "locked" ) {
                    singleton.outputText("The " + ip.name + " is not locked");
                } else {
                    game.setObjectState(args.dObj,"lock","unlocked");
                    singleton.outputText("Ok, " + ip.name + " is now unlocked");
                }
            }
        },
        {
            match : {
                verb : "!read",
                dObj : "*",
            } ,
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.content) {
                    singleton.outputText(ip.content);
                } else {
                    singleton.outputText("There is nothing written on the "+ip.name);
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.content) {
                    singleton.outputText(ip.content);
                } else {
                    game.stateMachine = stateMachineFillinCreate(ip,[ {msg:"What do you see written on " + ip.name + "?",prop:"content"} ]);
                }
            }
        },
        { 
            match : {
                verb : "!smell",
                dObj : "noactor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.smell && ip.smell.description ) {
                    singleton.outputText(ip.smell.description);
                } else {
                    singleton.outputText("You notice no smell in particular.");
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.smell && ip.smell.description ) {
                    singleton.outputText(ip.smell.description);
                } else {
                    if( !ip.smell ) {
                        ip.smell = {};
                    }
                    game.stateMachine = stateMachineFillinCreate(ip.smell,[ {msg:"Describe the smell of " + ip.name + "?",prop:"description"} ]);
                }
            }
        },
        { 
            match : {
                verb : "!touch",
                dObj : "noactor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.touch && ip.touch.description ) {
                    singleton.outputText(ip.touch.description);
                } else {
                    singleton.outputText("You don't notice anything out of the ordinary.");
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.touch && ip.touch.description ) {
                    singleton.outputText(ip.touch.description);
                } else {
                    if( !ip.touch ) {
                        ip.touch = {};
                    }
                    game.stateMachine = stateMachineFillinCreate(ip.touch,[ {msg:"Describe how " + ip.name + " feels to the touch?",prop:"description"} ]);
                }
            }
        },
        { 
            match : {
                verb : "!listen",
                dObj : "noactor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.sound && ip.sound.description ) {
                    singleton.outputText(ip.sound.description);
                } else {
                    singleton.outputText("You don't notice any sound.");
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.sound && ip.sound.description ) {
                    singleton.outputText(ip.sound.description);
                } else {
                    if( !ip.sound ) {
                        ip.sound = {};
                    }
                    game.stateMachine = stateMachineFillinCreate(ip.sound,[ {msg:"Describe how " + ip.name + " sounds?",prop:"description"} ]);
                }
            }        
        },
        {
            match : {
                verb : "!eat",
                dObj : "actor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip && ip.type ==  "food" ) {
                    singleton.outputText(game.dropObject(args.dObj).response);
                } else {
                    singleton.outputText("You cannot eat "+ip.name+".");
                }
            }
        },
        {
            match : {
                verb : "!wear",
                dObj : "actor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip && ip.type ==  "wearable" ) {
                    var is = game.getObjectState(args.dObj);
                    if( is.worn ) {
                        singleton.outputText("You area already wearing "+ip.name+".");
                    } else {
                        is.worn = true;
                        singleton.outputText("Ok");
                    }
                } else {
                    singleton.outputText("You cannot wear "+ip.name+".");
                }
            }
        },
        {
            match : {
                verb : "!doff",
                dObj : "actor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip && ip.worn ) {
                    delete ip.worn;
                    singleton.outputText("Ok.");
                } else {
                    singleton.outputText("You are not wearing "+ip.name+".");
                }
            }
        },
        {
            match : {
                verb : "!light",
                dObj : "actor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip && ip.type ==  "light" ) {
                    var is = game.getObjectState(args.dObj);
                    if( is.lit && is.lit > 0 ) {
                        singleton.outputText(ip.name+" is already lit.");
                    } else if( it.level && ip.level > 0 ) {
                        is.lit = ip.level;
                        singleton.outputText("Ok.");
                    } else {
                        is.lit = 10;
                        singleton.outputText("Ok.");
                    }
                } else {
                    singleton.outputText("You cannot light "+ip.name+".");
                }
            }
        },
        {
            match : {
                verb : ["!give","!show"],
                dObj : "*",
                subject : "npc",
                article : ["the","a","an","my"," "]
            } ,
            eval : function(args) {
                if( args.verb == "!give" )
                    game.verbCommand.action = "give";
                else
                    game.verbCommand.action = "show";
                game.verbCommand.npc = args.subject;
                game.verbCommand.topic = args.dObj;
                if( !singleton.processScript() ) {
                    if (game.pov.isGod ) {
                        singleton.defineScript();
                    } else {
                        singleton.noUnderstand();
                    }
                }
            }
        },
        {
            match : {
                verb : ["!talkto","!ask","!tell"],
                dObj : "topic",
                subject : "npc",
                preposition: ["about","for"]
            } ,
            eval : function(args) {
                if( args.verb == "!talkto" )
                    game.verbCommand.action = "talkto";
                else if( args.verb == "!tell" )
                    game.verbCommand.action = "tell";
                else
                    game.verbCommand.action = "ask";
                game.verbCommand.npc = args.subject;
                game.verbCommand.topic = args.dObj;
                game.verbCommand.preposition = args.preposition;
                if( !singleton.processScript() ) {
                    singleton.noUnderstand();
                }
            }
        },       
        {
            match : {
                verb : ["!talkto","!hi","!bye","!leave","!notice"],
                subject : "npc"
            } ,
            eval : function(args) {
                if( args.verb == "!hi" )
                    game.verbCommand.action = "hi";
                else if( args.verb == "!bye" )
                    game.verbCommand.action = "bye";
                else if( args.verb == "!leave" )
                    game.verbCommand.action = "leave";
                else if( args.verb == "!notice" )
                    game.verbCommand.action = "notice";
                else
                    game.verbCommand.action = "talkto";
                game.verbCommand.npc = args.subject;
                game.verbCommand.topic = null;
                game.verbCommand.preposition = null;
                if( !singleton.processScript() ) {
                    singleton.noUnderstand();
                }
            }
        },   
        {
            match: {
                verb : "!saveplay"
            },
            eval : function(args) {
                game.saveCommands();
                singleton.outputText("Saved");
            }
        }
    ];

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
    var lookupCommandHandle = function(commands,cmd,findPatternArgs) {
        var findPattern = null;
        var firstWord = cmd.firstWord;
        var command = cmd.command;
        var origCommand = cmd.origCommand;
        for( var i = 0 ; i < commands.length ; ++i ) {
            var _pattern =  commands[i];
            var preposition = null;
            var matchVerb = false;
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
                    var wList = splitOnOneOf( object1 , aList );
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
        return findPattern;
    };

    var parseCommand = function (command) {
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
            /*} else if (mode == 'door?') {
                // TBD make separate commands for door/passage etc Make
                lCase = lCase.trim();
                ...
                } else if (lCase == "u") {
                    game.getLocation(lastLocation)[lastDirection].direction = -1;
                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].direction = 1;
                    map = null;
                } else if (lCase == "d") {
                    game.getLocation(lastLocation)[lastDirection].direction = 1;
                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].direction = -1;
                    map = null;
                } else if (lCase == "-") {
                    game.getLocation(lastLocation)[lastDirection].teleport = true;
                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].teleport = true;
                    map = null;
                } else if (lCase == "+") {
                    // TBD - we need to make sure that the maps do *not* overlap
                    if( game.getLocation(lastLocation)[lastDirection].teleport ) {
                        delete game.getLocation(lastLocation)[lastDirection].teleport;
                    }
                    if( game.getLocation(game.pov.location)[reverseDirection(lastDirection)].teleport ) {
                        delete game.getLocation(game.pov.location)[reverseDirection(lastDirection)].teleport;
                    }
                    map = null;
                } else if (lCase != ""
                    && lCase != "n"
                    && lCase != "no"
                ) {
                    var name = extractNounAndAdj(command);
                    if (!name || getDoor(name)) {
                        name = game.getUniqueItemName(name,...);
                    }
                    game.setDoor(name,{ name: command });
                    game.getLocation(lastLocation)[lastDirection].door = name;
                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].door = name;
                }
                mode = "what";
                describe();
            */
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
                    
                } else if ( firstWord == "!eat" 
                         || firstWord == "!wear" 
                         || firstWord == "!light" 
                         || firstWord == "!affix"
                          ) {
                    var thingType = null;
                    if (firstWord == "!eat") {
                        thingType = "food";
                    } else if (firstWord == "!wear") {
                        thingType = "wearable";
                    } else if (firstWord == "!light") {
                        thingType = "light";
                    } else if (firstWord == "!affix") {
                        thingType = "fixture";
                    }
                    command = singleton.helper.subSentence( command , 1);
                    if (command != "") {
                        var where = game.getLocation(game.pov.location);
                        var what = command;
                        if (!where.contains) {
                            where.contains = [];
                        }
                        var existingItem = singleton.lookupItem(game.pov.location,what);
                        if (existingItem && existingItem != "?") {
                            var ip = game.getItem(existingItem);
                            if (game.pov.isGod && !ip.type) {
                                ip.type = thingType;
                                singleton.outputText(command + " is " + thingType + ".");
                            } else if (ip.type != thingType) {
                                singleton.outputText("You cannot " + firstWord + " " + command);
                            } else {
                                if( !game.pov.isGod ) {
                                    // TBD - add bookkeeping
                                    singleton.outputText("You " + firstWord + " " + command);
                                } else {
                                    singleton.outputText(command + " is " + thingType + ".");
                                }
                            }
                        } else if (existingItem != "?") {
                            singleton.dontSee(command,game.pov.location,origCommand);
                        }
                    }
                } else if (singleton.isDirection(lCase)) {
                    lCase = singleton.isDirection(lCase).primary;
                    if (game.getLocation(game.pov.location)) {
                        var nextLoc = game.getLocation(game.pov.location)[lCase];
                        if (!nextLoc) {
                            if( game.pov.isGod ) {
                                var design = game.design;
                                if (!game.map) {
                                    game.map = game.createMap();
                                } else if (game.map.location.room != game.pov.location) {
                                    game.recalcLocation(game.map, game.pov.location);
                                }
                                var level = game.map.location.level;
                                var row = game.map.location.row;
                                var col = game.map.location.col;

                                if( game.pov.location && design.lastNonVoid ) {
                                    if( game.getLocation(game.pov.location).type == "void" ) {
                                        if (lCase == "u") {
                                            lCase = "+";
                                        } else if (lCase == "d") {
                                            lCase = "-";
                                        }
                                    }
                                }
                                if( lCase == "+" ||  lCase == "-" ) {
                                    if( design.lastNonVoid && design.lastNonVoidPendingVoid ) {
                                        if( lCase == "+" ) {
                                            design.lastNonVoidDelta = design.lastNonVoidDelta + 1;
                                        } else {
                                            design.lastNonVoidDelta = design.lastNonVoidDelta - 1;
                                        }
                                        game.getLocation(design.lastNonVoidPendingVoid)[game.util.reverseDirection(design.lastNonVoidDirection)].direction = -design.lastNonVoidDelta;
                                        game.map = null;
                                        singleton.describeLocation();
                                    }
                                } else {
                                    if (lCase == "n") {
                                        row = row - 1;
                                    } else if (lCase == "s") {
                                        row = row + 1;
                                    } else if (lCase == "e") {
                                        col = col + 1;
                                    } else if (lCase == "w") {
                                        col = col - 1;
                                    } else if (lCase == "u") {
                                        level = level + 1;
                                    } else if (lCase == "d") {
                                        level = level - 1;
                                    } else if (lCase == "se") {
                                        row = row + 1;
                                        col = col + 1;
                                    } else if (lCase == "sw") {
                                        row = row + 1;
                                        col = col - 1;
                                    } else if (lCase == "ne") {
                                        row = row - 1;
                                        col = col + 1;
                                    } else if (lCase == "nw") {
                                        row = row - 1;
                                        col = col - 1;
                                    }
                                    var posCell = null;
                                    if (0 <= level && level < game.map.levels.length
                                        && 0 <= row && row < game.map.levels[level].length
                                        && 0 <= col && col < game.map.levels[level][row].length
                                    ) {
                                        posCell = game.map.levels[level][row][col];
                                    }
                                    if( game.pov.location ) {
                                        if( game.getLocation(game.pov.location).type != "void" ) {
                                            design.lastNonVoid = game.pov.location;
                                            design.lastNonVoidDirection = lCase;
                                            design.lastNonVoidDelta = 0;
                                            design.lastNonVoidPendingVoid = null;
                                        }
                                    }
                                    if (posCell) {
                                        if( game.getLocation(game.pov.location).type == "void" && game.getLocation(posCell).type != "void" ) {
                                            // clean up all the voids
                                            voids.clear(game);
                                        }
                                        design.lastLocation = game.pov.location
                                        design.lastDirection = lCase;
                                        game.pov.location = posCell;
                                        singleton.describeLocation();
                                    } else {
                                        design.lastLocation = game.pov.location;                                    
                                        var voidCounter = 1;
                                        while( game.getLocation("void"+voidCounter) ) {
                                            voidCounter = voidCounter + 1;
                                        }
                                        game.pov.location = "void"+voidCounter;
                                        // Single link void back to cell
                                        game.setLocation(game.pov.location,{ name : "void" , type : "void" , description : "void" });
                                        if( design.lastLocation && game.getLocation(design.lastLocation).type == "void" ) {
                                            game.getLocation(game.pov.location)[game.util.reverseDirection(lCase)] = { location: design.lastLocation , "wall" : "none" };
                                        } else {
                                            game.getLocation(game.pov.location)[game.util.reverseDirection(lCase)] = { location: design.lastLocation };
                                        }
                                        design.lastDirection = lCase;
                                        if( !design.lastNonVoidPendingVoid ) {
                                            design.lastNonVoidPendingVoid = game.pov.location;
                                        }
                                        game.map = null;
                                        singleton.describeLocation();
                                    }
                                }
                            } else {
                                singleton.outputText("You cannot go that way.");
                            }
                        } else {
                            var isBlocked = false;
                            if( nextLoc.door ) {
                                var objState = game.getObjectState(nextLoc.door);
                                if( objState ) {
                                    if( objState.access == "closed" ) {
                                        isBlocked = true;
                                    }
                                }
                            }
                            if( isBlocked && !game.pov.isGod ) {
                                singleton.outputText("The door is closed!");
                            } else {
                                if( game.pov.location ) {
                                    if( game.getLocation(game.pov.location).type == "void" && game.getLocation(nextLoc.location).type != "void" ) {
                                        // clean up all the voids
                                        voids.clear(game);
                                    } else if( nextLoc.teleport ) {
                                        game.map = null;
                                    }
                                }
                                if( lCase == "o" || lCase == "i" ) {
                                    game.map = null;
                                }
                                var design = game.design;
                                design.lastLocation = game.pov.location;
                                design.lastDirection = lCase;
                                game.pov.location = nextLoc.location;
                                singleton.describeLocation();
                            }
                        }
                    } else {
                        singleton.describeLocation(false);
                    }
                /*} else if (firstWord == "!makedoor" && game.pov.isGod ) {
                    command = subSentence( command , 1);
                    if( isDirection(command) ) {
                        lCase = isDirection(command).primary;
                    } else {
                        lCase = "lastdirection";
                    }
                    if (game.getLocation(game.pov.location)) {
                        var nextLoc = game.getLocation(game.pov.location)[lCase];
                        if (nextLoc) {
                            lastDirection = lCase;
                            lastLocation = game.pov.location;
                            game.pov.location = nextLoc.location;
                            stateMachine = stateMachineFillinCreate({},[
                                {msg:"Door name:",prop:"name"}
                            ],function(sm) {
                                if( sm.data.name  && sm.data.name.length > 1  ) {
                                    var name = extractNounAndAdj(sm.data.name);
                                    name = game.getUniqueItemName(name,"door",game.util.calcCommonPrefix(game.pov.location,lastLocation));
                                    game.setDoor(name,{ name: sm.data.name , type : "door" });
                                    game.getLocation(lastLocation)[lastDirection].door = name;
                                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].door = name;
                                    game.pov.location = lastLocation;
                                    game.map = null;
                                    describeLocation();
                                }
                            });
                        } else if( lCase == "lastdirection" ) { 
                            if( lastDirection 
                              && lastLocation 
                              ) {
                                stateMachine = stateMachineFillinCreate({},[
                                    {msg:"Door name:",prop:"name"}
                                ],function(sm) {
                                    if( sm.data.name  && sm.data.name.length > 1  ) {
                                        var name = extractNounAndAdj(sm.data.name);
                                        var lastLocDir = null;
                                        var curLocDir = null;
                                        name = game.getUniqueItemName(name,"door",game.util.calcCommonPrefix(game.pov.location,lastLocation));
                                        game.setDoor(name,{ name: sm.data.name , type : "door"});
                                        lastLocDir = game.getLocation(lastLocation)[lastDirection];
                                        curLocDir = game.getLocation(game.pov.location)[reverseDirection(lastDirection)]
                                        if( !lastLocDir
                                         && !curLocDir 
                                          ) {
                                            game.getLocation(lastLocation)[lastDirection] = { location : game.pov.location , door : name };
                                            game.getLocation(game.pov.location)[reverseDirection(lastDirection)] = { location : lastLocation , door : name};
                                        } else if( lastLocDir && curLocDir ) {
                                            lastLocDir.door = name;
                                            curLocDir.door = name;
                                        } else {
                                            outputText("Locations are not paired from "+lastDirection);
                                        }
                                        game.map = null;
                                        describeLocation();
                                    }
                                });
                            } else {
                                outputText("There is no ending location. lastLocation="+lastLocation+" lastDirection="+lastDirection+ " game.pov.location="+game.pov.location);
                            }
                        } else {
                            outputText("There is no opening to the "+lCase);
                        }
                    } else {
                        outputText("There is no starting location.");
                    }
                } else if ( (firstWord == "!makepath" || firstWord == "!makepassage" || firstWord == "!makestairs") && game.pov.isGod ) {
                    if( lastLocation ) {
                        var dirCType = firstWord.substring(5);
                        if( game.getLocation(lastLocation)[lastDirection] ) {
                            game.getLocation(lastLocation)[lastDirection].type = dirCType;
                            game.getLocation(game.pov.location)[reverseDirection(lastDirection)].type = dirCType;
                        } else if( !game.getLocation(game.pov.location)[reverseDirection(lastDirection)] ) {
                            game.getLocation(lastLocation)[lastDirection] = { location : game.pov.location , type : dirCType};
                            game.getLocation(game.pov.location)[reverseDirection(lastDirection)] = {location : lastLocation , type : dirCType};
                        }
                    } else {
                        outputText("There is no starting location.");
                    }*/
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
                    if (game.pov.isGod ) {
                        if( game.verbCommand.action ) {
                            command = singleton.helper.subSentence( command , 1);
                            if( command.length > 0 ) {
                                var _npc = singleton.findNPC(game.verbCommand.npc);
                                // TBD - also look for game.items (for verbs like push/pull etc)...
                                if( _npc && _npc.conversation ) {
                                    if( _npc.conversation[game.verbCommand.action] ) {
                                        if( _npc.conversation[game.verbCommand.action][game.verbCommand.topic] ) {
                                            var modResponse = _npc.conversation[game.verbCommand.action][game.verbCommand.topic].response;
                                            if( typeof(modResponse) == "string" ) {
                                                modResponse = { "then" : [modResponse,command] };
                                            } else {
                                                if( !modResponse.then || !modResponse.or ) {
                                                    modResponse = { "then" : [modResponse,command] };
                                                } else if( !modResponse.then ) {
                                                    modResponse.then = [];
                                                }
                                                modResponse.then.push(command);
                                            }
                                            _npc.conversation[game.verbCommand.action][game.verbCommand.topic].response = modResponse;
                                        }
                                    } else if( game.verbCommand.action == "talkto") {
                                        if( _npc.conversation.talkto ) {
                                            var modResponse = _npc.conversation.talkto.response;
                                            if( typeof(modResponse) == "string" ) {
                                                modResponse = { "then" : [modResponse,command] };
                                            } else {
                                                if( !modResponse.or && !modResponse.then) {
                                                    modResponse = { "then" : [modResponse,command] };
                                                } else if( !modResponse.then ) {
                                                    modResponse.then = [];
                                                }
                                                modResponse.then.push(command);
                                            }
                                            _npc.conversation.talkto.response = modResponse;
                                        }
                                    }
                                }
                            }
                        } else {
                            singleton.outputText("then requires a prior action");    
                        }
                    } else {
                        singleton.outputText("then what?");
                    }
                } else if( firstWord == "or" ) {
                    // alt script
                    if (game.pov.isGod ) {
                        if( game.verbCommand.action ) {
                            command = singleton.helper.subSentence( command , 1);
                            if( command.length > 0 ) {
                                var _npc = singleton.findNPC(game.verbCommand.npc);
                                // TBD - also look for game.items (for verbs like push/pull etc)...
                                if( _npc ) {
                                    if( _npc.conversation[game.verbCommand.action] ) {
                                        if( game.verbCommand.topic ) {
                                            if( _npc.conversation[game.verbCommand.action][game.verbCommand.topic] ) {
                                                var modResponse = _npc.conversation[game.verbCommand.action][game.verbCommand.topic].response;
                                                if( typeof(modResponse) == "string" ) {
                                                    modResponse = { "or" : [modResponse,command] };
                                                } else {
                                                    if( !modResponse.or && !modResponse.then) {
                                                        modResponse = { "or" : [modResponse,command] };
                                                    } else if( !modResponse.or ) {
                                                        modResponse.or = [];
                                                    }
                                                    modResponse.or.push(command);
                                                }
                                                _npc.conversation[game.verbCommand.action][game.verbCommand.topic].response = modResponse;
                                            } 
                                        } else {
                                            if( _npc.conversation[game.verbCommand.action] ) {
                                                var modResponse = _npc.conversation[game.verbCommand.action].response;
                                                if( typeof(modResponse) == "string" ) {
                                                    modResponse = { "or" : [modResponse,command] };
                                                } else {
                                                    if( !modResponse.or && !modResponse.then) {
                                                        modResponse = { "or" : [modResponse,command] };
                                                    } else if( !modResponse.or ) {
                                                        modResponse.or = [];
                                                    }
                                                    modResponse.or.push(command);
                                                }
                                                _npc.conversation[game.verbCommand.action].response = modResponse;
                                            } 
                                        }
                                    } else {
                                        singleton.outputText("No action defined");
                                    }
                                } else {
                                    singleton.outputText("Need a NPC");
                                }
                            } else {
                                singleton.outputText("Expected prose to follow 'or'.")
                            }
                        } else {
                            singleton.outputText("Need an action");
                        }
                    } else {
                        singleton.outputText("or not.");
                    }
                } else if( firstWord == "score") {
                    // linear script
                    command = singleton.helper.subSentence( command , 1);
                    if( command.length > 0 ) {
                        if (game.pov.isGod ) {
                            var value = Number.parseInt(command);
                            if( value > 0 ) {
                                var ptr = getConvoObjectPtr();
                                if( ptr ) {
                                    ptr.score = value; 
                                } else {
                                    singleton.outputText("Must have run a conversation to set an associated score");
                                }
                            }
                        } else {
                            singleton.outputText("Must be in game.god mode to set score");
                        }
                    } else {
                        if( game.state.Score ) {
                            singleton.outputText("Score: "+game.state.Score);
                        } else {
                            singleton.outputText("Score: 0");
                        }
                    }
                } else if ( firstWord == "acquire" && game.pov.isGod ) {
                    // Be given an item
                    command = singleton.helper.subSentence( command , 1);
                    var existingItem = singleton.lookupItem(game.pov.location,command);
                    if (existingItem && existingItem != "?") {
                        var ptr = getConvoObjectPtr();
                        if( ptr ) {
                            ptr.give = existingItem; 
                        } else {
                            singleton.outputText("Must have run a conversation to acquire an item");
                        }                
                    } else if( existingItem != "?" ) {
                        singleton.outputText(command+" does not exist");
                    } else {
                        singleton.outputText("????");
                    }                
                } else if ( 
                    firstWord == "!sit" 
                 || firstWord == "!lie" 
                 || firstWord == "!stand"
                 || firstWord == "!goin" 
                ) {
                    firstWord = firstWord.substring(1);
                    command = singleton.helper.subSentence( command , 1);
                    game.verbCommand.preposition  = singleton.resources.wordMap.resources.posturePrep[command.split(" ")[0]];
                    if( game.verbCommand.preposition  ) {
                        command = singleton.helper.subSentence( command , 1);
                    }
                    if( command.length ) {
                        var existingItem = singleton.lookupItem(game.pov.location,command);
                        if (existingItem && existingItem != "?") {
                            var ip =game.getItem(existingItem);
                            if( firstWord == "goin"  ) {
                                // Item portals to nested location..
                                if( ip.location ) {
                                    // go to object
                                    if( game.getLocation(ip.location) ) {
                                        game.pov.location = ip.location;
                                        game.map = null;
                                        singleton.describeLocation();
                                    }
                                } else if( game.pov.isGod ) {
                                    // Make a top level object... 
                                    if( game.pov.location )  {
                                        var design = game.design;
                                        design.pendingGoInsideItem = existingItem;                                        
                                        design.pendingItemOut = game.pov.location; 
                                        game.pov.location = null;
                                        game.map = null;
                                        singleton.describeLocation();
                                    }
                                }
                            } else if( allowPosture(ip,firstWord) ) {
                                singleton.outputText("You "+firstWord + " on " + ip.name + ".");
                            } else if( game.pov.isGod ) {
                                if( !ip.postures ) {
                                    ip.postures = [];
                                }
                                ip.postures.push(firstWord);
                                singleton.outputText("You can now "+firstWord + " on " + ip.name + ".");
                            } else {
                                singleton.outputText("You cannot "+firstWord + " on " + ip.name + ".");
                            }
                        } else if (existingItem != "?") {
                            singleton.dontSee(command,game.pov.location,origCommand);
                        }
                    }
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
                            if( game.allowGodMode ) {
                                if( singleton.godGame ) {
                                    game = singleton.godGame;
                                    singleton.game = game;
                                }
                                game.pov = game.god;
                            } else {
                                singleton.outputText("God mode not available.")
                            }
                        } else if( command == game.actor.name ) {
                            if( game.pov.isGod ) {
                                if( singleton.godGame ) {
                                    // Work from a copy
                                    game = new Game(settings);
                                    singleton.game = game;
                                    game.cloneFrom(singleton.godGame);
                                } else {
                                    game.state = {};
                                }
                            }
                            game.pov = game.actor;
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
                        doAnnotation(game.annotations[index-1]);
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
                        singleton.noUnderstand();
                    } else {
                        singleton.outputText("Command not handled ");
                    }
                }
            }
        }
        return true;
    };
    //---------------------------------------------------------------------------
    // Load a Game from JSON
    var loadGame = function (onComplete) {
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
                } else if( game.allowGodMode ) {
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
        generate({ folder : folder , settings : settings , metadata : game.metadata, game : game , actor : game.actor, getLocation : function(name) { return game.getLocation(name); } , locations : game.locations , items : game.items , npc : game.npc });
    };
    var exportInform = function(folder) {
        var generate = require("./generate-inform");
        generate({ folder : folder , settings : settings , game : game });
    };
    var createDumpFile = function(err) {
        game.createDumpFile(err);
    };
    var stateMachineCommand = function(command) {
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

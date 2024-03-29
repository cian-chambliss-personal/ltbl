module.exports = function(singleton) {
    var stateMachineFillinCreate = singleton.stateMachine.fillinCreate;
    var extractNounAndAdj = singleton.helper.extractNounAndAdj;
    var definePartOf = singleton.definePart;
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
                var game = singleton.game;
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
                    var game = singleton.game;
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
                var game = singleton.game;
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
                preposition: ["about","for","to"]
            } ,
            eval : function(args) {
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
        },
        {
            match : {
                verb : "!eat",
                dObj : "actor"
            } , 
            eval : function(args) {
                var game = singleton.game;
                var ip = game.getItem(args.dObj);
                if ( ip.type && ip.type != "food" ) {
                    singleton.outputText("You cannot eat "+ip.name+".");
                } else {
                    ip.type = "food";
                    singleton.outputText("Ok");
                }
            }
        },
        {
            match : {
                verb : "!wear",
                dObj : "actor"
            } , 
            eval : function(args) {
                var game = singleton.game;
                var ip = game.getItem(args.dObj);
                if (ip.type && ip.type !=  "wearable" ) {
                    singleton.outputText("You cannot wear "+ip.name+".");
                } else {
                    ip.type = "wearable";
                    singleton.outputText("Ok");
                }
            }
        },
        {
            match : {
                verb : "!light",
                dObj : "actor"
            } , 
            eval : function(args) {
                var game = singleton.game;
                var ip = game.getItem(args.dObj);
                if (ip.type && ip.type !=  "light" ) {
                    singleton.outputText("You cannot light "+ip.name+".");
                } else {
                    ip.type = "light";
                    singleton.outputText("Ok");
                }
            }
        },
        {
            match : {
                verb : "!affix",
                dObj : "actor"
            } , 
            eval : function(args) {
                var game = singleton.game;
                var ip = game.getItem(args.dObj);
                if (ip.type && ip.type !=  "fixture" ) {
                    singleton.outputText("You cannot affix "+ip.name+".");
                } else {
                    ip.type = "fixture";
                    singleton.outputText("Ok");
                }
            }
        },
        {
            match : {
                verb : "!acquire",
                dObj : "actor"
            } , 
            eval : function(args) {
                var ptr = singleton.getConvoObjectPtr();
                if( ptr ) {
                    ptr.give = args.dObj; 
                } else {
                    singleton.outputText("Must have run a conversation to acquire an item");
                }
            }
        },
        {
           match : "[subject:npc] is male",
           eval : function(args) {
               var npc = game.getNpc(args.subject);
               npc.gender = "male";
               singleton.outputText("Ok "+ip.name+" is male.");
           }
        },
        {
            match : "[subject:npc] is female",
            eval : function(args) {
               var game = singleton.game;
               var npc = game.getNpc(args.subject);
               npc.gender = "female";
               singleton.outputText("Ok "+npc.name+" is female.");
            }
        },
        {
            match : "[subject:npc] is an animal",
            eval : function(args) {
                var game = singleton.game;
                var npc = game.getNpc(args.subject);
                npc.species = "animal";
                singleton.outputText("Ok "+npc.name+" is an animal.");              
            }
        },
        {
            match : "[subject:npc] is a man",
            eval : function(args) {
               var game = singleton.game;
               var npc = game.getNpc(args.subject);
               npc.gender = "male";
               npc.species = "person";
               singleton.outputText("Ok "+npc.name+" is female.");
            }
        },
        {
            match : "[subject:npc] is a woman",
            eval : function(args) {
               var game = singleton.game;
               var npc = game.getNpc(args.subject);
               npc.gender = "female";
               npc.species = "person";
               singleton.outputText("Ok "+npc.name+" is female.");
            }
        },
        {
            match : "[subject:npc] is a person",
            eval : function(args) {
                var game = singleton.game;
                var npc = game.getNpc(args.subject);
                npc.species = "person";
                singleton.outputText("Ok "+npc.name+" is a person.");              
            }
        },
        {
            match : "every [type] provides [dObj] property",
            eval : function(args) {
                console.log("PROVIDES TYPE HANDLER ");
                console.dir(args);
            }
        },
        {
           match : "[subject] provides [dObj] property",
           eval : function(args) {
               console.log("PROVIDES HANDLER ");
               console.dir(args);
           }
        },
        {
            match : "[subject] is part of every [type]",
            eval : function(args) {
                definePartOf(args);
            }
        },
        {
            match : "[subject] is a part of every [type]",
            eval : function(args) {
                definePartOf(args);
            }
        },
        {
            match : "[subject] are part of every [type]",
            eval : function(args) {
                args.plural = true;
                definePartOf(args);
            }
        },
        {
            match : "[subject] are a part of every [type]",
            eval : function(args) {
                args.plural = true;
                definePartOf(args);
            }
        },
        {
            match : "[subject] is part of [dObj]",
            eval : function(args) {
                definePartOf(args);
            }
        },
        {
            match : "[subject] is a part of [dObj]",
            eval : function(args) {
                definePartOf(args);
            }
        },
        {
            match : "[subject] are part of [dObj]",
            eval : function(args) {
                args.plural = true;
                definePartOf(args);
            }
        },
        {
            match : "[subject] are a part of [dObj]",
            eval : function(args) {
                args.plural = true;
                definePartOf(args);
            }
        }
    ];
    /*
Missing door logic -- Change levels Up & down etc
     } else if (mode == 'door?') {
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
    return { godCommandPatterns : godCommandPatterns };
}
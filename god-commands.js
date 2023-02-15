module.exports = function(singleton) {
    var stateMachineFillinCreate = singleton.stateMachine.fillinCreate;
    var extractNounAndAdj = singleton.helper.extractNounAndAdj;
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
                preposition: ["about","for"]
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
        }
    ];
    return { godCommandPatterns : godCommandPatterns };
}
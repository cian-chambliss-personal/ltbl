module.exports = function(singleton) {
    var stateMachineFillinCreate = singleton.stateMachine.fillinCreate;
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
    var takeFromContainerHandler = function(args) {
        var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game; 
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
                var ip = game.getItem(args.dObj);
                if (ip.content) {
                    singleton.outputText(ip.content);
                } else {
                    singleton.outputText("There is nothing written on the "+ip.name);
                }
            },
            godEval: function(args) {
                var game = singleton.game;
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
                var game = singleton.game;
                var ip = game.getItem(args.dObj);
                if (ip.smell && ip.smell.description ) {
                    singleton.outputText(ip.smell.description);
                } else {
                    singleton.outputText("You notice no smell in particular.");
                }
            },
            godEval: function(args) {
                var game = singleton.game;
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
                var game = singleton.game;
                var ip = game.getItem(args.dObj);
                if (ip.touch && ip.touch.description ) {
                    singleton.outputText(ip.touch.description);
                } else {
                    singleton.outputText("You don't notice anything out of the ordinary.");
                }
            },
            godEval: function(args) {
                var game = singleton.game;
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
                var game = singleton.game;
                var ip = game.getItem(args.dObj);
                if (ip.sound && ip.sound.description ) {
                    singleton.outputText(ip.sound.description);
                } else {
                    singleton.outputText("You don't notice any sound.");
                }
            },
            godEval: function(args) {
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                var game = singleton.game;
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
                    singleton.noUnderstand();
                }
            }
        },
        {
            match : {
                verb : [ "!sit","!lie","!stand","!goin" ],
                dObj : "*" 
            } , 
            eval : function(args) {
                var game = singleton.game;
                var ip = game.getItem(args.dObj);
                var verb = args.verb.substring(1);
                if( args.verb == "!goin"  ) {
                   game.verbCommand.preposition  = "in";
                } else {
                    game.verbCommand.preposition = "on";    
                }
                if( args.verb == "!goin"  ) {
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
                            design.pendingGoInsideItem = args.dObj;                                        
                            design.pendingItemOut = game.pov.location; 
                            game.pov.location = null;
                            game.map = null;
                            singleton.describeLocation();
                        }
                    }
                } else if( allowPosture(ip,verb) ) {
                    singleton.outputText("You "+verb + " on " + ip.name + ".");
                    // TBD add state for non god
                } else if( game.pov.isGod ) {
                    if( !ip.postures ) {
                        ip.postures = [];
                    }
                    ip.postures.push(verb);
                    singleton.outputText("You can now "+verb + " on " + ip.name + ".");
                } else {
                    singleton.outputText("You cannot "+verb + " on " + ip.name + ".");
                }
            }
        },
        {
            match: {
                verb : "!saveplay"
            },
            eval : function(args) {
                var game = singleton.game;
                game.saveCommands();
                singleton.outputText("Saved");
            }
        }
    ];
    return { commandPatterns : commandPatterns };
}
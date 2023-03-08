module.exports = function(singleton) {
    var chalk = singleton.chalk;
    var stateMachineFillinCreate = singleton.stateMachine.fillinCreate;
    var doAnnotation = function(anno) {
        var game = singleton.game;
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
                singleton.spellcheckedText(ip,"description","Change entire item description:");
            }
        } else if( anno.type == "item.content" ) {
            var ip = game.getItem(anno.item);
            if( ip ) {
                singleton.spellcheckedText(ip,"content","Change entire item readable content:");
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
                game.stateMachine = stateMachineFillinCreate(loc,[{msg:"Change location name:",prop:"name"}],singleton.invalidateMap);
            }
        } else if( anno.type == "location.description" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                singleton.spellcheckedText(loc,"description","Change entire location description:");
            }
        } else if( anno.type == "location.type" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                game.stateMachine = stateMachineFillinCreate(loc,[{msg:"Change location type:",prop:"type",choices:singleton.resources.roomTypesMenu}],singleton.invalidateMap);
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
                    singleton.outputText(ni.description+" "+singleton.annotate({"type":"npc.description","npc":anno.npc}));
                } else {
                    singleton.outputText("No Description "+singleton.annotate({"type":"npc.description","npc":anno.npc}));    
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
        } else if( anno.type == "conv" || anno.type.substring(0,5) == "conv." ) {
            var ni = game.getNpc(anno.npc);
            if( ni ) {
                var ap = ni.conversation[anno.action]; 
                if( ap ) {
                    if( anno.topic && ap[anno.topic] ) {
                         ap = ap[anno.topic];
                         if( anno.preposition && ap[anno.preposition] ) {
                            ap = ap[anno.preposition];
                         }
                    }
                    if( ap.response ) {
                        game.annotations = [];
                        var emitResponse = function(response,parent) {
                            if( typeof(response) == "string" ) {
                                singleton.outputText( response + singleton.annotate({ type:parent+".response" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                                singleton.outputText( "Add actions..." + singleton.annotate({ type:parent+".response.action" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                                if( parent == "conv.") {
                                    singleton.outputText( "And then..." + singleton.annotate({ type:parent+".andthen" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                                    singleton.outputText( "Or else..." + singleton.annotate({ type:parent+".orelse" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                                }
                            } else if( response.then ) {
                                for( var i = 0 ; i < response.then.length ; ++i ) {
                                    if( i > 0 ) {
                                        singleton.outputText(chalk.green("And then ..."));
                                    }
                                    emitResponse(response.then[i],parent+".then."+i+".");
                                }
                                singleton.outputText( "And then..." + singleton.annotate({ type:parent+".andthen" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                            } else if( response.or ) {
                                for( var i = 0 ; i < response.or.length ; ++i ) {
                                    if( i > 0 ) {
                                        singleton.outputText(chalk.green("Or else..."));
                                    }
                                    emitResponse(response.or[i],parent+".or."+i+".");
                                }
                                singleton.outputText( "Or else..." + singleton.annotate({ type:parent+".orelse" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                            } else {
                                if( response.say ) {
                                    singleton.outputText( "Say: " + response.say + singleton.annotate({ type:parent+".response.say" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                                } else {
                                    singleton.outputText( "Say: " + singleton.annotate({ type:parent+".response.say" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );    
                                }
                                if( response.score ) {
                                    singleton.outputText( "Score: " + response.score + singleton.annotate({ type:parent+".response.score" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                                }
                                if( response.give ) {
                                    singleton.outputText( "Give: " + response.give + singleton.annotate({ type:parent+".response.give" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                                }
                                if( response.take ) {
                                    singleton.outputText( "Take: " + response.take + singleton.annotate({ type:parent+".response.take" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                                }
                                if( response.consume ) {
                                    singleton.outputText( "Consume: " + response.consume + singleton.annotate({ type:parent+".response.consume" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                                }
                                singleton.outputText( "Add actions..." + singleton.annotate({ type:parent+".response.action" , npc : anno.npc , action : anno.action , preposition  : anno.preposition , topic : anno.topic }) );
                            }
                        };
                        if( anno.type == "conv.response" ) {
                            if( typeof(ap.response) == "string" ) {
                                game.stateMachine = stateMachineFillinCreate(ap,[{msg:"Change NPC response:",prop:"response"}]);
                            }
                        } else if( anno.type == "conv" ) {
                            emitResponse(ap.response,"conv.");
                        } else {

                        }
                    }
                }
            }           
            //{ type:"conv" , game.npc : vc.npc , action : vc.action , preposition  : vc.preposition , topic : vc.topic }
        }
    };
    return { doAnnotation : doAnnotation };
}
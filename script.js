module.exports = function(singleton) {
    var stateMachineFillin = singleton.stateMachine.fillin;
    var stateMachineFillinStart = singleton.stateMachine.fillinStart;
    var defineNPCStates = [{
        msg: "Describe character called {game.npc}:", prop : "newNPC"
    } ];
    var defineScript = function() {
        var game = singleton.game;
        var  states = [];
        var  testNpc = false;
        var design = game.design;
        if( !game.verbCommand.npc ) {
            states.push({ msg : "who?" , prop : "npc"});
            testNpc = true;
        } else if( !singleton.findNPC(game.verbCommand.npc) ) {
            testNpc = true;
        }
        if( testNpc ) {
            states.push({ test : function(state,command) { if( singleton.findNPC(state.data.npc) ) { return "skip"; } return "expand"; }  ,
                states : defineNPCStates 
            } );
        }
        if( singleton.resources.verbsWithTopics[game.verbCommand.action] && !game.verbCommand.topic ) {
            states.push({ msg : "whats the topic of the '"+game.verbCommand.action+"'?" , prop : "topic"});
        }
        if( game.verbCommand.topic ) {
            if( game.verbCommand.preposition ) {
                states.push({ msg : "whats the response for '"+game.verbCommand.action+" "+game.verbCommand.preposition +" "+game.verbCommand.topic+"'?" , prop : "response"});
            } else {
                states.push({ msg : "whats the response for '"+game.verbCommand.action+" about "+game.verbCommand.topic+"'?" , prop : "response"});
            }
        } else {
            states.push({ msg : "whats the response for '"+game.verbCommand.action+"'?" , prop : "response"});
        }
        game.stateMachine = {
            state : 0 ,
            data : game.verbCommand ,
            states : states,
            execute : stateMachineFillin,
            start: stateMachineFillinStart,
            askAbort: function() {
                singleton.outputText("Do you want to quit? (y to quit)");
            },
            done: function(sm) {
                var vc = sm.data;
                if( vc.npc ) {
                    var _npc = singleton.findNPC(vc.npc);
                    if( !_npc && vc.newNPC ) {
                        var newNPC  = vc.npc;
                        newNPC = newNPC.toLowerCase().trim();
                        _npc = {
                            name : newNPC ,
                            description : vc.newNPC ,
                            location : game.pov.location 
                        };
                        game.setNpc(camelCase(newNPC),_npc);
                    }
                    if( _npc ) {
                        if( singleton.resources.verbsWithTopics[vc.action] ) {
                            if( !_npc.conversation ) {
                                _npc.conversation = {};
                            }                            
                            if( !_npc.conversation[vc.action] ) {
                                _npc.conversation[vc.action] = {};
                            }
                            if( game.verbCommand.preposition  ) {
                                _npc.conversation[vc.action][vc.topic] = { preposition  : vc.preposition  , response : vc.response };
                            } else {
                                _npc.conversation[vc.action][vc.topic] = { response : vc.response };
                            }
                            singleton.outputText('"'+vc.response+'"');
                        } else if( vc.action == "talkto" || vc.action == "hi" || vc.action == "bye" || vc.action == "leave" || vc.action == "notice" ) {
                            if( !_npc.conversation ) {
                                _npc.conversation = {};
                            }
                            _npc.conversation[vc.action] = { response : vc.response };
                            singleton.outputText('"'+vc.response+'"');    
                        } else {
                            singleton.outputText("**Bad action");
                        }
                    } else {
                        singleton.outputText("**No NPC")
                    }
                } else {
                    singleton.outputText("npc parameter not defined");
                }
            }
        };
        if( !game.stateMachine.start(game.stateMachine) ) {
            game.stateMachine = null;
        }
    };
    var processScript = function() {
        var game = singleton.game;
        var design = game.design;
        var emitResponse = function(response,vc,stateId) {
            if( typeof(response) == "string" ) {
                game.annotations = [];
                singleton.outputText( response + singleton.annotate({ type:"conv" , npc : vc.npc , action : vc.action , preposition  : vc.preposition , topic : vc.topic }) );
                return true;
            } else if( response.then ) {
                var responseIndex = game.state[stateId+".then"];
                if( responseIndex ) {
                    if( !emitResponse( response.then[responseIndex],vc,stateId ) )
                         return false;
                    if( response.then.length > (responseIndex+1) ) {
                        game.state[stateId+".then"] = (responseIndex+1);
                    }
                } else {
                    if( !emitResponse( response.then[0],vc,stateId ) )
                        return false;
                    if( response.then.length > 1 ) {
                        game.state[stateId+".then"] = 1;
                    }
                }
            } else if( response.or ) {
                var responseIndex = game.state[stateId+".or"];
                if( responseIndex ) {
                    if( !emitResponse( response.or[responseIndex],vc,stateId ) )
                        return false;
                    if( response.or.length > (responseIndex+1) ) {
                        game.state[stateId+".or"] = (responseIndex+1);
                    } else {
                        game.state[stateId+".or"] = 0;
                    }
                } else {
                    if( !emitResponse( response.or[0],vc,stateId ) )
                        return false;
                    if( response.or.length > 1 ) {
                        game.state[stateId+".or"] = 1;
                    }
                }
            } else {
                // All the actions
                if( response.take ) {
                    var npcPtr = game.getNpc(vc.npc);
                    if( !npcPtr )
                        return false;
                    var item = singleton.removeItem(game.pov.inventory,"@"+response.take);
                    if( !item ) 
                        return false;
                    if( npcPtr ) {
                        if( !npcPtr.inventory ) {
                            npcPtr.inventory = [];
                        }
                        npcPtr.inventory.push({item:item});
                    }
                }
                if( response.consume ) {
                    var item = singleton.removeItem(game.pov.inventory,"@"+response.consume);
                    if( !item ) 
                        return false;
                }
                if( response.give ) {
                    var npcPtr = game.getNpc(vc.npc);
                    if( !npcPtr )
                        return false;
                    if( !npcPtr.inventory ) 
                        return false;
                    var item = singleton.removeItem(npcPtr.inventory,"@"+response.give);
                    if( !item ) 
                        return false;                    
                    game.pov.inventory.push({ item : item });
                }
                if( response.say ) {
                    game.annotations = [];
                    singleton.outputText( response.say + singleton.annotate({ type:"conv" , npc : vc.npc , action : vc.action , preposition  : vc.preposition , topic : vc.topic }));
                }
                if( response.score ) {
                    if( !game.state[stateId+".score"] ) {
                        game.state[stateId+".score"] = true;
                        if( !game.state.Score ) {
                            game.state.Score = 0;
                        }
                        game.state.Score = game.state.Score + response.score;
                        singleton.outputText("Score went up by "+response.score+" Points");
                    }
                }
                //if( response.die ) {
                //}
            }
            return true;
        };
        if( !game.verbCommand.npc ) {
            return false;
        } else if( !singleton.findNPC(game.verbCommand.npc) ) {
            return false;
        } else if( singleton.resources.verbsWithTopics[game.verbCommand.action] && !game.verbCommand.topic ) {
            return false;
        } else {
            if( singleton.resources.verbsWithTopics[game.verbCommand.action] ) {
                if( !game.verbCommand.preposition  ) {
                    if( game.verbCommand.topic.substring(0,6) == "about " ) {
                        game.verbCommand.preposition  = "about";
                        game.verbCommand.topic = game.verbCommand.topic.substring(6).trim();
                    }
                }
                var _npc = singleton.findNPC(game.verbCommand.npc);
                if( _npc.conversation ) {
                    _npc = _npc.conversation[game.verbCommand.action];
                    if( _npc ) {
                        _npc = _npc[game.verbCommand.topic];
                    }
                } else {
                   _npc = null;
                }
                if( _npc ) {
                    emitResponse(_npc.response,game.verbCommand,game.verbCommand.npc+game.verbCommand.action+game.verbCommand.topic);
                    return true;
                } else if(game.pov.isGod) {
                    return false;
                } else {
                    singleton.noUnderstand();
                    return true;
                }
            } else {
                var _npc = singleton.findNPC(game.verbCommand.npc);
                if( _npc ) {
                    if( _npc.conversation ) {
                        if( game.verbCommand.action == "talkto" ) {
                            _npc = _npc.conversation.talkto;
                        } else if( _npc.conversation[game.verbCommand.action] ) {
                            _npc = _npc.conversation[game.verbCommand.action];                            
                        } else {
                            _npc = null;
                        }
                    } else {
                        _npc = null;
                    }
                }
                if( _npc && _npc.response ) {
                    emitResponse(_npc.response,game.verbCommand,game.verbCommand.npc+game.verbCommand.action+game.verbCommand.topic);
                    return true;
                } else if(game.pov.isGod) {
                    return false;
                } else {
                    singleton.noUnderstand();
                    return true;
                }
            }
        }       
        return false;
    };
    var getConvoObjectPtr = function(command) {
        var game = singleton.game;
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

    return { defineScript : defineScript , processScript : processScript , getConvoObjectPtr : getConvoObjectPtr };
}
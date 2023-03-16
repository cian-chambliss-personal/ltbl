module.exports = function (singleton) {
    var stateMachineFillin = singleton.stateMachine.fillin;
    var stateMachineFillinStart = singleton.stateMachine.fillinStart;
    var defineNPCStates = [{
        msg: "Describe character called {npc}:", prop: "newNPC"
    }];
    //=================================================================
    var defineScript = function () {
        var game = singleton.game;
        var states = [];
        var testNpc = false;
        var isAction = false;
        if( game.actions ) {
            if( game.actions[game.verbCommand.action] ) {
                isAction = true;
            }
        }
        if (!game.verbCommand.npc) {
            console.dir(game.verbCommand);
            states.push({ msg: "who?", prop: "npc" });
            testNpc = true;
        } else if (!singleton.findNPC(game.verbCommand.npc)) {
            testNpc = true;
        }
        if (testNpc) {
            states.push({
                test: function (state, command) { if (singleton.findNPC(state.data.npc)) { return "skip"; } return "expand"; },
                states: defineNPCStates
            });
        }
        if( !isAction ) {
            if (singleton.resources.verbsWithTopics[game.verbCommand.action] && !game.verbCommand.topic) {
                states.push({ msg: "whats the topic of the '" + game.verbCommand.action + "'?", prop: "topic" });
            }
        }
        if (game.verbCommand.topic) {
            if (game.verbCommand.preposition) {
                states.push({ msg: "whats the response for '" + game.verbCommand.action + " " + game.verbCommand.preposition + " " + game.verbCommand.topic + "'?", prop: "response" });
            } else {
                states.push({ msg: "whats the response for '" + game.verbCommand.action + " about " + game.verbCommand.topic + "'?", prop: "response" });
            }
        } else {
            states.push({ msg: "whats the response for '" + game.verbCommand.action + "'?", prop: "response" });
        }
        game.stateMachine = {
            state: 0,
            data: game.verbCommand,
            states: states,
            execute: stateMachineFillin,
            start: stateMachineFillinStart,
            askAbort: function () {
                singleton.outputText("Do you want to quit? (y to quit)");
            },
            done: function (sm) {
                var vc = sm.data;
                if (vc.npc) {
                    var _npc = singleton.findNPC(vc.npc);
                    if (!_npc && vc.newNPC) {
                        var newNPC = vc.npc;
                        newNPC = newNPC.toLowerCase().trim();
                        _npc = {
                            name: newNPC,
                            description: vc.newNPC,
                            location: game.pov.location
                        };
                        game.setNpc(camelCase(newNPC), _npc);
                    }
                    if (_npc) {
                        if( isAction ) {
                            if( !_npc.actions ) {
                                _npc.actions = {};
                            }
                            _npc.actions[vc.action] = { response : vc.response };
                        } else if (singleton.resources.verbsWithTopics[vc.action]) {
                            if (!_npc.conversation) {
                                _npc.conversation = {};
                            }
                            if (!_npc.conversation[vc.action]) {
                                _npc.conversation[vc.action] = {};
                            }
                            if (game.verbCommand.preposition) {
                                _npc.conversation[vc.action][vc.topic] = { preposition: vc.preposition, response: vc.response };
                            } else {
                                _npc.conversation[vc.action][vc.topic] = { response: vc.response };
                            }
                            singleton.outputText('"' + vc.response + '"');
                        } else if (vc.action == "talkto" || vc.action == "hi" || vc.action == "bye" || vc.action == "leave" || vc.action == "notice") {
                            if (!_npc.conversation) {
                                _npc.conversation = {};
                            }
                            _npc.conversation[vc.action] = { response: vc.response };
                            singleton.outputText('"' + vc.response + '"');
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
        if (!game.stateMachine.start(game.stateMachine)) {
            game.stateMachine = null;
        }
    };
    var doAction = function (action, vc, stateId) {
        var game = singleton.game;
        if (typeof (action) == "string") {
            game.annotations = [];
            singleton.outputText(action + singleton.annotate({ type: "conv", npc: vc.npc, action: vc.action, preposition: vc.preposition, topic: vc.topic }));
            return true;
        } else if (action.then) {
            var responseIndex = game.state[stateId + ".then"];
            if (responseIndex) {
                if (!doAction(action.then[responseIndex], vc, stateId))
                    return false;
                if (action.then.length > (responseIndex + 1)) {
                    game.state[stateId + ".then"] = (responseIndex + 1);
                }
            } else {
                if (!doAction(action.then[0], vc, stateId))
                    return false;
                if (action.then.length > 1) {
                    game.state[stateId + ".then"] = 1;
                }
            }
        } else if (action.or) {
            var responseIndex = game.state[stateId + ".or"];
            if (responseIndex) {
                if (!doAction(action.or[responseIndex], vc, stateId))
                    return false;
                if (action.or.length > (responseIndex + 1)) {
                    game.state[stateId + ".or"] = (responseIndex + 1);
                } else {
                    game.state[stateId + ".or"] = 0;
                }
            } else {
                if (!doAction(action.or[0], vc, stateId))
                    return false;
                if (action.or.length > 1) {
                    game.state[stateId + ".or"] = 1;
                }
            }
        } else {
            // All the actions
            if (action.take) {
                var npcPtr = game.getNpc(vc.npc);
                if (!npcPtr)
                    return false;
                var item = singleton.removeItem(game.pov.inventory, "@" + action.take);
                if (!item)
                    return false;
                if (npcPtr) {
                    if (!npcPtr.inventory) {
                        npcPtr.inventory = [];
                    }
                    npcPtr.inventory.push({ item: item });
                }
            }
            if (action.consume) {
                var item = singleton.removeItem(game.pov.inventory, "@" + action.consume);
                if (!item)
                    return false;
            }
            if (action.give) {
                var npcPtr = game.getNpc(vc.npc);
                if (!npcPtr)
                    return false;
                if (!npcPtr.inventory)
                    return false;
                var item = singleton.removeItem(npcPtr.inventory, "@" + action.give);
                if (!item)
                    return false;
                game.pov.inventory.push({ item: item });
            }
            if (action.say) {
                game.annotations = [];
                singleton.outputText(action.say + singleton.annotate({ type: "conv", npc: vc.npc, action: vc.action, preposition: vc.preposition, topic: vc.topic }));
            }
            if (action.score) {
                if (!game.state[stateId + ".score"]) {
                    game.state[stateId + ".score"] = true;
                    if (!game.state.Score) {
                        game.state.Score = 0;
                    }
                    game.state.Score = game.state.Score + action.score;
                    singleton.outputText("Score went up by " + action.score + " Points");
                }
            }
            //if( action.die ) {
            //}
        }
        return true;
    };
    //=================================================================  
    var processScript = function () {
        var game = singleton.game;
        var design = game.design;
        var _npc = null;
        var _item = null;
        var _origPtr = null;
        if (game.verbCommand.npc)
            _npc = singleton.findNPC(game.verbCommand.npc);
        else if (game.verbCommand.item)
            _item = game.getItem(game.verbCommand.item);

        if (!_npc && !_item) {
            return false;
        } else if (_npc && (singleton.resources.verbsWithTopics[game.verbCommand.action] && !game.verbCommand.topic)) {
            return false;
        } else {
            if (_npc) {
                _origPtr = _npc;
                if (singleton.resources.verbsWithTopics[game.verbCommand.action]) {
                    if (!game.verbCommand.preposition) {
                        if (game.verbCommand.topic.substring(0, 6) == "about ") {
                            game.verbCommand.preposition = "about";
                            game.verbCommand.topic = game.verbCommand.topic.substring(6).trim();
                        }
                    }
                    if (_npc.conversation) {
                        _npc = _npc.conversation[game.verbCommand.action];
                        if (_npc) {
                            _npc = _npc[game.verbCommand.topic];
                        }
                    } else {
                        _npc = null;
                    }
                    if (_npc) {
                        doAction(_npc.response, game.verbCommand, game.verbCommand.npc + game.verbCommand.action + game.verbCommand.topic);
                        return true;
                    } else if (game.pov.isGod) {
                        return false;
                    } else {
                        singleton.noUnderstand();
                        return true;
                    }
                } else {
                    if (_npc) {
                        if (_npc.conversation) {
                            if (game.verbCommand.action == "talkto") {
                                _npc = _npc.conversation.talkto;
                            } else if (_npc.conversation[game.verbCommand.action]) {
                                _npc = _npc.conversation[game.verbCommand.action];
                            } else {
                                _npc = null;
                            }
                        } else {
                            _npc = null;
                        }
                    } else {
                        _npc = null;
                    }
                    if( !_npc ) {
                        if( _origPtr.actions ) {
                            _npc = _origPtr.actions[game.verbCommand.action];
                        }
                    }
                    if (_npc && _npc.response) {
                        doAction(_npc.response, game.verbCommand, game.verbCommand.npc + game.verbCommand.action + game.verbCommand.topic);
                        return true;
                    } else if (game.pov.isGod) {
                        return false;
                    } else {
                        singleton.noUnderstand();
                        return true;
                    }
                }
            } else if( _item ) {
                // Perform action on an item...
            }
        }
        return false;
    };
    //=================================================================  
    var getConvoObjectPtr = function (command) {
        var game = singleton.game;
        if (game.verbCommand.action) {
            var _npc = singleton.findNPC(game.verbCommand.npc);
            if (_npc) {
                var ptr = null;
                var rContainer = null;
                if (game.verbCommand.action == "talkto") {
                    if (_npc.conversation.talkto) {
                        rContainer = _npc.conversation.talkto;
                        ptr = rContainer.response;
                    }
                } else if (_npc.conversation[game.verbCommand.action]) {
                    if (_npc.conversation[game.verbCommand.action][game.verbCommand.topic]) {
                        rContainer = _npc.conversation[game.verbCommand.action][game.verbCommand.topic];
                        ptr = rContainer.response;
                    }
                }
                if (ptr) {
                    if (typeof (ptr) == "string") {
                        ptr = { "say": ptr };
                        if (rContainer) {
                            rContainer.response = ptr;
                        }
                    } else if (ptr.then) {
                        if (typeof (ptr.then[ptr.then.length - 1]) == "string") {
                            ptr.then[ptr.then.length - 1] = { "say": ptr.then[ptr.then.length - 1] };
                            ptr = ptr.then[ptr.then.length - 1];
                        } else {
                            ptr = ptr.then[ptr.then.length - 1];
                        }
                    } else if (ptr.or) {
                        if (typeof (ptr.or[ptr.or.length - 1]) == "string") {
                            ptr.then[ptr.or.length - 1] = { "say": ptr.or[ptr.or.length - 1] };
                            ptr = ptr.or[ptr.or.length - 1];
                        } else {
                            ptr = ptr.or[ptr.or.length - 1];
                        }
                    }
                    return ptr;
                }
            }
        }
        return null;
    };
    //=================================================================
    var thenDo = function (command) {
        var game = singleton.game;
        if (game.pov.isGod) {
            if (game.verbCommand.action) {
                command = singleton.helper.subSentence(command, 1);
                if (command.length > 0) {
                    var _npc = singleton.findNPC(game.verbCommand.npc);
                    // TBD - also look for game.items (for verbs like push/pull etc)...
                    var actions = null;
                    if( _npc ) {
                        if ( _npc.actions && _npc.actions[game.verbCommand.action] ) {
                            actions = _npc.actions;    
                        } else if ( _npc.conversation) {
                            actions = _npc.conversation;
                        }
                    }
                    if( actions ) {
                        if (actions[game.verbCommand.action]) {
                            if (actions[game.verbCommand.action][game.verbCommand.topic]) {
                                var modResponse = actions[game.verbCommand.action][game.verbCommand.topic].response;
                                if (typeof (modResponse) == "string") {
                                    modResponse = { "then": [modResponse, command] };
                                } else {
                                    if (!modResponse.then || !modResponse.or) {
                                        modResponse = { "then": [modResponse, command] };
                                    } else if (!modResponse.then) {
                                        modResponse.then = [];
                                    }
                                    modResponse.then.push(command);
                                }
                                actions[game.verbCommand.action][game.verbCommand.topic].response = modResponse;
                                return;
                            }
                        } 
                        if (game.verbCommand.action == "talkto" || actions != _npc.conversation ) {
                            if (actions[game.verbCommand.action]) {
                                var modResponse = actions[game.verbCommand.action].response;
                                if (typeof (modResponse) == "string") {
                                    modResponse = { "then": [modResponse, command] };
                                } else {
                                    if (!modResponse.or && !modResponse.then) {
                                        modResponse = { "then": [modResponse, command] };
                                    } else if (!modResponse.then) {
                                        modResponse.then = [];
                                    }
                                    modResponse.then.push(command);
                                }
                                actions[game.verbCommand.action].response = modResponse;
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
    };
    //=================================================================
    var orDo = function (command) {
        var game = singleton.game;
        if (game.pov.isGod) {
            if (game.verbCommand.action) {
                command = singleton.helper.subSentence(command, 1);
                if (command.length > 0) {
                    var _npc = singleton.findNPC(game.verbCommand.npc);
                    // TBD - also look for game.items (for verbs like push/pull etc)...
                    if (_npc) {
                        var actions = null;
                        if ( _npc.actions && _npc.actions[game.verbCommand.action] ) {
                            actions = _npc.actions;    
                        } else if ( _npc.conversation) {
                            actions = _npc.conversation;
                        }
                        if( actions ) {
                            if (actions[game.verbCommand.action]) {
                                if (game.verbCommand.topic) {
                                    if (actions[game.verbCommand.action][game.verbCommand.topic]) {
                                        var modResponse = actions[game.verbCommand.action][game.verbCommand.topic].response;
                                        if (typeof (modResponse) == "string") {
                                            modResponse = { "or": [modResponse, command] };
                                        } else {
                                            if (!modResponse.or && !modResponse.then) {
                                                modResponse = { "or": [modResponse, command] };
                                            } else if (!modResponse.or) {
                                                modResponse.or = [];
                                            }
                                            modResponse.or.push(command);
                                        }
                                        actions[game.verbCommand.action][game.verbCommand.topic].response = modResponse;
                                    }
                                } else {
                                    if (actions[game.verbCommand.action]) {
                                        var modResponse = actions[game.verbCommand.action].response;
                                        if (typeof (modResponse) == "string") {
                                            modResponse = { "or": [modResponse, command] };
                                        } else {
                                            if (!modResponse.or && !modResponse.then) {
                                                modResponse = { "or": [modResponse, command] };
                                            } else if (!modResponse.or) {
                                                modResponse.or = [];
                                            }
                                            modResponse.or.push(command);
                                        }
                                        actions[game.verbCommand.action].response = modResponse;
                                    }
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
    };
    var scoreDo = function (command) {
        var game = singleton.game;
        command = singleton.helper.subSentence(command, 1);
        if (command.length > 0) {
            if (game.pov.isGod) {
                var value = Number.parseInt(command);
                if (value > 0) {
                    var ptr = singleton.getConvoObjectPtr();
                    if (ptr) {
                        ptr.score = value;
                    } else {
                        singleton.outputText("Must have run a conversation to set an associated score");
                    }
                }
            } else {
                singleton.outputText("Must be in game.god mode to set score");
            }
        } else {
            if (game.state.Score) {
                singleton.outputText("Score: " + game.state.Score);
            } else {
                singleton.outputText("Score: 0");
            }
        }
    };
    var processAction = function(action,vc,stateId) {
        return doAction(action, vc, stateId);
    };
    return { defineScript: defineScript, processScript: processScript, processAction : processAction, getConvoObjectPtr: getConvoObjectPtr, thenDo: thenDo, orDo: orDo, scoreDo: scoreDo  };
}
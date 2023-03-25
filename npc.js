module.exports = function(singleton) {
    var findNPC =function(name) {
        name = name.toLowerCase().trim();
        var cc = singleton.helper.camelCase(name);
        var game = singleton.game;
        var _npc = game.npc[cc];
        if( _npc ) {
            // well known short name...
            return _npc;
        }
        for( var _ind in game.npc ) {
            var _npc = game.npc[_ind];
            if( _npc.name == name ) {
                return _npc;
            }
            if( _npc.alias ) {
                for( var i = 0 ; i < _npc.alias.length ; ++i ) {
                    if( _npc.alias[i] == name ) {
                        return _npc;
                    }
                }
            }
        }
        return null;
    };

    var findNPCs = function(name) {
        var list = [];
        name = name.toLowerCase().trim();
        var cc = singleton.helper.camelCase(name);
        var game = singleton.game;
        if( game.npc[cc] ) {
            // well known short name...
            return [cc];
        }
        for( var _ind in game.npc ) {
            var _npc = game.npc[_ind];
            if( _npc.name == name ) {
                return [_ind];
            }
            if( _npc.description.indexOf(name) >= 0 ) {
                list.push(_ind);
            } else if( _npc.name.indexOf(name) >= 0 ) {
                list.push(_ind);
            } else if( _npc.alias ) {
                for( var i = 0 ; i < _npc.alias.length ; ++i ) {
                    if( _npc.alias[i] == name ) {
                        list.push(_ind);
                        break;
                    }
                }
            }
        }
        return list;
    };

    

    // data
    
    
    var describeNPC = function(npc,preposition,search) {
        var game = singleton.game;
        var npcPtr = game.getNpc(npc);
        if( npcPtr.description ) {
            singleton.outputText(npcPtr.description);
        } else if(game.pov.isGod) {
            game.stateMachine = singleton.stateMachine.fillinCreate(npcPtr,[ {msg:"How would you describe " + npcPtr.name + "?",prop:"description"} ]);
        } else {
            singleton.outputText(npcPtr.name);
        }
    };
    return { findNPC : findNPC , findNPCs: findNPCs , describeNPC : describeNPC };

}
module.exports = function(singleton) {
    var definePart =function(args) {
        var game = singleton.game;
        if( args.type ) {
            // Lets go after 'types'
            var _type = game.types[args.type];
            if( !_type ) {
                _type = {};
                game.types[args.type] = _type;
            }
            if( !_type.parts ) {
                _type.parts = {};
            }
            var _part = _type.parts[args.subject];
            if( !_part ) {
                _part = { name : args.subject };
                _type.parts[args.subject] = _part;
            }
            if( args.plural ) {
                _part.plural = true;
                singleton.outputText("Ok, "+args.subject+" are part of every "+args.type);
            } else {
                singleton.outputText("Ok, "+args.subject+" is part of every "+args.type);
            }
        } else if( args.dObj ) {
            var npc = singleton.findNPC(args.dObj);
            if( npc ) {
                if( !npc.parts ) {
                    npc.parts = {};
                }
                var _part = npc.parts[args.subject];
                if( !_part ) {
                    _part = { name : args.subject };
                    npc.parts[args.subject] = _part;
                }
                if( args.plural ) {
                    _part.plural = true;
                    singleton.outputText("Ok, "+args.subject+" are part of "+args.dObj);
                } else {
                    singleton.outputText("Ok, "+args.subject+" is part of "+args.dObj);
                }
            } else {
                var objName = singleton.lookupItem(game.pov.location,args.dObj);
                if( objName && objName != "?") {
                    var _item = game.getItem(objName);
                    if( _item ) {
                        if( !_item.parts ) {
                            _item.parts = {};
                        }
                        var _part = _item.parts[args.subject];
                        if( !_part ) {
                            _part = { name : args.subject };
                            _item.parts[args.subject] = _part;
                        }
                        if( args.plural ) {
                            _part.plural = true;
                            singleton.outputText("Ok, "+args.subject+" are part of "+args.dObj);
                        } else {
                            singleton.outputText("Ok, "+args.subject+" is part of "+args.dObj);
                        }
                    } else  {
                        singleton.dontSee(args.dObj,game.pov.location);
                    }               
                } else if( !objName ) {
                    singleton.dontSee(args.dObj,game.pov.location);
                }
            }
        } else {
            singleton.outputText("Must supply a type or an object or npc");
        }
    };
    return { definePart : definePart };
}
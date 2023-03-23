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
            }
            console.dir("Ok, "+args.subject+" is part of every "+args.type);
        } else if( args.dObj ) {
            console.log("TBD...");

        } else {
            console.log("Must supply a type or an object or npc");
        }
    };
    return { definePart : definePart };
}
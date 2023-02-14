module.exports = function(singleton) {
    var noCareAbout = function (locationId,filterOn) {
        var game = singleton.game;
        var dontCare = [];
        var loc = game.getLocation(locationId);
        if( loc.description ) {
            // Look for all the nouns in a room that cannot be resolved...
            var parts = getPartsOfSpeech(loc.description,true);
            var nameParts = {};
            if( loc.name ) {
                nameParts = getPartsOfSpeech(loc.name,true);
            }
            var exclude = nameParts.objects;
            if( !exclude ) {
                exclude = [];
            }
            for( var i = 0 ; i < parts.objects.length ; ++i ) {
                if( !isArticle(parts.objects[i]) && !lookupItem(locationId,parts.objects[i]) ) {
                    var excluded = false;
                    for( var j = 0 ; j < exclude.length ; ++j ) {
                        if( exclude[j] == parts.objects[i]) {
                            excluded = true;
                        }
                    }
                    if( !excluded ) {
                        dontCare.push(parts.objects[i]);
                    }
                }                
            }            
            if( filterOn ) {
                if( dontCare.length > 0 ) {
                    // Find the match...
                    var parts = getPartsOfSpeech(filterOn,true);
                    var test = dontCare;
                    dontCare = [];                    
                    for( var i = 0 ; i <  parts.objects.length ; ++i ) {
                        for( var j = 0 ; j < test.length ; ++j ) {
                            if( test[j].indexOf(parts.objects[i]) >= 0 ) {
                                return [test[j]];
                            }
                        }
                    }
                }                        
            }
        }
        return dontCare;
    };
    var noUnderstand = function() {
        singleton.outputText("What was that?");
    };
    var dontSee = function (what,locationId,command) {
        var dontCare = noCareAbout(locationId,what);
        if( dontCare.length > 0 ) {
            if( command ) {
                if( command.indexOf(what) >= 0 ) {
                    command = command.split(what).join("the "+dontCare[0]);
                }
                singleton.outputText("You cannot " + command);
            } else {
                singleton.outputText("I don't know what you want me to do with the " + dontCare[0]);
            }
        } else {
            singleton.outputText("You see no " + what);
        }
    };
    var dontSeeNpc = function (npc,locationId,command) {
        singleton.outputText("You dont see " + npc);
    };
    return { dontSee : dontSee , dontSeeNpc : dontSeeNpc , noUnderstand : noUnderstand , noCareAbout : noCareAbout};
};
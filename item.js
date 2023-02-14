module.exports = function(singleton) {
    var lookupItemLow = function (parts,arr,command,candidates) {
        var itemName = null;
        if( command[0] == '@' ) {
            command = command.substring(1);
            for (var i = 0; i < arr.length; ++i) {
                 if( arr[i].item == command ) {
                    itemName = command;
                    break;
                 }
            }
        } else if( command == '{*}' ) { 
            for (var i = 0; i < arr.length; ++i) {
                candidates.push( arr[i].item );
            }
        } else {
            for (var i = 0; i < arr.length; ++i) {
                var item = arr[i].item;
                var game = singleton.game;
                var ptr = game.getItem(item);
                if (ptr) {
                    var lname = ptr.name;
                    if (command == lname.toLowerCase()) {
                        itemName = item;
                        break;
                    } else {
                        if( ptr.alias ) {
                            for (var j = 0; j <  ptr.alias.length; ++j) {
                                lname = ptr.alias[j];
                                if (command == lname.toLowerCase()) {
                                    itemName = item;
                                    break;
                                }
                            }
                            if( itemName ) {
                                break;
                            }
                        }
                        var iparts = singleton.helper.getPartsOfSpeech(lname);
                        var foundPart = false;
                        for (var j = 0; j < parts.noun.length; ++j) {
                            for (var k = 0; k < iparts.noun.length; ++k) {
                                if (iparts.noun[k] == parts.noun[j]) {
                                    foundPart = true;
                                    break;
                                }
                            }
                            if (foundPart) {
                                break;
                            }
                        }
                        if (foundPart) {
                            candidates.push(item);
                        }
                    }
                }
            }
        }
        return itemName;
    };
    var lookupItemArr = function (command, arr) {
        var itemName = null;
        if (command != "" && arr ) {
            var candidates = [];
            var parts = singleton.helper.getPartsOfSpeech(command);
            itemName = lookupItemLow(parts,arr,command,candidates);
            if( !itemName ) {
                if( candidates.length > 0 ) {
                    if( candidates.length == 1 ) {
                        itemName = candidates[0];                       
                    }
                }
            }
        }
        return itemName;
    };
    var findItems = function (command) {
        var candidates = [];
        var allItems = [];
        var game = singleton.game;
        for(var _item in game.items ) {
            allItems.push({ item : _item});
        }
        var parts = singleton.helper.getPartsOfSpeech(command);
        var item = lookupItemLow(parts,allItems,command,candidates);

        if( item && item != "?" ) {
            if( candidates.length < 1 ) {
                candidates = [item];
            }
        }
        return candidates;
    };
    var lookupItem = function (locationId,command, flags) {
        var itemName = null;
        if (command != "") {
            var game = singleton.game;
            var where = game.getLocation(locationId);
            var candidates = [];
            var what = command;
            command = command.toLowerCase();
            var parts = singleton.helper.getPartsOfSpeech(command);
            if (flags != "noactor" && game.pov.inventory )
                itemName = lookupItemLow(parts,game.pov.inventory,command,candidates);
            if (where.contains && !itemName && flags != "actor") {
                itemName = lookupItemLow(parts,where.contains,command,candidates);
            }
            if( !itemName && flags != "actor") {
                var doors = [];
                for( var i = 0 ; i < singleton.directionsNames.length ; ++i ) {
                    var dir = where[singleton.directionsNames[i]];
                    if( dir ) {
                        if( dir.door ) {
                            doors.push({ item : dir.door });
                        }
                    }
                }
                if( doors.length ) {
                    itemName = lookupItemLow(parts,doors,command,candidates);
                }
            }
            if (!itemName && flags != "actor" && where.wall) {
                if (!itemName && where.wall.n) {
                    if (where.wall.n.contains) {
                        itemName = lookupItemLow(parts,where.wall.n.contains,command,candidates);
                    }
                }
                if (!itemName && where.wall.s) {
                    if (where.wall.s.contains) {
                        itemName = lookupItemLow(parts,where.wall.s.contains,command,candidates);
                    }
                }
                if (!itemName && where.wall.e) {
                    if (where.wall.e.contains) {
                        itemName = lookupItemLow(parts,where.wall.e.contains,command,candidates);
                    }
                }
                if (!itemName && where.wall.w) {
                    if (where.wall.w.contains) {
                        itemName = lookupItemLow(parts,where.wall.w.contains,command,candidates);
                    }
                }
            }
            if (!itemName && flags != "actor") {
                var disclosedList = game.state[locationId+"_disclosed"];
                if( disclosedList ) {
                    var disclosed = [];                        
                    for(var item in disclosedList ) {
                        disclosed.push({item:item});
                    }
                    itemName = lookupItemLow(parts,disclosed,command,candidates);
                }
            }
            if( command == "{*}") {
                itemName = candidates.join("\n");
            } else if (!itemName) {                
                if (candidates.length == 1) {
                    itemName = candidates[0];
                } else if (candidates.length > 1) {
                    singleton.outputText("which " + command + "?");
                    for (var i = 0; i < candidates.length; ++i) {
                        singleton.outputText(game.getItem(candidates[i]).name);
                    }
                    itemName = "?"; // ambiguouse
                } else if( game.pov.isGod && command.substring(0,1) == "@" ) {                    
                    // God is all seeing
                    itemName = game.getItemFromLCased(command.substring(1));
                }
            }
        }
        return itemName;
    };
    var removeItem = function(inventory,command) {
        var item = lookupItemArr(command,inventory);
        if (item) {
            var game = singleton.game;
            for (var i = 0; i < game.pov.inventory.length; ++i) {
                if (inventory[i].item == item) {
                    inventory.splice(i, 1);
                    return item;
                }
            }
        }
        return null;
    }; 
    return {
        lookupItem : lookupItem ,
        lookupItemArr : lookupItemArr ,
        lookupItemLow : lookupItemLow ,
        findItems : findItems,
        removeItem : removeItem
    };
}
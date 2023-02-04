const path = require("path");

//---------------------------------------------------------------------------
// Generate a TADs source file....
module.exports = function(args) {
    var filename = args.filename;
    var settings = args.settings;
    var game = args.game;
    var safePrefixAdd = function(prefix,loc) {
        if( prefix ) {
            return prefix+"/"+loc;
        }
        return loc;
    };
    var getParentRoomId = function(id) {
        var delimPos = id.lastIndexOf("/");
        if(delimPos > 0) {
            return id.substring(0,delimPos);
        }
        return null;
    };
    var generateInform = function() {
        var src = "";
        var informNameRev = {};
        var informNameMap = {};
        var roomIdToInform = {};
        var _roomName;

        // Find Rooms that require a unique name
        var  collectRooms = function( _locations , prefix) {
            var loc;
            for (loc in _locations) {
                var room = _locations[loc];
                var name = room.name;
                if( !name ) {
                    name = room.description;
                    if( !name ) {
                        name = loc;
                    }
                }
                if( !informNameRev[name] ) {
                    informNameRev[name] = [prefix+loc];
                } else {
                    informNameRev[name].push(prefix+loc);
                }
                if( room.locations ) {
                    collectRooms(room.locations,safePrefixAdd(prefix,loc));
                }
            }
        };
        var roomUniqueName = function(roomName,rooms) {
            var uniqueNames = {};
            var baseNameUsed  = 0;
            var modifiers = ["Second ","Third ","Forth ","Fifth ","Sixth ","Seventh ","Eighth "];
            for( var i = 0 ; i < rooms.length ; ++i ) {
                var roomId = rooms[i];
                var roomParentName = getParentRoomId(roomId);
                if( roomParentName ) {
                    roomParentName = game.getLocation(roomParentName);
                    if(roomParentName) {
                        if( roomParentName.name ) {
                            roomParentName = roomParentName.name;
                        } else if( roomParentName.description ) {
                            roomParentName = roomParentName.description;
                        } else {
                            roomParentName = null;
                        }
                    }
                }
                if( roomParentName ) {
                    uniqueNames[roomName+" of "+roomParentName] = roomId;
                } else if ( baseNameUsed == 0 ) {
                    baseNameUsed = 1;
                    uniqueNames[roomName] = roomId;
                } else if( baseNameUsed <=modifiers.length ) {
                    uniqueNames[modifiers[baseNameUsed-1]+roomName] = roomId;
                    baseNameUsed = baseNameUsed + 1;
                } else {
                    uniqueNames["#"+baseNameUsed+" "+roomName] = roomId;
                    baseNameUsed = baseNameUsed + 1;
                }
            }
            return uniqueNames;
        };

        collectRooms(game.locations,"");

        // Create unique name mappings where there is ambiguity
        for(_roomName in informNameRev ) {
            var _rooms = informNameRev[_roomName];
            if( _rooms.length == 1 ) {
                informNameMap[_roomName] = _rooms[0];
                roomIdToInform[_rooms[0]] = _roomName;
            } else {
                var uniqueNames = roomUniqueName(_roomName,_rooms);
                var uniqueName;
                for(uniqueName in uniqueNames) {
                    informNameMap[uniqueName] = uniqueNames[uniqueName];
                    roomIdToInform[uniqueName] = uniqueNames[uniqueName];
                }
            }
        }
        for(_roomName in informNameMap ) {
            src = src + _roomName + " is a room with id "+informNameMap[_roomName]+"\n";
        }
        return src;
    };
    var informSrc = generateInform();
    if( informSrc && informSrc.length ) {
        //fs.writeFile(filename, informSrc, {}, function () { });
        console.log(informSrc);
    } else {
        console.log("No code generated");
    }
};

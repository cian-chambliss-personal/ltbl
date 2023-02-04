const path = require("path");
const { isAsyncFunction } = require("util/types");

//---------------------------------------------------------------------------
// Generate a INFORM7 source file....
module.exports = function(args) {
    var filename = args.filename;
    var settings = args.settings;
    var informDirection = {
        "e" : "east",
        "w" : "west",
        "n" : "north",
        "s" : "south",
        "sw" : "southwest",
        "se" : "southeast",
        "nw" : "northwest",
        "ne" : "northeast",
        "u" : "up",
        "d" : "down"
    };
    var game = args.game;
    var quoted = function(txt) {
        return '"'+txt+'"';
    };
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
        var generatedRoom = {};
        var directionHandled = {};

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
                    informNameRev[name] = [safePrefixAdd(prefix,loc)];
                } else {
                    informNameRev[name].push(safePrefixAdd(prefix,loc));
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
                    roomIdToInform[uniqueNames[uniqueName]] = uniqueName;
                }
            }
        }

        var startLoc = game.actor.location;
        if( startLoc ) {
            var goDirection = function(room,loc,direction,pass) {
                var goes = room[direction];
                if( goes ) {
                    if( pass == 1 ) {
                        emitRoom(goes.location);
                    } else if( !directionHandled[direction+":"+loc] ) {
                       var revDir = game.util.reverseDirection(direction);
                       directionHandled[revDir+":"+goes.location] = true;
                       src = src + "The "+roomIdToInform[loc]+" is "+informDirection[revDir]+" of the "+roomIdToInform[goes.location]+".\n";
                    }
                }
            };
            var emitRoom = function(id) {
                if( !generatedRoom[id] ) {
                    generatedRoom[id] = true;
                    var room = game.getLocation(id);
                    src = src + "\nThe "+roomIdToInform[id]+" is a room.";
                    if( room.name && room.name != roomIdToInform[id] ) {
                        src += ' The printed name is '+quoted(room.name); 
                    }
                    if( room.name && room.description && room.name != room.description ) {
                        src += ' The description is '+quoted(room.description);
                    }
                    src = src + "\n";
                    for(var pass = 0 ; pass < 2 ; ++pass ) {
                        for( var dir in informDirection ) {
                            goDirection(room,id,dir,pass);
                        }
                    }
                }
            }
            emitRoom(startLoc);
            if( src.length > 0 ) {
                var titleSection = ""; 
                if( game.metadata.author && game.metadata.title ) {
                    titleSection = quoted(game.metadata.title)+" by "+game.metadata.author+"\n\n";
                }   
                if( game.metadata.title ) {
                    titleSection = titleSection + "The story headline is "+quoted(game.metadata.title)+".  ";
                }
                if( game.metadata.description ) {
                    titleSection = titleSection + "The story description is "+quoted(game.metadata.title)+".  ";
                }
                if( titleSection.length ) {
                    src = titleSection.trim() + "\n\n" + src;
                }
            }
        } else {
            console.log("no starting location.");
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

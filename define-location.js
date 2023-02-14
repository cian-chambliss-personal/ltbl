module.exports = function(singleton) {
    var voids = require("./void-location.js")();
    var friendlyDir = function (dir) {
        var name = singleton.resources.friendlyDir[dir];
        if( name ) {
            return name;
        }
        return dir;
    }
    var locationDefine = function(data) {
        var prefix = "";
        var connectedVoid = { count : 0 };
        var game = singleton.game;
        var design = game.design;
        if( design.lastNonVoid ) {
            if( design.lastNonVoid.indexOf("/") > 0 ) {
                prefix = design.lastNonVoid.substring(0,design.lastNonVoid.indexOf("/"));
                var parentLoc = game.getLocation(prefix);
                if( parentLoc ) {
                    prefix = prefix + "/";
                } else {
                    prefix = "";
                }
                if( !data.roomType ) {
                    if( game.getLocation(design.lastNonVoid).type ) {
                        data.roomType = game.getLocation(design.lastNonVoid).type;
                    }
                }            
            }
        }
        if( prefix == "" ) {
            if( data.type && data.name ) {
                prefix = singleton.helper.extractNounAndAdjAlways(data.name);
                if( prefix && prefix != "" ) {
                    if( game.getLocation(prefix) ) {
                        prefix = prefix + "/";
                    } else{
                        game.setLocation(prefix,{ name : prefix , decription : data.name , type : data.type })
                        prefix = prefix + "/";
                        if( !data.roomType ) {
                            if( data.type == "outdoors" ) {
                                data.roomType = "outside";
                            }
                        }
                    }
                } else {
                    prefix = "";
                }
            }
        }
        if( game.pov.location ) {
            if( game.getLocation(game.pov.location).type == "void" ) {
                connectedVoid = voids.gather(game);
                if( connectedVoid.count  > 1 ) {
                    voids.autoConnect(game,connectedVoid.collectedVoid);
                }
            }
        }
        var calcRoomName = function(prefix,suffix) {
            var roomName = prefix+singleton.helper.extractNounAndAdjAlways(data.room);
            if (roomName) {
                if( suffix ) {
                    var parentRoom = game.getLocation(roomName);
                    if( !parentRoom ) {
                        game.setLocation(roomName,{name:data.room});
                    }
                    roomName = roomName + "/" + suffix;
                }
                // add # to the orginal room (libary,library1,library2...)
                if (game.getLocation(roomName)) {
                    var extactCount = 1;
                    while( game.getLocation(roomName+extactCount) ) {
                        extactCount = extactCount + 1;
                    }
                    roomName = roomName+extactCount;
                }
            } else {
                roomName = prefix+"room" + design.roomNum;
                design.roomNum = design.roomNum + 1;
            }
            return roomName;
        };
        var roomName;
        var name = data.room;
        var parts = singleton.helper.getPartsOfSpeech(data.room);
        game.map = null; // need to recalc the map 

        if( connectedVoid.count > 1 ) {
            var newRoomMap = {};
            // Create rooms for all the voids....
            var minRow = 1000 , minCol = 1000, maxRow = 0, maxCol = 0;
            for( var voidRoom in connectedVoid.voids ) {
                var srcRoom = connectedVoid.voids[voidRoom];

                if( Number.isFinite(srcRoom.row) && Number.isFinite(srcRoom.col) ) {
                    if( maxRow < srcRoom.row ) {
                        maxRow = srcRoom.row;
                    } 
                    if( maxCol < srcRoom.col ) {
                        maxCol = srcRoom.col;
                    }
                    if( minRow > srcRoom.row ) {
                        minRow = srcRoom.row;
                    } 
                    if( minCol > srcRoom.col ) {
                        minCol = srcRoom.col;
                    }
                }
            }
            for( var voidRoom in connectedVoid.voids ) {
                var _name = parts.name;
                var roomDesc = data.room;
                var srcRoom = connectedVoid.voids[voidRoom];
                var suffix = srcRoom.edge;
                if( !suffix && Number.isFinite(srcRoom.row) && Number.isFinite(srcRoom.col) ) {
                    if( maxCol > minCol && maxRow > minRow ) {
                       suffix = "r"+srcRoom.row+"c"+srcRoom.col;
                    } else if( maxRow > minRow ) {
                        suffix = "r"+srcRoom.row;
                    } else if( maxCol > minCol ) {
                        suffix = "c"+srcRoom.col;
                    }
                } else if( !suffix ) {
                    suffix = "part";
                }
                var roomName = calcRoomName(prefix,suffix);
                newRoomMap[voidRoom] = roomName;
                if( srcRoom.edge ) {
                    var edgeName = friendlyDir(srcRoom.edge);
                    _name = edgeName+" "+_name;
                    roomDesc = edgeName+" "+roomDesc;
                }
                game.setLocation(roomName,{ name: _name, description: roomDesc });
                if( data.roomType ) {
                    game.getLocation(roomName).type = data.roomType;
                }
            }
            // Now connect voids (and rooms)
            for( var voidRoom in connectedVoid.voids ) {
                var roomName = newRoomMap[voidRoom];
                var srcRoom = connectedVoid.voids[voidRoom];
                var dstRoom = game.getLocation(roomName);
                var otherLocation;
                if( srcRoom.n && !dstRoom.n ) {
                    if( newRoomMap[srcRoom.n.location] ) {
                        dstRoom.n = { location : newRoomMap[srcRoom.n.location] };
                    } else {
                        dstRoom.n = { location : srcRoom.n.location };
                    }
                    otherLocation = { location : roomName };
                    if( srcRoom.n.wall ) {
                        dstRoom.n.wall = srcRoom.n.wall;
                        otherLocation.wall = srcRoom.n.wall;
                    }
                    game.getLocation(dstRoom.n.location).s = otherLocation;
                }
                if( srcRoom.s && !dstRoom.s ) {
                    if( newRoomMap[srcRoom.s.location] ) {
                        dstRoom.s = { location : newRoomMap[srcRoom.s.location] };
                    } else {
                        dstRoom.s = { location : srcRoom.s.location };
                    }
                    otherLocation = { location : roomName };
                    if( srcRoom.s.wall  ) {
                        dstRoom.s.wall = srcRoom.s.wall;
                        otherLocation.wall = srcRoom.s.wall;
                    }
                    game.getLocation(dstRoom.s.location).n = otherLocation;
                }
                if( srcRoom.e && !dstRoom.e ) {
                    if( newRoomMap[srcRoom.e.location] ) {
                        dstRoom.e = { location : newRoomMap[srcRoom.e.location] };
                    } else {
                        dstRoom.e = { location : srcRoom.e.location };
                    }
                    otherLocation = { location : roomName };
                    if( srcRoom.e.wall ) {
                        dstRoom.e.wall = srcRoom.e.wall;
                        otherLocation.wall = srcRoom.e.wall;
                    }
                    game.getLocation(dstRoom.e.location).w = otherLocation;
                }
                if( srcRoom.w && !dstRoom.w ) {
                    if( newRoomMap[srcRoom.w.location] ) {
                        dstRoom.w = { location : newRoomMap[srcRoom.w.location] };
                    } else {
                        dstRoom.w = { location : srcRoom.w.location };
                    }
                    otherLocation = { location : roomName };
                    if( srcRoom.w.wall ) {
                        dstRoom.w.wall = srcRoom.w.wall;
                        otherLocation.wall = srcRoom.w.wall;
                    }
                    game.getLocation(dstRoom.w.location).e = otherLocation;
                }
                if( srcRoom.u && !dstRoom.u ) {
                    if( newRoomMap[srcRoom.u.location] ) {
                        dstRoom.u = { location : newRoomMap[srcRoom.u.location] };
                    } else {
                        dstRoom.u = { location : srcRoom.u.location };
                    }
                    otherLocation = { location : roomName };
                    if( srcRoom.u.wall ) {
                        dstRoom.u.wall = srcRoom.u.wall;
                        otherLocation.wall = srcRoom.u.wall;
                    }
                    game.getLocation(dstRoom.u.location).d = otherLocation;
                }
                if( srcRoom.d && !dstRoom.d ) {
                    if( newRoomMap[srcRoom.d.location] ) {
                        dstRoom.d = { location : newRoomMap[srcRoom.d.location] };
                    } else {
                        dstRoom.d = { location : srcRoom.d.location };
                    }
                    otherLocation = { location : roomName };
                    if( srcRoom.d.wall ) {
                        dstRoom.d.wall = srcRoom.d.wall;
                        otherLocation.wall = srcRoom.d.wall;
                    }
                    game.getLocation(dstRoom.d.location).u = otherLocation;
                }
            }
            game.pov.location = newRoomMap[game.pov.location];
            design.lastLocation = null;
            design.lastDirection = null;
            // Drop or raise voids
            if( design.lastNonVoid && design.lastNonVoidDelta != 0 ) {
                game.getLocation(design.lastNonVoid)[design.lastNonVoidDirection].direction = design.lastNonVoidDelta;
                game.getLocation(game.getLocation(design.lastNonVoid)[design.lastNonVoidDirection].location)[game.util.reverseDirection(design.lastNonVoidDirection)].direction = -design.lastNonVoidDelta;
            }
            voids.clear(game);
            singleton.describeLocation();
        }  else {
            roomName = calcRoomName(prefix,null);
            game.pov.location = roomName;
            game.setLocation(game.pov.location,{ name: parts.name, description: data.room });
            if( connectedVoid.count > 0 ) {
                voids.clear(game);
            }
            if (design.lastLocation) {
                if (game.getLocation(design.lastLocation).type) {
                    game.getLocation(game.pov.location).type = game.getLocation(design.lastLocation).type;
                }
            }
            if (design.lastLocation && design.lastDirection) {
                game.getLocation(design.lastLocation)[design.lastDirection] = { location: game.pov.location };
                game.getLocation(game.pov.location)[game.util.reverseDirection(design.lastDirection)] = { location: design.lastLocation };
                if( design.lastNonVoidDelta != 0 ) {
                    game.getLocation(design.lastLocation)[design.lastDirection].direction = design.lastNonVoidDelta;
                    game.getLocation(game.pov.location)[game.util.reverseDirection(design.lastDirection)].direction = -design.lastNonVoidDelta;
                }
            }
            if( design.pendingGoInsideItem ) {
                var inItem = game.getItem(design.pendingGoInsideItem);
                if( inItem ) {
                    inItem.location = game.pov.location;
                }
                design.pendingGoInsideItem = null;
            }
            if( design.pendingItemOut ) {
                game.getLocation(game.pov.location).o = { location : design.pendingItemOut };
                design.pendingItemOut = null;
            }
            singleton.describeLocation();
        }    
    };
    return { locationDefine : locationDefine };

};
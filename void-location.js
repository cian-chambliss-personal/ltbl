module.exports = function() {
    var clearVoid = function(game) {
        var voidCounter = 1;
        while( game.locations["void"+voidCounter] ) {
            delete game.locations["void"+voidCounter];
            voidCounter = voidCounter + 1;
        }
        game.map = null; // force regen without the voids....
    };
    var gatherVoid = function(game) {
        var  collectedVoid = {};
        var voidCounter = 1;
        while( game.locations["void"+voidCounter] ) {
            collectedVoid["void"+voidCounter] = game.locations["void"+voidCounter];
            voidCounter = voidCounter + 1;
        }
        return { voids : collectedVoid , count : voidCounter };
    };
    var autoConnectVoids = function(game,collectedVoid) {
        // Connect all voids to other adjecent voids - defines a big room.
        var _map = game.map;
        var rows = _map.levels[_map.location.level];
        var visitedVoid = {};
        var minRow = _map.location.row;
        var minCol = _map.location.col;
        var maxRow = _map.location.row;
        var maxCol = _map.location.col;
        var connectAllVoid = function (r,c) {
            var room = rows[r][c] , otherRoom;
            if( visitedVoid[room] ) {
                return room;
            } else {
                if( room ) {
                    var roomPtr = game.getLocation(room);
                    if( roomPtr ) {
                        if( roomPtr.type == "void" ) {
                            // look for other connection
                            roomPtr.row = r;
                            roomPtr.col = c;
                            if( r < minRow ) {
                                minRow = r;
                            }
                            if( maxRow < r ) {
                                maxRow = r;
                            }
                            if( c < minCol ) {
                                minCol = c;
                            }
                            if( maxCol < c ) {
                                maxCol = c;
                            }
                            visitedVoid[room] = roomPtr;
                            if( c > 0 ) {
                                if( roomPtr.w ) {
                                    if( game.getLocation( roomPtr.w.location ).type == "void" ) {
                                        roomPtr.w.wall = "none";
                                        otherRoom = connectAllVoid(r,c-1);
                                    }                                    
                                } else {
                                    otherRoom = connectAllVoid(r,c-1);
                                    if( otherRoom ) {
                                        roomPtr.w = { location : otherRoom , wall : "none" };
                                        game.getLocation(otherRoom).e = { location : room , wall : "none"};
                                    }
                                }
                            }
                            if( (c + 1) < rows[r].length ) {
                                if( roomPtr.e ) {
                                    if( game.getLocation( roomPtr.e.location ).type == "void" ) {
                                        roomPtr.e.wall = "none";
                                        otherRoom = connectAllVoid(r,c+1);
                                    }                                    
                                } else {
                                    otherRoom = connectAllVoid(r,c+1);
                                    if( otherRoom ) {
                                        roomPtr.e = { location : otherRoom , wall : "none"};
                                        game.getLocation(otherRoom).w = { location : room , wall : "none"};
                                    }
                                }
                            }
                            if( r > 0 ) {
                                if( roomPtr.n ) {
                                    if( game.getLocation( roomPtr.n.location ).type == "void" ) {
                                        roomPtr.n.wall = "none";
                                        otherRoom = connectAllVoid(r-1,c);
                                    }
                                } else {
                                    otherRoom = connectAllVoid(r-1,c);
                                    if( otherRoom ) {
                                        roomPtr.n = { location : otherRoom , wall : "none"};
                                        game.getLocation(otherRoom).s = { location : room , wall : "none"};
                                    }
                                }
                            }
                            if( (r + 1) < rows.length  ) {
                                if( roomPtr.s ) {
                                    if( game.getLocation( roomPtr.s.location ).type == "void" ) {
                                        roomPtr.s.wall = "none";
                                        otherRoom = connectAllVoid(r+1,c);
                                    }
                                } else {
                                    otherRoom = connectAllVoid(r+1,c);
                                    if( otherRoom ) {
                                        roomPtr.s = { location : otherRoom , wall : "none"};
                                        game.getLocation(otherRoom).n = { location : room , wall : "none"};
                                    }
                                }
                            }
                            return room;
                        }
                    }
                }
            }
            return null;
        };
        connectAllVoid(_map.location.row,_map.location.col);
        // Optional 'edge' modifier
        for( var room in visitedVoid ) {
            var roomPtr = visitedVoid[room];
            if( minRow < maxRow ) {
                if( roomPtr.row == minRow ) {
                    roomPtr.edge = "n";
                } else if( roomPtr.row == maxRow ) {
                    roomPtr.edge = "s";
                }
            }
            if( minCol < maxCol ) {
                if( roomPtr.col == minCol ) {
                    if( roomPtr.edge ) {
                        roomPtr.edge = roomPtr.edge+"w";
                    } else {
                        roomPtr.edge = "w";
                    }
                } else if( roomPtr.col == maxCol ) {
                    if( roomPtr.edge ) {
                        roomPtr.edge = roomPtr.edge+"e";
                    } else {
                        roomPtr.edge = "e";
                    }
                }
            }
        }
    };


    return {
        clear: clearVoid,
        gather: gatherVoid,
        autoConnect : autoConnectVoids
    };
}
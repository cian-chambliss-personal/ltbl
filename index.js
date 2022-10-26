const { doesNotReject } = require("assert");
const { findSourceMap } = require("module");
const path = require("path");
const { isAsyncFunction } = require("util/types");

module.exports = function ltbl(settings) {
    var roomNum = 1;
    var itemNum = 1;
    var doorNum = 1;
    var mode = 'where';
    var lastLocation = null;
    var lastDirection = null;
    var describeItem = null;
    var location = null;
    var fs = require("fs");
    var partOfSp = require("./en-parts.json");
    var reservedNames = require("./reserved.json");
    var verbAction = null;
    var propositionAction = null;
    var verbNPC = null;
    var verbsWithTopics = { "ask" : true , "tell" : true };
    var verbTopic = null;
    var metadata = {
        title: null,
        author: null,
        authorEmail: null,
        description: null,
        version: "1",
        IFID: null
    };
    var actor = {
        inventory: []
    };
    var locations = {
    };
    var doors = {
    };
    var items = {
    };
    var npc = {
    };
    var topics = {
    };
    //---------------------------------------------------------------------------
    // Create a spacial map of from the logical description
    var createMap = function () {
        var visited = {};
        var createMapLow = function (row, col, level, _loc, bounds, emitRooms) {
            if (!visited[_loc]) {
                visited[_loc] = true;
                emitRooms(row, col, level, _loc, bounds);
                if (level < bounds.startLevel)
                    bounds.startLevel = level;
                if (level > bounds.endLevel)
                    bounds.endLevel = level;
                if (row < bounds.startRow)
                    bounds.startRow = row;
                if (row > bounds.endRow)
                    bounds.endRow = row;
                if (col < bounds.startCol)
                    bounds.startCol = col;
                if (col > bounds.endCol)
                    bounds.endCol = col;
                var loc = locations[_loc];
                if (loc.w) {
                    createMapLow(row, col - 1, level, loc.w.location, bounds, emitRooms);
                }
                if (loc.e) {
                    createMapLow(row, col + 1, level, loc.e.location, bounds, emitRooms);
                }
                if (loc.n) {
                    createMapLow(row - 1, col, level, loc.n.location, bounds, emitRooms);
                }
                if (loc.nw) {
                    createMapLow(row - 1, col - 1, level, loc.nw.location, bounds, emitRooms);
                }
                if (loc.ne) {
                    createMapLow(row - 1, col + 1, level, loc.ne.location, bounds, emitRooms);
                }
                if (loc.s) {
                    createMapLow(row + 1, col, level, loc.s.location, bounds, emitRooms);
                }
                if (loc.sw) {
                    createMapLow(row + 1, col - 1, level, loc.sw.location, bounds, emitRooms);
                }
                if (loc.se) {
                    createMapLow(row + 1, col + 1, level, loc.se.location, bounds, emitRooms);
                }
                if (loc.d) {
                    createMapLow(row, col, level - 1, loc.d.location, bounds, emitRooms);
                }
                if (loc.u) {
                    createMapLow(row, col, level + 1, loc.u.location, bounds, emitRooms);
                }
            }
        };
        var bounds = {
            startLevel: 0,
            endLevel: 0,
            startRow: 0,
            endRow: 0,
            startCol: 0,
            endCol: 0
        };
        createMapLow(0, 0, 0, location, bounds, function (row, col, level, loc, bounds) { });
        visited = {};
        var nLevel = (bounds.endLevel - bounds.startLevel + 1);
        var nRow = (bounds.endRow - bounds.startRow + 1);
        var nCol = (bounds.endCol - bounds.startCol + 1);
        var levels = [];
        for (var l = 0; l < nLevel; ++l) {
            var rows = [];
            for (var r = 0; r < nRow; ++r) {
                var cols = [];
                for (var c = 0; c < nCol; ++c) {
                    cols.push(null);
                }
                rows.push(cols);
            }
            levels.push(rows);
        }
        createMapLow(0, 0, 0, location, bounds, function (row, col, level, loc, bounds) {
            levels[level - bounds.startLevel][row - bounds.startRow][col - bounds.startCol] = loc;
        });
        return { levels: levels, location: { room: location, level: -bounds.startLevel, row: -bounds.startRow, col: - bounds.startCol } };
    };
    var recalcLocation = function (map, location) {
        for (var l = 0; l < map.levels.length; ++l) {
            var rows = map.levels[l];
            for (var r = 0; r < rows.length; ++r) {
                var cols = rows[r];
                for (var c = 0; c < cols.length; ++c) {
                    if (cols[c] == location) {
                        map.location.room = location;
                        map.location.level = l;
                        map.location.row = r;
                        map.location.col = c;
                        return true;
                    }
                }
            }
        }
        return false;
    }
    var renderMapLevelText = function (map) {
        var rows = map.levels[map.location.level];
        for (var r = 0; r < rows.length; ++r) {
            var cols = rows[r];
            for (var ch = 0; ch < 5; ++ch) {
                var line = "";
                for (var c = 0; c < cols.length; ++c) {
                    var cell = cols[c];
                    if (cell) {
                        cell = locations[cell];
                    }
                    text = "          ";
                    if (cell) {
                        if (cell.type != "outside") {
                            if (ch == 0 || ch == 4) {
                                text = "+--------+";
                            } else {
                                text = "|        |";
                            }
                        }
                        if (ch == 0) {
                            if (cell.n) {
                                if (cell.type == "outside") {
                                    text = "    .     ";
                                } else {
                                    text = "+---|----+";
                                }
                            }
                        } else if (1 <= ch && ch < 4) {
                            var nameParts = "";
                            if (cell.name) {
                                nameParts = cell.name;
                            } else if (cell.description) {
                                nameParts = cell.description;
                            }
                            nameParts = nameParts.split(" ");
                            if (ch <= nameParts.length) {
                                nameParts = nameParts[ch - 1];
                            } else {
                                nameParts = "";
                            }
                            if (nameParts.length > 8) {
                                nameParts = nameParts.substring(0, 8);
                            }
                            if (nameParts != "") {
                                var leadChr = (10 - nameParts.length) / 2;
                                text = text.substring(0, leadChr) + nameParts + text.substring(nameParts.length + leadChr);
                            }
                            if (ch == 2) {
                                if (cell.w) {
                                    if (cell.type == "outside") {
                                        text = "." + text.substring(1);
                                    } else {
                                        text = "=" + text.substring(1);
                                    }
                                }
                                if (cell.e) {
                                    if (cell.type == "outside") {
                                        text = text.substring(0, 9) + ".";
                                    } else {
                                        text = text.substring(0, 9) + "=";
                                    }
                                }
                            }
                        } else if (ch == 4) {
                            if (cell.s) {
                                if (cell.type == "outside") {
                                    text = "    .     ";
                                } else {
                                    text = "+---|----+";
                                }
                            }
                        }
                    }
                    if (map.location.row == r && map.location.col == c) {
                        text = text.split(" ").join(".");
                    }
                    line += text;
                }
                console.log(line);
            }
        }
    };
    var map = null;
    var camelCase = function(name) {
        var words = name.toLowerCase().split(" ");
        name = words[0];
        for( var i = 1 ; i < words.length ; ++i ) {
            name = name + words[i].charAt(0).toUpperCase() + words[i].slice(1);
        }
        return name;
    };
    //---------------------------------------------------------------------------
    // parser Utility functions
    var extractNounAndAdj = function (command) {
        var words = command.toLowerCase().split(" ");
        var altNoun = null;
        var adj = "";
        var adjLoc = -1;
        for (var i = 0; i < words.length; ++i) {
            var pos = partOfSp[words[i]];
            if (pos) {
                if (i > 0 && words[i] == "room") {
                    if ((i - 1) > adjLoc) {
                        if (adj != "") {
                            adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                        } else {
                            adj = words[i];
                        }
                    }
                }
                if ((pos & 8) != 0) {
                    if (adj != "") {
                        adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                    } else {
                        adj = words[i];
                    }
                    if (pos & 1) {
                        altNoun = adj;
                    }
                    adjLoc = i;
                } else if ((pos & 1) != 0) {
                    if (adj.length > 0) {
                        if (adj != "") {
                            adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                        } else {
                            adj = words[i];
                        }
                        return adj;
                    }
                    return words[i];
                }
            } else {
                words[i] = words[i].replace("'", "")
                if (words[i].length > 1 && words[i][words[i].length - 1] == 's') {
                    if (adj != "") {
                        adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                    } else {
                        adj = words[i];
                    }
                    adjLoc = i;
                }
            }
        }
        return altNoun;
    };
    var getPartsOfSpeech = function (command) {
        var parts = { count: 0, noun: [], adj: [], name: "" };
        var words = command.toLowerCase().split(" ");
        var altNoun = null;
        var adj = "";
        var adjLoc = -1;
        var name = [];
        for (var i = 0; i < words.length; ++i) {
            var pos = partOfSp[words[i]];
            if ((pos & 1) != 0) {
                if (parts.noun.length > 0) {
                    if ((partOfSp[parts.noun[parts.noun.length - 1]] & 8) != 0) {
                        parts.adj.push(parts.noun[parts.noun.length - 1]);
                        parts.noun.splice(parts.noun.length - 1, 1);
                    }
                }
                parts.noun.push(words[i]);
                ++parts.count;
                name.push(words[i]);
            } else if ((pos & 8) != 0) {
                parts.adj.push(words[i]);
                ++parts.count;
                name.push(words[i]);
            }
        }
        parts.name = name.join(" ");
        return parts;
    }
    //---------------------------------------------------------------------------
    // Save off to file....
    var saveFile = function () {
        var obj = { 
            metadata: metadata, 
            actor: actor, 
            locations: locations, 
            doors: doors, 
            location: location, 
            items: items, 
            npc: npc , 
            topics : topics 
        };
        fs.writeFile(settings.filename, JSON.stringify(obj, null, "  "), function (err, data) { });
    };

    //---------------------------------------------------------------------------
    // Build a map....
    var reverseDirection = function (dir) {
        if (dir == "s") return "n";
        if (dir == "n") return "s";
        if (dir == "e") return "w";
        if (dir == "w") return "e";
        if (dir == "u") return "d";
        if (dir == "d") return "u";
        if (dir == "sw") return "ne";
        if (dir == "se") return "nw";
        if (dir == "ne") return "sw";
        if (dir == "nw") return "se";
        if (dir == "o") return "i";
        if (dir == "i") return "o";
        return dir;
    };
    var friendlyDir = function (dir) {
        if (dir == "s") return "south";
        if (dir == "n") return "north";
        if (dir == "e") return "east";
        if (dir == "w") return "west";
        if (dir == "u") return "up";
        if (dir == "d") return "down";
        if (dir == "sw") return "southwest";
        if (dir == "se") return "southeast";
        if (dir == "ne") return "northeast";
        if (dir == "nw") return "northwest";
        if (dir == "o") return "out";
        if (dir == "i") return "in";
        return dir;
    }

    var render = function (loc, depth, where) {
        var describeNav = function (dir, name) {
            if (dir.type == "stairs") {
                console.log("There are stairs leading " + name + ".");
            } else if (dir.type == "passage") {
                console.log("There is a passage leading " + name + ".");
            } else if (dir.type == "path") {
                console.log("There is a path leading " + name + ".");
            } else if (dir.door) {
                if (dir.open) {
                    console.log("To the " + name + " is open " + doors[dir.door].name);
                } else {
                    console.log("To the " + name + " is " + doors[dir.door].name);
                }
            } else {
                console.log("To the " + name + " is " + (locations[dir.location].name || locations[dir.location].description) + ".");
            }
        };
        if (loc.description) {
            console.log(loc.description);
        } else if (loc.name) {
            console.log(loc.name);
        }
        if (loc.contains) {
            var contains = "there is ";
            if (loc.contains.length > 1) {
                contains = "there are ";
            }
            for (var i = 0; i < loc.contains.length; ++i) {
                if (i) {
                    contains += " , ";
                    if ((i + 1) == loc.contains.length) {
                        contains += "and";
                    }
                }
                var iname = items[loc.contains[i].item].name
                if ("AEIOUYW".indexOf(iname[0]))
                    contains += " a ";
                else
                    contains += " an ";
                contains += iname;
            }
            if (where) {
                contains += " " + where + ".";
            }

            console.log(contains);
        }
        if (loc.wall) {
            for (var dir in loc.wall) {
                var wall = loc.wall[dir];
                render(wall, 1, "along " + friendlyDir(dir) + " wall ");
            }
        }
        if (loc.e) {
            describeNav(loc.e, "east");
        }
        if (loc.w) {
            describeNav(loc.w, "west");
        }
        if (loc.n) {
            describeNav(loc.n, "north");
        }
        if (loc.s) {
            describeNav(loc.s, "south");
        }
        if (loc.u) {
            describeNav(loc.u, "up");
        }
        if (loc.d) {
            describeNav(loc.d, "down");
        }
        if (loc.se) {
            describeNav(loc.se, "southeast");
        }
        if (loc.ne) {
            describeNav(loc.ne, "northeast");
        }
        if (loc.sw) {
            describeNav(loc.sw, "southwest");
        }
        if (loc.nw) {
            describeNav(loc.nw, "northwest");
        }
    };
    var findNPC =function(name) {
        name = name.toLowerCase().trim();
        var cc = camelCase(name);
        if( npc[cc] ) {
            // well known short name...
            return npc[cc];
        }
        for( var _ind in npc ) {
            var _npc = npc[_ind];
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

    var describe = function () {
        if (!metadata.title) {
            console.log("What is the title of your interactive fiction?");
            mode = "gettitle";
        } else if (!metadata.description) {
            console.log("How would you describe this interactive fiction work?");
            mode = "getdescription";
        } else if (!metadata.author) {
            console.log("What is you name (byline)?");
            mode = "getauthor";
        } else if (!metadata.authorEmail) {
            console.log("What is you email?");
            mode = "getemail";
        } else if (location) {
            render(locations[location], 0);
            mode = "what";
        } else {
            if (lastLocation && lastDirection) {
                console.log("You traveled " + lastDirection + " from " + locations[lastLocation].description + ".( b for back)");
            }
            console.log("Where are you?");
            mode = 'where';
        }
    };
    var lookupItem = function (command, flags) {
        var itemName = null;
        if (command != "") {
            var where = locations[location];
            var candidates = [];
            var what = command;
            command = command.toLowerCase();
            var parts = getPartsOfSpeech(command);
            var lookupItemLow = function (arr) {
                for (var i = 0; i < arr.length; ++i) {
                    var item = arr[i].item;
                    var ptr = items[item];
                    if (ptr) {
                        var lname = ptr.name;
                        if (command == lname.toLowerCase()) {
                            itemName = item;
                            break;
                        } else {
                            var iparts = getPartsOfSpeech(lname);
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
                return itemName;
            };
            if (flags != "noactor")
                itemName = lookupItemLow(actor.inventory);
            if (where.contains && !itemName && flags != "actor") {
                itemName = lookupItemLow(where.contains);
            }
            if (!itemName && flags != "actor" && where.wall) {
                if (!itemName && where.wall.n) {
                    if (where.wall.n.contains) {
                        itemName = lookupItemLow(where.wall.n.contains);
                    }
                }
                if (!itemName && where.wall.s) {
                    if (where.wall.s.contains) {
                        itemName = lookupItemLow(where.wall.s.contains);
                    }
                }
                if (!itemName && where.wall.e) {
                    if (where.wall.e.contains) {
                        itemName = lookupItemLow(where.wall.e.contains);
                    }
                }
                if (!itemName && where.wall.w) {
                    if (where.wall.w.contains) {
                        itemName = lookupItemLow(where.wall.w.contains);
                    }
                }
            }
            if (!itemName) {
                if (candidates.length == 1) {
                    itemName = candidates[0];
                } else if (candidates.length > 1) {
                    console.log("which " + command + "?");
                    for (var i = 0; i < candidates.length; ++i) {
                        console.log(items[candidates[i]].name);
                    }
                    itemName = "?"; // ambiguouse
                }
            }
        }
        return itemName;
    };
    var directionTags = ["s", "n", "e", "w", "u", "d", "sw", "se", "nw", "ne"];
    var directionsHash = {
        "s": { primary: "s" },
        "n": { primary: "n" },
        "e": { primary: "e" },
        "w": { primary: "w" },
        "u": { primary: "u" },
        "d": { primary: "d" },
        "sw": { primary: "sw" },
        "se": { primary: "sw" },
        "nw": { primary: "nw" },
        "ne": { primary: "ne" },
        "south": { primary: "s" },
        "north": { primary: "n" },
        "east": { primary: "e" },
        "west": { primary: "w" },
        "up": { primary: "u" },
        "down": { primary: "d" },
        "southwest": { primary: "sw" },
        "southeast": { primary: "sw" },
        "northwest": { primary: "nw" },
        "northeast": { primary: "ne" },
        "south west": { primary: "sw" },
        "south east": { primary: "sw" },
        "north west": { primary: "nw" },
        "north east": { primary: "ne" }
    };
    var isDirection = function (command) {
        return directionsHash[command];
    }
    var processScript = function(command) {
        if( command == "n" || command == "no" )
            return true;
        if( command && command.length > 0 ) {
            if( !verbNPC ) {
                verbNPC = command;
            } else if( verbsWithTopics[verbAction] && !verbTopic ) {
                verbTopic = command;
            } else {
                var _npc = findNPC(verbNPC);
                // TBD - also look for items (for verbs like push/pull etc)...
                if( _npc ) {
                    if( verbsWithTopics[verbAction] ) {
                        console.log( "TBD - implement convo - ["+verbAction+","+verbNPC+","+propositionAction+","+verbTopic+"] => "+command );
                    } else {
                        console.log( "TBD - implement verb - ["+verbAction+","+verbNPC+","+propositionAction+","+verbTopic+"] => "+command );
                    }
                    return true;                    
                } else {
                    var newNPC  = verbNPC;
                    newNPC = newNPC.toLowerCase().trim();
                    npc[camelCase(newNPC)] = { name : newNPC , description : command };
                }
            }
        }
        if( !verbNPC ) {
            console.log( verbAction +" who? (n/no to stop defining)" );
            return false;
        } else if( !findNPC(verbNPC) ) {
            console.log( "Describe non player character named '"+verbNPC+"': (n/no for stop)" );
            return false;
        } else if( verbsWithTopics[verbAction] && !verbTopic ) {
            if( propositionAction )
                console.log( verbAction +" "+verbNPC+" "+propositionAction+" what?" );
            else
                console.log( verbAction +" "+verbNPC+" what?" );
        } else {
            if( verbsWithTopics[verbAction] ) {
                if( !propositionAction ) {
                    if( verbTopic.substring(0,6) == "about " ) {
                        propositionAction = "about";
                        verbTopic = verbTopic.substring(6).trim();
                    }
                }
                if( propositionAction ) {
                    console.log( "what is response? (n/no for stop)" );                    
                }
            } else {
                console.log( "what is response? (n/no for stop)" );
            }
        }
        return false;
    }

    var parseCommand = function (command) {
        var lCase = command;
        if (mode == "gettitle") {
            metadata.title = command;
            describe();
        } else if (mode == "getdescription") {
            metadata.description = command;
            describe();
        } else if (mode == "getauthor") {
            metadata.author = command;
            describe();
        } else if (mode == "getemail") {
            metadata.authorEmail = command;
            describe();
            saveFile();
        } else if (lCase == 'quit' || lCase == 'exit') {
            return false;
        } else {
            lCase = lCase.toLowerCase();
            if (lCase.trim() == "") {
                console.log("Pardon?");
                describe();
            } else if (mode == 'where') {
                if (lCase == 'b') {
                    location = lastLocation;
                    describe();
                } else if (lCase.length > 2) {
                    var roomName = extractNounAndAdj(command);
                    console.log(roomName);
                    if (roomName) {
                        location = roomName;
                        if (locations[location]) {
                            location = "room" + roomNum;
                            roomNum = roomNum + 1;
                        }
                    } else {
                        location = "room" + roomNum;
                        roomNum = roomNum + 1;
                    }
                    var name = command;
                    var parts = getPartsOfSpeech(command);
                    locations[location] = { name: parts.name, description: command };
                    map = null; // need to recalc the map 
                    if (lastLocation) {
                        if (locations[lastLocation].type) {
                            locations[location].type = locations[lastLocation].type;
                        }
                    }
                    if (lastLocation && lastDirection) {
                        locations[lastLocation][lastDirection] = { location: location };
                        locations[location][reverseDirection(lastDirection)] = { location: lastLocation };
                    }
                    console.log("Door name (blank or 'n' for no door, 's' for stairs, 'p' for path/passage )");
                    mode = "door?";
                }
            } else if (mode == 'door?') {
                lCase = lCase.trim();
                if (lCase == "s") {
                    locations[lastLocation][lastDirection].type = "stairs";
                    locations[location][reverseDirection(lastDirection)].type = "stairs";
                } else if (lCase == "p") {
                    if (locations[lastLocation].type == "outside") {
                        locations[lastLocation][lastDirection].type = "path";
                        locations[location][reverseDirection(lastDirection)].type = "path";
                    } else {
                        locations[lastLocation][lastDirection].type = "passage";
                        locations[location][reverseDirection(lastDirection)].type = "passage";
                    }
                } else if (lCase != ""
                    && lCase != "n"
                    && lCase != "no"
                ) {
                    var name = extractNounAndAdj(command);
                    if (!name || doors[name]) {
                        name = "door" + itemNum;
                        itemNum = itemNum + 1;
                    }
                    doors[name] = { name: command };
                    locations[lastLocation][lastDirection].door = name;
                    locations[location][reverseDirection(lastDirection)].door = name;
                }
                mode = "what";
                describe();
            } else if (mode == "script?") {
                if( processScript(command) ) {
                    mode = "what";
                }
            } else if (mode == 'describe_item') {
                items[describeItem].description = command;
                mode = "what";
            } else if (mode == 'write') {
                items[describeItem].content = command;
                mode = "what";
            } else if (mode == 'describe_location') {
                locations[location].description = command;
                mode = "what";
            } else if (mode == 'what') {
                // navigate the map
                if (lCase == "l") {
                    describe();
                } else if (lCase.substring(0, 2) == "x ") {
                    command = command.substring(2).trim();
                    if (command != "") {
                        var item = lookupItem(command);
                        if (item && item != "?") {
                            var itemPtr = items[item];
                            if (itemPtr.description) {
                                console.log(itemPtr.description);
                            } else {
                                mode = "describe_item";
                                console.log("How would you describe the " + item + "?")
                                describeItem = item;
                            }
                        }
                    } else {
                        console.log("what do you want to examine?");
                    }
                } else if (lCase == "x") {
                    var where = locations[location];
                    if (where.description) {
                        console.log(where.description);
                    } else {
                        mode = "describe_location";
                        console.log("How would you describe the " + where.name + "?")
                    }
                } else if (lCase == "i") {
                    if (actor.inventory.length == 0) {
                        console.log("You are carrying nothing.");
                    } else {
                        console.log("You are carrying:");
                        for (var i = 0; i < actor.inventory.length; ++i) {
                            console.log(items[actor.inventory[i].item].name);
                        }
                    }
                } else if (lCase.substring(0, 5) == "drop "
                    || lCase.substring(0, 4) == "put "
                    || lCase.substring(0, 5) == "hide "
                ) {
                    // Drop & put are pretty much the same, rely on 'on' / 'in' / 'behind' / 'under' for position
                    // Hide adds the 'hidden' property requires the player to inspect the container
                    command = command.substring(4).trim();
                    if (command != "") {
                        var where = locations[location];
                        var what = command;
                        var holder = "contains";
                        var existingItem = lookupItem(what, "actor");
                        var objectWhere = null;
                        var sep = command.indexOf(" on ");
                        var hidden = false;
                        if (lCase.substring(0, 5) == "hide ") {
                            hidden = true;
                        }
                        if (sep > 0) {
                            objectWhere = command.substring(sep + 4);
                            command = command.substring(0, sep);
                            holder = "supports";
                        } else {
                            sep = command.indexOf(" in ");
                            if (sep > 0) {
                                objectWhere = command.substring(sep + 4);
                                command = command.substring(0, sep);
                            } else {
                                sep = command.indexOf(" inside ");
                                if (sep > 0) {
                                    objectWhere = command.substring(sep + 8);
                                    command = command.substring(0, sep);
                                } else {
                                    sep = command.indexOf(" behind ");
                                    if (sep > 0) {
                                        objectWhere = command.substring(sep + 8);
                                        command = command.substring(0, sep);
                                        holder = "behind";
                                    } else {
                                        sep = command.indexOf(" under ");
                                        if (sep > 0) {
                                            objectWhere = command.substring(sep + 7);
                                            command = command.substring(0, sep);
                                            holder = "under";
                                        }
                                    }
                                }
                            }
                        }
                        // we are relative to another object
                        if (objectWhere) {
                            where = lookupItem(objectWhere);
                            if (where) {
                                where = items[where];
                            }
                            if (!where) {
                                console.log("you see no " + objectWhere);
                            }
                        }
                        if (where) {
                            if (existingItem) {
                                if (existingItem != "?") {
                                    for (var i = 0; i < actor.inventory.length; ++i) {
                                        if (actor.inventory[i].item == existingItem) {
                                            if (!where[holder]) {
                                                where[holder] = [];
                                            }
                                            if (hidden) {
                                                actor.inventory[i].hidden = true;
                                            } else if (actor.inventory[i].hidden) {
                                                delete actor.inventory[i].hidden;
                                            }
                                            where[holder].push(actor.inventory[i]);
                                            actor.inventory.splice(i, 1);
                                            break;
                                        }
                                    }
                                }
                            } else {
                                var name = extractNounAndAdj(what);
                                if (!name) {
                                    name = "item" + itemNum;
                                    itemNum = itemNum + 1;
                                }
                                if (!items[name]) {
                                    items[name] = { name: command };
                                }
                                if (!where[holder]) {
                                    where[holder] = [];
                                }
                                var itemEnv = { item: name };
                                if (hidden) {
                                    itemEnv.hidden = true;
                                }
                                where[holder].push(itemEnv);
                            }
                        }
                    }
                } else if (lCase.substring(0, 5) == "read ") {
                    command = command.substring(5).trim();
                    if (command != "") {
                        var item = lookupItem(command);
                        if (item) {
                            if (item != "?") {
                                if (items[item].content) {
                                    console.log(items[item].content);
                                } else {
                                    describeItem = item;
                                    console.log("What do you see written in " + items[item].name + "?");
                                    mode = "write";
                                }
                            }
                        } else {
                            console.log("You see no " + command);
                        }
                    }
                } else if (lCase.substring(0, 5) == "take ") {
                    command = command.substring(5).trim();
                    if (command != "") {
                        var item = lookupItem(command, "noactor");
                        if (item) {
                            if (item != "?") {
                                var where = locations[location];
                                for (var i = 0; i < where.contains.length; ++i) {
                                    if (where.contains[i].item == item) {
                                        actor.inventory.push(where.contains[i]);
                                        where.contains.splice(i, 1);
                                        if (where.contains.length == 0) {
                                            delete where.contains;
                                        }
                                        break;
                                    }
                                }
                            }
                        } else {
                            console.log("You see no " + command);
                        }
                    }
                } else if (lCase.substring(0, 4) == "eat " || lCase.substring(0, 5) == "wear " || lCase.substring(0, 6) == "light " || lCase.substring(0, 6) == "affix ") {
                    var thingType = null;
                    if (lCase.substring(0, 4) == "eat ") {
                        thingType = "food";
                    } else if (lCase.substring(0, 5) == "wear ") {
                        thingType = "wearable";
                    } else if (lCase.substring(0, 6) == "light ") {
                        thingType = "light";
                    } else if (lCase.substring(0, 6) == "affix ") {
                        thingType = "fixture";
                    }
                    command = command.substring(command.indexOf(" ") + 1).trim();
                    if (command != "") {
                        var where = locations[location];
                        var what = command;
                        if (!where.contains) {
                            where.contains = [];
                        }
                        var existingItem = lookupItem(what);
                        if (existingItem && existingItem != "?") {
                            if (!items[existingItem].type) {
                                items[existingItem].type = thingType;
                                console.log(command + " is " + thingType + ".");
                            } else if (items[existingItem].type != thingType) {
                                console.log("You cannot " + lCase.substring(0, lCase.indexOf(" ") + 1) + " " + command);
                            }
                        } else if (existingItem != "?") {
                            console.log("You see no " + command);
                        }
                    }
                } else if (isDirection(lCase)) {
                    lCase = isDirection(lCase).primary;
                    if (locations[location]) {
                        var nextLoc = locations[location][lCase];
                        if (!nextLoc) {
                            if (!map) {
                                map = createMap();
                            } else if (map.location.room != location) {
                                recalcLocation(map, location);
                            }
                            var level = map.location.level;
                            var row = map.location.row;
                            var col = map.location.col;
                            if (lCase == "n") {
                                row = row - 1;
                            } else if (lCase == "s") {
                                row = row + 1;
                            } else if (lCase == "e") {
                                col = col + 1;
                            } else if (lCase == "w") {
                                col = col - 1;
                            } else if (lCase == "u") {
                                level = level + 1;
                            } else if (lCase == "d") {
                                level = level - 1;
                            } else if (lCase == "se") {
                                row = row + 1;
                                col = col + 1;
                            } else if (lCase == "sw") {
                                row = row + 1;
                                col = col - 1;
                            } else if (lCase == "ne") {
                                row = row - 1;
                                col = col + 1;
                            } else if (lCase == "nw") {
                                row = row - 1;
                                col = col - 1;
                            }
                            var posCell = null;
                            if (0 <= level && level < map.levels.length
                                && 0 <= row && row < map.levels[level].length
                                && 0 <= col && col < map.levels[level][row].length
                            ) {
                                posCell = map.levels[level][row][col];
                            }
                            if (posCell) {
                                locations[location][lCase] = { location: posCell };
                                location = posCell;
                            } else {
                                lastLocation = location;
                                location = null;
                                lastDirection = lCase;
                            }
                        } else {
                            location = nextLoc.location;
                        }
                    }
                    describe();
                } else if (lCase.substring(0, 5) == "door " && isDirection(lCase.substring(5))) {
                    lCase = isDirection(lCase.substring(5).trim()).primary;
                    if (locations[location]) {
                        var nextLoc = locations[location][lCase];
                        if (nextLoc) {
                            lastDirection = lCase;
                            lastLocation = location;
                            location = nextLoc.location;
                            console.log("Door name (blank or 'n' for no door)");
                            mode = "door?";
                        } else {
                            console.log("There is no ending location.");
                        }
                    } else {
                        console.log("There is no starting location.");
                    }
                } else if (lCase == "location outside" || lCase == "is outside") {
                    if (location) {
                        locations[location].type = "outside";
                    } else {
                        console.log("You are nowhere.");
                    }
                } else if (lCase == "location ship" || lCase == "is ship") {
                    if (location) {
                        locations[location].type = "ship";
                    } else {
                        console.log("You are nowhere.");
                    }
                } else if (lCase == "location dark" || lCase == "is dark") {
                    if (location) {
                        locations[location].type = "dark";
                    } else {
                        console.log("You are nowhere.");
                    }
                } else if (lCase == "location bottomless" || lCase == "is bottomless" ) {
                    if (location) {
                        locations[location].type = "bottomless";
                    } else {
                        console.log("You are nowhere.");
                    }
                } else if (lCase == "location inside" || lCase == "is inside" ) {
                    if (location) {
                        delete locations[location].type;
                    } else {
                        console.log("You are nowhere.");
                    }
                } else if (lCase == "location") {
                    if (location) {
                        if (locations[location].type) {
                            console.log("Location is " + locations[location].type + ".");
                        } else {
                            console.log("Location is inside.");
                        }
                    } else {
                        console.log("You are nowhere.");
                    }

                } else if( (lCase+" ").substring(0,5) == "then ") {
                    // linear script
                    if( verbAction ) {
                        command = command.substring(5).trim();
                        console.log("TBD continue [then] "+verbAction+" - "+command)
                    }
                } else if( (lCase+" ").substring(0,3) == "or ") {
                    // alt scriptqq
                    if( verbAction ) {
                        command = command.substring(3).trim();
                        console.log("TBD continue [or] "+verbAction+" - "+command)
                    }
                } else if ( (lCase+" ").substring(0,4) == "ask " 
                         || (lCase+" ").substring(0,5) == "tell "  
                          ) {
                    // TBD - register NPCs & topics
                    command = command.substring(4).trim();
                    command = command.split(" about ");
                    if( command.length == 1 ) {
                        command = command[0].split(" for ");
                        if( command.length != 1 ) {
                            propositionAction = "for";
                        } else {
                            propositionAction = null;
                        }
                    } else {
                        propositionAction = "about";
                    }                
                    verbAction = (lCase+" ").substring(0,4).trim();
                    verbNPC = null;
                    verbTopic = null;                
                    if( command.length > 1 ) {
                        verbNPC = command[0];
                        verbTopic = command[1];
                    } else if( command.length == 1 ) {
                        verbNPC = command[0];
                        verbTopic = "";
                    }
                    if( !processScript("") ) {
                        mode = "script?";
                    }
                } else if (lCase == "dump") {
                    console.log(JSON.stringify(metadata, null, "  "));
                    console.log(JSON.stringify(locations, null, "  "));
                    console.log(JSON.stringify(items, null, "  "));
                } else if (lCase == "map") {
                    if (!map) {
                        map = createMap();
                    } else if (location && map.location.room != location) {
                        recalcLocation(map, location);
                    }
                    renderMapLevelText(map);
                } else if (lCase == "save") {
                    saveFile();
                } else if (lCase.split(" ")[0] == "help") {
                    if (lCase.split(" ").length > 1) {
                        lCase = lCase.split(" ")[1];
                        if (lCase == 'location') {
                            console.log([
                             "location outside - outdoors",
                             "location inside - inside a building/cave", 
                             "location dark - in a dark room (require light)", 
                             "location ship - aboard a ship", 
                             "location bottomless - in a room with no floor (chasm)"
                            ].join("\n"));
                        } else if (lCase == 'item') {
                            console.log([
                             "take <item> - place an item in the actors inventory",
                             "drop <item> - place an item in the current location", 
                             "drop <item> in/on/behind/under <item> - place item relative to another item", 
                             "put <item> in/on/behind/under <item> - place item relative to another item", 
                             "hide <item> in/on/behind/under <item> - hide item relative to another item",
                             "eat <item> - indicates that the item is food", 
                             "wear <item> - indicates that the item can be worn", 
                             "light  <item> - indicates that the item is a light source", 
                             "read <item>   - read text of item (book/letter) create text if none exists",                             
                             "affix  <item> - the item is a fixture (attached / cannot be moved)"
                            ].join("\n"));
                        } else if (lCase == 'door') {
                            console.log([
                                "door <n/s/e/w> - add a door in the direction specified"
                            ].join("\n"));
                        }
                    } else {
                        console.log([
                           "Help topics:",
                           "help location", 
                           "help item", 
                           "help door"
                        ].join("\n"));
                    }
                } else {
                    var verb = lCase.split(" ")[0];
                    if ( partOfSp[verb] & 2) {
                        // TBD register actions (and consequences)
                        verbAction = verb;
                        verbNPC = null;
                        verbTopic = null;    
                        propositionAction = null;
                        command = command.split(" ");
                        command[0] = "";
                        command = command.join(" ").trim();
                        if( !processScript(command) ) {
                            mode = "script?";
                        }
                    } else {
                        console.log("Command not handled");
                    }
                }
            }
        }
        return true;
    };
    //---------------------------------------------------------------------------
    // Load a Game from JSON
    var loadGame = function (onComplete) {
        fs.readFile(settings.filename, (err, data) => {
            if (!err) {
                var obj = JSON.parse(data);
                metadata = obj.metadata;
                actor = obj.actor;
                locations = obj.locations;
                items = obj.items;
                doors = obj.doors;
                npc = obj.npc;
                topics = obj.topics;
                location = obj.location;

                while (locations["room" + roomNum]) {
                    roomNum = roomNum + 1;
                }
                while (items["item" + itemNum]) {
                    itemNum = itemNum + 1;
                }
                while (locations["door" + doorNum]) {
                    doorNum = doorNum + 1;
                }
                onComplete(null, true);
            } else {
                onComplete(err, false);
            }
        });
    };
    //---------------------------------------------------------------------------
    // Generate a TADs source file....
    var generateTads = function (tadsSrc) {
        var main = path.parse(settings.filename).name + ".t";
        var roomDObj = location;
        if (reservedNames[roomDObj]) {
            roomDObj = reservedNames[roomDObj];
        }
        var srcLines = [
            '#charset "us-ascii"',
            '#include <adv3.h>',
            '#include <en_us.h>',
            'versionInfo: GameID',
            "\tname = '" + metadata.title + "'",
            "\tbyLine = 'by " + metadata.author + "'",
            "\tauthorEmail = '" + metadata.author + " <" + metadata.authorEmail + ">'",
            "\tversion = '" + metadata.version + "'",
            ";"
            , ""
            , "gameMain: GameMainDef"
            , "\tinitialPlayerChar = me"
            , ";"
            , ""
            , "me: Actor"
            , "\tlocation = " + roomDObj
            , ";"
            , ""
        ];
        var emitItem = function (it, depth, props) {
            var _srcLines = []
            var ip = items[it];
            var oName = it;
            if (reservedNames[oName]) {
                oName = reservedNames[oName];
            }
            if (depth > 0) {
                oName = ("+++++++++++++++++".substring(0, depth)) + " " + oName;
            }
            var prefix = "";
            if (props.hidden) {
                prefix = " Hidden,"
            }
            if (ip.supports) {
                prefix += " Surface,"
            }
            if (ip.behind) {
                // TBD - tads 3 has a specialization of this that allows for attached to rear
                prefix += " RearContainer,"
            }
            if (ip.under) {
                prefix += " Underside,"
            }
            if (ip.content) {
                _srcLines.push(oName + " :" + prefix + " Readable");
            } else if (ip.type) {
                if (ip.type == "food") {
                    _srcLines.push(oName + " :" + prefix + " Food");
                } else if (ip.type == "wearable") {
                    _srcLines.push(oName + " :" + prefix + " Wearable");
                } else if (ip.type == "light") {
                    _srcLines.push(oName + " :" + prefix + " Flashlight");
                } else if (ip.type == "fixture") {
                    _srcLines.push(oName + " :" + prefix + " Fixture");
                } else {
                    _srcLines.push(oName + " :" + prefix + " Thing");
                }
            } else {
                _srcLines.push(oName + " :" + prefix + " Thing");
            }
            _srcLines.push("\tname = '" + ip.name + "'");
            var parts = getPartsOfSpeech(ip.name);
            if (parts.count > 0) {
                if (parts.noun.length > 0) {
                    var nouns = "\tnoun = ";
                    for (var i = 0; i < parts.noun.length; ++i) {
                        nouns += " '" + parts.noun[i] + "'";
                    }
                    _srcLines.push(nouns);
                }
                if (parts.adj.length > 0) {
                    var adjs = "\tadjective = ";
                    for (var i = 0; i < parts.adj.length; ++i) {
                        adjs += " '" + parts.adj[i] + "'";
                    }
                    _srcLines.push(adjs);
                }
            }
            if (ip.description) {
                _srcLines.push('\tdesc = "' + ip.description + '"');
            }
            if (ip.content) {
                _srcLines.push('\treadDesc = "' + ip.content + '"');
            }
            _srcLines.push(";");
            _srcLines.push("");
            // Containership & Concealing
            if (ip.supports) {
                for (var i = 0; i < ip.supports.length; ++i) {
                    itemEmitted[ip.supports[i].item] = true;
                    _srcLines.push(emitItem(ip.supports[i].item, depth + 1, ip.supports[i]));
                }
            }
            if (ip.contains) {
                for (var i = 0; i < ip.contains.length; ++i) {
                    itemEmitted[ip.contains[i].item] = true;
                    _srcLines.push(emitItem(ip.contains[i].item, depth + 1, ip.contains[i]));
                }
            }
            if (ip.behind) {
                for (var i = 0; i < ip.behind.length; ++i) {
                    itemEmitted[ip.behind[i].item] = true;
                    _srcLines.push(emitItem(ip.behind[i].item, depth + 1, ip.behind[i]));
                }
            }
            if (ip.under) {
                for (var i = 0; i < ip.under.length; ++i) {
                    itemEmitted[ip.under[i].item] = true;
                    _srcLines.push(emitItem(ip.under[i].item, depth + 1, ip.under[i]));
                }
            }
            return _srcLines.join("\n");
        };
        var itemEmitted = {};
        for (var i = 0; i < actor.inventory.length; ++i) {
            itemEmitted[actor.inventory[i].item] = true;
            srcLines.push(emitItem(actor.inventory[i].item, 1, actor.inventory[i]));
        }
        var masterDoors = {};
        var locationHandled = {};
        var addDoors = null;
        var findLocationDir = function (room, roomLoc) {
            for (var i = 0; i < directionTags.length; ++i) {
                var dPtr = room[directionTags[i]];
                if (dPtr) {
                    if (dPtr.location == roomLoc) {
                        return directionTags[i];
                    }
                }
            }
            return null;
        }
        var getConnector = function (dir, roomLoc, dirName) {
            var connectorType = null, connectorName = null;
            if (dir.type == "stairs") {
                if (dirName == "u")
                    connectorType = "StairwayUp";
                else if (dirName == "d")
                    connectorType = "StairwayDown";
                else // TBD - up/down inside dir (e.g. north & up)
                    connectorType = "Stairway";
                connectorName = roomLoc + "Stairs";
            } else if (dir.type == "path") {
                connectorType = "PathPassage";
                connectorName = roomLoc + "Path";
            } else if (dir.type == "passage") {
                connectorType = "ThroughPassage";
                connectorName = roomLoc + "Passage";
            } else {
                return null;
            }
            return { type: connectorType, name: connectorName };
        };
        var tadDirection = function (dir, roomLoc, dirName) {
            if (dir.door) {
                if (doors[dir.door]) {
                    var doorPrt = doors[dir.door];
                    var doorname = "door";
                    if (doorPrt.name) {
                        doorname = doorPrt.name;
                    }
                    var masterDoor = masterDoors[dir.door];
                    if (masterDoor) {
                        if (!addDoors) {
                            addDoors = "";
                        }
                        addDoors = [addDoors + "+ " + dir.door + "Other : Door '" + doorname + "*doors' '" + doorname + "'", "\tmasterObject = " + dir.door, ";", ""].join("\n");
                        return dir.door + "Other";
                    } else {
                        masterDoors[dir.door] = true;
                        if (!addDoors) {
                            addDoors = "";
                        }
                        addDoors = [addDoors + "+ " + dir.door + ": Door '" + doorname + "*doors' '" + doorname + "'", ";", ""].join("\n");
                        return dir.door;
                    }
                }
            }
            if (dir.type) {
                if (dir.type == "stairs"
                    || dir.type == "path"
                    || dir.type == "passage"
                ) {
                    var connectorDef = getConnector(dir, roomLoc, dirName);
                    if (locationHandled[dir.location]) {
                        if (connectorDef) {
                            if (!addDoors) {
                                addDoors = "";
                            }
                            addDoors = [addDoors + "+ " + connectorDef.name + " : " + connectorDef.type + " '" + dir.type + "' '" + dir.type + "'", ";", ""].join("\n");
                            return connectorDef.name;
                        }
                    } else {
                        var wayBack = locations[dir.location];
                        var wayDir = findLocationDir(wayBack, roomLoc);
                        if (wayDir) {
                            var connectorDefAlt = getConnector(wayBack[wayDir], dir.location, wayDir);
                            if (!connectorDefAlt) {
                                connectorDefAlt = { name: dir.location };
                            }
                            if (!addDoors) {
                                addDoors = "";
                            }
                            addDoors = [addDoors + "+ " + connectorDef.name + " : " + connectorDef.type + " ->" + connectorDefAlt.name + " '" + dir.type + "' '" + dir.type + "'", ";", ""].join("\n");
                            return connectorDef.name;
                        }
                    }
                }
            }
            if (reservedNames[dir.location]) {
                return reservedNames[dir.location];
            }
            return dir.location;
        };
        for (loc in locations) {
            var room = locations[loc];
            var roomDObj = loc;
            if (reservedNames[roomDObj]) {
                roomDObj = reservedNames[roomDObj];
            }
            if (locations[location].type == "outside") {
                srcLines.push(roomDObj + ": OutdoorRoom");
            } else if (locations[location].type == "dark") {
                srcLines.push(roomDObj + ": DarkRoom");
            } else if (locations[location].type == "ship") {
                srcLines.push(roomDObj + ": ShipboardRoom");
            } else if (locations[location].type == "bottomless") {
                srcLines.push(roomDObj + ": FloorlessRoom");
            } else {
                srcLines.push(roomDObj + ": Room");
            }
            if (!room.name && room.description) {
                var parts = getPartsOfSpeech(room.description);
                if (parts.name.length > 0) {
                    room.name = parts.name;
                }
            }
            if (room.name) {
                srcLines.push("\troomName = '" + room.name + "'");
            }
            if (room.description) {
                srcLines.push('\tdesc = "' + room.description + '"');
            }
            if (room.e) {
                srcLines.push('\teast = ' + tadDirection(room.e, loc, "e"));
            }
            if (room.w) {
                srcLines.push('\twest = ' + tadDirection(room.w, loc, "w"));
            }
            if (room.n) {
                srcLines.push('\tnorth = ' + tadDirection(room.n, loc, "n"));
            }
            if (room.s) {
                srcLines.push('\tsouth = ' + tadDirection(room.s, loc, "s"));
            }
            if (room.sw) {
                srcLines.push('\tsouthwest = ' + tadDirection(room.sw, loc, "sw"));
            }
            if (room.se) {
                srcLines.push('\tsoutheast = ' + tadDirection(room.se, loc, "se"));
            }
            if (room.nw) {
                srcLines.push('\tnorthwest = ' + tadDirection(room.nw, loc, "nw"));
            }
            if (room.ne) {
                srcLines.push('\tnortheast = ' + tadDirection(room.ne, loc, "ne"));
            }
            if (room.u) {
                srcLines.push('\tup = ' + tadDirection(room.u, loc, "u"));
            }
            if (room.d) {
                srcLines.push('\tdown = ' + tadDirection(room.d, loc, "d"));
            }
            srcLines.push(";");
            srcLines.push("");
            if (addDoors) {
                srcLines.push(addDoors);
                addDoors = null;
            }
            if (room.contains) {
                for (var i = 0; i < room.contains.length; ++i) {
                    itemEmitted[room.contains[i].item] = true;
                    srcLines.push(emitItem(room.contains[i].item, 1, room.contains[i]));
                }
            }
            if (room.wall) {
                if (room.wall.n) {
                }
            }
            locationHandled[loc] = true;
        }
        // Leftover items (not directly owned or contained)
        for (it in items) {
            if (!itemEmitted[it]) {
                srcLines.push(emitItem(it, 0, {}));
            }
        }
        tadsSrc[main] = srcLines.join("\n");
        return true;
    };
    var exportTads = function (folder) {
        var tadsSrc = {};
        if (generateTads(tadsSrc)) {
            for (var name in tadsSrc) {
                console.log(name + ":");
                console.log(tadsSrc[name]);
            }
            fs.mkdir(folder, {}, function (err, data) {
                if (err) {
                    if (err.code != "EEXIST") {
                        console.log("Error exporting to tads " + err.code);
                        return;
                    }
                }
                if (folder[folder.length - 1] != "/" && folder[folder.length - 1] != "\\") {
                    if (folder.indexOf("\\") >= 0) {
                        folder += "\\";
                    } else {
                        folder += "/";
                    }
                }
                for (var name in tadsSrc) {
                    fs.writeFile(folder + name, tadsSrc[name], {}, function () { });
                }
            });
        }
    }
    return {
        describe: describe,
        parseCommand: parseCommand,
        loadGame: loadGame,
        exportTads: exportTads
    };
};

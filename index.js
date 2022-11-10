module.exports = function ltbl(settings) {
    var roomNum = 1;
    var itemNum = 1;
    var doorNum = 1;
    var mode = 'where';
    var lastLocation = null;
    var lastDirection = null;
    var describeItem = null;
    var fs = require("fs");
    var helpText = require("./en-help.json");
    var verbAction = null;
    var propositionAction = null;
    var verbNPC = null;
    var verbsWithTopics = { "ask" : true , "tell" : true , "show" : true , "give" : true };
    var wordMap = {
        firstWord : {
        "hello" : "hi",
        "hi" : "hi",
        "bye" : "bye" ,
        "goodbye" : "bye",
        "farewell" : "bye",
        "leave" : "leave",
        "notice" : "notice",
        "l" : "look",
        "look" : "look",
        "x" : "examine",
        "examine" : "examine",
        "i": "inventory",
        "inventory" : "inventory",
        "drop" : "drop",
        "put" : "put",
        "hide" : "hide",
        "read" : "read",
        "eat" : "eat",
        "wear" : "wear",
        "light": "light",
        "affix" : "affix",
        "sit" : "sit",
        "stand" : "stand",
        "pov" :  "pov"
        },
        firstTwoWord : {
            "talk to" : "!talkto",
            "sit down" : "sit",
            "lie down" : "lie",
            "stand up" : "stand"
        },
        postures : {
            "stand" : {
                "participle" : "standing",
                "past" : "stood"
            },
            "sit" : {
                "participle" : "sitting",
                "past" : "sat"
            },
            "lie" : {
                "participle" : "lying",
                "past" : "lay"
            },
        },
        posturePrep : {
            "on" : "on" , 
            "in" : "in"
        },
        nestedrooms : {
            "chair" : {
                "postures" : ["sit","stand"],
                "posture" : "sit"
            },
            "platform" : {
                "postures" : ["stand","sit","lie"],
                "posture" : "stand"
            },
            "bed" : {
                "postures" : ["stand","sit","lie"],
                "posture" : "lie"
            }
        }
    };
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
        name : "me",
        inventory: [],
        location : null
    };
    var god = {
        name : "god",
        isGod : true,
        inventory: [],
        location : null
    };
    var pov = actor;
    var allowGodMode = true;
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
        createMapLow(0, 0, 0, pov.location, bounds, function (row, col, level, loc, bounds) { });
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
        createMapLow(0, 0, 0, pov.location, bounds, function (row, col, level, loc, bounds) {
            levels[level - bounds.startLevel][row - bounds.startRow][col - bounds.startCol] = loc;
        });
        return { levels: levels, location: { room: pov.location, level: -bounds.startLevel, row: -bounds.startRow, col: - bounds.startCol } };
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
        var render = require("./render-map-text.js");
        return render( { map : map , locations : locations } );
    };
    var map = null;
    var helper = require("./helper.js")();
    var camelCase = helper.camelCase;
    var extractNounAndAdj = helper.extractNounAndAdj;
    var getPartsOfSpeech = helper.getPartsOfSpeech;
    var isVerb = helper.isVerb;
    //---------------------------------------------------------------------------
    // Save off to file....
    var saveFile = function () {
        var obj = { 
            metadata: metadata, 
            actor: actor, 
            locations: locations, 
            doors: doors, 
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

    var render = function (loc,locationId, depth, where) {
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
                render(wall,null, 1, "along " + friendlyDir(dir) + " wall ");
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
        if( locationId ) {
            for( var _npc in npc) {
                var  ni = npc[_npc];
                if( ni.location == locationId ) {
                    console.log(ni.name+" is here.");
                }
            }
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
        } else if (pov.location) {
            render(locations[pov.location],pov.location, 0);
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
            var where = locations[pov.location];
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
    var subSentence = function(sentence,wrd) {
        sentence = sentence.split(" ");
        for( var i = 0 ; i < wrd ; ++i )
            sentence[i] = "";
        return sentence.join(" ").trim();
    };
    var isDirection = function (command) {
        return directionsHash[command];
    };
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
                        if( verbAction && verbTopic ) {
                            if( !_npc.conversation ) {
                                _npc.conversation = {};
                            }                            
                            if( !_npc.conversation[verbAction] ) {
                                _npc.conversation[verbAction] = {};
                            }
                            if( propositionAction ) {
                                _npc.conversation[verbAction][verbTopic] = { proposition : propositionAction , response : command };
                            } else {
                                _npc.conversation[verbAction][verbTopic] = { response : command };
                            }
                        }
                    } else if( verbAction ) {
                        console.log( "TBD - implement verb - ["+verbAction+","+verbNPC+","+propositionAction+","+verbTopic+"] => "+command );
                    }
                    return true;                    
                } else {
                    var newNPC  = verbNPC;
                    newNPC = newNPC.toLowerCase().trim();
                    npc[camelCase(newNPC)] = {
                        name : newNPC ,
                        description : command ,
                        location : pov.location 
                    };
                }
            }
        }
        if( !verbNPC ) {
            console.log( verbAction +" who? (n/no to stop defining)" );
            return false;
        } else if( !findNPC(verbNPC) ) {
            if( pov.isGod ) {
                console.log( "Describe non player character named '"+verbNPC+"': (n/no for stop)" );
            } else {
                console.log( "You see no "+verbNPC+"." );
            }
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
                var _npc = findNPC(verbNPC);
                if( _npc.conversation ) {
                    _npc = _npc.conversation[verbAction];
                    if( _npc ) {
                        _npc = _npc[verbTopic];
                    }
                } else {
                   _npc = null;
                }
                if( _npc ) {
                    if( _npc.response ) {
                        console.log( _npc.response );
                    }
                } else if(pov.isGod) {
                    if( propositionAction ) {
                        console.log( "what is response? (n/no for stop)" );                    
                    }
                } else {
                    noUnderstand();
                }
            } else if(pov.isGod) {
                console.log( "what is response? (n/no for stop)" );
            } else {
                noUnderstand();
            }
        }
        return false;
    };

    var allowPosture = function(itemptr,posture) {
        if( itemptr.postures ) {
            for( var i = 0 ; i < itemptr.postures.length ; ++i ) {
                if( itemptr.postures[i] == posture ) {
                    return true;
                }
            }
        }
        return false;
    };
    var setLocationType = function(ltype) {
        if (pov.location) {
            if( pov.isGod ) {
                if( ltype == "inside"  ) {
                    delete locations[pov.location].type;
                } else {
                    locations[pov.location].type = ltype;
                }
            } else if( !locations[pov.location].type && ltype == "inside" ) {
                console.log("Yes it is.");
            } else if( locations[pov.location].type == ltype ) {
                console.log("Yes it is.");
            } else {
                console.log("No, it isn't.");
            }
        } else {
            console.log("You are nowhere.");
        }
    };
    var noUnderstand = function() {
        console.log("What was that?");
    };

    var parseCommand = function (command) {
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
            var lCase = command;
            lCase = lCase.toLowerCase();
            var lCaseWords =  lCase.split(" ");
            var firstWord = lCaseWords[0].trim(); 
            var firstPhrase = null;

            if( wordMap.firstWord[firstWord] ) {
                firstWord = wordMap.firstWord[firstWord];
            }
            // Override pattern
            if( lCaseWords.length > 0 ) {
                firstPhrase =  wordMap.firstTwoWord[lCaseWords[0]+" "+lCaseWords[1]];
                if( firstPhrase ) {
                    command = firstPhrase+" "+subSentence(command,2);
                    firstWord = firstPhrase;
                    lCase = command;
                    lCase = lCase.toLowerCase();
                    lCaseWords =  lCase.split(" ");
                }
            }
            if (lCase.trim() == "") {
                console.log("Pardon?");
                describe();
            } else if (mode == 'where') {
                if (lCase == 'b') {
                    pov.location = lastLocation;
                    describe();
                } else if (lCase.length > 2) {
                    var roomName = extractNounAndAdj(command);
                    console.log(roomName);
                    if (roomName) {
                        pov.location = roomName;
                        if (locations[pov.location]) {
                            pov.location = "room" + roomNum;
                            roomNum = roomNum + 1;
                        }
                    } else {
                        pov.location = "room" + roomNum;
                        roomNum = roomNum + 1;
                    }
                    var name = command;
                    var parts = getPartsOfSpeech(command);
                    locations[pov.location] = { name: parts.name, description: command };
                    map = null; // need to recalc the map 
                    if (lastLocation) {
                        if (locations[lastLocation].type) {
                            locations[pov.location].type = locations[lastLocation].type;
                        }
                    }
                    if (lastLocation && lastDirection) {
                        locations[lastLocation][lastDirection] = { location: pov.location };
                        locations[pov.location][reverseDirection(lastDirection)] = { location: lastLocation };
                    }
                    console.log("Door name (blank or 'n' for no door, 's' for stairs, 'p' for path/passage )");
                    mode = "door?";
                }
            } else if (mode == 'door?') {
                lCase = lCase.trim();
                if (lCase == "s") {
                    locations[lastLocation][lastDirection].type = "stairs";
                    locations[pov.location][reverseDirection(lastDirection)].type = "stairs";
                } else if (lCase == "p") {
                    if (locations[lastLocation].type == "outside") {
                        locations[lastLocation][lastDirection].type = "path";
                        locations[pov.location][reverseDirection(lastDirection)].type = "path";
                    } else {
                        locations[lastLocation][lastDirection].type = "passage";
                        locations[pov.location][reverseDirection(lastDirection)].type = "passage";
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
                    locations[pov.location][reverseDirection(lastDirection)].door = name;
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
                locations[pov.location].description = command;
                mode = "what";
            } else if (mode == 'what') {
                // navigate the map
                if (firstWord == "look" && lCase.indexOf(" ") < 0 ) {
                    describe();
                } else if ( firstWord == "examine") {
                    command = subSentence( command , 1);
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
                } else if (firstWord == "examine") {
                    var where = locations[pov.location];
                    if (where.description) {
                        console.log(where.description);
                    } else {
                        mode = "describe_location";
                        console.log("How would you describe the " + where.name + "?")
                    }
                } else if (firstWord == "inventory") {
                    if (actor.inventory.length == 0) {
                        console.log("You are carrying nothing.");
                    } else {
                        console.log("You are carrying:");
                        for (var i = 0; i < pov.inventory.length; ++i) {
                            console.log(items[pov.inventory[i].item].name);
                        }
                    }
                } else if ( firstWord == "drop"
                         || firstWord == "put" 
                         || firstWord == "hide" 
                          ) {
                    // Drop & put are pretty much the same, rely on 'on' / 'in' / 'behind' / 'under' for position
                    // Hide adds the 'hidden' property requires the player to inspect the container
                    command = subSentence( command , 1);
                    if (command != "") {
                        var where = locations[pov.location];
                        var what = command;
                        var holder = "contains";
                        var existingItem = lookupItem(what, "actor");
                        var objectWhere = null;
                        var sep = command.indexOf(" on ");
                        var hidden = false;
                        if (firstWord == "hide") {
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
                                    for (var i = 0; i < pov.inventory.length; ++i) {
                                        if (pov.inventory[i].item == existingItem) {
                                            if (!where[holder]) {
                                                where[holder] = [];
                                            }
                                            if (hidden) {
                                                pov.inventory[i].hidden = true;
                                            } else if (pov.inventory[i].hidden) {
                                                delete pov.inventory[i].hidden;
                                            }
                                            where[holder].push(pov.inventory[i]);
                                            pov.inventory.splice(i, 1);
                                            break;
                                        }
                                    }
                                }
                            } else if( pov.isGod ) {                            
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
                            } else {
                                console.log("You see no " + what);
                            }
                        }
                    }
                } else if( firstWord == "read" ) {
                    command = subSentence( command , 1);
                    if (command != "") {
                        var item = lookupItem(command);
                        if (item) {
                            if (item != "?") {
                                if (items[item].content) {
                                    console.log(items[item].content);
                                } else if( pov.isGod ) {
                                    describeItem = item;
                                    console.log("What do you see written in " + items[item].name + "?");
                                    mode = "write";
                                } else {
                                    console.log("There is nothing written on the "+items[item].name);
                                }
                            }
                        } else {
                            console.log("You see no " + command);
                        }
                    }
                } else if ( firstWord == "take" ) {
                    command = subSentence( command , 1);
                    if (command != "") {
                        var item = lookupItem(command, "noactor");
                        if (item) {
                            if (item != "?") {
                                var where = locations[pov.location];
                                for (var i = 0; i < where.contains.length; ++i) {
                                    if (where.contains[i].item == item) {
                                        pov.inventory.push(where.contains[i]);
                                        where.contains.splice(i, 1);
                                        if (where.contains.length == 0) {
                                            delete where.contains;
                                        }
                                        console.log("Taken.");
                                        break;
                                    }
                                }
                            }
                        } else {
                            console.log("You see no " + command);
                        }
                    }
                } else if ( firstWord == "eat" 
                         || firstWord == "wear" 
                         || firstWord == "light" 
                         || firstWord == "affix"
                          ) {
                    var thingType = null;
                    if (firstWord == "eat") {
                        thingType = "food";
                    } else if (firstWord == "wear") {
                        thingType = "wearable";
                    } else if (firstWord == "light") {
                        thingType = "light";
                    } else if (firstWord == "affix") {
                        thingType = "fixture";
                    }
                    command = subSentence( command , 1);
                    if (command != "") {
                        var where = locations[pov.location];
                        var what = command;
                        if (!where.contains) {
                            where.contains = [];
                        }
                        var existingItem = lookupItem(what);
                        if (existingItem && existingItem != "?") {
                            if (pov.isGod && !items[existingItem].type) {
                                items[existingItem].type = thingType;
                                console.log(command + " is " + thingType + ".");
                            } else if (items[existingItem].type != thingType) {
                                console.log("You cannot " + firstWord + " " + command);
                            } else {
                                if( !pov.isGod ) {
                                    // TBD - add bookkeeping
                                    console.log("You " + firstWord + " " + command);
                                } else {
                                    console.log(command + " is " + thingType + ".");
                                }
                            }
                        } else if (existingItem != "?") {
                            console.log("You see no " + command);
                        }
                    }
                } else if (isDirection(lCase)) {
                    lCase = isDirection(lCase).primary;
                    if (locations[pov.location]) {
                        var nextLoc = locations[pov.location][lCase];
                        if (!nextLoc) {
                            if( pov.isGod ) {
                                if (!map) {
                                    map = createMap();
                                } else if (map.location.room != pov.location) {
                                    recalcLocation(map, pov.location);
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
                                    locations[pov.location][lCase] = { location: posCell };
                                    pov.location = posCell;
                                } else {
                                    lastLocation = pov.location;
                                    pov.location = null;
                                    lastDirection = lCase;
                                }
                            } else {
                                console.log("You cannot go that way.");
                            }
                        } else {
                            pov.location = nextLoc.location;
                        }
                    }
                    describe();
                } else if (firstWord == "door" && isDirection(subSentence( command , 1))) {
                    if( pov.isGod ) {
                        command = subSentence( command , 1);
                        lCase = isDirection(command).primary;
                        if (locations[pov.location]) {
                            var nextLoc = locations[pov.location][lCase];
                            if (nextLoc) {
                                lastDirection = lCase;
                                lastLocation = pov.location;
                                pov.location = nextLoc.location;
                                console.log("Door name (blank or 'n' for no door)");
                                mode = "door?";
                            } else {
                                console.log("There is no ending location.");
                            }
                        } else {
                            console.log("There is no starting location.");
                        }
                    } else {
                        noUnderstand();
                    }
                } else if (lCase == "location outside" || lCase == "is outside") {                    
                    setLocationType("outside");
                } else if (lCase == "location ship" || lCase == "is ship") {
                    setLocationType("ship");
                } else if (lCase == "location dark" || lCase == "is dark") {
                    setLocationType("dark");
                } else if (lCase == "location bottomless" || lCase == "is bottomless" ) {
                    setLocationType("bottomless");
                } else if (lCase == "location inside" || lCase == "is inside" ) {
                    if( pov.isGod && pov.location ) {
                        delete locations[pov.location].type;
                    } else {
                        setLocationType("inside");
                    }
                } else if (lCase == "location") {
                    if (pov.location) {
                        if (locations[pov.location].type) {
                            console.log("Location is " + locations[pov.location].type + ".");
                        } else {
                            console.log("Location is inside.");
                        }
                    } else {
                        console.log("You are nowhere.");
                    }

                } else if( firstWord == "then") {
                    // linear script
                    if (pov.isGod ) {
                        if( verbAction ) {
                            command = subSentence( command , 1);
                            console.log("TBD continue [then] "+verbAction+" - "+command)
                        }
                    } else {
                        console.log("then what?");
                    }
                } else if( firstWord == "or" ) {
                    // alt script
                    if (pov.isGod ) {
                        if( verbAction ) {
                            command = subSentence( command , 1);
                            console.log("TBD continue [or] "+verbAction+" - "+command)
                        }
                    } else {
                        console.log("or not.");
                    }
                } else if ( firstWord == "hi" 
                         || firstWord == "bye" 
                         || firstWord == "leave" 
                         || firstWord == "notice" 
                          ) {
                    command = subSentence( command , 1);
                } else if ( firstWord == "ask" 
                         || firstWord == "tell"  
                         || firstWord == "give"  
                         || firstWord == "show"  
                         || firstWord == "!talkto"
                          ) {
                    // TBD - register NPCs & topics
                    command = subSentence( command , 1);
                    if( firstWord == "give" || firstWord == "show" ) {
                        command = command.split(" the ");
                        if( command.length == 1 ) {
                            command = command.split(" my ");
                            if( command.length == 1 ) {
                                command = command.split(" ");
                                if( command.length > 2 ) {
                                    if( findNPC(command[0]) ) {
                                        verbNPC = command[0];
                                        command[0] = "";
                                        command = [verbNPC,command.join(" ").trim()];
                                    }
                                }
                            }
                        }
                    } else {
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
                    }
                    verbAction = firstWord;
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
                        if (pov.isGod ) {
                            mode = "script?";
                        } else {
                            noUnderstand();
                        }
                    }
                } else if ( 
                    firstWord == "sit" 
                 || firstWord == "lie" 
                 || firstWord == "stand" 
                ) {
                    command = subSentence( command , 1);
                    propositionAction = wordMap.posturePrep[command.split(" ")[0]];
                    if( propositionAction ) {
                        command = subSentence( command , 1);
                    }
                    if( command.length ) {
                        var existingItem = lookupItem(command);
                        if (existingItem && existingItem != "?") {
                            if( allowPosture(items[existingItem],firstWord) ) {
                                console.log("You "+firstWord + " on " + items[existingItem].name + ".");
                            } else if( pov.isGod ) {
                                if( !items[existingItem].postures ) {
                                    items[existingItem].postures = [];
                                }
                                items[existingItem].postures.push(firstWord);
                                console.log("You can now "+firstWord + " on " + items[existingItem].name + ".");
                            } else {
                                console.log("You cannot "+firstWord + " on " + items[existingItem].name + ".");
                            }
                        } else if (existingItem != "?") {
                            console.log("You see no " + command);
                        }
                    }
                } else if (lCase == "dump") {
                    if( pov.isGod ) {
                        console.log(JSON.stringify(metadata, null, "  "));
                        console.log(JSON.stringify(locations, null, "  "));
                        console.log(JSON.stringify(items, null, "  "));
                    } else {
                        console.log("dump what?");
                    }
                } else if (lCase == "map") {
                    if( pov.isGod ) {
                        if (!map) {
                            map = createMap();
                        } else if (pov.location && map.location.room != pov.location) {
                            recalcLocation(map, pov.location);
                        }
                        var renderMap =  renderMapLevelText(map);
                        console.log(renderMap.lines.join("\n"));
                    } else {
                        console.log("You don't have a map");
                    }
                } else if (firstWord == "pov") {
                    command = subSentence( command , 1);
                    if( command && command.length ) {
                        if( command == god.name ) {
                            if( allowGodMode ) {
                                pov = god;
                            } else {
                                console.log("God mode not available.")
                            }
                        } else if( command == actor.name ) {
                            pov = actor;
                        }
                    } else {
                        console.log("You are "+pov.name);
                    }
                } else if (lCase == "save") {
                    saveFile();
                } else if (firstWord == "help") {
                    if (lCase.split(" ").length > 1) {
                        lCase = lCase.split(" ")[1];
                        if( helpText.subtopic[lCase]) {
                            console.log(helpText.subtopic[lCase].help.join("\n"));                            
                        } else {
                            console.log("Unrecognized help category '"+lCase+"'\n"+helpText.help.join("\n"));
                        }
                    } else {
                        console.log(helpText.help.join("\n"));
                    }
                } else {
                    var verb = lCase.split(" ")[0];
                    if ( isVerb(verb) ) {
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
                if( obj.god ) {
                    allowGodMode = true;
                    god = obj.god;
                    pov = god;
                } else {
                    allowGodMode = false;
                    pov = actor;
                }
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
    var exportTads = function (folder) {
        var generate = require("./generate-tads");
        generate({ folder : folder , settings : settings , metadata : metadata, actor : actor, locations : locations , doors : doors , items : items , npc : npc , topics : topics });
    }
    return {
        describe: describe,
        parseCommand: parseCommand,
        loadGame: loadGame,
        exportTads: exportTads
    };
};

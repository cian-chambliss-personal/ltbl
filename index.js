const chalk = require("chalk");

module.exports = function ltbl(settings) {
    var roomNum = 1;
    var itemNum = 1;
    var doorNum = 1;
    var mode = 'where';
    var statusLine = null;
    var lastLocation = null;
    var lastDirection = null;
    var lastNonVoid = null;
    var lastNonVoidDirection = null;
    var lastNonVoidDelta = 0;
    var lastNonVoidPendingVoid = null;
    var describeItem = null;
    var fs = require("fs");
    var helpText = require("./en-help.json");
    var verbAction = null;
    var propositionAction = null;
    var verbNPC = null;
    var verbsWithTopics = { "ask" : true , "tell" : true , "show" : true , "give" : true };
    var gameState = {};
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
    var editStates = {
        noLocation : {
            "1" : { description : "create room" }
        },
        location : {
            "1" : { description : "edit room" ,
                states : {
                    "1" : { description : "Change name" },
                    "2" : { description : "Change description" },
                    "3" : { description : "Change location type" }
                }
            },
            "2" : { description : "edit connections" ,
                    states : {
                    "1" : { description : "Add connection" },
                    "2" : { description : "Edit connection" },
                    "3" : { description : "Remove connection" }
                   }
            },
            "3" : { description : "item" ,
                states : {
                    "1" : { description : "Add item" },
                    "2" : { description : "Edit item" ,
                            states : {
                                "1" : { description : "Change name" },
                                "2" : { description : "Change description" },
                                "3" : { description : "Change item type" ,
                                        states : {
                                            "1" : { description : "Item is a fixture" },
                                            "2" : { description : "Item is a container" },
                                            "3" : { description : "Item is readable" },
                                            "4" : { description : "Item is a lightsource" },
                                            "5" : { description : "Item is eatable" },
                                        }
                                    }
                            }
                          },
                    "3" : { description : "Remove item" }
                }
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
    var getLocation = function(name) {
        var location = null;
        name = name.split("/");
        location = locations[name[0]];
        if( name.length > 1 ) {
            for( var i = 1 ; location && i < name.length ; ++i ) {
                if( location.locations ) {
                    location = location.locations[name[i]];
                } else {
                    location = null;
                }
            }
        }
        return location;
    };
    var setLocation = function(name,room) {
        var location = null;
        name = name.split("/");
        location = locations[name[0]];
        if( !location ) {
            if( name.length > 1 ) {
                locations[name[0]] = {};
            } else {
                locations[name[0]] = room;
            }
        }
        if( name.length > 1 ) {
            for( var i = 1 ; location && i < name.length ; ++i ) {
                if( !location.locations ) {
                    location.locations = {};
                }
                if( i == name.length - 1) {
                    location.locations[name[i]] = room;
                    break
                } else {
                    if( !location.locations[name[i]] ) {
                        location.locations[name[i]] = {};
                    }
                    location = location.locations[name[i]];
                }
            }
        }
        return location;
    };
    //---------------------------------------------------------------------------
    // Create a spacial map of from the logical description
    var createMap = function () {
        var visited = {};
        var adjustLevel = function(dir,level) {
            if( dir.direction ) {
                // Delta to level 
                return level+dir.direction;
            }
            return level;
        }
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
                var loc = getLocation(_loc);
                if( !loc ) {
                    loc = { name : "undefined"};
                }
                if (loc.w) {
                    if( !loc.w.teleport ) {
                        createMapLow(row, col - 1, adjustLevel(loc.w,level), loc.w.location, bounds, emitRooms);
                    }
                }
                if (loc.e) {
                    if( !loc.e.teleport ) {
                        createMapLow(row, col + 1, adjustLevel(loc.e,level), loc.e.location, bounds, emitRooms);
                    }
                }
                if (loc.n) {
                    if( !loc.n.teleport ) {
                        createMapLow(row - 1, col, adjustLevel(loc.n,level), loc.n.location, bounds, emitRooms);
                    }
                }
                if (loc.nw) {
                    if( !loc.nw.teleport ) {
                        createMapLow(row - 1, col - 1, adjustLevel(loc.nw,level), loc.nw.location, bounds, emitRooms);
                    }
                }
                if (loc.ne) {
                    if( !loc.ne.teleport ) {
                        createMapLow(row - 1, col + 1, adjustLevel(loc.ne,level), loc.ne.location, bounds, emitRooms);
                    }
                }
                if (loc.s) {
                    if( !loc.s.teleport ) {
                        createMapLow(row + 1, col, adjustLevel(loc.s,level), loc.s.location, bounds, emitRooms);
                    }
                }
                if (loc.sw) {
                    if( !loc.sw.teleport ) {
                        createMapLow(row + 1, col - 1, adjustLevel(loc.sw,level), loc.sw.location, bounds, emitRooms);
                    }
                }
                if (loc.se) {
                    if( !loc.se.teleport ) {
                        createMapLow(row + 1, col + 1, adjustLevel(loc.se,level), loc.se.location, bounds, emitRooms);
                    }
                }
                if (loc.d) {
                    if( !loc.d.teleport ) {
                        createMapLow(row, col, level - 1, loc.d.location, bounds, emitRooms);
                    }
                }
                if (loc.u) {
                    if( !loc.u.teleport ) {
                        createMapLow(row, col, level + 1, loc.u.location, bounds, emitRooms);
                    }
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
        return render( { map : map , getLocation : getLocation , viewportHeight : 15 , viewportWidth : 40 } );
    };
    var map = null;
    var renderMap = null;
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
        if( allowGodMode ) {
            obj.god = god;
        }
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
                if( dir.direction ) {
                    if( dir.direction > 0 ) {
                        console.log("To the " + name + " is passage leading up.");
                    } else {
                        console.log("To the " + name + " is passage leading down.");
                    }
                } else {                
                    console.log("To the " + name + " is " + (getLocation(dir.location).name || getLocation(dir.location).description) + ".");
                }
            }
        };
        if( !loc ) {
            console.log("Null for "+locationId);
        }
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

    var describe = function (noVoid) {
        if( renderMap ) {
            if( !map || map.location.room != pov.location ) {
                if (!map) {
                    map = createMap();
                } else if (pov.location && map.location.room != pov.location) {
                    recalcLocation(map, pov.location);
                }
                renderMap =  renderMapLevelText(map);
            }            
        }
        if( pov.isGod ) {
            console.clear();
            if( renderMap ) {
                var mapWidth = 40;
                var infoWidth = 79 - mapWidth - 3;
                var screen = [];
                var maxLines = renderMap.lines.length;
                var infoLines = [];
                if( !infoWidth || infoWidth < 1 ) {
                    infoWidth = 20;
                }
                if( renderMap.legend ) {
                    infoLines =renderMap.legend;
                }
                screen.push("┌"+("─".repeat(infoWidth))+"┬"+("─".repeat(mapWidth))+"┐");
                for( var i = 0 ; i < maxLines ; ++i ) {
                    var mapLine = null;
                    var infoLine = null;
                    if( i < renderMap.lines.length )
                        mapLine = renderMap.lines[i];
                    else
                        mapLine = (" ".repeat(mapWidth));
                    if( i < infoLines.length ) {
                        infoLine = infoLines[i];
                        if( infoLine.length > infoWidth ) {
                            infoLine = infoLine.substring(0,infoWidth);
                        } else if( infoLine.length < infoWidth ) {
                            infoLine = infoLine + " ".repeat(infoWidth-infoLine.length)
                        }                        
                    } else 
                        infoLine = (" ".repeat(infoWidth));
                    screen.push("│"+infoLine+"│"+mapLine+"│");
                }
                screen.push("└"+("─".repeat(infoWidth))+"┴"+("─".repeat(mapWidth))+"┘");
                if( statusLine != null ) {
                    screen.push(statusLine);
                }
                console.log(screen.join("\n"));
            }
        }
        if( noVoid ) {
            if(pov.location) {
                if( getLocation(pov.location).type != "void" ) {
                    noVoid = false;
                }
            }
        }
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
        } else if (pov.location && !noVoid ) {
            render(getLocation(pov.location),pov.location, 0);
            mode = "what";
        } else {            
            console.log("Where are you?");
            mode = 'where';
        }
    };
    var lookupItemLow = function (arr,command,candidates) {
        var itemName = null;
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
    var lookupItemArr = function (command, arr) {
        var itemName = null;
        if (command != "") {
            var candidates = [];
            itemName = lookupItemLow(arr,command,candidates);
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
    var lookupItem = function (command, flags) {
        var itemName = null;
        if (command != "") {
            var where = getLocation(pov.location);
            var candidates = [];
            var what = command;
            command = command.toLowerCase();
            var parts = getPartsOfSpeech(command);
            if (flags != "noactor")
                itemName = lookupItemLow(actor.inventory,command,candidates);
            if (where.contains && !itemName && flags != "actor") {
                itemName = lookupItemLow(where.contains,command,candidates);
            }
            if (!itemName && flags != "actor" && where.wall) {
                if (!itemName && where.wall.n) {
                    if (where.wall.n.contains) {
                        itemName = lookupItemLow(where.wall.n.contains,command,candidates);
                    }
                }
                if (!itemName && where.wall.s) {
                    if (where.wall.s.contains) {
                        itemName = lookupItemLow(where.wall.s.contains,command,candidates);
                    }
                }
                if (!itemName && where.wall.e) {
                    if (where.wall.e.contains) {
                        itemName = lookupItemLow(where.wall.e.contains,command,candidates);
                    }
                }
                if (!itemName && where.wall.w) {
                    if (where.wall.w.contains) {
                        itemName = lookupItemLow(where.wall.w.contains,command,candidates);
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
    var removeItem = function(inventory,command) {
        var item = lookupItemArr(inventory,command);
        if (item) {
            for (var i = 0; i < pov.inventory.length; ++i) {
                if (inventory[i].item == item) {
                    inventory.splice(i, 1);
                    return item;
                }
            }
        }
        return null;
    };
    var processScript = function(command) {
        var emitResponse = function(response,verbNPC,stateId) {
            if( typeof(response) == "string" ) {
                console.log( response );
                return true;
            } else if( response.then ) {
                var responseIndex = gameState[stateId+".then"];
                if( responseIndex ) {
                    if( !emitResponse( response.then[responseIndex],verbNPC,stateId ) )
                         return false;
                    if( response.then.length > (responseIndex+1) ) {
                        gameState[stateId+".then"] = (responseIndex+1);
                    }
                } else {
                    if( !emitResponse( response.then[0],verbNPC,stateId ) )
                        return false;
                    if( response.then.length > 1 ) {
                        gameState[stateId+".then"] = 1;
                    }
                }
            } else if( response.or ) {
                var responseIndex = gameState[stateId+".or"];
                if( responseIndex ) {
                    if( !emitResponse( response.or[responseIndex],verbNPC,stateId ) )
                        return false;
                    if( response.or.length > (responseIndex+1) ) {
                        gameState[stateId+".or"] = (responseIndex+1);
                    } else {
                        gameState[stateId+".or"] = 0;
                    }
                } else {
                    if( !emitResponse( response.then[0],verbNPC,stateId ) )
                        return false;
                    if( response.or.length > 1 ) {
                        gameState[stateId+".or"] = 1;
                    }
                }
            } else {
                // All the actions
                if( response.take ) {
                    var npcPtr = npc[verbNPC];
                    if( !npcPtr )
                        return false;
                    var item = removeItem(actor.inventory,response.take);
                    if( !item ) 
                        return false;
                    if( npcPtr ) {
                        if( !npcPtr.inventory ) {
                            npcPtr.inventory = [];
                        }
                        npcPtr.inventory.push(item);
                    }
                }
                if( response.consume ) {
                    var item = removeItem(actor.inventory,response.consume);
                    if( !item ) 
                        return false;
                }
                if( response.give ) {
                    var npcPtr = npc[verbNPC];
                    if( !npcPtr )
                        return false;
                    if( !npcPtr.inventory ) 
                        return false;
                    var item = removeItem(npcPtr.inventory,response.give);
                    if( !item ) 
                        return false;
                    actor.inventory.push(item);
                }
                if( response.say ) {
                    console.log( response.say );
                }
                if( response.score ) {
                    if( !gameState[stateId+".score"] ) {
                        gameState[stateId+".score"] = true;
                        if( !gameState.Score ) {
                            gameState.Score = 0;
                        }
                        gameState.Score = gameState.Score + response.score;
                        console.log("Score went up by "+response.score+" Points");
                    }
                }
                //if( response.die ) {
                //}
            }
            return true;
        };
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
                    } else if( verbAction == "!talkto" ) {
                        _npc.conversation.talkto = { response : command };
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
                    emitResponse(_npc.response,verbNPC,verbNPC+verbAction+verbTopic);
                    return true;
                } else if(pov.isGod) {
                    if( propositionAction ) {
                        console.log( "what is response? (n/no for stop)" );                    
                    }
                } else {
                    noUnderstand();
                    return true;
                }
            } else {
                var _npc = findNPC(verbNPC);
                if( _npc ) {
                    if( _npc.conversation ) {
                        if( verbAction == "!talkto" ) {
                            _npc = _npc.conversation.talkto;
                        } else if( _npc.conversation[verbAction] ) {
                            _npc = _npc.conversation[verbAction];                            
                        } else {
                            _npc = null;
                        }
                    } else {
                        _npc = null;
                    }
                }
                if( _npc && _npc.response ) {
                    emitResponse(_npc.response,verbNPC,verbNPC+verbAction+verbTopic);
                    return true;
                } else if(pov.isGod) {
                    console.log( "what is response? (n/no for stop)" );
                } else {
                    noUnderstand();
                    return true;
                }
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
            var roomPtr = getLocation(pov.location);
            if( pov.isGod ) {
                if( ltype == "inside"  ) {
                    delete roomPtr.type;
                } else {
                    roomPtr.type = ltype;
                }
            } else if( !roomPtr.type && ltype == "inside" ) {
                console.log("Yes it is.");
            } else if( roomPtr.type == ltype ) {
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
    var clearVoid = function() {
        var voidCounter = 1;
        while( locations["void"+voidCounter] ) {
            delete locations["void"+voidCounter];
            voidCounter = voidCounter + 1;
        }
        map = null; // force regen without the voids....
    };
    var gatherVoid = function() {
        var  collectedVoid = {};
        var voidCounter = 1;
        while( locations["void"+voidCounter] ) {
            collectedVoid["void"+voidCounter] = locations["void"+voidCounter];
            voidCounter = voidCounter + 1;
        }
        return { voids : collectedVoid , count : voidCounter };
    };
    var autoConnectVoids = function(map,collectedVoid) {
        // Connect all voids to other adjecent voids - defines a big room.
        var rows = map.levels[map.location.level];
        var visitedVoid = {};
        var minRow = map.location.row;
        var minCol = map.location.col;
        var maxRow = map.location.row;
        var maxCol = map.location.col;
        var connectAllVoid = function (r,c) {
            var room = rows[r][c] , otherRoom;
            if( visitedVoid[room] ) {
                return room;
            } else {
                if( room ) {
                    var roomPtr = getLocation(room);
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
                                    if( getLocation( roomPtr.w.location ).type == "void" ) {
                                        roomPtr.w.wall = "none";
                                    }                                    
                                } else {
                                    otherRoom = connectAllVoid(r,c-1);
                                    if( otherRoom ) {
                                        roomPtr.w = { location : otherRoom , wall : "none" };
                                        getLocation(otherRoom).e = { location : room , wall : "none"};
                                    }
                                }
                            }
                            if( (c + 1) < rows[r].length ) {
                                if( roomPtr.e ) {
                                    if( getLocation( roomPtr.e.location ).type == "void" ) {
                                        roomPtr.e.wall = "none";
                                    }                                    
                                } else {
                                    otherRoom = connectAllVoid(r,c+1);
                                    if( otherRoom ) {
                                        roomPtr.e = { location : otherRoom , wall : "none"};
                                        getLocation(otherRoom).w = { location : room , wall : "none"};
                                    }
                                }
                            }
                            if( r > 0 ) {
                                if( roomPtr.n ) {
                                    if( getLocation( roomPtr.n.location ).type == "void" ) {
                                        roomPtr.n.wall = "none";
                                    }
                                } else {
                                    otherRoom = connectAllVoid(r-1,c);
                                    if( otherRoom ) {
                                        roomPtr.n = { location : otherRoom , wall : "none"};
                                        getLocation(otherRoom).s = { location : room , wall : "none"};
                                    }
                                }
                            }
                            if( (r + 1) < rows.length  ) {
                                if( roomPtr.s ) {
                                    if( getLocation( roomPtr.s.location ).type == "void" ) {
                                        roomPtr.s.wall = "none";
                                    }
                                } else {
                                    otherRoom = connectAllVoid(r+1,c);
                                    if( otherRoom ) {
                                        roomPtr.s = { location : otherRoom , wall : "none"};
                                        getLocation(otherRoom).n = { location : room , wall : "none"};
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
        connectAllVoid(map.location.row,map.location.col);
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

    var getConvoObjectPtr = function(command) {
        if( verbAction ) {        
            var _npc = findNPC(verbNPC);
            if( _npc ) {
                var ptr = null;
                if( verbAction == "!talkto")  {
                    if( _npc.conversation.talkto ) {
                        ptr =_npc.conversation.talkto.response;
                    }
                } else if( _npc.conversation[verbAction] ) {
                    if( _npc.conversation[verbAction][verbTopic] ) {
                         ptr = _npc.conversation[verbAction][verbTopic].response;
                    }
                }
                if( ptr ) {
                    if( typeof(ptr) == "string" ) {
                        ptr = { "say" : ptr };
                    } else if( ptr.then ) {
                        if( typeof(ptr.then[ ptr.then.length - 1 ]) == "string" ) {
                            ptr.then[ ptr.then.length - 1 ] = { "say" : ptr.then[ ptr.then.length - 1 ] };
                            ptr = ptr.then[ ptr.then.length - 1 ];
                        } else {
                            ptr = ptr.then[ ptr.then.length - 1 ];
                        }
                    } else if( ptr.or ) {
                        if( typeof(ptr.or[ ptr.or.length - 1 ]) == "string" ) {
                            ptr.then[ ptr.or.length - 1 ] = { "say" : ptr.or[ ptr.or.length - 1 ] };
                            ptr = ptr.or[ ptr.or.length - 1 ];
                        } else {
                            ptr = ptr.or[ ptr.or.length - 1 ];
                        }
                    }
                    return ptr;
                }
            }            
        }
        return null;
    };


    var parseCommand = function (command) {
        if (mode == "gettitle") {
            metadata.title = command;
            describe(false);
        } else if (mode == "getdescription") {
            metadata.description = command;
            describe(false);
        } else if (mode == "getauthor") {
            metadata.author = command;
            describe(false);
        } else if (mode == "getemail") {
            metadata.authorEmail = command;
            describe(false);
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
                if (lCase == 'b' && lastLocation ) {
                    pov.location = lastLocation;
                    describe();
                } else if (lCase.length > 2) {
                    var connectedVoid = { count : 0 };
                    if( pov.location ) {
                        if( getLocation(pov.location).type == "void" ) {
                            connectedVoid = gatherVoid();
                            if( connectedVoid.count  > 1 ) {
                                autoConnectVoids(map,connectedVoid.collectedVoid);
                            }
                        }
                    }
                    var calcRoomName = function(suffix) {
                        var roomName = extractNounAndAdj(command);
                        if (roomName) {
                            if( suffix ) {
                                roomName = roomName + "."+ suffix;
                            }
                            // add # to the orginal room (libary,library1,library2...)
                            if (getLocation(roomName)) {
                                var extactCount = 1;
                                while( getLocation(roomName+extactCount) ) {
                                    extactCount = extactCount + 1;
                                }
                                roomName = roomName+extactCount
                            }
                        } else {
                            roomName = "room" + roomNum;
                            roomNum = roomNum + 1;
                        }
                        return roomName;
                    };
                    var roomName;
                    var name = command;
                    var parts = getPartsOfSpeech(command);
                    map = null; // need to recalc the map 

                    if( connectedVoid.count > 1 ) {
                        var newRoomMap = {};
                        // Create rooms for all the voids....
                        for( var voidRoom in connectedVoid.voids ) {
                            var _name = parts.name;
                            var roomDesc = command;
                            var srcRoom = connectedVoid.voids[voidRoom];
                            var suffix = srcRoom.edge;
                            if( !suffix && Number.isFinite(srcRoom.row) && Number.isFinite(srcRoom.col) ) {
                                suffix = "r"+srcRoom.row+"c"+srcRoom.col;
                            } else {
                                suffix = "part";
                            }
                            var roomName = calcRoomName(suffix);
                            newRoomMap[voidRoom] = roomName;
                            if( srcRoom.edge ) {
                                var edgeName = friendlyDir(srcRoom.edge);
                                _name = edgeName+" "+_name;
                                roomDesc = edgeName+" "+roomDesc;
                            }
                            setLocation(roomName,{ name: _name, description: roomDesc });
                            if( lastNonVoid ) {
                                if( getLocation(lastNonVoid).type ) {
                                    getLocation(roomName).type = getLocation(lastNonVoid).type;
                                }
                            }
                        }
                        // Now connect voids (and rooms)
                        for( var voidRoom in connectedVoid.voids ) {
                            var roomName = newRoomMap[voidRoom];
                            var srcRoom = connectedVoid.voids[voidRoom];
                            var dstRoom = getLocation(roomName);
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
                                getLocation(dstRoom.n.location).s = otherLocation;
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
                                getLocation(dstRoom.s.location).n = otherLocation;
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
                                getLocation(dstRoom.e.location).w = otherLocation;
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
                                getLocation(dstRoom.w.location).e = otherLocation;
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
                                getLocation(dstRoom.u.location).d = otherLocation;
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
                                getLocation(dstRoom.d.location).u = otherLocation;
                            }
                        }
                        pov.location = newRoomMap[pov.location];
                        lastLocation = null;
                        lastDirection = null;
                        // Drop or raise voids
                        if( lastNonVoid && lastNonVoidDelta != 0 ) {
                            getLocation(lastNonVoid)[lastNonVoidDirection].direction = lastNonVoidDelta;
                            getLocation(getLocation(lastNonVoid)[lastNonVoidDirection].location)[reverseDirection(lastNonVoidDirection)].direction = -lastNonVoidDelta;
                        }
                        clearVoid();
                        describe();
                        mode = "what";
                    }  else {
                        roomName = calcRoomName(null);
                        pov.location = roomName;
                        getLocation(pov.location) = { name: parts.name, description: command };
                        if( connectedVoid.count > 0 ) {
                            clearVoid();
                        }
                        if (lastLocation) {
                            if (getLocation(lastLocation).type) {
                                getLocation(pov.location).type = getLocation(lastLocation).type;
                            }
                        }
                        if (lastLocation && lastDirection) {
                            getLocation(lastLocation)[lastDirection] = { location: pov.location };
                            getLocation(pov.location)[reverseDirection(lastDirection)] = { location: lastLocation };
                            if( lastNonVoidDelta != 0 ) {
                                getLocation(lastLocation)[lastDirection].direction = lastNonVoidDelta;
                                getLocation(pov.location)[reverseDirection(lastDirection)].direction = -lastNonVoidDelta;
                            }
                            //console.log("Door name (blank or 'n' for no door, 's' for stairs, 'p' for path/passage )");
                            mode = "what";
                        }
                        describe();
                    }
                }
            } else if (mode == 'door?') {
                lCase = lCase.trim();
                if (lCase == "s") {
                    getLocation(lastLocation)[lastDirection].type = "stairs";
                    getLocation(pov.location)[reverseDirection(lastDirection)].type = "stairs";
                } else if (lCase == "p") {
                    if (getLocation(lastLocation).type == "outside") {
                        getLocation(lastLocation)[lastDirection].type = "path";
                        getLocation(pov.location)[reverseDirection(lastDirection)].type = "path";
                    } else {
                        getLocation(lastLocation)[lastDirection].type = "passage";
                        getLocation(pov.location)[reverseDirection(lastDirection)].type = "passage";
                    }
                } else if (lCase == "u") {
                    getLocation(lastLocation)[lastDirection].direction = -1;
                    getLocation(pov.location)[reverseDirection(lastDirection)].direction = 1;
                    map = null;
                } else if (lCase == "d") {
                    getLocation(lastLocation)[lastDirection].direction = 1;
                    getLocation(pov.location)[reverseDirection(lastDirection)].direction = -1;
                    map = null;
                } else if (lCase == "-") {
                    getLocation(lastLocation)[lastDirection].teleport = true;
                    getLocation(pov.location)[reverseDirection(lastDirection)].teleport = true;
                    map = null;
                } else if (lCase == "+") {
                    // TBD - we need to make sure that the maps do *not* overlap
                    if( getLocation(lastLocation)[lastDirection].teleport ) {
                        delete getLocation(lastLocation)[lastDirection].teleport;
                    }
                    if( getLocation(pov.location)[reverseDirection(lastDirection)].teleport ) {
                        delete getLocation(pov.location)[reverseDirection(lastDirection)].teleport;
                    }
                    map = null;
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
                    getLocation(lastLocation)[lastDirection].door = name;
                    getLocation(pov.location)[reverseDirection(lastDirection)].door = name;
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
                getLocation(pov.location).description = command;
                mode = "what";
            } else if (mode == 'what') {
                // navigate the map
                if (firstWord == "look" && lCase.indexOf(" ") < 0 ) {
                    describe(true);
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
                        var where = getLocation(pov.location);
                        if (where.description) {
                            console.log(where.description);
                        } else {
                            mode = "describe_location";
                            console.log("How would you describe the " + where.name + "?")
                        }
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
                        var where = getLocation(pov.location);
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
                                var where = getLocation(pov.location);
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
                        var where = getLocation(pov.location);
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
                    if (getLocation(pov.location)) {
                        var nextLoc = getLocation(pov.location)[lCase];
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

                                if( pov.location && lastNonVoid ) {
                                    if( getLocation(pov.location).type == "void" ) {
                                        if (lCase == "u") {
                                            lCase = "+";
                                        } else if (lCase == "d") {
                                            lCase = "-";
                                        }
                                    }
                                }
                                if( lCase == "+" ||  lCase == "-" ) {
                                    if( lastNonVoid && lastNonVoidPendingVoid ) {
                                        if( lCase == "+" ) {
                                            lastNonVoidDelta = lastNonVoidDelta + 1;
                                        } else {
                                            lastNonVoidDelta = lastNonVoidDelta - 1;
                                        }
                                        getLocation(lastNonVoidPendingVoid)[reverseDirection(lastNonVoidDirection)].direction = -lastNonVoidDelta;
                                        map = null;
                                        describe();
                                    }
                                } else {
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
                                    if( pov.location ) {
                                        if( getLocation(pov.location).type != "void" ) {
                                            lastNonVoid = pov.location;
                                            lastNonVoidDirection = lCase;
                                            lastNonVoidDelta = 0;
                                            lastNonVoidPendingVoid = null;
                                        }
                                    }
                                    if (posCell) {
                                        if( getLocation(pov.location).type == "void" && getLocation(posCell).type != "void" ) {
                                            // clean up all the voids
                                            clearVoid();
                                        }
                                        lastLocation = pov.location
                                        lastDirection = lCase;
                                        pov.location = posCell;
                                    } else {
                                        lastLocation = pov.location;                                    
                                        var voidCounter = 1;
                                        while( getLocation("void"+voidCounter) ) {
                                            voidCounter = voidCounter + 1;
                                        }
                                        pov.location = "void"+voidCounter;
                                        // Single link void back to cell
                                        setLocation(pov.location,{ name : "void" , type : "void" , description : "void" });
                                        if( lastLocation && getLocation(lastLocation).type == "void" ) {
                                            getLocation(pov.location)[reverseDirection(lCase)] = { location: lastLocation , "wall" : "none" };
                                        } else {
                                            getLocation(pov.location)[reverseDirection(lCase)] = { location: lastLocation };
                                        }
                                        lastDirection = lCase;
                                        if( !lastNonVoidPendingVoid ) {
                                            lastNonVoidPendingVoid = pov.location;
                                        }
                                        map = null;
                                        describe();
                                    }
                                }
                            } else {
                                console.log("You cannot go that way.");
                            }
                        } else {
                            if( pov.location ) {
                                if( getLocation(pov.location).type == "void" && getLocation(nextLoc.location).type != "void" ) {
                                    // clean up all the voids
                                    clearVoid();
                                } else if( nextLoc.teleport ) {
                                    map = null;
                                }
                            }
                            lastLocation = pov.location;
                            lastDirection = lCase;
                            pov.location = nextLoc.location;
                        }
                    }
                    describe(false);
                } else if (firstWord == "door" ) {
                    if( pov.isGod ) {
                        command = subSentence( command , 1);
                        if( isDirection(command) ) {
                            lCase = isDirection(command).primary;
                        } else {
                            lCase = lastDirection;
                        }
                        if (getLocation(pov.location)) {
                            var nextLoc = getLocation(pov.location)[lCase];
                            if (nextLoc) {
                                lastDirection = lCase;
                                lastLocation = pov.location;
                                pov.location = nextLoc.location;
                                console.log("Door name (blank or 'n' for no door, 's' for stairs, 'p' for path/passage )");
                                mode = "door?";
                            } else {
                                if( lastDirection 
                                 && lastLocation 
                                 && lCase == lastDirection
                                 && !getLocation(lastLocation)[lastDirection]
                                 && !getLocation(pov.location)[reverseDirection(lastDirection)]
                                  ) {
                                    getLocation(lastLocation)[lastDirection] = { location : pov.location };
                                    getLocation(pov.location)[reverseDirection(lastDirection)] = { location : lastLocation };
                                    map = null;
                                    describe();
                                    console.log("Door name (blank or 'n' for no door, 's' for stairs, 'p' for path/passage )");
                                    mode = "door?";
                                } else {
                                    console.log("There is no ending location. lastLocation="+lastLocation+" lastDirection="+lastDirection+ " pov.location="+pov.location);
                                }
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
                        delete getLocation(pov.location).type;
                    } else {
                        setLocationType("inside");
                    }
                } else if (lCase == "location") {
                    if (pov.location) {
                        if (getLocation(pov.location).type) {
                            console.log("Location is " + getLocation(pov.location).type + ".");
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
                            if( command.length > 0 ) {
                                var _npc = findNPC(verbNPC);
                                // TBD - also look for items (for verbs like push/pull etc)...
                                if( _npc && _npc.conversation ) {
                                    if( _npc.conversation[verbAction] ) {
                                        if( _npc.conversation[verbAction][verbTopic] ) {
                                            var modResponse = _npc.conversation[verbAction][verbTopic].response;
                                            if( typeof(modResponse) == "string" ) {
                                                modResponse = { "then" : [modResponse,command] };
                                            } else {
                                                if( !modResponse.then || !modResponse.or ) {
                                                    modResponse = { "then" : [modResponse,command] };
                                                } else if( !modResponse.then ) {
                                                    modResponse.then = [];
                                                }
                                                modResponse.then.push(command);
                                            }
                                            _npc.conversation[verbAction][verbTopic].response = modResponse;
                                        }
                                    } else if( verbAction == "!talkto") {
                                        if( _npc.conversation.talkto ) {
                                            var modResponse = _npc.conversation.talkto.response;
                                            if( typeof(modResponse) == "string" ) {
                                                modResponse = { "then" : [modResponse,command] };
                                            } else {
                                                if( !modResponse.or && !modResponse.then) {
                                                    modResponse = { "then" : [modResponse,command] };
                                                } else if( !modResponse.then ) {
                                                    modResponse.then = [];
                                                }
                                                modResponse.then.push(command);
                                            }
                                            _npc.conversation.talkto.response = modResponse;
                                        }
                                    }
                                }
                            }
                        } else {
                            console.log("then requires a prior action");    
                        }
                    } else {
                        console.log("then what?");
                    }
                } else if( firstWord == "or" ) {
                    // alt script
                    if (pov.isGod ) {
                        if( verbAction ) {
                            command = subSentence( command , 1);
                            if( command.length > 0 ) {
                                var _npc = findNPC(verbNPC);
                                // TBD - also look for items (for verbs like push/pull etc)...
                                if( _npc ) {
                                    if( _npc.conversation[verbAction] ) {
                                        if( _npc.conversation[verbAction][verbTopic] ) {
                                            var modResponse = _npc.conversation[verbAction][verbTopic].response;
                                            if( typeof(modResponse) == "string" ) {
                                                modResponse = { "or" : [modResponse,command] };
                                            } else {
                                                if( !modResponse.or && !modResponse.then) {
                                                    modResponse = { "or" : [modResponse,command] };
                                                } else if( !modResponse.or ) {
                                                    modResponse.or = [];
                                                }
                                                modResponse.or.push(command);
                                            }
                                            _npc.conversation[verbAction][verbTopic].response = modResponse;
                                        }
                                    }
                                }
                            }
                        }
                    } else {
                        console.log("or not.");
                    }
                } else if( firstWord == "score") {
                    // linear script
                    command = subSentence( command , 1);
                    if( command.length > 0 ) {
                        if (pov.isGod ) {
                            var value = Number.parseInt(command);
                            if( value > 0 ) {
                                var ptr = getConvoObjectPtr();
                                if( ptr ) {
                                    ptr.score = value; 
                                } else {
                                    console.log("Must have run a conversation to set an associated score");
                                }
                            }
                        } else {
                            console.log("Must be in god mode to set score");
                        }
                    } else {
                        if( gameState.Score ) {
                            console.log("Score: "+gameState.Score);
                        } else {
                            console.log("Score: 0");
                        }
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
                } else if (firstWord == "map") {
                    if( pov.isGod ) {
                        command = subSentence( command , 1).toLowerCase();
                        if( command == "show" )
                        {
                            if( !renderMap ) {
                                if (!map) {
                                    map = createMap();
                                } else if (pov.location && map.location.room != pov.location) {
                                    recalcLocation(map, pov.location);
                                }
                                renderMap =  renderMapLevelText(map);
                                describe(false);
                            }
                        }
                        else if( command == "hide" )
                        {
                            if( renderMap ) {
                                renderMap = null;
                                console.clear();
                            }
                        }
                    } else {
                        console.log("You don't have a map");
                    }
                } else if ( firstWord == "b" ) {
                    if( pov.isGod ) {
                        if( lastNonVoid && pov.location ) {
                            if( getLocation(pov.location).type == "void" ) {
                                clearVoid();
                                pov.location = lastNonVoid;
                                describe();
                            }
                        }
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
                            if( pov.isGod ) {
                                gameState = {};
                            }
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
                while (getLocation("room" + roomNum)) {
                    roomNum = roomNum + 1;
                }
                while (items["item" + itemNum]) {
                    itemNum = itemNum + 1;
                }
                while (doors["door" + doorNum]) {
                    doorNum = doorNum + 1;
                }
                if( allowGodMode ) {
                    if (!map) {
                        map = createMap();
                    } else if (pov.location && map.location.room != pov.location) {
                        recalcLocation(map, pov.location);
                    }
                    renderMap =  renderMapLevelText(map);
                    describe(false);
                }                
                onComplete(null, true);
            } else {
                god.location = "void1";
                pov = god;
                setLocation(god.location,{ "type" : "void" , "name" : "void" , "description" : "void" });
                map = createMap();
                renderMap =  renderMapLevelText(map);
                onComplete(err, false);
            }
        });
    };
    var exportTads = function (folder) {
        var generate = require("./generate-tads");
        generate({ folder : folder , settings : settings , metadata : metadata, actor : actor, getLocation : getLocation , locations : locations , doors : doors , items : items , npc : npc , topics : topics });
    }
    return {
        describe: describe,
        parseCommand: parseCommand,
        loadGame: loadGame,
        exportTads: exportTads
    };
};

const chalk = require("chalk");
const { get } = require("http");
const { off } = require("process");

module.exports = function ltbl(settings) {
    /*
      State machine for parseCommand

      stateMachine = {
         state : 0 , // index
         execute : function(statemachine,command) {
                // return "retry";
                // return "abort";
                return "next";
            
         }
      }
     */
    var stateMachine = null;
    var annotations = [];    
    var _SM = require("./state-machine")();
    var stateMachineFillin = _SM.fillin;
    var stateMachineFillinStart = _SM.fillinStart;
    var stateMachineFillinCreate = _SM.fillinCreate;
    var roomNum = 1;
    var mode = 'what';
    var statusLine = null;
    var lastLocation = null;
    var lastDirection = null;
    var lastNonVoid = null;
    var lastNonVoidDirection = null;
    var lastNonVoidDelta = 0;
    var lastNonVoidPendingVoid = null;
    var pendingGoInsideItem = null;
    var pendingItemOut = null;
    var describeItem = null;
    var fs = require("fs");
    var helpText = require("./en-help.json");
    var verbCommand = {
        action : null,
        npc : null,
        proposition  :null,
        topic : null
    };
    var verbsWithTopics = { "ask" : true , "tell" : true , "show" : true , "give" : true };
    var gameState = {};
    var wordMap = {
        firstWord : {
        "hello" : "!hi",
        "hi" : "!hi",
        "bye" : "!bye" ,
        "goodbye" : "!bye",
        "farewell" : "!bye",
        "leave" : "!leave",
        "notice" : "!notice",
        "l" : "look",
        "look" : "look",
        "x" : "examine",
        "examine" : "examine",
        "touch" : "touch",
        "feel" : "touch",
        "smell" : "!smell",
        "sniff" : "!smell",
        "listen" : "listen",
        "i": "inventory",
        "inventory" : "inventory",
        "drop" : "!drop",
        "put" : "!put",
        "hide" : "!hide",
        "read" : "!read",
        "eat" : "!eat",
        "wear" : "!wear",
        "light": "!light",
        "affix" : "!affix",
        "sit" : "!sit",
        "stand" : "!stand",
        "pov" :  "pov",
        "ask" : "!ask" , 
        "tell" : "!tell" , 
        "show" : "!show" , 
        "give" : "!give" 
        },
        firstTwoWord : {
            "talk to"  : "!talkto",
            "sit down" : "!sit",
            "lie down" : "!lie",
            "stand up" : "!stand",
            "go in" : "!goin",
            "go inside" : "!goin",
            "make door" : "!makedoor",
            "make path" : "!makepath",
            "make passage" : "!makepassage",
            "make stairs" : "!makestairs"
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
    var topLocationTypes = {
        outdoors : {
            membership : "part of"
        },
        indoors : {
            membership : "inside"
        },
        underground : {
            membership : "inside"
        }
    };
    topLocationMenu= [
        {
            text : "Outdoors" ,
            value : "outdoors"
        },
        {
            text : "Indoors" ,
            value : "indoors"
        },
        {
            text : "Underground" ,
            value : "underground"
        },
        {
            text : "One Room" ,
            value : "oneroom"
        }
    ];
    var dirTypesMenu = [
        {
            text : "Stairs" ,
            value : "stairs"
        },
        {
            text : "Passage" ,
            value : "passage"
        },
        {
            text : "Path" ,
            value : "path"
        },
        {
            text : "None" ,
            value : null
        }
    ];
    var roomTypesMenu = [
        {
            text : "Outside" ,
            value : "outside"
        },
        {
            text : "Ship" ,
            value : "ship"
        },
        {
            text : "Dark" ,
            value : "dark"
        },
        {
            text : "Bottomless" ,
            value : "bottomless"
        },
        {
            text : "Inside" ,
            value : null
        }
    ];
    var postureTypeList = [
        {
            text : "Sit" ,
            value : "sit"
        },
        {
            text : "Lie" ,
            value : "lie"
        },
        {
            text : "Stand" ,
            value : "stand"
        }
    ];
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
    var items = {
    };
    var npc = {
    };
    var topics = {
    };
    var getLocation = function(name) {
        var location = null;
        if( name ) {
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
        }
        return location;
    };
    var topRoomName = function(locName) {
        var location = locName.split("/");
        if( location.length > 1 ) {
            return location[0];
        }
        return null;
    };
    var calcCommonPrefix = function(loc1,loc2) {
        if( loc1 && loc2 ) {
            loc1 = topRoomName(loc1);
            loc2 = topRoomName(loc2);
            if( loc1 && !loc2 )
                return loc1+"/";
            if( loc2 && !loc1 )
                return loc2+"/";
            if( loc1 == loc2 )
                return loc1+"/";
        }
        return null;
    };
    var getItem = function(name) {
        name = name.split("/");
        if( name.length > 1 ) {
            var location = locations[name[0]];
            var i = 1;
            while( location && (i+1) < name.length ) {
                if( location.locations ) {
                    location = location.locations[name[i]];
                } else {
                    location = null;
                }
                i = i + 1;
            }
            if( location ) {
                if( location.items ) {
                    return location.items[name[name.length-1]];
                }
            }            
        } else {
            return items[name[0]];
        }
        return null;
    }
    var setItem = function(name,pi) {        
        name = name.split("/");
        if( name.length > 1 ) {
            location = locations[name[0]];
            for( var i = 1 ; location && i < (name.length-1) ; ++i ) {
                if( location.locations ) {
                    location = location.locations[name[i]];
                } else {
                    location = null;
                }
            }
            if( location ) {
                if( !location.items ) {
                    location.items = {};
                }
                location.items[name[name.length-1]] = pi;
            }
        } else {
            items[name[0]] = pi;
        }

    }
    var getUniqueItemName = function(name,altname,prefix) {
        var fullName = null;
        if (!name) {
            name = altname;
        }
        if( prefix ) {
            fullName = prefix+name;
        } else {
            fullName = name;
        }
        if( getItem(fullName) ) {
            var counter = 1;
            while( getItem(fullName+counter) ) {
                counter = counter + 1;
            }
            fullName = fullName+counter;
        }
        return fullName;
    }    
    var getDoor = function(name) {
        return getItem(name);
    };
    var setDoor = function(name,di) {        
        setItem(name,di);
    };
    var getNpc = function(name) {
        name = name.split("/");
        if( name.length > 1 ) {
            var location = locations[name[0]];
            var i = 1;
            while( location && (i+1) < name.length ) {
                if( location.locations ) {
                    location = location.locations[name[i]];
                } else {
                    location = null;
                }
                i = i + 1;
            }
            if( location ) {
                if( location.npc ) {
                    return location.npc[name[name.length-1]];
                }
            }            
        } else {
            return npc[name[0]];
        }
        return null;
    }
    var setNpc = function(name,ni) {
        npc[name] = ni;
    }
    var setLocation = function(name,room) {
        var location = null;
        name = name.split("/");
        location = locations[name[0]];
        if( !location ) {
            if( name.length > 1 ) {
                locations[name[0]] = {};
                location = locations[name[0]];
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
                    break;
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
    var findLocations = function(name) {
        var list = [];
        var inexactList = [];
        name = name.toLowerCase();
        var _findLocations = function(_locations,name,prefix) {
            for(var loc in _locations ) {
                var _loc = _locations[loc];
                if( _loc.name ) {
                    var _lname = _loc.name;
                    _lname = _lname.toLowerCase();
                    if( name == _lname ) {
                        list.push(prefix+loc);
                    } else if( _lname.indexOf(name) >= 0 ) {
                        inexactList.push(prefix+loc);
                    }
                } else if( _loc.description ) {
                    var _lname = _loc.description;
                    _lname = _lname.toLowerCase();
                    if( _lname.indexOf(name) >= 0 ) {
                        inexactList.push(prefix+loc);
                    }
                }
                if( _loc.locations ) {
                    _findLocations(_loc.locations,name,prefix+loc+"/");
                }
            }
        };
        _findLocations(locations,name,"");
        if( list.length == 0 ) {
            list = inexactList;
        }
        return list;
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
        if( mapScale == "small" ) {
                return render( { map : map , getLocation : getLocation , viewportHeight : 16 , viewportWidth : 40 , small : true} );
        }
        return render( { map : map , getLocation : getLocation , viewportHeight : 16 , viewportWidth : 40 } );
    };
    var map = null;
    var renderMap = null;
    var mapScale = null;
    var helper = require("./helper.js")();
    var camelCase = helper.camelCase;
    var extractNounAndAdj = helper.extractNounAndAdj;
    var getPartsOfSpeech = helper.getPartsOfSpeech;
    var isVerb = helper.isVerb;
    var isArticle = helper.isArticle;
    var invalidateMap = function() {
        map = null;
        render(getLocation(pov.location),pov.location, 0);
    };
    var annotate = function(expr) {
        if( pov.isGod ) {
            annotations.push(expr);
            return helper.superScript(""+annotations.length);
        }
        return "";
    };
    var splitOnOneOf = function(text,words) {
        var newText;
        for(var i = 0 ; i < words.length ; ++i ) {
            newText = text.split(words[i]);
            if( newText.length > 1 )
                break;
        }
        return newText;                            
    };
    //---------------------------------------------------------------------------
    // Save off to file....
    var saveFile = function () {
        var obj = { 
            metadata: metadata, 
            actor: actor, 
            locations: locations, 
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
        if( !depth ) {
            annotations = [];
        }
        var describeNav = function (dir, name, rawDir) {
            if (dir.type == "stairs") {
                console.log("There are stairs leading " + name + "."+annotate({"type":"dir","dir":rawDir}));
            } else if (dir.type == "passage") {
                console.log("There is a passage leading " + name + "."+annotate({"type":"dir","dir":rawDir}));
            } else if (dir.type == "path") {
                console.log("There is a path leading " + name + "."+annotate({"type":"dir","dir":rawDir}));
            } else if (dir.door) {
                if (dir.open) {
                    console.log("To the " + name + " is open " + getDoor(dir.door).name+annotate({"type":"dir","dir":rawDir}));
                } else {
                    console.log("To the " + name + " is " + getDoor(dir.door).name+annotate({"type":"dir","dir":rawDir}));
                }
            } else {
                if( dir.direction ) {
                    if( dir.direction > 0 ) {
                        console.log("To the " + name + " is passage leading up."+annotate({"type":"dir","dir":rawDir}));
                    } else {
                        console.log("To the " + name + " is passage leading down."+annotate({"type":"dir","dir":rawDir}));
                    }
                } else {                
                    console.log("To the " + name + " is " + (getLocation(dir.location).name || getLocation(dir.location).description) + "."+annotate({"type":"dir","dir":rawDir}));
                }
            }
        };
        if( !loc ) {
            console.log("Null for "+locationId);
        }
        if( loc.type == "void") {
            if (loc.name) {
                console.log(chalk.bold(loc.name));
            } else if (loc.description) {
                console.log(loc.description);
            }
            
        } else {
            if(pov.isGod && !depth ) {
                if( locationId.indexOf("/") > 0 ) {
                    var topLoc = locationId.split("/")[0];
                    var topLocType = topLocationTypes[getLocation(topLoc).type];
                    if( topLocType ) {
                        console.log(topLocType.membership+" "+getLocation(topLoc).name+annotate({"type":"location.topLoc","location":topLoc }));
                    }
                }
                if(loc.type)
                    console.log("Type: "+chalk.bold(loc.type)+annotate({"type":"location.type"}));
                else
                    console.log("Type: "+chalk.bold("inside")+annotate({"type":"location.type"}));
            }
            if (loc.name) {
                console.log(chalk.bold(loc.name)+annotate({"type":"location.name"}));
            } else if(pov.isGod && !depth ) {
                console.log(chalk.bold("No name")+annotate({"type":"location.name"}));
            }
            if (loc.description) {
                console.log(loc.description+annotate({"type":"location.description"}));
            } else if(pov.isGod&& !depth ) {
                console.log(chalk.bold("No description")+annotate({"type":"location.description"}));
            }
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
                var iname = getItem(loc.contains[i].item).name;
                if ("AEIOUYW".indexOf(iname[0]))
                    contains += " a ";
                else
                    contains += " an ";
                contains += iname+annotate({"type":"item","item":loc.contains[i].item});
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
            describeNav(loc.e, "east","e");
        }
        if (loc.w) {
            describeNav(loc.w, "west","w");
        }
        if (loc.n) {
            describeNav(loc.n, "north","n");
        }
        if (loc.s) {
            describeNav(loc.s, "south","s");
        }
        if (loc.u) {
            describeNav(loc.u, "up","u");
        }
        if (loc.d) {
            describeNav(loc.d, "down","d");
        }
        if (loc.se) {
            describeNav(loc.se, "southeast","se");
        }
        if (loc.ne) {
            describeNav(loc.ne, "northeast","ne");
        }
        if (loc.sw) {
            describeNav(loc.sw, "southwest","sw");
        }
        if (loc.nw) {
            describeNav(loc.nw, "northwest","nw");
        }
        if( locationId ) {
            for( var _npc in npc) {
                var  ni = getNpc(_npc);
                if( ni.location == locationId ) {
                    console.log(ni.name+" is here."+annotate({"type":"npc","npc":_npc}));
                }
            }
        }
    };
    var findNPC =function(name) {
        name = name.toLowerCase().trim();
        var cc = camelCase(name);
        var _npc = npc[cc];
        if( _npc ) {
            // well known short name...
            return _npc;
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

    var findNPCs =function(name) {
        var list = [];
        name = name.toLowerCase().trim();
        var cc = camelCase(name);
        if( npc[cc] ) {
            // well known short name...
            return [cc];
        }
        for( var _ind in npc ) {
            var _npc = npc[_ind];
            if( _npc.name == name ) {
                return [_ind];
            }
            if( _npc.description.indexOf(name) >= 0 ) {
                list.push(_ind);
            } else if( _npc.name.indexOf(name) >= 0 ) {
                list.push(_ind);
            } else if( _npc.alias ) {
                for( var i = 0 ; i < _npc.alias.length ; ++i ) {
                    if( _npc.alias[i] == name ) {
                        list.push(_ind);
                        break;
                    }
                }
            }
        }
        return list;
    };

    var extractNounAndAdjAlways = function(text) {
        var name = extractNounAndAdj(text);
        if( !name ) {
            var words = text.split(" ");
            if( words.length > 1) {
                if( isArticle(words[0]) ) {
                    text = text.substring(words[0].length+1).trim();
                }
            }
            name = camelCase(text);
        }
        return name;
    };

    // data
    var locationDefine = function(data) {
        var prefix = "";
        var connectedVoid = { count : 0 };
        if( lastNonVoid ) {
            if( lastNonVoid.indexOf("/") > 0 ) {
                prefix = lastNonVoid.substring(0,lastNonVoid.indexOf("/"));
                var parentLoc = getLocation(prefix);
                if( parentLoc ) {
                    prefix = prefix + "/";
                } else {
                    prefix = "";
                }
                if( !data.roomType ) {
                    if( getLocation(lastNonVoid).type ) {
                        data.roomType = getLocation(lastNonVoid).type;
                    }
                }            
            }
        }
        if( prefix == "" ) {
            if( data.type && data.name ) {
                prefix = extractNounAndAdjAlways(data.name);
                if( prefix && prefix != "" ) {
                    if( getLocation(prefix) ) {
                        prefix = prefix + "/";
                    } else{
                        setLocation(prefix,{ name : prefix , decription : data.name , type : data.type })
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
        if( pov.location ) {
            if( getLocation(pov.location).type == "void" ) {
                connectedVoid = gatherVoid();
                if( connectedVoid.count  > 1 ) {
                    autoConnectVoids(map,connectedVoid.collectedVoid);
                }
            }
        }
        var calcRoomName = function(prefix,suffix) {
            var roomName = prefix+extractNounAndAdjAlways(data.room);
            if (roomName) {
                if( suffix ) {
                    var parentRoom = getLocation(roomName);
                    if( !parentRoom ) {
                        setLocation(roomName,{name:data.room});
                    }
                    roomName = roomName + "/" + suffix;
                }
                // add # to the orginal room (libary,library1,library2...)
                if (getLocation(roomName)) {
                    var extactCount = 1;
                    while( getLocation(roomName+extactCount) ) {
                        extactCount = extactCount + 1;
                    }
                    roomName = roomName+extactCount;
                }
            } else {
                roomName = prefix+"room" + roomNum;
                roomNum = roomNum + 1;
            }
            return roomName;
        };
        var roomName;
        var name = data.room;
        var parts = getPartsOfSpeech(data.room);
        map = null; // need to recalc the map 

        if( connectedVoid.count > 1 ) {
            var newRoomMap = {};
            // Create rooms for all the voids....
            for( var voidRoom in connectedVoid.voids ) {
                var _name = parts.name;
                var roomDesc = data.room;
                var srcRoom = connectedVoid.voids[voidRoom];
                var suffix = srcRoom.edge;
                if( !suffix && Number.isFinite(srcRoom.row) && Number.isFinite(srcRoom.col) ) {
                    suffix = "r"+srcRoom.row+"c"+srcRoom.col;
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
                setLocation(roomName,{ name: _name, description: roomDesc });
                if( data.roomType ) {
                    getLocation(roomName).type = data.roomType;
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
            roomName = calcRoomName(prefix,null);
            pov.location = roomName;
            setLocation(pov.location,{ name: parts.name, description: data.room });
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
            if( pendingGoInsideItem ) {
                var inItem = getItem(pendingGoInsideItem);
                if( inItem ) {
                    inItem.location = pov.location;
                }
                pendingGoInsideItem = null;
            }
            if( pendingItemOut ) {
                getLocation(pov.location).o = { location : pendingItemOut };
                pendingItemOut = null;
            }
            describe();
        }    
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
                var headingWidth = 0;
                var headingText = "";
                if( pendingGoInsideItem ) {
                    var pi = getItem(pendingGoInsideItem);
                    if( pi && pi.name ) {
                        headingText = pi.name;
                        headingWidth = headingText.length;
                        if( headingWidth & 1 ) {
                            headingText = headingText+" ";
                            ++headingWidth;
                        }
                    }
                }
                if( headingWidth > 0 )   {
                    screen.push("┌"+("─".repeat(infoWidth))+"┬"+("─".repeat((mapWidth-headingWidth)/2))+headingText+("─".repeat((mapWidth-headingWidth)/2))+"┐");
                } else {
                    screen.push("┌"+("─".repeat(infoWidth))+"┬"+("─".repeat(mapWidth))+"┐");
                }
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
        if (!metadata.title && !stateMachine ) {            
            stateMachine = {
                state : 0 ,
                data : metadata ,
                states : [
                    { msg : "What is the title of your interactive fiction?" , prop : "title" },
                    { msg : "How would you describe this interactive fiction work?" , prop : "description" },
                    { msg : "What is you name (byline)?" , prop : "author"  },
                    { msg : "What is you email?" , prop : "authorEmail" },
                ],
                execute : stateMachineFillin,
                start: stateMachineFillinStart,
                done: function(sm) { saveFile(); }
            };
            stateMachine.start(stateMachine);
         } else if (pov.location && !noVoid ) {
            render(getLocation(pov.location),pov.location, 0);
            mode = "what";
        } else {            
            if( lastNonVoid ) {
                stateMachine = stateMachineFillinCreate({},[
                    {msg:"Enter name for this location?",prop:"room"}
                ],function(sm) {
                    if( sm.data.room  && sm.data.room.length > 1  ) {
                        locationDefine(sm.data);
                    }
                },function(sm) {
                    if( !pov.location ) {
                        if( pendingItemOut ) {
                            pov.location = pendingItemOut;
                            pendingItemOut = null;
                            pendingGoInsideItem = null;
                            map = null;
                            describe();
                        }                        
                    }
                });
            } else {
                // First in            
                stateMachine = stateMachineFillinCreate({},[
                    {msg:"What kind of level?",prop:"type",choices:topLocationMenu},
                    { test : 
                        function(sm) { 
                            if(sm.data.type == "oneroom") 
                                   return "expand.oneroom"; 
                            return "expand"; 
                        } , states : [ 
                            {msg:"Levels are like 'the castle', 'the asylum' , 'the town' , 'the desert', 'the island' etc - that which contains all the rooms for part of the story.\nEnter a name for this level:",prop:"name"},
                            {msg:"The first location within the level - This is a 'room' like 'study', 'dinning room' , 'forest clearing' , 'backyard' etc. Enter name for this location:",prop:"room"}
                        ] , oneroom : [
                            {msg:"Enter name for this location:",prop:"room"}
                        ]
                    }
                ],function(sm) {
                    if( sm.data.room 
                     && sm.data.room.length > 1 
                      ) {
                        locationDefine(sm.data);
                    }
                });
            }
        }
    };
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
        } else {
            for (var i = 0; i < arr.length; ++i) {
                var item = arr[i].item;
                var ptr = getItem(item);
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
        }
        return itemName;
    };
    var lookupItemArr = function (command, arr) {
        var itemName = null;
        if (command != "") {
            var candidates = [];
            var parts = getPartsOfSpeech(command);
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
        for(var _item in items ) {
            allItems.push({ item : _item});
        }
        var parts = getPartsOfSpeech(command);
        var item = lookupItemLow(parts,allItems,command,candidates);

        if( item && item != "?" ) {
            if( candidates.length < 1 ) {
                candidates = [item];
            }
        }
        return candidates;
    };
    var lookupItem = function (command, flags) {
        var itemName = null;
        if (command != "") {
            var where = getLocation(pov.location);
            var candidates = [];
            var what = command;
            command = command.toLowerCase();
            var parts = getPartsOfSpeech(command);
            if (flags != "noactor" && actor.inventory )
                itemName = lookupItemLow(parts,actor.inventory,command,candidates);
            if (where.contains && !itemName && flags != "actor") {
                itemName = lookupItemLow(parts,where.contains,command,candidates);
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
            if (!itemName) {
                if (candidates.length == 1) {
                    itemName = candidates[0];
                } else if (candidates.length > 1) {
                    console.log("which " + command + "?");
                    for (var i = 0; i < candidates.length; ++i) {
                        console.log(getItem(candidates[i]).name);
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
        "north east": { primary: "ne" },
        "in" : { primary: "i" },
        "out" : { primary: "o" }
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
        var item = lookupItemArr(command,inventory);
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
    var defineNPCStates = [{
        msg: "Describe character called {npc}:", prop : "newNPC"
    } ];
    var defineScript = function() {
        var  states = [];
        var  testNpc = false;
        if( !verbCommand.npc ) {
            states.push({ msg : "who?" , prop : "npc"});
            testNpc = true;
        } else if( !findNPC(verbCommand.npc) ) {
            testNpc = true;
        }
        if( testNpc ) {
            states.push({ test : function(state,command) { if( findNPC(state.data.npc) ) { return "skip"; } return "expand"; }  ,
                states : defineNPCStates 
            } );
        }
        if( verbsWithTopics[verbCommand.action] && !verbCommand.topic ) {
            states.push({ msg : "whats the topic of the '"+verbCommand.action+"'?" , prop : "topic"});
        }
        if( verbCommand.topic ) {
            if( verbCommand.proposition ) {
                states.push({ msg : "whats the response for '"+verbCommand.action+" "+verbCommand.proposition+" "+verbCommand.topic+"'?" , prop : "response"});
            } else {
                states.push({ msg : "whats the response for '"+verbCommand.action+" about "+verbCommand.topic+"'?" , prop : "response"});
            }
        } else {
            states.push({ msg : "whats the response for '"+verbCommand.action+"'?" , prop : "response"});
        }
        stateMachine = {
            state : 0 ,
            data : verbCommand ,
            states : states,
            execute : stateMachineFillin,
            start: stateMachineFillinStart,
            askAbort: function() {
                console.log("Do you want to quit? (y to quit)");
            },
            done: function(sm) {
                var vc = sm.data;
                if( vc.npc ) {
                    var _npc = findNPC(vc.npc);
                    if( !_npc && vc.newNPC ) {
                        var newNPC  = vc.npc;
                        newNPC = newNPC.toLowerCase().trim();
                        _npc = {
                            name : newNPC ,
                            description : vc.newNPC ,
                            location : pov.location 
                        };
                        setNpc(camelCase(newNPC),_npc);
                    }
                    if( _npc ) {
                        if( verbsWithTopics[vc.action] ) {
                            if( !_npc.conversation ) {
                                _npc.conversation = {};
                            }                            
                            if( !_npc.conversation[vc.action] ) {
                                _npc.conversation[vc.action] = {};
                            }
                            if( verbCommand.proposition ) {
                                _npc.conversation[vc.action][vc.topic] = { proposition : vc.proposition , response : vc.response };
                            } else {
                                _npc.conversation[vc.action][vc.topic] = { response : vc.response };
                            }
                        } else if( vc.action == "talkto" || vc.action == "hi" || vc.action == "bye" || vc.action == "leave" || vc.action == "notice" ) {
                            if( !_npc.conversation ) {
                                _npc.conversation = {};
                            }
                            _npc.conversation[vc.action] = { response : vc.response };    
                        }
                    }
                }
            }
        };
        if( !stateMachine.start(stateMachine) ) {
            stateMachine = null;
        }
    };
    var processScript = function() {
        var emitResponse = function(response,vc,stateId) {
            if( typeof(response) == "string" ) {
                annotations = [];
                console.log( response + annotate({ type:"conv" , npc : vc.npc , action : vc.action , proposition : vc.proposition, topic : vc.topic }) );
                return true;
            } else if( response.then ) {
                var responseIndex = gameState[stateId+".then"];
                if( responseIndex ) {
                    if( !emitResponse( response.then[responseIndex],vc,stateId ) )
                         return false;
                    if( response.then.length > (responseIndex+1) ) {
                        gameState[stateId+".then"] = (responseIndex+1);
                    }
                } else {
                    if( !emitResponse( response.then[0],vc,stateId ) )
                        return false;
                    if( response.then.length > 1 ) {
                        gameState[stateId+".then"] = 1;
                    }
                }
            } else if( response.or ) {
                var responseIndex = gameState[stateId+".or"];
                if( responseIndex ) {
                    if( !emitResponse( response.or[responseIndex],vc,stateId ) )
                        return false;
                    if( response.or.length > (responseIndex+1) ) {
                        gameState[stateId+".or"] = (responseIndex+1);
                    } else {
                        gameState[stateId+".or"] = 0;
                    }
                } else {
                    if( !emitResponse( response.then[0],vc,stateId ) )
                        return false;
                    if( response.or.length > 1 ) {
                        gameState[stateId+".or"] = 1;
                    }
                }
            } else {
                // All the actions
                if( response.take ) {
                    var npcPtr = getNpc(vc.npc);
                    if( !npcPtr )
                        return false;
                    var item = removeItem(actor.inventory,"@"+response.take);
                    if( !item ) 
                        return false;
                    if( npcPtr ) {
                        if( !npcPtr.inventory ) {
                            npcPtr.inventory = [];
                        }
                        npcPtr.inventory.push({item:item});
                    }
                }
                if( response.consume ) {
                    var item = removeItem(actor.inventory,"@"+response.consume);
                    if( !item ) 
                        return false;
                }
                if( response.give ) {
                    var npcPtr = getNpc(vc.npc);
                    if( !npcPtr )
                        return false;
                    if( !npcPtr.inventory ) 
                        return false;
                    var item = removeItem(npcPtr.inventory,"@"+response.give);
                    if( !item ) 
                        return false;                    
                    actor.inventory.push({ item : item });
                }
                if( response.say ) {
                    annotations = [];
                    console.log( response.say + annotate({ type:"conv" , npc : vc.npc , action : vc.action , proposition : vc.proposition, topic : vc.topic }));
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
        if( !verbCommand.npc ) {
            return false;
        } else if( !findNPC(verbCommand.npc) ) {
            return false;
        } else if( verbsWithTopics[verbCommand.action] && !verbCommand.topic ) {
            return false;
        } else {
            if( verbsWithTopics[verbCommand.action] ) {
                if( !verbCommand.proposition ) {
                    if( verbCommand.topic.substring(0,6) == "about " ) {
                        verbCommand.proposition = "about";
                        verbCommand.topic = verbCommand.topic.substring(6).trim();
                    }
                }
                var _npc = findNPC(verbCommand.npc);
                if( _npc.conversation ) {
                    _npc = _npc.conversation[verbCommand.action];
                    if( _npc ) {
                        _npc = _npc[verbCommand.topic];
                    }
                } else {
                   _npc = null;
                }
                if( _npc ) {
                    emitResponse(_npc.response,verbCommand,verbCommand.npc+verbCommand.action+verbCommand.topic);
                    return true;
                } else if(pov.isGod) {
                    return false;
                } else {
                    noUnderstand();
                    return true;
                }
            } else {
                var _npc = findNPC(verbCommand.npc);
                if( _npc ) {
                    if( _npc.conversation ) {
                        if( verbCommand.action == "talkto" ) {
                            _npc = _npc.conversation.talkto;
                        } else if( _npc.conversation[verbCommand.action] ) {
                            _npc = _npc.conversation[verbCommand.action];                            
                        } else {
                            _npc = null;
                        }
                    } else {
                        _npc = null;
                    }
                }
                if( _npc && _npc.response ) {
                    emitResponse(_npc.response,verbCommand,verbCommand.npc+verbCommand.action+verbCommand.topic);
                    return true;
                } else if(pov.isGod) {
                    return false;
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
                                        otherRoom = connectAllVoid(r,c-1);
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
                                        otherRoom = connectAllVoid(r,c+1);
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
                                        otherRoom = connectAllVoid(r-1,c);
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
                                        otherRoom = connectAllVoid(r+1,c);
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
        if( verbCommand.action ) {        
            var _npc = findNPC(verbCommand.npc);
            if( _npc ) {
                var ptr = null;
                var rContainer = null;
                if( verbCommand.action == "talkto")  {
                    if( _npc.conversation.talkto ) {
                        rContainer = _npc.conversation.talkto;
                        ptr = rContainer.response;
                    }
                } else if( _npc.conversation[verbCommand.action] ) {
                    if( _npc.conversation[verbCommand.action][verbCommand.topic] ) {
                         rContainer = _npc.conversation[verbCommand.action][verbCommand.topic];
                         ptr = rContainer.response;
                    }
                }
                if( ptr ) {
                    if( typeof(ptr) == "string" ) {
                        ptr = { "say" : ptr };
                        if( rContainer ) {
                            rContainer.response = ptr;
                        }
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

    var doAnnotation = function(anno) {
        if( anno.type == "item" ) {
            //{"type":"item","item":
            var ip = getItem(anno.item);
            annotations = [];
            if( ip ) {
                var noPostures = true;                
                if( ip.name ) {
                    console.log(chalk.bold("Name\n"+ip.name)+" "+annotate({"type":"item.name","item":anno.item}))
                } else {
                    console.log(chalk.bold("Name\nnone")+" "+annotate({"type":"item.name","item":anno.item}))
                }
                console.log(chalk.bold("Description"));
                if( ip.description ) {
                    console.log(ip.description+annotate({"type":"item.description","item":anno.item}))
                } else {
                    console.log("No description"+annotate({"type":"item.description","item":anno.item}))
                }
                console.log(chalk.bold("Content"));
                if( ip.content ) {
                    console.log(ip.content+annotate({"type":"item.content","item":anno.content}))
                } else {
                    console.log("No readable content"+annotate({"type":"item.content","item":anno.item}))
                }
                if( ip.postures ) {
                    if( ip.postures.length ) {
                        console.log(chalk.bold("Nested Room Supported Postures"))
                        console.log(ip.postures.join(",")+annotate({"type":"item.postures","item":anno.item}))
                        noPostures = false;
                    }
                }
                if( noPostures ) {
                    console.log("Not a Nested room"+annotate({"type":"item.postures","item":anno.item}))
                }
                /*
                if( ip.contains ) {
                    if( ip.contains.length ) {
                    }
                }
                if( ip.supports ) {
                }            
                if( ip.behind ) {
                }
                if( ip.under ) {
                }*/
              }
        } else if( anno.type == "item.name" ) {
            var ip = getItem(anno.item);
            if( ip ) {
                stateMachine = stateMachineFillinCreate(ip,[{msg:"Change item name:",prop:"name"}]);
            }
        } else if( anno.type == "item.description" ) {
            var ip = getItem(anno.item);
            if( ip ) {
                stateMachine = stateMachineFillinCreate(ip,[{msg:"Change item description:",prop:"description"}]);
            }
        } else if( anno.type == "item.content" ) {
            var ip = getItem(anno.item);
            if( ip ) {
                stateMachine = stateMachineFillinCreate(ip,[{msg:"Change item readable content:",prop:"content"}]);
            }
        } else if( anno.type == "item.postures" ) {
            var ip = getItem(anno.item);
            if( ip ) {
                stateMachine = stateMachineFillinCreate(ip,[{msg:"Supported postures:",prop:"postures",choices:postureTypeList,multiple:true}]);
            }            
        } else if( anno.type == "dir" ) {
            var loc = getLocation(pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    annotations = [];
                    console.log(chalk.bold("Location"));
                    console.log(dp.location+" "+annotate({"type":"dir.location","dir":anno.dir}))
                    console.log(chalk.bold("Type"));
                    if( dp.type ) {
                        console.log(dp.type+" "+annotate({"type":"dir.type","dir":anno.dir}))
                    } else {
                        console.log("Default "+annotate({"type":"dir.type","dir":anno.dir}))
                    }
                }
            }
        } else if( anno.type == "location.name" ) {
            var loc = getLocation(pov.location);
            if( loc ) {
                stateMachine = stateMachineFillinCreate(loc,[{msg:"Change location name:",prop:"name"}],invalidateMap);
            }
        } else if( anno.type == "location.description" ) {
            var loc = getLocation(pov.location);
            if( loc ) {
                stateMachine = stateMachineFillinCreate(loc,[{msg:"Change location description:",prop:"description"}],invalidateMap);
            }
        } else if( anno.type == "location.type" ) {
            var loc = getLocation(pov.location);
            if( loc ) {
                stateMachine = stateMachineFillinCreate(loc,[{msg:"Change location type:",prop:"type",choices:roomTypesMenu}],invalidateMap);
            }
        } else if( anno.type == "location.topLoc" ) {
            annotations = [];
            var loc =  getLocation(anno.location);
            if( loc ) {
                console.log(chalk.bold("Level Type"));
                console.log(loc.type+" "+annotate({"type":"topLoc.type","location":anno.location}))
                console.log(chalk.bold("Level Name"));
                console.log(loc.name+" "+annotate({"type":"topLoc.name","location":anno.location}))
            }
        } else if( anno.type == "dir.location" ) {
            var loc = getLocation(pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    // TBD changing location could orphan rooms or
                    // mess up geography - we need some validation logic
                    // to prevent this
                }
            }
        } else if( anno.type == "dir.type" ) {
            var loc = getLocation(pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    stateMachine = stateMachineFillinCreate(dp,[{msg:"Change location type:",prop:"type",choices:dirTypesMenu}]);
                }
            }
        } else if( anno.type == "npc" ) {
            var ni = getNpc(anno.npc);
            if( ni ) {
                annotations = [];
                console.log(chalk.bold("Name"));
                if( ni.name ) {
                    console.log(ni.name+" "+annotate({"type":"npc.name","npc":anno.npc}));
                } else {
                    console.log("No Name "+annotate({"type":"npc.name","npc":anno.npc}));
                }
                console.log(chalk.bold("Description"));
                if( ni.description ) {
                    console.log(ni.description+" "+annotate({"type":"npc.name","npc":anno.npc}));
                } else {
                    console.log("No Description "+annotate({"type":"npc.name","npc":anno.npc}));    
                }
            }
        } else if( anno.type == "npc.name" ) {
            var ni = getNpc(anno.npc);
            if( ni ) {
                stateMachine = stateMachineFillinCreate(ni,[{msg:"Change NPC name:",prop:"name"}]);
            }
        } else if( anno.type == "npc.description" ) {
            var ni = getNpc(anno.npc);
            if( ni ) {
                stateMachine = stateMachineFillinCreate(ni,[{msg:"Change NPC description:",prop:"description"}]);
            }
        } else if( anno.type == "conv" ) {
            //{ type:"conv" , npc : vc.npc , action : vc.action , proposition : vc.proposition, topic : vc.topic }
        }
    };


    var parseCommand = function (command) {
        if( stateMachine ) {
            // Set of prompts....
            var res = stateMachine.execute(stateMachine,command);
            if( res == "next") {
                stateMachine.state = stateMachine.state + 1;
            } else if( res != "retry")
                stateMachine = null;
            return true;    
        }       
        if (lCase == 'quit' || lCase == 'exit') {
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
            /*} else if (mode == 'door?') {
                // TBD make separate commands for door/passage etc Make
                lCase = lCase.trim();
                ...
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
                    if (!name || getDoor(name)) {
                        name = getUniqueItemName(name,...);
                    }
                    setDoor(name,{ name: command });
                    getLocation(lastLocation)[lastDirection].door = name;
                    getLocation(pov.location)[reverseDirection(lastDirection)].door = name;
                }
                mode = "what";
                describe();
            */
            } else if (mode == 'describe_item') {
                getItem(describeItem).description = command;
                mode = "what";
            } else if (mode == 'write') {
                getItem(describeItem).content = command;
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
                            var itemPtr = getItem(item);
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
                } else if ( firstWord == "touch" 
                         || firstWord == "!smell"  
                         || firstWord == "listen" 
                          ) {
                    console.log("TBD - add item/npc/etc smell/touch etc.");
                } else if (firstWord == "inventory") {
                    if (actor.inventory.length == 0) {
                        console.log("You are carrying nothing.");
                    } else {
                        annotations = [];
                        console.log("You are carrying:");
                        for (var i = 0; i < pov.inventory.length; ++i) {
                            console.log(getItem(pov.inventory[i].item).name+annotate({"type":"item","item":pov.inventory[i].item}));
                        }
                    }
                } else if ( firstWord == "!drop"
                         || firstWord == "!put" 
                         || firstWord == "!hide"
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
                        if (firstWord == "!hide") {
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
                                where = getItem(where);
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
                                name = getUniqueItemName(name,"item",calcCommonPrefix(pov.location,pov.location));
                                setItem(name,{ name: command });
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
                } else if( firstWord == "!read" ) {
                    command = subSentence( command , 1);
                    if (command != "") {
                        var item = lookupItem(command);
                        if (item) {
                            if (item != "?") {
                                var ip = getItem(item);
                                if (ip.content) {
                                    console.log(ip.content);
                                } else if( pov.isGod ) {
                                    describeItem = item;
                                    console.log("What do you see written in " + ip.name + "?");
                                    mode = "write";
                                } else {
                                    console.log("There is nothing written on the "+ip.name);
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
                                        if( !pov.inventory ) {
                                            pov.inventory = [];
                                        }
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
                } else if ( firstWord == "!eat" 
                         || firstWord == "!wear" 
                         || firstWord == "!light" 
                         || firstWord == "!affix"
                          ) {
                    var thingType = null;
                    if (firstWord == "!eat") {
                        thingType = "food";
                    } else if (firstWord == "!wear") {
                        thingType = "wearable";
                    } else if (firstWord == "!light") {
                        thingType = "light";
                    } else if (firstWord == "!affix") {
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
                            var ip = getItem(existingItem);
                            if (pov.isGod && !ip.type) {
                                ip.type = thingType;
                                console.log(command + " is " + thingType + ".");
                            } else if (ip.type != thingType) {
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
                            if( lCase == "o" || lCase == "i" ) {
                                map = null;
                            }
                            lastLocation = pov.location;
                            lastDirection = lCase;
                            pov.location = nextLoc.location;
                            describe();
                        }
                    }
                    describe(false);
                } else if (firstWord == "!makedoor" && pov.isGod ) {
                    command = subSentence( command , 1);
                    if( isDirection(command) ) {
                        lCase = isDirection(command).primary;
                    } else {
                        lCase = "lastdirection";
                    }
                    if (getLocation(pov.location)) {
                        var nextLoc = getLocation(pov.location)[lCase];
                        if (nextLoc) {
                            lastDirection = lCase;
                            lastLocation = pov.location;
                            pov.location = nextLoc.location;
                            stateMachine = stateMachineFillinCreate({},[
                                {msg:"Door name:",prop:"name"}
                            ],function(sm) {
                                if( sm.data.name  && sm.data.name.length > 1  ) {
                                    var name = extractNounAndAdj(sm.data.name);
                                    name = getUniqueItemName(name,"door",calcCommonPrefix(pov.location,lastLocation));
                                    setDoor(name,{ name: sm.data.name , type : "door" });
                                    getLocation(lastLocation)[lastDirection].door = name;
                                    getLocation(pov.location)[reverseDirection(lastDirection)].door = name;
                                    pov.location = lastLocation;
                                    map = null;
                                    describe();
                                }
                            });
                        } else if( lCase == "lastdirection" ) { 
                            if( lastDirection 
                              && lastLocation 
                              ) {
                                stateMachine = stateMachineFillinCreate({},[
                                    {msg:"Door name:",prop:"name"}
                                ],function(sm) {
                                    if( sm.data.name  && sm.data.name.length > 1  ) {
                                        var name = extractNounAndAdj(sm.data.name);
                                        name = getUniqueItemName(name,"door",calcCommonPrefix(pov.location,lastLocation));
                                        setDoor(name,{ name: sm.data.name , type : "door"});
                                        if( !getLocation(lastLocation)[lastDirection]
                                         && !getLocation(pov.location)[reverseDirection(lastDirection)] ) {
                                            getLocation(lastLocation)[lastDirection] = { location : pov.location , door : name };
                                            getLocation(pov.location)[reverseDirection(lastDirection)] = { location : lastLocation , door : name};
                                        } else {
                                            getLocation(lastLocation)[lastDirection].door = name;
                                            getLocation(pov.location)[reverseDirection(lastDirection)].door = name;
                                        }
                                        map = null;
                                        describe();
                                    }
                                });
                            } else {
                                console.log("There is no ending location. lastLocation="+lastLocation+" lastDirection="+lastDirection+ " pov.location="+pov.location);
                            }
                        } else {
                            console.log("There is no opening to the "+lCase);
                        }
                    } else {
                        console.log("There is no starting location.");
                    }
                } else if ( (firstWord == "!makepath" || firstWord == "!makepassage" || firstWord == "!makestairs") && pov.isGod ) {
                    if( lastLocation ) {
                        var dirCType = firstWord.substring(5);
                        if( getLocation(lastLocation)[lastDirection] ) {
                            getLocation(lastLocation)[lastDirection].type = dirCType;
                            getLocation(pov.location)[reverseDirection(lastDirection)].type = dirCType;
                        } else if( !getLocation(pov.location)[reverseDirection(lastDirection)] ) {
                            getLocation(lastLocation)[lastDirection] = { location : pov.location , type : dirCType};
                            getLocation(pov.location)[reverseDirection(lastDirection)] = {location : lastLocation , type : dirCType};
                        }
                    } else {
                        console.log("There is no starting location.");
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
                        if( verbCommand.action ) {
                            command = subSentence( command , 1);
                            if( command.length > 0 ) {
                                var _npc = findNPC(verbCommand.npc);
                                // TBD - also look for items (for verbs like push/pull etc)...
                                if( _npc && _npc.conversation ) {
                                    if( _npc.conversation[verbCommand.action] ) {
                                        if( _npc.conversation[verbCommand.action][verbCommand.topic] ) {
                                            var modResponse = _npc.conversation[verbCommand.action][verbCommand.topic].response;
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
                                            _npc.conversation[verbCommand.action][verbCommand.topic].response = modResponse;
                                        }
                                    } else if( verbCommand.action == "talkto") {
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
                        if( verbCommand.action ) {
                            command = subSentence( command , 1);
                            if( command.length > 0 ) {
                                var _npc = findNPC(verbCommand.npc);
                                // TBD - also look for items (for verbs like push/pull etc)...
                                if( _npc ) {
                                    if( _npc.conversation[verbCommand.action] ) {
                                        if( _npc.conversation[verbCommand.action][verbCommand.topic] ) {
                                            var modResponse = _npc.conversation[verbCommand.action][verbCommand.topic].response;
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
                                            _npc.conversation[verbCommand.action][verbCommand.topic].response = modResponse;
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
                } else if ( firstWord == "acquire" && pov.isGod ) {
                    // Be given an item
                    command = subSentence( command , 1);
                    var existingItem = lookupItem(command);
                    if (existingItem && existingItem != "?") {
                        var ptr = getConvoObjectPtr();
                        if( ptr ) {
                            ptr.give = existingItem; 
                        } else {
                            console.log("Must have run a conversation to acquire an item");
                        }                
                    } else if( existingItem != "?" ) {
                        console.log(command+" does not exist");
                    } else {
                        console.log("????");
                    }
                } else if ( firstWord == "!ask" 
                         || firstWord == "!tell"  
                         || firstWord == "!give"  
                         || firstWord == "!show"  
                         || firstWord == "!talkto"                         
                         || firstWord == "!hi" 
                         || firstWord == "!bye" 
                         || firstWord == "!leave" 
                         || firstWord == "!notice" 
                          ) {
                    // TBD - register NPCs & topics
                    command = subSentence( command , 1);
                    if( firstWord == "!give" || firstWord == "!show" ) {
                        command = splitOnOneOf( command , [" the "," a "," an "," my "," "]);
                        if( command.length > 2 ) {
                            if( findNPC(command[0]) ) {
                                verbCommand.npc = command[0];
                                command[0] = "";
                                command = [verbCommand.npc,command.join(" ").trim()];
                            }
                        }
                    } else {
                        command = command.split(" about ");
                        if( command.length == 1 ) {
                            command = command[0].split(" for ");
                            if( command.length != 1 ) {
                                verbCommand.proposition = "for";
                            } else {
                                verbCommand.proposition = null;
                            }
                        } else {
                            verbCommand.proposition = "about";
                        }
                    }
                    verbCommand.action = firstWord.substring(1);
                    verbCommand.npc = null;
                    verbCommand.topic = null;                
                    if( command.length > 1 ) {
                        verbCommand.npc = command[0];
                        verbCommand.topic = command[1];
                    } else if( command.length == 1 ) {
                        verbCommand.npc = command[0];
                        verbCommand.topic = "";
                    }
                    if ( !pov.isGod && (firstWord == "!leave" || firstWord == "!notice") ) {
                        // user tried to ivoke implicit event in play mode
                        noUnderstand();
                    } else if( !processScript() ) {
                        if (pov.isGod ) {
                            defineScript();
                        } else {
                            noUnderstand();
                        }
                    }
                } else if ( 
                    firstWord == "!sit" 
                 || firstWord == "!lie" 
                 || firstWord == "!stand"
                 || firstWord == "!goin" 
                ) {
                    firstWord = firstWord.substring(1);
                    command = subSentence( command , 1);
                    verbCommand.proposition = wordMap.posturePrep[command.split(" ")[0]];
                    if( verbCommand.proposition ) {
                        command = subSentence( command , 1);
                    }
                    if( command.length ) {
                        var existingItem = lookupItem(command);
                        if (existingItem && existingItem != "?") {
                            var ip =getItem(existingItem);
                            if( firstWord == "goin"  ) {
                                // Item portals to nested location..
                                if( ip.location ) {
                                    // go to object
                                    if( getLocation(ip.location) ) {
                                        pov.location = ip.location;
                                        map = null;
                                        describe();
                                    }
                                } else if( pov.isGod ) {
                                    // Make a top level object... 
                                    if( pov.location )  {
                                        pendingGoInsideItem = existingItem;                                        
                                        pendingItemOut = pov.location; 
                                        pov.location = null;
                                        map = null;
                                        describe();
                                    }
                                }
                            } else if( allowPosture(ip,firstWord) ) {
                                console.log("You "+firstWord + " on " + ip.name + ".");
                            } else if( pov.isGod ) {
                                if( !ip.postures ) {
                                    ip.postures = [];
                                }
                                ip.postures.push(firstWord);
                                console.log("You can now "+firstWord + " on " + ip.name + ".");
                            } else {
                                console.log("You cannot "+firstWord + " on " + ip.name + ".");
                            }
                        } else if (existingItem != "?") {
                            console.log("You see no " + command);
                        }
                    }
                } else if ( pov.isGod && firstWord == "dump") {
                    command = subSentence( command , 1).toLowerCase();
                    if( pov.isGod ) {
                        if( command && command.length )
                        {                            
                            var list = findLocations(command);
                            for( var i = 0 ; i < list.length ; ++i ) {
                                console.log(chalk.bold(list[i]));
                                console.dir(getLocation(list[i]),{ depth : 6 , colors : true});                                
                            }
                            list = findItems(command);
                            for( var i = 0 ; i < list.length ; ++i ) {
                                console.log(chalk.bold(list[i]));
                                console.dir(getItem(list[i]), { depth : 6 , colors : true});
                            }
                            list = findNPCs(command);
                            for( var i = 0 ; i < list.length ; ++i ) {
                                console.log(chalk.bold(list[i]));
                                console.dir(getNpc(list[i]), { depth : 6 , colors : true});
                            }
                        }
                        else
                        {
                            console.dir(metadata, { depth : 6 , colors : true} );
                            console.dir(locations, { depth : 6 , colors : true} );
                            console.dir(npc, { depth : 6 , colors : true} );
                            console.dir(items, { depth : 6 , colors : true} );
                        }
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
                        else if( command == "small" )
                        {
                            if( mapScale != "small" ) {
                                mapScale = "small" ;
                                renderMap =  renderMapLevelText(map);
                                describe(false);
                            }
                        } else if( command == "normal" ) {
                            if( mapScale == "small" ) {
                                mapScale = null;
                                renderMap =  renderMapLevelText(map);
                                describe(false);
                            }
                        }
                        else if( command == "!hide" )
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
                } else if (  '0' < firstWord[0] && firstWord[0] <= '9' && pov.isGod ) {
                    var index = Number.parseInt(firstWord);
                    if( index > annotations.length || index < 1 ) {
                        console.log("No footnote "+index+" defined");
                    } else {
                        doAnnotation(annotations[index-1]);
                    }
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
                        verbCommand.action = verb;
                        verbCommand.npc = null;
                        verbCommand.topic = null;    
                        verbCommand.proposition = null;
                        command = command.split(" ");
                        command[0] = "";
                        command = command.join(" ").trim();
                        if( !processScript() ) {
                            if (pov.isGod ) {
                                defineScript();
                            } else {
                                noUnderstand();
                            }
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
        generate({ folder : folder , settings : settings , metadata : metadata, actor : actor, getLocation : getLocation , locations : locations , items : items , npc : npc , topics : topics });
    }
    return {
        describe: describe,
        parseCommand: parseCommand,
        loadGame: loadGame,
        exportTads: exportTads
    };
};

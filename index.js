const chalk = require("chalk");
const { get } = require("http");
const { resolve } = require("path");
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
    var outputText = function(txt) {
        console.log(txt);
    };
    var _SM = require("./state-machine")({output : function(txt) {
        outputText(txt);
    }});
    var stateMachineFillin = _SM.fillin;
    var stateMachineFillinStart = _SM.fillinStart;
    var stateMachineFillinCreate = _SM.fillinCreate;
    var roomNum = 1;
    var statusLine = null;
    var lastLocation = null;
    var lastDirection = null;
    var lastNonVoid = null;
    var lastNonVoidDirection = null;
    var lastNonVoidDelta = 0;
    var lastNonVoidPendingVoid = null;
    var pendingGoInsideItem = null;
    var pendingItemOut = null;
    var fs = require("fs");
    var helpText = require("./en-help.json");
    var verbCommand = {
        action : null,
        npc : null,
        preposition  :null,
        topic : null
    };
    var verbsWithTopics = { "ask" : true , "tell" : true , "show" : true , "give" : true };
    var wordMap = {
        firstWord : {
        "hello" : "!hi",
        "hi" : "!hi",
        "bye" : "!bye" ,
        "goodbye" : "!bye",
        "farewell" : "!bye",
        "l" : "!look",
        "look" : "!look",
        "x" : "!examine",
        "examine" : "!examine",
        "search" : "!search",
        "touch" : "!touch",
        "feel" : "!touch",
        "smell" : "!smell",
        "sniff" : "!smell",
        "listen" : "!listen",
        "i": "!inventory",
        "inventory" : "!inventory",
        "take" : "!take",
        "drop" : "!drop",
        "put" : "!put",
        "hide" : "!hide",
        "read" : "!read",
        "eat" : "!eat",
        "wear" : "!wear",
        "doff" : "!doff",
        "light": "!light",
        "affix" : "!affix",
        "sit" : "!sit",
        "stand" : "!stand",
        "pov" :  "pov",
        "ask" : "!ask" , 
        "tell" : "!tell" , 
        "show" : "!show" , 
        "give" : "!give" ,
        "open" : "!open" ,
        "close" : "!close" ,
        "unlock" : "!unlock" ,
        "lock" : "!lock",
        "buy" : "!buy",
        "sell" : "!sell",
        "quit" : "!quit" 
        },
        firstTwoWord : {
            "talk to"  : "!talkto",
            "sit down" : "!sit",
            "lie down" : "!lie",
            "stand up" : "!stand",
            "go in" : "!goin",
            "go inside" : "!goin",
            "save play" : "!saveplay"
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
    var godWordMap = {
        firstWord : {
            "leave" : "!leave",
            "notice" : "!notice",
            "dump" : "!dump"
        },
        firstTwoWord : {
            "make door" : "!makedoor",
            "make path" : "!makepath",
            "make passage" : "!makepassage",
            "make stairs" : "!makestairs"
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
    
    var Game = require('./Game');
    var game = new Game(settings);
    var godGame = null;    
    var renderMap = null;
    var helper = require("./helper.js")({spellCorrect:settings.spellCorrect});
    var camelCase = helper.camelCase;
    var extractNounAndAdj = helper.extractNounAndAdj;
    var getPartsOfSpeech = helper.getPartsOfSpeech;
    var isVerb = helper.isVerb;
    var isArticle = helper.isArticle;
    var singularFromPlural = helper.singularFromPlural;
    var pluralFromSingular = helper.pluralFromSingular;
    var invalidateMap = function() {
        game.map = null;
        render(game.getLocation(game.pov.location),game.pov.location, 0);
    };
    var annotate = function(expr) {
        if( game.pov.isGod ) {
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

    var noCareAbout = function (locationId,filterOn) {
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
    var spellCorrectText = function(description) {
        var parts = getPartsOfSpeech(description,false,true);
        if( parts.mispelled.length > 0 ) {
            for(var i = 0; i < parts.mispelled.length ; ++i ) {
                description = (" "+description+" ").split(" "+parts.mispelled[i].word+" ").join(chalk.red(" "+parts.mispelled[i].word+" ")).trim();
            }
        }
        return description;
    };
    var render = function (loc,locationId, depth, where) {
        if( !depth ) {
            annotations = [];
        }
        var describeNav = function (dir, name, rawDir) {
            if (dir.type == "stairs") {
                outputText("There are stairs leading " + name + "."+annotate({"type":"dir","dir":rawDir}));
            } else if (dir.type == "passage") {
                outputText("There is a passage leading " + name + "."+annotate({"type":"dir","dir":rawDir}));
            } else if (dir.type == "path") {
                outputText("There is a path leading " + name + "."+annotate({"type":"dir","dir":rawDir}));
            } else if (dir.door) {
                if (dir.open) {
                    outputText("To the " + name + " is open " + game.getDoor(dir.door).name+annotate({"type":"dir","dir":rawDir}));
                } else {
                    outputText("To the " + name + " is " + game.getDoor(dir.door).name+annotate({"type":"dir","dir":rawDir}));
                }
            } else {
                if( dir.direction ) {
                    if( dir.direction > 0 ) {
                        outputText("To the " + name + " is passage leading up."+annotate({"type":"dir","dir":rawDir}));
                    } else {
                        outputText("To the " + name + " is passage leading down."+annotate({"type":"dir","dir":rawDir}));
                    }
                } else {                
                    outputText("To the " + name + " is " + (game.getLocation(dir.location).name || game.getLocation(dir.location).description) + "."+annotate({"type":"dir","dir":rawDir}));
                }
            }
        };
        if( !loc ) {
            outputText("Null for "+locationId);
        }
        if( loc.type == "void") {
            if (loc.name) {
                outputText(chalk.bold(loc.name));
            } else if (loc.description) {
                outputText(loc.description);
            }
            
        } else {
            if(game.pov.isGod && !depth ) {
                if( locationId.indexOf("/") > 0 ) {
                    var topLoc = locationId.split("/")[0];
                    var topLocType = topLocationTypes[game.getLocation(topLoc).type];
                    if( topLocType ) {
                        outputText(topLocType.membership+" "+game.getLocation(topLoc).name+annotate({"type":"location.topLoc","location":topLoc }));
                    }
                }
                if(loc.type)
                    outputText("Type: "+chalk.bold(loc.type)+annotate({"type":"location.type"}));
                else
                    outputText("Type: "+chalk.bold("inside")+annotate({"type":"location.type"}));
            }
            if (loc.name) {
                outputText(chalk.bold(loc.name)+annotate({"type":"location.name"}));
            } else if(game.pov.isGod && !depth ) {
                outputText(chalk.bold("No name")+annotate({"type":"location.name"}));
            }
            if (loc.description) {
                var roomDescription = loc.description;
                if( game.pov.isGod && settings.spellCorrect ) {
                    roomDescription = spellCorrectText(roomDescription);
                } 
                outputText(roomDescription+annotate({"type":"location.description"}));
            } else if(game.pov.isGod&& !depth ) {
                outputText(chalk.bold("No description")+annotate({"type":"location.description"}));
            }
        }
        if (loc.contains) {
            var _contains = [];
            for (var i = 0; i < loc.contains.length; ++i) {
                if( !loc.contains[i].described ) {
                    _contains.push(loc.contains[i]);
                }
            }
            if( _contains.length > 0 ) {
                var contains = "there is ";
                if (_contains.length > 1) {
                    contains = "there are ";
                }
                for (var i = 0; i < _contains.length; ++i) {
                    if (i) {
                        contains += " , ";
                        if ((i + 1) == _contains.length) {
                            contains += "and";
                        }
                    }
                    var ip = game.getItem(_contains[i].item);
                    if( ip ) {
                        var iname = ip.name;
                        if( _contains[i].scalar && _contains[i].scalar > 1 ) {
                            iname = " " + _contains[i].scalar + " " + ip.plural;
                        }
                        else if ("AEIOUYW".indexOf(iname[0]))
                            contains += " a ";
                        else
                            contains += " an ";
                        contains += iname+annotate({"type":"item","item":_contains[i].item});
                    }
                }
                if (where) {
                    contains += " " + where + ".";
                }
                outputText(contains);
            }
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
            for( var _npc in game.npc) {
                var  ni = game.getNpc(_npc);
                if( ni.location == locationId ) {
                    outputText(ni.name+" is here."+annotate({"type":"npc","npc":_npc}));
                }
            }
        }
    };
    var findNPC =function(name) {
        name = name.toLowerCase().trim();
        var cc = camelCase(name);
        var _npc = game.npc[cc];
        if( _npc ) {
            // well known short name...
            return _npc;
        }
        for( var _ind in game.npc ) {
            var _npc = game.npc[_ind];
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

    var findNPCs = function(name) {
        var list = [];
        name = name.toLowerCase().trim();
        var cc = camelCase(name);
        if( game.npc[cc] ) {
            // well known short name...
            return [cc];
        }
        for( var _ind in game.npc ) {
            var _npc = game.npc[_ind];
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
                var parentLoc = game.getLocation(prefix);
                if( parentLoc ) {
                    prefix = prefix + "/";
                } else {
                    prefix = "";
                }
                if( !data.roomType ) {
                    if( game.getLocation(lastNonVoid).type ) {
                        data.roomType = game.getLocation(lastNonVoid).type;
                    }
                }            
            }
        }
        if( prefix == "" ) {
            if( data.type && data.name ) {
                prefix = extractNounAndAdjAlways(data.name);
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
                connectedVoid = gatherVoid();
                if( connectedVoid.count  > 1 ) {
                    autoConnectVoids(game.map,connectedVoid.collectedVoid);
                }
            }
        }
        var calcRoomName = function(prefix,suffix) {
            var roomName = prefix+extractNounAndAdjAlways(data.room);
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
                roomName = prefix+"room" + roomNum;
                roomNum = roomNum + 1;
            }
            return roomName;
        };
        var roomName;
        var name = data.room;
        var parts = getPartsOfSpeech(data.room);
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
            lastLocation = null;
            lastDirection = null;
            // Drop or raise voids
            if( lastNonVoid && lastNonVoidDelta != 0 ) {
                game.getLocation(lastNonVoid)[lastNonVoidDirection].direction = lastNonVoidDelta;
                game.getLocation(game.getLocation(lastNonVoid)[lastNonVoidDirection].location)[reverseDirection(lastNonVoidDirection)].direction = -lastNonVoidDelta;
            }
            clearVoid();
            describeLocation();
        }  else {
            roomName = calcRoomName(prefix,null);
            game.pov.location = roomName;
            game.setLocation(game.pov.location,{ name: parts.name, description: data.room });
            if( connectedVoid.count > 0 ) {
                clearVoid();
            }
            if (lastLocation) {
                if (game.getLocation(lastLocation).type) {
                    game.getLocation(game.pov.location).type = game.getLocation(lastLocation).type;
                }
            }
            if (lastLocation && lastDirection) {
                game.getLocation(lastLocation)[lastDirection] = { location: game.pov.location };
                game.getLocation(game.pov.location)[reverseDirection(lastDirection)] = { location: lastLocation };
                if( lastNonVoidDelta != 0 ) {
                    game.getLocation(lastLocation)[lastDirection].direction = lastNonVoidDelta;
                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].direction = -lastNonVoidDelta;
                }
            }
            if( pendingGoInsideItem ) {
                var inItem = game.getItem(pendingGoInsideItem);
                if( inItem ) {
                    inItem.location = game.pov.location;
                }
                pendingGoInsideItem = null;
            }
            if( pendingItemOut ) {
                game.getLocation(game.pov.location).o = { location : pendingItemOut };
                pendingItemOut = null;
            }
            describeLocation();
        }    
    };

    var disclosedContents= function(item,itemPtr,list,prop,preposition,search) {
        var discovered = [];
        var disclosedList = game.state[game.pov.location+"_disclosed"];
        if( !disclosedList ) {
            game.state[game.pov.location+"_disclosed"] = {};
            disclosedList = game.state[game.pov.location+"_disclosed"];
        }
        var contents = function(list) {
            var text = "";
            for( var i = 0 ; i < list.length ; ++i ) {
                if( text != "" ) {
                    text = text + " , ";
                }
                var ip = game.getItem(list[i].item);
                if( list[i].scalar && list[i].scalar > 1 ) {
                    text = text + "" + list[i].scalar + " " + ip.plural;
                } else {
                    text = text + ip.name;
                }
                if( !disclosedList[list[i].item] ) {
                    // Disclose content for further object interaction
                    disclosedList[list[i].item] = prop+" "+item;
                }
            }
            return text;
        };
        if( search ) {
            for(var i = 0 ; i < list.length ; ++i ) {
                if( list[i].hidden ) {
                    list[i].hidden = false;
                    discovered.push(list[i]);
                }
            }
            if( discovered.length > 0 ) {
                outputText("You discover "+contents(discovered)+" "+preposition+" "+itemPtr.name);
            } else {
                outputText("You find nothing else "+preposition+" "+itemPtr.name);
            }
            return true;
        }
        for(var i = 0 ; i < list.length ; ++i ) {
            if( !list[i].hidden ) {
                discovered.push(list[i]);
            }
        }
        if( discovered.length > 1 ) {
            outputText("There are "+contents(discovered)+" "+preposition+" "+itemPtr.name);
            return true;
        } else if( discovered.length == 1 ) {
            outputText("There is "+contents(discovered)+" "+preposition+" "+itemPtr.name);
            return true;
        }
        return false;
    };
    var decribeItem = function(item,preposition,search) {
        var itemPtr = game.getItem(item);
        var itemState = game.getObjectState(item);
        var itemStateAccess = null;
        if (itemPtr.description) {
            outputText(itemPtr.description);
        } else if(game.pov.isGod) {
            stateMachine = stateMachineFillinCreate(itemPtr,[ {msg:"How would you describe the " + item + "?",prop:"description"} ]);
        } else {
            outputText(itemPtr.name);
        }
        if( itemState ) {
            if( itemState.access ) {
                itemStateAccess = itemState.access;
            }
            if( itemState.broken ) {
                outputText("The "+itemPtr.name+" is broken");
            } else if( itemState.locked == "locked" ) {
                outputText("The "+itemPtr.name+" is locked");
            } else if( itemState.access == "open" ) {
                outputText("The "+itemPtr.name+" is open");
            } else if( itemState.locked == "unlocked" ) {
                outputText("The "+itemPtr.name+" is unlocked but closed.");
            } else if( itemState.access == "closed" ) {
                outputText("The "+itemPtr.name+" is closed");
            }
            if( itemState.lit ) {
                outputText("The "+itemPtr.name+" is lit.");
            }
            if( itemState.worn ) {
                outputText("The "+itemPtr.name+" is being worn.");
            }
        }
        if( itemPtr.supports ) {
            disclosedContents(item,itemPtr,itemPtr.supports,"supports","on",search);
        }
        if( itemPtr.contains && itemStateAccess != "closed" ) {
            disclosedContents(item,itemPtr,itemPtr.contains,"contains","inside",search);
        }
        if( itemPtr.under && preposition == "under" ) {
            disclosedContents(item,itemPtr,itemPtr.under,"under","under",search);
        }
        if( itemPtr.behind && preposition == "behind" ) {
            disclosedContents(item,itemPtr,itemPtr.behind,"behind","behind",search);
        }
    };

    var describeLocation = function (noVoid) {
        if( renderMap ) {
            if( !game.map || game.map.location.room != game.pov.location ) {
                if (!game.map) {
                    game.map = game.createMap();
                } else if (game.pov.location && game.map.location.room != game.pov.location) {
                    game.recalcLocation(game.map, game.pov.location);
                }
                renderMap =  game.renderMapLevelText(game.map);
            }            
        }
        if( game.pov.isGod ) {
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
                    var pi = game.getItem(pendingGoInsideItem);
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
                outputText(screen.join("\n"));
            }
        }
        if( noVoid ) {
            if(game.pov.location) {
                if( game.getLocation(game.pov.location).type != "void" ) {
                    noVoid = false;
                }
            }
        }        
        if (!game.metadata.title && !stateMachine ) {            
            stateMachine = {
                state : 0 ,
                data : game.metadata ,
                states : [
                    { msg : "What is the title of your interactive fiction?" , prop : "title" },
                    { msg : "How would you describe this interactive fiction work?" , prop : "description" },
                    { msg : "What is you name (byline)?" , prop : "author"  },
                    { msg : "What is you email?" , prop : "authorEmail" },
                ],
                execute : stateMachineFillin,
                start: stateMachineFillinStart,
                done: function(sm) { game.saveFile(); }
            };
            stateMachine.start(stateMachine);
         } else if (game.pov.location && !noVoid ) {
            render(game.getLocation(game.pov.location),game.pov.location, 0);
        } else {            
            if( lastNonVoid ) {
                stateMachine = stateMachineFillinCreate({},[
                    {msg:"Enter name for this location?",prop:"room"}
                ],function(sm) {
                    if( sm.data.room  && sm.data.room.length > 1  ) {
                        locationDefine(sm.data);
                    }
                },function(sm) {
                    if( !game.pov.location ) {
                        if( pendingItemOut ) {
                            game.pov.location = pendingItemOut;
                            pendingItemOut = null;
                            pendingGoInsideItem = null;
                            game.map = null;
                            describeLocation();
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
                        if( !game.actor.location ) 
                        {
                            game.actor.location = game.pov.location;
                        }
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
        } else if( command == '{*}' ) { 
            for (var i = 0; i < arr.length; ++i) {
                candidates.push( arr[i].item );
            }
        } else {
            for (var i = 0; i < arr.length; ++i) {
                var item = arr[i].item;
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
        if (command != "" && arr ) {
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
        for(var _item in game.items ) {
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
    var lookupItem = function (locationId,command, flags) {
        var itemName = null;
        if (command != "") {
            var where = game.getLocation(locationId);
            var candidates = [];
            var what = command;
            command = command.toLowerCase();
            var parts = getPartsOfSpeech(command);
            if (flags != "noactor" && game.pov.inventory )
                itemName = lookupItemLow(parts,game.pov.inventory,command,candidates);
            if (where.contains && !itemName && flags != "actor") {
                itemName = lookupItemLow(parts,where.contains,command,candidates);
            }
            if( !itemName && flags != "actor") {
                var doors = [];
                for( var i = 0 ; i < directionsNames.length ; ++i ) {
                    var dir = where[directionsNames[i]];
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
                    outputText("which " + command + "?");
                    for (var i = 0; i < candidates.length; ++i) {
                        outputText(game.getItem(candidates[i]).name);
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
    var directionsNames = ["s","n","e","w","u","d","sw","se","nw","ne"];
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
            for (var i = 0; i < game.pov.inventory.length; ++i) {
                if (inventory[i].item == item) {
                    inventory.splice(i, 1);
                    return item;
                }
            }
        }
        return null;
    };    
    var defineNPCStates = [{
        msg: "Describe character called {game.npc}:", prop : "newNPC"
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
            if( verbCommand.preposition ) {
                states.push({ msg : "whats the response for '"+verbCommand.action+" "+verbCommand.preposition +" "+verbCommand.topic+"'?" , prop : "response"});
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
                outputText("Do you want to quit? (y to quit)");
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
                            location : game.pov.location 
                        };
                        game.setNpc(camelCase(newNPC),_npc);
                    }
                    if( _npc ) {
                        if( verbsWithTopics[vc.action] ) {
                            if( !_npc.conversation ) {
                                _npc.conversation = {};
                            }                            
                            if( !_npc.conversation[vc.action] ) {
                                _npc.conversation[vc.action] = {};
                            }
                            if( verbCommand.preposition  ) {
                                _npc.conversation[vc.action][vc.topic] = { preposition  : vc.preposition  , response : vc.response };
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
                outputText( response + annotate({ type:"conv" , npc : vc.npc , action : vc.action , preposition  : vc.preposition , topic : vc.topic }) );
                return true;
            } else if( response.then ) {
                var responseIndex = game.state[stateId+".then"];
                if( responseIndex ) {
                    if( !emitResponse( response.then[responseIndex],vc,stateId ) )
                         return false;
                    if( response.then.length > (responseIndex+1) ) {
                        game.state[stateId+".then"] = (responseIndex+1);
                    }
                } else {
                    if( !emitResponse( response.then[0],vc,stateId ) )
                        return false;
                    if( response.then.length > 1 ) {
                        game.state[stateId+".then"] = 1;
                    }
                }
            } else if( response.or ) {
                var responseIndex = game.state[stateId+".or"];
                if( responseIndex ) {
                    if( !emitResponse( response.or[responseIndex],vc,stateId ) )
                        return false;
                    if( response.or.length > (responseIndex+1) ) {
                        game.state[stateId+".or"] = (responseIndex+1);
                    } else {
                        game.state[stateId+".or"] = 0;
                    }
                } else {
                    if( !emitResponse( response.then[0],vc,stateId ) )
                        return false;
                    if( response.or.length > 1 ) {
                        game.state[stateId+".or"] = 1;
                    }
                }
            } else {
                // All the actions
                if( response.take ) {
                    var npcPtr = game.getNpc(vc.npc);
                    if( !npcPtr )
                        return false;
                    var item = removeItem(game.pov.inventory,"@"+response.take);
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
                    var item = removeItem(game.pov.inventory,"@"+response.consume);
                    if( !item ) 
                        return false;
                }
                if( response.give ) {
                    var npcPtr = game.getNpc(vc.npc);
                    if( !npcPtr )
                        return false;
                    if( !npcPtr.inventory ) 
                        return false;
                    var item = removeItem(npcPtr.inventory,"@"+response.give);
                    if( !item ) 
                        return false;                    
                    game.pov.inventory.push({ item : item });
                }
                if( response.say ) {
                    annotations = [];
                    outputText( response.say + annotate({ type:"conv" , npc : vc.npc , action : vc.action , preposition  : vc.preposition , topic : vc.topic }));
                }
                if( response.score ) {
                    if( !game.state[stateId+".score"] ) {
                        game.state[stateId+".score"] = true;
                        if( !game.state.Score ) {
                            game.state.Score = 0;
                        }
                        game.state.Score = game.state.Score + response.score;
                        outputText("Score went up by "+response.score+" Points");
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
                if( !verbCommand.preposition  ) {
                    if( verbCommand.topic.substring(0,6) == "about " ) {
                        verbCommand.preposition  = "about";
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
                } else if(game.pov.isGod) {
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
                } else if(game.pov.isGod) {
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
        if (game.pov.location) {
            var roomPtr = game.getLocation(game.pov.location);
            if( game.pov.isGod ) {
                if( ltype == "inside"  ) {
                    delete roomPtr.type;
                } else {
                    roomPtr.type = ltype;
                }
            } else if( !roomPtr.type && ltype == "inside" ) {
                outputText("Yes it is.");
            } else if( roomPtr.type == ltype ) {
                outputText("Yes it is.");
            } else {
                outputText("No, it isn't.");
            }
        } else {
            outputText("You are nowhere.");
        }
    };
    var noUnderstand = function() {
        outputText("What was that?");
    };
    var dontSee = function (what,locationId,command) {
        var dontCare = noCareAbout(locationId,what);
        if( dontCare.length > 0 ) {
            if( command ) {
                if( command.indexOf(what) >= 0 ) {
                    command = command.split(what).join("the "+dontCare[0]);
                }
                outputText("You cannot " + command);
            } else {
                outputText("I don't know what you want me to do with the " + dontCare[0]);
            }
        } else {
            outputText("You see no " + what);
        }
    };
    var dontSeeNpc = function (npc,locationId,command) {
        outputText("You dont see " + npc);
    };
    var clearVoid = function() {
        var voidCounter = 1;
        while( game.locations["void"+voidCounter] ) {
            delete game.locations["void"+voidCounter];
            voidCounter = voidCounter + 1;
        }
        game.map = null; // force regen without the voids....
    };
    var gatherVoid = function() {
        var  collectedVoid = {};
        var voidCounter = 1;
        while( game.locations["void"+voidCounter] ) {
            collectedVoid["void"+voidCounter] = game.locations["void"+voidCounter];
            voidCounter = voidCounter + 1;
        }
        return { voids : collectedVoid , count : voidCounter };
    };
    var autoConnectVoids = function(_map,collectedVoid) {
        // Connect all voids to other adjecent voids - defines a big room.
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
    var spellcheckedText = function(obj,prop,prompt) {
        var choices = [];
        var parts = { mispelled : []};
        if( obj[prop] ) {
            parts = getPartsOfSpeech(obj[prop],false,true);
        }
        if( parts.mispelled.length > 0 ) {
            for(var i = 0; i < parts.mispelled.length ; ++i ) {
                choices.push({ text : 'Fix "'+parts.mispelled[i].word+'"' , value : parts.mispelled[i].word });
            }
            choices.push({text:prompt,value:"*"});
        }
        if( choices.length > 1 ) {
            stateMachine = stateMachineFillinCreate({word:'',fix:''},[
                {msg:"Change description:",prop:"word",choices:choices},
                { test : function(sm) { 
                        if(sm.data.word == "*") 
                               return "expand.entire";
                        var findWrd = sm.data.word;
                        var se = sm.states[1];
                        se.states[0].msg = findWrd;
                        for(var i = 0; i < parts.mispelled.length ; ++i ) {
                            if( parts.mispelled[i].word == findWrd ) {
                                var srcCorrect =parts.mispelled[i].corrections;
                                var correct = [];
                                for(var j = 0; j < srcCorrect.length ; ++j ) {
                                    var coorection =  srcCorrect[j];
                                    correct.push({ text : 'Replace "'+findWrd+'" with "'+coorection+'"', value : coorection } );
                                }
                                correct.push({ text : 'Make a custom fix', value : "?" } );
                                se.states[0].choices = correct;
                                break;
                            }
                        }
                        return "expand"; 
                    } , states : [ 
                        {msg:"??",prop:"fix",choices:[]},
                        {
                            test : function(sm) {
                                if( sm.data.fix == "?" ) { return "expand"; }
                                return "skip";
                            },
                            states : [ { msg: "Custom fix" , prop : "fix" } ]
                        }
                    ] , entire : [
                        {msg:prompt,prop:prop}
                    ]
                }
            ],function(sm) {
                if(sm.data.word == "*") {
                    if( sm.data[prop] ) {
                        obj[prop] = sm.data[prop];
                    }
                } else if(sm.data.fix) {
                    var desc = obj[prop];
                    obj[prop] = desc.split(sm.data.word).join(sm.data.fix);
                }
                game.map = null;
                render(game.getLocation(game.pov.location),game.pov.location, 0);
            });
        } else {
            stateMachine = stateMachineFillinCreate(obj,[ {msg:prompt,prop:prop} ],invalidateMap);
        }
    };
    var doAnnotation = function(anno) {
        if( anno.type == "item" ) {
            //{"type":"item","item":
            var ip = game.getItem(anno.item);
            annotations = [];
            if( ip ) {
                var noPostures = true;                
                if( ip.name ) {
                    outputText(chalk.bold("Name\n"+ip.name)+" "+annotate({"type":"item.name","item":anno.item}))
                } else {
                    outputText(chalk.bold("Name\nnone")+" "+annotate({"type":"item.name","item":anno.item}))
                }
                outputText(chalk.bold("Description"));
                if( ip.description ) {
                    outputText(ip.description+annotate({"type":"item.description","item":anno.item}))
                } else {
                    outputText("No description"+annotate({"type":"item.description","item":anno.item}))
                }
                outputText(chalk.bold("Content"));
                if( ip.content ) {
                    outputText(ip.content+annotate({"type":"item.content","item":anno.content}))
                } else {
                    outputText("No readable content"+annotate({"type":"item.content","item":anno.item}))
                }
                if( ip.postures ) {
                    if( ip.postures.length ) {
                        outputText(chalk.bold("Nested Room Supported Postures"))
                        outputText(ip.postures.join(",")+annotate({"type":"item.postures","item":anno.item}))
                        noPostures = false;
                    }
                }
                if( noPostures ) {
                    outputText("Not a Nested room"+annotate({"type":"item.postures","item":anno.item}))
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
            var ip = game.getItem(anno.item);
            if( ip ) {
                stateMachine = stateMachineFillinCreate(ip,[{msg:"Change item name:",prop:"name"}]);
            }
        } else if( anno.type == "item.description" ) {
            var ip = game.getItem(anno.item);
            if( ip ) {
                spellcheckedText(ip,"description","Change entire item description:");
            }
        } else if( anno.type == "item.content" ) {
            var ip = game.getItem(anno.item);
            if( ip ) {
                spellcheckedText(ip,"content","Change entire item readable content:");
            }
        } else if( anno.type == "item.postures" ) {
            var ip = game.getItem(anno.item);
            if( ip ) {
                stateMachine = stateMachineFillinCreate(ip,[{msg:"Supported postures:",prop:"postures",choices:postureTypeList,multiple:true}]);
            }            
        } else if( anno.type == "dir" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    annotations = [];
                    outputText(chalk.bold("Location"));
                    outputText(dp.location+" "+annotate({"type":"dir.location","dir":anno.dir}))
                    outputText(chalk.bold("Type"));
                    if( dp.type ) {
                        outputText(dp.type+" "+annotate({"type":"dir.type","dir":anno.dir}))
                    } else {
                        outputText("Default "+annotate({"type":"dir.type","dir":anno.dir}))
                    }
                    if( dp.wall ) {
                        outputText("Wall: "+dp.wall+annotate({"type":"dir.wall","dir":anno.dir}));
                    } else {
                        if( loc.type == "outside" && game.getLocation(dp.location).type == "outside" ) {
                            outputText("Wall Default - none outside"+annotate({"type":"dir.wall","dir":anno.dir}));
                        } else {
                            outputText("Wall Default - inside wall"+annotate({"type":"dir.wall","dir":anno.dir}));
                        }
                    }
                    if( dp.door ) {
                        outputText(chalk.bold("Door Name"));
                        outputText(game.getDoor(dp.door).name+" "+annotate({"type":"door.name","door":dp.door}))
                        outputText(chalk.bold("Door Description"));
                        outputText(game.getDoor(dp.door).description+" "+annotate({"type":"door.description","door":dp.door}))
                    }
                }
            }
        } else if( anno.type == "location.name" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                stateMachine = stateMachineFillinCreate(loc,[{msg:"Change location name:",prop:"name"}],invalidateMap);
            }
        } else if( anno.type == "location.description" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                spellcheckedText(loc,"description","Change entire location description:");
            }
        } else if( anno.type == "location.type" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                stateMachine = stateMachineFillinCreate(loc,[{msg:"Change location type:",prop:"type",choices:roomTypesMenu}],invalidateMap);
            }
        } else if( anno.type == "location.topLoc" ) {
            annotations = [];
            var loc =  game.getLocation(anno.location);
            if( loc ) {
                outputText(chalk.bold("Level Type"));
                outputText(loc.type+" "+annotate({"type":"topLoc.type","location":anno.location}))
                outputText(chalk.bold("Level Name"));
                outputText(loc.name+" "+annotate({"type":"topLoc.name","location":anno.location}))
            }
        } else if( anno.type == "dir.location" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    // TBD changing location could orphan rooms or
                    // mess up geography - we need some validation logic
                    // to prevent this
                }
            }
        } else if( anno.type == "dir.type" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    stateMachine = stateMachineFillinCreate(dp,[{msg:"Change location type:",prop:"type",choices:dirTypesMenu}]);
                }
            }
        } else if( anno.type == "dir.wall" ) {
            var loc = game.getLocation(game.pov.location);
            if( loc ) {
                var dp = loc[anno.dir];
                if( dp ) {
                    //stateMachine = stateMachineFillinCreate(dp,[{msg:"Change location type:",prop:"type",choices:dirTypesMenu}]);
                    ;
                }
            }
        } else if( anno.type == "door.name" ) {
            var dp = game.getDoor(anno.door);
            if(dp) {                
                stateMachine = stateMachineFillinCreate(dp,[{msg:"Change door name:",prop:"name"}]);
            }
        } else if( anno.type == "door.description" ) {
            var dp = game.getDoor(anno.door);
            if(dp) {                
                stateMachine = stateMachineFillinCreate(dp,[{msg:"Change door description:",prop:"description"}]);
            }
        } else if( anno.type == "npc" ) {
            var ni = game.getNpc(anno.npc);
            if( ni ) {
                annotations = [];
                outputText(chalk.bold("Name"));
                if( ni.name ) {
                    outputText(ni.name+" "+annotate({"type":"npc.name","npc":anno.npc}));
                } else {
                    outputText("No Name "+annotate({"type":"npc.name","npc":anno.npc}));
                }
                outputText(chalk.bold("Description"));
                if( ni.description ) {
                    outputText(ni.description+" "+annotate({"type":"npc.name","npc":anno.npc}));
                } else {
                    outputText("No Description "+annotate({"type":"npc.name","npc":anno.npc}));    
                }
            }
        } else if( anno.type == "npc.name" ) {
            var ni = game.getNpc(anno.npc);
            if( ni ) {
                stateMachine = stateMachineFillinCreate(ni,[{msg:"Change NPC name:",prop:"name"}]);
            }
        } else if( anno.type == "npc.description" ) {
            var ni = game.getNpc(anno.npc);
            if( ni ) {
                stateMachine = stateMachineFillinCreate(ni,[{msg:"Change NPC description:",prop:"description"}]);
            }
        } else if( anno.type == "conv" ) {
            //{ type:"conv" , game.npc : vc.npc , action : vc.action , preposition  : vc.preposition , topic : vc.topic }
        }
    };
    var godCommandPatterns = [
        {
            match : {
                verb : [ "!drop","!put","!hide" ],
                dObjScalar : true,
                dObj : "create" ,
                iObj : "create" ,
                preposition : ["on","from","in","inside","under","behind"]
            } , 
            eval : function(args) {
                var ip = game.getItem(args.iObj);
                if( args.new_iObj ) {
                    // we need to put the iObj in location
                    var pLoc = game.getLocation(game.pov.location);
                    var foundItem = false;
                    if( !pLoc.contains ) {
                        pLoc.contains = [];
                    }
                    for( var i = 0 ; i < pLoc.contains.length ; ++i ) {
                        if( pLoc.contains[i].item == args.iObj ) {
                            foundItem = true;
                        }
                    }
                    if( !foundItem ) {
                        pLoc.contains.push({item:args.iObj})
                    }
                } else if( !ip ) {
                    outputText(args.iObj+" was not found!");
                }
                var listName = null;
                if( args.preposition == "on") {
                    listName = "supports";                    
                } else if( args.preposition == "under") {
                    listName = "under";
                } else if( args.preposition == "behind") {
                    listName = "behind";
                } else {
                    listName = "contains";
                }
                if( !ip[listName] ) {
                    ip[listName] = [];
                }
                if( args.verb == "!hide" ) {
                    ip[listName].push({ item : args.dObj , hidden : true });
                } else {
                    ip[listName].push({ item : args.dObj });
                }
                outputText("Ok");
            },
        },
        {
            match : {
                verb : [ "!drop" ],
                dObjScalar : true,
                dObj : "create" ,
            } , 
            eval : function(args) {
                if( args.new_dObj ) {
                    var pLoc = game.getLocation(game.pov.location);
                    if( !pLoc.contains ) {
                        pLoc.contains = [];
                    }
                    var ip =  {item:args.dObj};
                    if( args.dObjScalar ) {
                        ip.scalar = args.dObjScalar;
                    }
                    pLoc.contains.push(ip);
                    var ip = game.getItem(args.dObj);
                    outputText(ip.name+" has been placed in "+pLoc.name);
                }
            }
        },    
        {
            match : {
                verb : "!makedoor",
                direction: true
            },
            eval : function(args) {
                if (game.getLocation(game.pov.location)) {
                    var nextLoc = game.getLocation(game.pov.location)[args.direction];
                    if (nextLoc) {
                        lastDirection = args.direction;
                        lastLocation = game.pov.location;
                        game.pov.location = nextLoc.location;
                        stateMachine = stateMachineFillinCreate({},[
                            {msg:"Door name:",prop:"name"}
                        ],function(sm) {
                            if( sm.data.name  && sm.data.name.length > 1  ) {
                                var name = extractNounAndAdj(sm.data.name);
                                name = game.getUniqueItemName(name,"door",game.util.calcCommonPrefix(game.pov.location,lastLocation));
                                game.setDoor(name,{ name: sm.data.name , type : "door" });
                                game.getLocation(lastLocation)[lastDirection].door = name;
                                game.getLocation(game.pov.location)[reverseDirection(lastDirection)].door = name;
                                game.pov.location = lastLocation;
                                game.map = null;
                                describeLocation();
                            }
                        });
                    } else {
                        outputText("There is no opening to the "+args.direction);
                    }
                } else {
                    outputText("There is no starting location.");
                }
            }
        },
        {
            match : {
                verb : "!makedoor"
            },
            eval : function(args) {
                if( lastDirection && lastLocation  ) {
                    stateMachine = stateMachineFillinCreate({},[
                        {msg:"Door name:",prop:"name"}
                    ],function(sm) {
                        if( sm.data.name  && sm.data.name.length > 1  ) {
                            var name = extractNounAndAdj(sm.data.name);
                            var lastLocDir = null;
                            var curLocDir = null;
                            name = game.getUniqueItemName(name,"door",game.util.calcCommonPrefix(game.pov.location,lastLocation));
                            game.setDoor(name,{ name: sm.data.name , type : "door"});
                            lastLocDir = game.getLocation(lastLocation)[lastDirection];
                            curLocDir = game.getLocation(game.pov.location)[reverseDirection(lastDirection)]
                            if( !lastLocDir
                            && !curLocDir 
                                ) {
                                game.getLocation(lastLocation)[lastDirection] = { location : game.pov.location , door : name };
                                game.getLocation(game.pov.location)[reverseDirection(lastDirection)] = { location : lastLocation , door : name};
                            } else if( lastLocDir && curLocDir ) {
                                lastLocDir.door = name;
                                curLocDir.door = name;
                            } else {
                                outputText("Locations are not paired from "+lastDirection);
                            }
                            game.map = null;
                            describeLocation();
                        }
                    });
                } else {
                    outputText("There is no ending location. lastLocation="+lastLocation+" lastDirection="+lastDirection+ " game.pov.location="+game.pov.location);
                }
            }
        },
        {
            match : {
                verb : [ "!makepath","!makepassage","!makestairs"]
            },
            eval : function(args) {
                if( lastLocation ) {
                    var dirCType = args.verb.substring(5);
                    if( game.getLocation(lastLocation)[lastDirection] ) {
                        game.getLocation(lastLocation)[lastDirection].type = dirCType;
                        game.getLocation(game.pov.location)[reverseDirection(lastDirection)].type = dirCType;
                    } else if( !game.getLocation(game.pov.location)[reverseDirection(lastDirection)] ) {
                        game.getLocation(lastLocation)[lastDirection] = { location : game.pov.location , type : dirCType};
                        game.getLocation(game.pov.location)[reverseDirection(lastDirection)] = {location : lastLocation , type : dirCType};
                    }
                } else {
                    outputText("There is no starting location.");
                }
            }
        }
    ];


    var takeFromContainerHandler = function(args) {
        var ip = game.getItem(args.iObj);
        var from = null;
        var prop = null;
        if( ip.supports && (args.preposition == "on"||args.preposition == "from") ) {
            from = lookupItemArr(args.dObj,ip.supports);
            if( from )
                prop = "supports";
        }
        if( ip.behind && (args.preposition == "behind"||args.preposition == "from") && !from ) {
            from = lookupItemArr(args.dObj,ip.behind);
            if( from )
                prop = "behind";
        }
        if( ip.under && (args.preposition == "under"||args.preposition == "from") && !from ) {
            from = lookupItemArr(args.dObj,ip.under);
            if( from )
                prop = "under";
        }
        if( ip.contains && (args.preposition == "in"||args.preposition == "contains"||args.preposition == "from") && !from ) {
            from = lookupItemArr(args.dObj,ip.contains);
            if( from )
                prop = "contains";
        }
        if( !from && args.preposition == "from" ) {
            if( ip.supports ) {
                args.preposition = "on";
            } else if( !ip.contains && ip.behind ) {
                args.preposition = "behind";
            } else if( !ip.contains && ip.under ) {
                args.preposition = "under";
            }
        }
        if( from ) {
            var listPtr = ip[prop];
            for (var i = 0; i < listPtr.length; ++i) {
                if (listPtr[i].item == from) {
                    if( !game.pov.inventory ) {
                        game.pov.inventory = [];
                    }
                    game.pov.inventory.push(listPtr[i]);
                    ip[prop].splice(i, 1);                            
                    outputText("Taken.");
                    break;
                }
            }
        } else if(args.preposition == "on") {
            outputText("There is no "+args.dObj+" on "+ip.name);                    
        } else if(args.preposition == "behind") {
            outputText("There is no "+args.dObj+" behind "+ip.name);                    
        } else if(args.preposition == "under") {
            outputText("There is no "+args.dObj+" under "+ip.name);                    
        } else {
            outputText("There is no "+args.dObj+" in "+ip.name);
        }
    };

    // Command patterns
    var commandPatterns = [
        {
            match : {
                verb : "!look"
            }, 
            eval : function(args) {
                describeLocation(true);
            }
        },
        {
            match : {
                verb : "!inventory"
            }, 
            eval : function(args) {
                if (game.pov.inventory.length == 0) {
                    outputText("You are carrying nothing.");
                } else {
                    annotations = [];
                    outputText("You are carrying:");
                    for (var i = 0; i < game.pov.inventory.length; ++i) {
                        outputText(game.getItem(game.pov.inventory[i].item).name+annotate({"type":"item","item":game.pov.inventory[i].item}));
                    }
                }
            }
        },        
        {
            match : {
                verb : "!examine",
                dObj : "*",
                preposition : ["on","under","behind","in","inside"]
            }, 
            eval : function(args) {
                decribeItem(args.dObj,args.preposition);
            }
        } ,
        {
            match : {
                verb : "!examine",
                dObj : "*"
            }, 
            eval : function(args) {
                decribeItem(args.dObj);                
            }
        } ,
        {
            match : {
                verb : "!search",
                dObj : "*",
                preposition : ["on","under","behind","in","inside"]
            }, 
            eval : function(args) {
                decribeItem(args.dObj,args.preposition,true);
            }
        } ,
        {
            match : {
                verb : "!search",
                dObj : "*"
            }, 
            eval : function(args) {
                decribeItem(args.dObj,null,true);
            }
        } ,
        {
            match : {
                verb : "!take",
                dObj : "name",
                iObj : "*" ,
                preposition : ["on","from","in","under","behind"]
            } , 
            eval : takeFromContainerHandler
        },
        { 
            match : {
                verb : "!take",
                dObj : "noactor"
            } , 
            eval : function(args) {
                var where = game.getLocation(game.pov.location);
                var taken = false;
                for (var i = 0; i < where.contains.length; ++i) {
                    if (where.contains[i].item == args.dObj) {
                        if( !game.pov.inventory ) {
                            game.pov.inventory = [];
                        }
                        game.pov.inventory.push(where.contains[i]);
                        where.contains.splice(i, 1);
                        if (where.contains.length == 0) {
                            delete where.contains;
                        }
                        outputText("Taken.");
                        taken = true;
                        break;
                    }
                }
                if( !taken ) {
                    var disclosedList = game.state[game.pov.location+"_disclosed"];
                    if( disclosedList ) {
                        var path = disclosedList[args.dObj];
                        if( path ) {
                            var sep = path.indexOf(" ");
                            if( sep > 0 ) {
                                args.preposition = path.substring(0,sep);
                                if( args.preposition == "supports") {
                                    args.preposition = "on";
                                }
                                args.iObj  = path.substring(sep+1).trim();
                                args.dObj  = game.getItem(args.dObj).name;
                                takeFromContainerHandler(args);
                            }
                        }                        
                    }
                }
            }
        },
        {
            match : {
                verb : [ "!drop","!put","!hide" ],
                dObj : "actor" ,
                iObj : "*" ,
                preposition : ["on","from","in","inside","under","behind"]
            } , 
            eval : function(args) {
                var where = game.getItem(args.iObj);
                var what = game.getItem(args.dObj);
                var holder = "contains";
                if( args.preposition == "on" ) {
                    holder = "supports";
                } else if( args.preposition == "under" ) {
                    holder = "under";
                } else if( args.preposition == "behind" ) {
                    holder = "behind";                    
                }
                if (where) {
                    if (where[holder]) {
                        var found = false;
                        var dropped = game.dropObject(dObj);
                        outputText(dropped.response);
                        if( dropped.found ) {                            
                            if (args.verb == "!hide") {
                                objRef.hidden = true;
                            } else if (objRef.hidden) {
                                delete objRef.hidden;
                            }
                            where[holder].push(objRef);
                        }        
                    } else {
                        outputText("You cannot place "+what.name+" "+args.preposition+" "+where.name);
                    }
                } else {
                    outputText("You don't see "+ args.iObj+"!");   
                }
            }
        },
        {
            match : {
                verb : [ "!drop" ],
                dObj : "actor" ,
            } , 
            eval : function(args) {                
                var where = game.getLocation(game.pov.location);
                for (var i = 0; i < game.pov.inventory.length; ++i) {
                    if (game.pov.inventory[i].item == args.dObj) {
                        if( !where.contains ) {
                            where.contains = [];
                        }                
                        where.contains.push(game.pov.inventory[i]);
                        game.pov.inventory.splice(i, 1);
                        break;
                    }
                }
            }
        },
        { 
            match : {
                verb : "!open",
                dObj : "*"
            } , 
            eval : function(args) {
                var objState = game.getObjectState(args.dObj);
                var ip = game.getItem(args.dObj);
                var itemStateAccess = null;
                var itemStateLock = null;
                if( objState ) {
                    itemStateAccess = objState.access;
                    itemStateLock = objState.lock;
                }
                if( itemStateAccess == "open" ) {
                    outputText("The " + ip.name + " is already open");
                } else if( itemStateLock == "locked" ) {
                    outputText("The " + ip.name + " is locked");
                } else if( itemStateAccess == "closed" ) {
                    game.setObjectState(args.dObj,"access","open");
                    outputText("Ok, you opened the " + ip.name);
                } else {
                    outputText(ip.name + " cannot be opened.");
                }
           }
        },
        {
            match : {
                verb : "!close",
                dObj : "*"
            } ,
            eval : function(args) {
                var objState = game.getObjectState(args.dObj);
                var ip = game.getItem(args.dObj);
                var itemStateAccess = null;
                var itemStateLock = null;
                if( objState ) {
                    itemStateAccess = objState.access;
                    itemStateLock = objState.lock;
                }
                if( itemStateAccess == "open" ) {
                    game.setObjectState(args.dObj,"access","closed");
                    outputText("Ok, you closed the " + ip.name);
                } else if( itemStateAccess == "closed" ) {
                    outputText("The " + ip.name + " is already closed");
                } else if( itemStateLock == "locked" ) {
                    outputText("The " + ip.name + " is not open");
                } else {
                    outputText(ip.name + " cannot be closed.");
                }
            }
        },
        {
            match : {
                verb : "!lock",
                preposition: ["with","using"],
                dObj : "*",
                iObj : "actor"
            } ,
            eval : function(args) {
                var objState = game.getObjectState(args.dObj);
                var ip = game.getItem(args.dObj);
                var kp = game.getItem(args.iObj);
                var itemStateAccess = null;
                var itemStateLock = null;
                if( objState ) {
                    itemStateAccess = objState.access;
                    itemStateLock = objState.lock;
                }
                if( ip.key != args.iObj ) {
                    if( ip.key ) {
                        outputText("The " + kp.name + " doesn't fit "+ip.dObj);
                    } else {
                        outputText("The " + kp.name + " cannot be locked");
                    }
                } else if( itemStateLock == "locked" ) {
                    outputText("The " + ip.name + " is already locked");
                } else if( itemStateAccess == "open" ) {
                    game.setObjectState(args.dObj,"access","closed");
                    game.setObjectState(args.dObj,"lock","locked");
                    outputText("First closing, " + ip.name + " is now locked");
                } else {
                    game.setObjectState(args.dObj,"lock","locked");
                    outputText("Ok, " + ip.name + " is now locked");
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                var kp = game.getItem(args.iObj);
                ip.key = args.iObj;
                ip.state = "locked";
                outputText("Ok, " + ip.name + " is now keyed to "+kp.name);
            }
        },
        {
            match : {
                verb : "!unlock",
                preposition: "with",
                dObj : "*",
                iObj : "actor"
            } ,
            eval : function(args) {
                var objState = game.getObjectState(args.dObj);
                var ip = game.getItem(args.dObj);
                var kp = game.getItem(args.iObj);
                var itemStateLock = null;
                if( objState ) {
                    itemStateLock = objState.lock;
                }                
                if( ip.key != args.iObj ) {
                    if( ip.key ) {
                        outputText("The " + kp.name + " doesn't fit "+ip.dObj);
                    } else {
                        outputText("The " + kp.name + " cannot be unlocked");
                    }
                } else if( itemStateLock != "locked" ) {
                    outputText("The " + ip.name + " is not locked");
                } else {
                    game.setObjectState(args.dObj,"lock","unlocked");
                    outputText("Ok, " + ip.name + " is now unlocked");
                }
            }
        },
        {
            match : {
                verb : "!read",
                dObj : "*",
            } ,
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.content) {
                    outputText(ip.content);
                } else {
                    outputText("There is nothing written on the "+ip.name);
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.content) {
                    outputText(ip.content);
                } else {
                    stateMachine = stateMachineFillinCreate(ip,[ {msg:"What do you see written on " + ip.name + "?",prop:"content"} ]);
                }
            }
        },
        { 
            match : {
                verb : "!smell",
                dObj : "noactor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.smell && ip.smell.description ) {
                    outputText(ip.smell.description);
                } else {
                    outputText("You notice no smell in particular.");
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.smell && ip.smell.description ) {
                    outputText(ip.smell.description);
                } else {
                    if( !ip.smell ) {
                        ip.smell = {};
                    }
                    stateMachine = stateMachineFillinCreate(ip.smell,[ {msg:"Describe the smell of " + ip.name + "?",prop:"description"} ]);
                }
            }
        },
        { 
            match : {
                verb : "!touch",
                dObj : "noactor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.touch && ip.touch.description ) {
                    outputText(ip.touch.description);
                } else {
                    outputText("You don't notice anything out of the ordinary.");
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.touch && ip.touch.description ) {
                    outputText(ip.touch.description);
                } else {
                    if( !ip.touch ) {
                        ip.touch = {};
                    }
                    stateMachine = stateMachineFillinCreate(ip.touch,[ {msg:"Describe how " + ip.name + " feels to the touch?",prop:"description"} ]);
                }
            }
        },
        { 
            match : {
                verb : "!listen",
                dObj : "noactor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.sound && ip.sound.description ) {
                    outputText(ip.sound.description);
                } else {
                    outputText("You don't notice any sound.");
                }
            },
            godEval: function(args) {
                var ip = game.getItem(args.dObj);
                if (ip.sound && ip.sound.description ) {
                    outputText(ip.sound.description);
                } else {
                    if( !ip.sound ) {
                        ip.sound = {};
                    }
                    stateMachine = stateMachineFillinCreate(ip.sound,[ {msg:"Describe how " + ip.name + " sounds?",prop:"description"} ]);
                }
            }        
        },
        {
            match : {
                verb : "!eat",
                dObj : "actor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip && ip.type ==  "food" ) {
                    outputText(game.dropObject(args.dObj).response);
                } else {
                    outputText("You cannot eat "+ip.name+".");
                }
            }
        },
        {
            match : {
                verb : "!wear",
                dObj : "actor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip && ip.type ==  "wearable" ) {
                    var is = game.getObjectState(args.dObj);
                    if( is.worn ) {
                        outputText("You area already wearing "+ip.name+".");
                    } else {
                        is.worn = true;
                        outputText("Ok");
                    }
                } else {
                    outputText("You cannot wear "+ip.name+".");
                }
            }
        },
        {
            match : {
                verb : "!doff",
                dObj : "actor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip && ip.worn ) {
                    delete ip.worn;
                    outputText("Ok.");
                } else {
                    outputText("You are not wearing "+ip.name+".");
                }
            }
        },
        {
            match : {
                verb : "!light",
                dObj : "actor"
            } , 
            eval : function(args) {
                var ip = game.getItem(args.dObj);
                if (ip && ip.type ==  "light" ) {
                    var is = game.getObjectState(args.dObj);
                    if( is.lit && is.lit > 0 ) {
                        outputText(ip.name+" is already lit.");
                    } else if( it.level && ip.level > 0 ) {
                        is.lit = ip.level;
                        outputText("Ok.");
                    } else {
                        is.lit = 10;
                        outputText("Ok.");
                    }
                } else {
                    outputText("You cannot light "+ip.name+".");
                }
            }
        },
        {
            match : {
                verb : ["!give","!show"],
                dObj : "*",
                subject : "npc",
                article : ["the","a","an","my"," "]
            } ,
            eval : function(args) {
                if( args.verb == "!give" )
                    verbCommand.action = "give";
                else
                    verbCommand.action = "show";
                verbCommand.npc = args.subject;
                verbCommand.topic = args.dObj;
                if( !processScript() ) {
                    if (game.pov.isGod ) {
                        defineScript();
                    } else {
                        noUnderstand();
                    }
                }
            }
        },
        {
            match : {
                verb : ["!talkto","!ask","!tell"],
                dObj : "topic",
                subject : "npc",
                preposition: ["about","for"]
            } ,
            eval : function(args) {
                if( args.verb == "!talkto" )
                    verbCommand.action = "talkto";
                else if( args.verb == "!tell" )
                    verbCommand.action = "tell";
                else
                    verbCommand.action = "ask";
                verbCommand.npc = args.subject;
                verbCommand.topic = args.dObj;
                verbCommand.preposition = args.preposition;
                if( !processScript() ) {
                    if (game.pov.isGod ) {
                        defineScript();
                    } else {
                        noUnderstand();
                    }
                }
            }
        },       
        {
            match : {
                verb : ["!talkto","!hi","!bye","!leave","!notice"],
                subject : "npc"
            } ,
            eval : function(args) {
                if( args.verb == "!hi" )
                    verbCommand.action = "hi";
                else if( args.verb == "!bye" )
                    verbCommand.action = "bye";
                else if( args.verb == "!leave" )
                    verbCommand.action = "leave";
                else if( args.verb == "!notice" )
                    verbCommand.action = "notice";
                else
                    verbCommand.action = "talkto";
                verbCommand.npc = args.subject;
                verbCommand.topic = null;
                verbCommand.preposition = null;
                if( !processScript() ) {
                    if (game.pov.isGod ) {
                        defineScript();
                    } else {
                        noUnderstand();
                    }
                }
            }
        },   
        {
            match: {
                verb : "!saveplay"
            },
            eval : function(args) {
                game.saveCommands();
                outputText("Saved");
            }
        }
    ];

    var parseArg = function(game,pattern,findPatternArgs,argName,name,origCommand) {
        var objName = null;
        if( pattern.match[argName] == "name" || pattern.match[argName] == "topic" ) {
            // Just use name (will be resolved late)            
            findPatternArgs[argName] = name;
            return true;
        } else if( pattern.match[argName] == "npc" || pattern.match[argName] == "createnpc" ) {
            objName = findNPCs(name);
            if( objName.length == 1 ) {
                objName = objName[0];
                findPatternArgs[argName] = objName;
                return true;
            } else {
                dontSeeNpc(name,game.pov.location,origCommand);                
            }
        } else {
            if( pattern.match[argName] == "*" || pattern.match[argName] == "create" ) {
                objName = lookupItem(game.pov.location,name);
            } else {
                objName = lookupItem(game.pov.location,name,pattern.match[argName]);
            }
            if( objName && objName != "?") {
                findPatternArgs[argName] = objName;
                return true;
            } else if( !objName ) {
                if( pattern.match[argName] == "create" ) {
                    // Add a state
                    if( !findPatternArgs.states ) {
                        findPatternArgs.states = [];
                    }
                    findPatternArgs[argName] = name;
                    var createChoices = null;
                    if( findPatternArgs[argName+"Scalar"]) {
                        createChoices = [{ text : 'Create a new object type for "'+name+'"' , value : "<createtype>" }]; 
                    } else {
                        createChoices = [{ text : 'Create new object for "'+name+'"' , value : "<create>" }];
                        // If items 
                        var findAll = lookupItem(game.pov.location,"{*}").split("\n");
                        if( findAll && findAll.length > 0 ) {
                            if( findAll.length > 1 ) {
                                var subChoices = [];
                                for( var i = 0 ; i < findAll.length ; ++i ) {
                                    subChoices.push({text : 'Alias for '+game.getItem(findAll[i]).name , value : findAll[i] });
                                }
                                subChoices.push({text : 'Return to top' , abort : true });
                                createChoices.push({text : 'Object is Alias', msg : 'Object '+name, choices : subChoices });
                            } else if( findAll[0] && findAll[0] != '' ){
                                createChoices.push({text : 'Alias for '+game.getItem(findAll[0]).name , value : findAll[0] });
                            }
                        }
                    }               
                    createChoices.push({text : 'Abort the command' , abort : true});
                    findPatternArgs.states.push({msg:(name+" does not exist"),prop:"new_"+argName,choices : createChoices });
                    return true;
                } else {
                    dontSee(name,game.pov.location,origCommand);
                }
            }
        }
        return false;
    };

    var nullPatternHandler = { eval : function() {} };
    var extractScalar = function(obj,origCommand) {
        var words = obj.split(" ");
        var scalar = 0;
        if( words.length > 1 ) {
            if( '0' <= words[0][0] && words[0][0] <= '9' ) {
               scalar = Number.parseInt(words[0]);
               words[0] = "";
               obj = words.join(" ").trim();
            }
        }
        return { obj :obj , scalar : scalar };
    };
    var lookupCommandHandle = function(commands,cmd,findPatternArgs) {
        var findPattern = null;
        var firstWord = cmd.firstWord;
        var command = cmd.command;
        var origCommand = cmd.origCommand;
        for( var i = 0 ; i < commands.length ; ++i ) {
            var _pattern =  commands[i];
            var preposition = null;
            var matchVerb = false;
            if( Array.isArray(_pattern.match.verb) ) {
                for( var j = 0 ; j < _pattern.match.verb.length ; ++j ) {
                    if( _pattern.match.verb[j] == firstWord ) {
                        findPatternArgs.verb = firstWord;
                        matchVerb = true;
                        break;
                    } 
                }
            } else if( _pattern.match.verb == firstWord ) {
                matchVerb = true;
            }
            if( matchVerb ) {
                var object1 = subSentence( command , 1) , object2;
                if( _pattern.match.article ) {
                    var aList = [];
                    for(var j = 0 ; j < _pattern.match.article.length ; ++j ) {
                        if( _pattern.match.article[j] == " " ) {
                            if( object1.indexOf( " " ) ) {
                                aList.push(" ");
                            }
                        } else if( object1.indexOf( " " + _pattern.match.article[j] + " ") >= 0 ) {
                            aList.push(" " + _pattern.match.article[j] + " ");
                            break;
                        }
                    }
                    var wList = splitOnOneOf( object1 , aList );
                    if( wList.length > 1 ) {
                        findPatternArgs.article = aList[0];
                        object1 = wList[0];
                        wList[0] = "";
                        object2 = wList.join(" ").trim();
                        if( _pattern.match.subject ) {
                            if( !parseArg(game,_pattern,findPatternArgs,"subject",object1,origCommand) ) {
                                findPattern = nullPatternHandler;
                                break;
                            }
                            if( _pattern.match.iObj ) {
                                if( !parseArg(game,_pattern,findPatternArgs,"iObj",object2,origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }
                                findPatternArgs.preposition = preposition;
                                findPattern = _pattern;
                                break;
                            } else if( _pattern.match.dObj ) {
                                if( _pattern.match.dObjScalar ) {
                                    var es = extractScalar(object2,origCommand);
                                    object2 = es.obj;
                                    findPatternArgs.dObjScalar = es.scalar;
                                }
                                if( !parseArg(game,_pattern,findPatternArgs,"dObj",object2,origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }
                                findPatternArgs.preposition = preposition;
                                findPattern = _pattern;
                                break;
                            }
                        } else if( _pattern.match.dObj ) {
                            if( _pattern.match.dObjScalar ) {
                                var es = extractScalar(object1,origCommand);
                                object1 = es.obj;
                                findPatternArgs.dObjScalar = es.scalar;
                            }
                            if( !parseArg(game,_pattern,findPatternArgs,"dObj",object1,origCommand) ) {
                                findPattern = nullPatternHandler;
                                break;
                            }
                            if( _pattern.match.iObj ) {
                                if( !parseArg(game,_pattern,findPatternArgs,"iObj",object2,origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }
                                findPatternArgs.preposition = preposition;
                                findPattern = _pattern;                                            
                                break;
                            }
                        }
                    }
                } else if( _pattern.match.preposition ) {
                    preposition = null;
                    if( Array.isArray(_pattern.match.preposition) ) {                                
                        for( var j = 0 ; j < _pattern.match.preposition.length ; ++j ) {
                            var sep = command.indexOf(" "+_pattern.match.preposition[j]+" ");
                            if( sep > 0 ) {
                                preposition = _pattern.match.preposition[j];
                                break;
                            }
                        }
                    } else {
                        preposition = _pattern.match.preposition;
                    }
                    if( preposition ) {
                        var sep = object1.indexOf(" "+preposition+" ");
                        if( sep > 0 ) {
                            object2 = object1.substring(sep+preposition.length+2);
                            object1 = object1.substring(0,sep);
                            if( _pattern.match.subject ) {
                                if( !parseArg(game,_pattern,findPatternArgs,"subject",object1,origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }
                                if( _pattern.match.iObj ) {
                                    if( !parseArg(game,_pattern,findPatternArgs,"iObj",object2,origCommand) ) {
                                        findPattern = nullPatternHandler;
                                        break;
                                    }
                                    findPatternArgs.preposition = preposition;
                                    findPattern = _pattern;
                                    break;
                                } else if( _pattern.match.dObj ) {
                                    if( _pattern.match.dObjScalar ) {
                                        var es = extractScalar(object2,origCommand);
                                        object2 = es.obj;
                                        findPatternArgs.dObjScalar = es.scalar;
                                    } 
                                    if( !parseArg(game,_pattern,findPatternArgs,"dObj",object2,origCommand) ) {
                                        findPattern = nullPatternHandler;
                                        break;
                                    }
                                    findPatternArgs.preposition = preposition;
                                    findPattern = _pattern;
                                    break;
                                }
                            } else if( _pattern.match.dObj ) {
                                if( _pattern.match.dObjScalar ) {
                                    var es = extractScalar(object1,origCommand);
                                    object1 = es.obj;
                                    findPatternArgs.dObjScalar = es.scalar;
                                }
                                if( !parseArg(game,_pattern,findPatternArgs,"dObj",object1,origCommand) ) {
                                    findPattern = nullPatternHandler;
                                    break;
                                }
                                if( _pattern.match.iObj ) {
                                    if( !parseArg(game,_pattern,findPatternArgs,"iObj",object2,origCommand) ) {
                                        findPattern = nullPatternHandler;
                                        break;
                                    }
                                    findPatternArgs.preposition = preposition;
                                    findPattern = _pattern;                                            
                                    break;
                                }
                            }
                        } else if( _pattern.match.dObj 
                               && !_pattern.match.iObj
                               && !_pattern.match.subject
                                 ) {
                                    if( _pattern.match.dObjScalar ) {
                                        var es = extractScalar(object1,origCommand);
                                        object1 = es.obj;
                                        findPatternArgs.dObjScalar = es.scalar;
                                    }
                                if( !parseArg(game,_pattern,findPatternArgs,"dObj",object1,origCommand) ) {
                                findPattern = nullPatternHandler;
                                break;
                            }                            
                            findPatternArgs.preposition = preposition;
                            findPattern = _pattern;
                            break;                
                        } else if( !_pattern.match.dObj 
                                && !_pattern.match.iObj
                                && _pattern.match.subject
                                 ) {
                            if( !parseArg(game,_pattern,findPatternArgs,"subject",object1,origCommand) ) {
                                findPattern = nullPatternHandler;
                                break;
                            }                            
                            findPatternArgs.preposition = preposition;
                            findPattern = _pattern;
                            break;                
                        } else {
                            preposition = null;
                        }
                    }
                } else if( _pattern.match.dObj ) {
                    if( _pattern.match.dObjScalar ) {
                        var es = extractScalar(object1,origCommand);
                        object1 = es.obj;
                        findPatternArgs.dObjScalar = es.scalar;
                    }
                    if( !parseArg(game,_pattern,findPatternArgs,"dObj",object1,origCommand) ) {
                        findPattern = nullPatternHandler;
                        break;
                    }                            
                    findPattern = _pattern;
                    break;
                } else if( _pattern.match.subject ) {
                    if( !parseArg(game,_pattern,findPatternArgs,"subject",object1,origCommand) ) {
                        findPattern = nullPatternHandler;
                        break;
                    }
                    findPattern = _pattern;
                    break;
                } else if( _pattern.match.iObj ) {
                    if( !parseArg(game,_pattern,findPatternArgs,"iObj",object1,origCommand) ) {
                        findPattern = nullPatternHandler;
                        break;
                    }                            
                    findPattern = _pattern;
                    break;
                } else if( _pattern.match.direction ) {
                    // Verb + direction
                    if( isDirection(object1) ) {
                        findPatternArgs.direction = isDirection(object1).primary;
                        findPattern = _pattern;
                        break;    
                    } else if( object1 != "" ) {
                        outputText("Expected a direction");
                        findPattern = nullPatternHandler;
                        break;
                    }
                } else if( object1 == "" ) {
                    // Just a verb & nothing else supplied
                    findPattern = _pattern;
                    break;
                }
            }
        }
        return findPattern;
    };

    var parseCommand = function (command) {
        if( stateMachine ) {
            // Set of prompts....
            if( command && command.length > 0 && !stateMachine.aborting )
               game.logCommand(command);
            var res = stateMachine.execute(stateMachine,command);
            if( res == "next") {
                stateMachine.state = stateMachine.state + 1;
            } else if( res != "retry")
                stateMachine = null;
            return true;    
        } else {
            var origCommand = command;
            var lCase = command;
            lCase = lCase.toLowerCase();
            var lCaseWords =  lCase.split(" ");
            var firstWord = lCaseWords[0].trim(); 
            var firstPhrase = null;
            if( command && command.length > 0 )
               game.logCommand(command);
            if( game.pov ) {
                if( game.pov.isGod ) {
                    if( godWordMap.firstWord[firstWord] ) {
                        firstWord = godWordMap.firstWord[firstWord];
                    }
                    if( lCaseWords.length > 0 ) {
                        firstPhrase =  godWordMap.firstTwoWord[lCaseWords[0]+" "+lCaseWords[1]];
                        if( firstPhrase ) {
                            command = firstPhrase+" "+subSentence(command,2);
                            firstWord = firstPhrase;
                            lCase = command;
                            lCase = lCase.toLowerCase();
                            lCaseWords =  lCase.split(" ");
                        }
                    }    
                }
            }
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
            if( firstWord == "!quit") {
                return false;
            } else if (lCase.trim() == "") {
                outputText("Pardon?");
                describeLocation();
            /*} else if (mode == 'door?') {
                // TBD make separate commands for door/passage etc Make
                lCase = lCase.trim();
                ...
                } else if (lCase == "u") {
                    game.getLocation(lastLocation)[lastDirection].direction = -1;
                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].direction = 1;
                    map = null;
                } else if (lCase == "d") {
                    game.getLocation(lastLocation)[lastDirection].direction = 1;
                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].direction = -1;
                    map = null;
                } else if (lCase == "-") {
                    game.getLocation(lastLocation)[lastDirection].teleport = true;
                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].teleport = true;
                    map = null;
                } else if (lCase == "+") {
                    // TBD - we need to make sure that the maps do *not* overlap
                    if( game.getLocation(lastLocation)[lastDirection].teleport ) {
                        delete game.getLocation(lastLocation)[lastDirection].teleport;
                    }
                    if( game.getLocation(game.pov.location)[reverseDirection(lastDirection)].teleport ) {
                        delete game.getLocation(game.pov.location)[reverseDirection(lastDirection)].teleport;
                    }
                    map = null;
                } else if (lCase != ""
                    && lCase != "n"
                    && lCase != "no"
                ) {
                    var name = extractNounAndAdj(command);
                    if (!name || getDoor(name)) {
                        name = game.getUniqueItemName(name,...);
                    }
                    game.setDoor(name,{ name: command });
                    game.getLocation(lastLocation)[lastDirection].door = name;
                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].door = name;
                }
                mode = "what";
                describe();
            */
            } else {                
                var findPatternArgs = {};
                var cmd = { firstWord : firstWord , command : command , origCommand : origCommand };
                var findPattern = null;
                if( game.pov.isGod ) {
                    findPattern = lookupCommandHandle(godCommandPatterns,cmd,findPatternArgs);
                }
                if( !findPattern ) {
                    findPattern = lookupCommandHandle(commandPatterns,cmd,findPatternArgs);
                }
                if( findPattern ) {
                    // Pattern matches handles patterns generally
                    if( findPatternArgs.states ) {
                        // Prompt for new elements
                        findPatternArgs.pattern = findPattern;                        
                        stateMachine = stateMachineFillinCreate(findPatternArgs,findPatternArgs.states,function(sm) {
                            var missingObjects = false;
                            var createObjects = [];
                            var objectTypes = {};
                            for(var prop in sm.data ) {
                                if( prop.substring(0,4) == "new_") {
                                    if( sm.data[prop] ) {
                                        if( sm.data[prop] == "<create>" || sm.data[prop] == "<createtype>" ) {
                                            if( sm.data[prop] == "<createtype>" ) {
                                                objectTypes[prop.substring(4)] = true;
                                            }
                                            createObjects.push(prop.substring(4));
                                        } else {
                                            var aliasName = sm.data[prop.substring(4)];
                                            var aliasItem = game.getItem(sm.data[prop]);
                                            sm.data[prop.substring(4)] = sm.data[prop];
                                            if( !aliasItem.alias ) {
                                                aliasItem.alias = [aliasName];
                                            } else {
                                                aliasItem.alias.push(aliasName);
                                            }
                                        }
                                    } else {
                                        missingObjects = true;
                                        break;
                                    }
                                }
                            }
                            if( missingObjects ) {
                                outputText("Objects were missing, aborted...")
                            } else {
                                for(var i = 0 ; i < createObjects.length ; ++i ) {
                                    var friendlyName = sm.data[createObjects[i]];                                    
                                    var name = extractNounAndAdj(friendlyName);
                                    if( !name ) {
                                        name = friendlyName;
                                    }
                                    if( objectTypes[createObjects[i]] ) {
                                        name = singularFromPlural(name);
                                        name = game.getUniqueItemName(name,"item");
                                        game.setItem(name,{ name: name , plural : pluralFromSingular(name) , multiple : true});
                                    } else {
                                        name = game.getUniqueItemName(name,"item",game.util.calcCommonPrefix(game.pov.location,game.pov.location));
                                        game.setItem(name,{ name: friendlyName });
                                    }
                                    sm.data[createObjects[i]] = name;
                                }
                                // Create game.items
                                sm.data.pattern.eval(sm.data);
                            }                            
                        });
                    } else if( game.pov.isGod && findPattern.godEval ) {
                        findPattern.godEval(findPatternArgs);
                    } else {
                        findPattern.eval(findPatternArgs);
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
                        var where = game.getLocation(game.pov.location);
                        var what = command;
                        if (!where.contains) {
                            where.contains = [];
                        }
                        var existingItem = lookupItem(game.pov.location,what);
                        if (existingItem && existingItem != "?") {
                            var ip = game.getItem(existingItem);
                            if (game.pov.isGod && !ip.type) {
                                ip.type = thingType;
                                outputText(command + " is " + thingType + ".");
                            } else if (ip.type != thingType) {
                                outputText("You cannot " + firstWord + " " + command);
                            } else {
                                if( !game.pov.isGod ) {
                                    // TBD - add bookkeeping
                                    outputText("You " + firstWord + " " + command);
                                } else {
                                    outputText(command + " is " + thingType + ".");
                                }
                            }
                        } else if (existingItem != "?") {
                            dontSee(command,game.pov.location,origCommand);
                        }
                    }
                } else if (isDirection(lCase)) {
                    lCase = isDirection(lCase).primary;
                    if (game.getLocation(game.pov.location)) {
                        var nextLoc = game.getLocation(game.pov.location)[lCase];
                        if (!nextLoc) {
                            if( game.pov.isGod ) {
                                if (!game.map) {
                                    game.map = game.createMap();
                                } else if (game.map.location.room != game.pov.location) {
                                    game.recalcLocation(game.map, game.pov.location);
                                }
                                var level = game.map.location.level;
                                var row = game.map.location.row;
                                var col = game.map.location.col;

                                if( game.pov.location && lastNonVoid ) {
                                    if( game.getLocation(game.pov.location).type == "void" ) {
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
                                        game.getLocation(lastNonVoidPendingVoid)[reverseDirection(lastNonVoidDirection)].direction = -lastNonVoidDelta;
                                        game.map = null;
                                        describeLocation();
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
                                    if (0 <= level && level < game.map.levels.length
                                        && 0 <= row && row < game.map.levels[level].length
                                        && 0 <= col && col < game.map.levels[level][row].length
                                    ) {
                                        posCell = game.map.levels[level][row][col];
                                    }
                                    if( game.pov.location ) {
                                        if( game.getLocation(game.pov.location).type != "void" ) {
                                            lastNonVoid = game.pov.location;
                                            lastNonVoidDirection = lCase;
                                            lastNonVoidDelta = 0;
                                            lastNonVoidPendingVoid = null;
                                        }
                                    }
                                    if (posCell) {
                                        if( game.getLocation(game.pov.location).type == "void" && game.getLocation(posCell).type != "void" ) {
                                            // clean up all the voids
                                            clearVoid();
                                        }
                                        lastLocation = game.pov.location
                                        lastDirection = lCase;
                                        game.pov.location = posCell;
                                        describeLocation();
                                    } else {
                                        lastLocation = game.pov.location;                                    
                                        var voidCounter = 1;
                                        while( game.getLocation("void"+voidCounter) ) {
                                            voidCounter = voidCounter + 1;
                                        }
                                        game.pov.location = "void"+voidCounter;
                                        // Single link void back to cell
                                        game.setLocation(game.pov.location,{ name : "void" , type : "void" , description : "void" });
                                        if( lastLocation && game.getLocation(lastLocation).type == "void" ) {
                                            game.getLocation(game.pov.location)[reverseDirection(lCase)] = { location: lastLocation , "wall" : "none" };
                                        } else {
                                            game.getLocation(game.pov.location)[reverseDirection(lCase)] = { location: lastLocation };
                                        }
                                        lastDirection = lCase;
                                        if( !lastNonVoidPendingVoid ) {
                                            lastNonVoidPendingVoid = game.pov.location;
                                        }
                                        game.map = null;
                                        describeLocation();
                                    }
                                }
                            } else {
                                outputText("You cannot go that way.");
                            }
                        } else {
                            var isBlocked = false;
                            if( nextLoc.door ) {
                                var objState = game.getObjectState(nextLoc.door);
                                if( objState ) {
                                    if( objState.access == "closed" ) {
                                        isBlocked = true;
                                    }
                                }
                            }
                            if( isBlocked && !game.pov.isGod ) {
                                outputText("The door is closed!");
                            } else {
                                if( game.pov.location ) {
                                    if( game.getLocation(game.pov.location).type == "void" && game.getLocation(nextLoc.location).type != "void" ) {
                                        // clean up all the voids
                                        clearVoid();
                                    } else if( nextLoc.teleport ) {
                                        game.map = null;
                                    }
                                }
                                if( lCase == "o" || lCase == "i" ) {
                                    game.map = null;
                                }
                                lastLocation = game.pov.location;
                                lastDirection = lCase;
                                game.pov.location = nextLoc.location;
                                describeLocation();
                            }
                        }
                    } else {
                        describeLocation(false);
                    }
                /*} else if (firstWord == "!makedoor" && game.pov.isGod ) {
                    command = subSentence( command , 1);
                    if( isDirection(command) ) {
                        lCase = isDirection(command).primary;
                    } else {
                        lCase = "lastdirection";
                    }
                    if (game.getLocation(game.pov.location)) {
                        var nextLoc = game.getLocation(game.pov.location)[lCase];
                        if (nextLoc) {
                            lastDirection = lCase;
                            lastLocation = game.pov.location;
                            game.pov.location = nextLoc.location;
                            stateMachine = stateMachineFillinCreate({},[
                                {msg:"Door name:",prop:"name"}
                            ],function(sm) {
                                if( sm.data.name  && sm.data.name.length > 1  ) {
                                    var name = extractNounAndAdj(sm.data.name);
                                    name = game.getUniqueItemName(name,"door",game.util.calcCommonPrefix(game.pov.location,lastLocation));
                                    game.setDoor(name,{ name: sm.data.name , type : "door" });
                                    game.getLocation(lastLocation)[lastDirection].door = name;
                                    game.getLocation(game.pov.location)[reverseDirection(lastDirection)].door = name;
                                    game.pov.location = lastLocation;
                                    game.map = null;
                                    describeLocation();
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
                                        var lastLocDir = null;
                                        var curLocDir = null;
                                        name = game.getUniqueItemName(name,"door",game.util.calcCommonPrefix(game.pov.location,lastLocation));
                                        game.setDoor(name,{ name: sm.data.name , type : "door"});
                                        lastLocDir = game.getLocation(lastLocation)[lastDirection];
                                        curLocDir = game.getLocation(game.pov.location)[reverseDirection(lastDirection)]
                                        if( !lastLocDir
                                         && !curLocDir 
                                          ) {
                                            game.getLocation(lastLocation)[lastDirection] = { location : game.pov.location , door : name };
                                            game.getLocation(game.pov.location)[reverseDirection(lastDirection)] = { location : lastLocation , door : name};
                                        } else if( lastLocDir && curLocDir ) {
                                            lastLocDir.door = name;
                                            curLocDir.door = name;
                                        } else {
                                            outputText("Locations are not paired from "+lastDirection);
                                        }
                                        game.map = null;
                                        describeLocation();
                                    }
                                });
                            } else {
                                outputText("There is no ending location. lastLocation="+lastLocation+" lastDirection="+lastDirection+ " game.pov.location="+game.pov.location);
                            }
                        } else {
                            outputText("There is no opening to the "+lCase);
                        }
                    } else {
                        outputText("There is no starting location.");
                    }
                } else if ( (firstWord == "!makepath" || firstWord == "!makepassage" || firstWord == "!makestairs") && game.pov.isGod ) {
                    if( lastLocation ) {
                        var dirCType = firstWord.substring(5);
                        if( game.getLocation(lastLocation)[lastDirection] ) {
                            game.getLocation(lastLocation)[lastDirection].type = dirCType;
                            game.getLocation(game.pov.location)[reverseDirection(lastDirection)].type = dirCType;
                        } else if( !game.getLocation(game.pov.location)[reverseDirection(lastDirection)] ) {
                            game.getLocation(lastLocation)[lastDirection] = { location : game.pov.location , type : dirCType};
                            game.getLocation(game.pov.location)[reverseDirection(lastDirection)] = {location : lastLocation , type : dirCType};
                        }
                    } else {
                        outputText("There is no starting location.");
                    }*/
                } else if (lCase == "location outside" || lCase == "is outside") {                    
                    setLocationType("outside");
                } else if (lCase == "location ship" || lCase == "is ship") {
                    setLocationType("ship");
                } else if (lCase == "location dark" || lCase == "is dark") {
                    setLocationType("dark");
                } else if (lCase == "location bottomless" || lCase == "is bottomless" ) {
                    setLocationType("bottomless");
                } else if (lCase == "location inside" || lCase == "is inside" ) {
                    if( game.pov.isGod && game.pov.location ) {
                        delete game.getLocation(game.pov.location).type;
                    } else {
                        setLocationType("inside");
                    }
                } else if (lCase == "location") {
                    if (game.pov.location) {
                        if (game.getLocation(game.pov.location).type) {
                            outputText("Location is " + game.getLocation(game.pov.location).type + ".");
                        } else {
                            outputText("Location is inside.");
                        }
                    } else {
                        outputText("You are nowhere.");
                    }

                } else if( firstWord == "then") {
                    // linear script
                    if (game.pov.isGod ) {
                        if( verbCommand.action ) {
                            command = subSentence( command , 1);
                            if( command.length > 0 ) {
                                var _npc = findNPC(verbCommand.npc);
                                // TBD - also look for game.items (for verbs like push/pull etc)...
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
                            outputText("then requires a prior action");    
                        }
                    } else {
                        outputText("then what?");
                    }
                } else if( firstWord == "or" ) {
                    // alt script
                    if (game.pov.isGod ) {
                        if( verbCommand.action ) {
                            command = subSentence( command , 1);
                            if( command.length > 0 ) {
                                var _npc = findNPC(verbCommand.npc);
                                // TBD - also look for game.items (for verbs like push/pull etc)...
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
                        outputText("or not.");
                    }
                } else if( firstWord == "score") {
                    // linear script
                    command = subSentence( command , 1);
                    if( command.length > 0 ) {
                        if (game.pov.isGod ) {
                            var value = Number.parseInt(command);
                            if( value > 0 ) {
                                var ptr = getConvoObjectPtr();
                                if( ptr ) {
                                    ptr.score = value; 
                                } else {
                                    outputText("Must have run a conversation to set an associated score");
                                }
                            }
                        } else {
                            outputText("Must be in game.god mode to set score");
                        }
                    } else {
                        if( game.state.Score ) {
                            outputText("Score: "+game.state.Score);
                        } else {
                            outputText("Score: 0");
                        }
                    }
                } else if ( firstWord == "acquire" && game.pov.isGod ) {
                    // Be given an item
                    command = subSentence( command , 1);
                    var existingItem = lookupItem(game.pov.location,command);
                    if (existingItem && existingItem != "?") {
                        var ptr = getConvoObjectPtr();
                        if( ptr ) {
                            ptr.give = existingItem; 
                        } else {
                            outputText("Must have run a conversation to acquire an item");
                        }                
                    } else if( existingItem != "?" ) {
                        outputText(command+" does not exist");
                    } else {
                        outputText("????");
                    }                
                } else if ( 
                    firstWord == "!sit" 
                 || firstWord == "!lie" 
                 || firstWord == "!stand"
                 || firstWord == "!goin" 
                ) {
                    firstWord = firstWord.substring(1);
                    command = subSentence( command , 1);
                    verbCommand.preposition  = wordMap.posturePrep[command.split(" ")[0]];
                    if( verbCommand.preposition  ) {
                        command = subSentence( command , 1);
                    }
                    if( command.length ) {
                        var existingItem = lookupItem(game.pov.location,command);
                        if (existingItem && existingItem != "?") {
                            var ip =game.getItem(existingItem);
                            if( firstWord == "goin"  ) {
                                // Item portals to nested location..
                                if( ip.location ) {
                                    // go to object
                                    if( game.getLocation(ip.location) ) {
                                        game.pov.location = ip.location;
                                        game.map = null;
                                        describeLocation();
                                    }
                                } else if( game.pov.isGod ) {
                                    // Make a top level object... 
                                    if( game.pov.location )  {
                                        pendingGoInsideItem = existingItem;                                        
                                        pendingItemOut = game.pov.location; 
                                        game.pov.location = null;
                                        game.map = null;
                                        describeLocation();
                                    }
                                }
                            } else if( allowPosture(ip,firstWord) ) {
                                outputText("You "+firstWord + " on " + ip.name + ".");
                            } else if( game.pov.isGod ) {
                                if( !ip.postures ) {
                                    ip.postures = [];
                                }
                                ip.postures.push(firstWord);
                                outputText("You can now "+firstWord + " on " + ip.name + ".");
                            } else {
                                outputText("You cannot "+firstWord + " on " + ip.name + ".");
                            }
                        } else if (existingItem != "?") {
                            dontSee(command,game.pov.location,origCommand);
                        }
                    }
                } else if ( game.pov.isGod && firstWord == "!dump") {
                    command = subSentence( command , 1).toLowerCase();
                    if( game.pov.isGod ) {
                        if( command && command.length )
                        {
                            var list = game.findLocations(command);
                            for( var i = 0 ; i < list.length ; ++i ) {
                                outputText(chalk.bold(list[i]));
                                console.dir(game.getLocation(list[i]),{ depth : 6 , colors : true});                                
                            }
                            list = findItems(command);
                            for( var i = 0 ; i < list.length ; ++i ) {
                                outputText(chalk.bold(list[i]));
                                console.dir(game.getItem(list[i]), { depth : 6 , colors : true});
                            }
                            list = findNPCs(command);
                            for( var i = 0 ; i < list.length ; ++i ) {
                                outputText(chalk.bold(list[i]));
                                console.dir(game.getNpc(list[i]), { depth : 6 , colors : true});
                            }
                        }
                        else
                        {
                            console.dir(game.metadata, { depth : 6 , colors : true} );
                            console.dir(game.locations, { depth : 6 , colors : true} );
                            console.dir(game.npc, { depth : 6 , colors : true} );
                            console.dir(game.items, { depth : 6 , colors : true} );
                        }
                    }
                } else if ( game.pov.isGod && firstWord == "nocare") {
                    // test 'I don't care for a room
                    if( game.pov.location ) {
                        outputText(noCareAbout(game.pov.location));
                    }
                } else if (firstWord == "map") {
                    if( game.pov.isGod ) {
                        command = subSentence( command , 1).toLowerCase();
                        if( command == "show" )
                        {
                            if( !renderMap ) {
                                if (!game.map) {
                                    game.map = game.createMap();
                                } else if (game.pov.location && game.map.location.room != game.pov.location) {
                                    game.recalcLocation(game.map, game.pov.location);
                                }
                                renderMap =  game.renderMapLevelText(game.map);
                                describeLocation(false);
                            }
                        }
                        else if( command == "small" )
                        {
                            if( game.mapScale != "small" ) {
                                game.mapScale = "small" ;
                                renderMap =  game.renderMapLevelText(game.map);
                                describeLocation(false);
                            }
                        } else if( command == "normal" ) {
                            if( game.mapScale == "small" ) {
                                game.mapScale = null;
                                renderMap =  game.renderMapLevelText(game.map);
                                describeLocation(false);
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
                        outputText("You don't have a map");
                    }
                } else if ( firstWord == "b" ) {
                    if( game.pov.isGod ) {
                        if( lastNonVoid && game.pov.location ) {
                            if( game.getLocation(game.pov.location).type == "void" ) {
                                clearVoid();
                                game.pov.location = lastNonVoid;
                                describeLocation();
                            }
                        }
                    }
                } else if (firstWord == "pov") {
                    command = subSentence( command , 1);
                    if( command && command.length ) {
                        if( command == game.god.name ) {
                            if( game.allowGodMode ) {
                                if( godGame ) {
                                    game = godGame;
                                }
                                game.pov = game.god;
                            } else {
                                outputText("God mode not available.")
                            }
                        } else if( command == game.actor.name ) {
                            if( game.pov.isGod ) {
                                if( godGame ) {
                                    // Work from a copy
                                    game = new Game(settings);
                                    game.cloneFrom(godGame);
                                } else {
                                    game.state = {};
                                }
                            }
                            game.pov = game.actor;
                        }
                    } else {
                        outputText("You are "+game.pov.name);
                    }
                } else if (lCase == "save") {
                    game.saveFile();
                } else if (  '0' < firstWord[0] && firstWord[0] <= '9' && game.pov.isGod ) {
                    var index = Number.parseInt(firstWord);
                    if( index > annotations.length || index < 1 ) {
                        outputText("No footnote "+index+" defined");
                    } else {
                        doAnnotation(annotations[index-1]);
                    }
                } else if (firstWord == "help") {
                    if (lCase.split(" ").length > 1) {
                        lCase = lCase.split(" ")[1];
                        if( helpText.subtopic[lCase]) {
                            outputText(helpText.subtopic[lCase].help.join("\n"));                            
                        } else {
                            outputText("Unrecognized help category '"+lCase+"'\n"+helpText.help.join("\n"));
                        }
                    } else {
                        outputText(helpText.help.join("\n"));
                    }
                } else {
                    var verb = lCase.split(" ")[0];
                    if ( isVerb(verb) ) {
                        // TBD register actions (and consequences)
                        verbCommand.action = verb;
                        verbCommand.npc = null;
                        verbCommand.topic = null;    
                        verbCommand.preposition  = null;
                        command = command.split(" ");
                        command[0] = "";
                        command = command.join(" ").trim();
                        if( !processScript() ) {
                            if (game.pov.isGod ) {
                                defineScript();
                            } else {
                                noUnderstand();
                            }
                        }
                    } else {
                        outputText("Command not handled");
                    }
                }
            }
        }
        return true;
    };
    //---------------------------------------------------------------------------
    // Load a Game from JSON
    var loadGame = function (onComplete) {
        game.loadGame(function(err, loaded) {
            if( !loaded ) {
                game.god.location = "void1";
                game.pov = game.god;
                game.setLocation(game.god.location,{ "type" : "void" , "name" : "void" , "description" : "void" });
                game.map = game.createMap();
                renderMap =  game.renderMapLevelText();
            } else {
                if( settings.action == "play") {
                    game.pov = game.actor;
                    game.allowGodMode = false;
                } else if( game.allowGodMode ) {
                    renderMap =  game.renderMapLevelText();
                    describeLocation(false);
                    godGame = game;
                }                
            }
            onComplete(err,loaded);
         } );
    };
    var exportTads = function (folder) {
        var generate = require("./generate-tads");
        generate({ folder : folder , settings : settings , metadata : game.metadata, game : game , actor : game.actor, getLocation : function(name) { return game.getLocation(name); } , locations : game.locations , items : game.items , npc : game.npc });
    }
    return {
        describe: describeLocation,
        parseCommand: parseCommand,
        loadGame: loadGame,
        exportTads: exportTads
    };
};

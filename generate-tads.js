const path = require("path");

//---------------------------------------------------------------------------
// Generate a TADs source file....
module.exports = function(args) {
    var folder = args.folder;
    var settings = args.settings;
    var metadata = args.metadata;
    var actor = args.actor;
    var getLocation = args.getLocation;
    var locations = args.locations;
    var doors = args.doors;
    var items = args.items;
    var npc = args.npc;
    var topics = args.topics;
    var reservedNames = require("./reserved.json");
    var helper = require("./helper.js")();
    var getPartsOfSpeech = helper.getPartsOfSpeech;
    var directionTags = helper.directionTags();

    var generateTads = function (tadsSrc) {
        var main = path.parse(settings.filename).name + ".t";
        var roomDObj;
        var srcLines = [
            '#charset "us-ascii"',
            '#include <adv3.h>',
            '#include <en_us.h>',
            'versionInfo: GameID',
            "\tname = '" + metadata.title + "'",
            "\tbyLine = 'by " + metadata.author + "'",
            "\tauthorEmail = '" + metadata.author + " <" + metadata.authorEmail + ">'",
            "\tversion = '" + (metadata.version || "1") + "'",
            ";"
            , ""
            , "gameMain: GameMainDef"
            , "\tinitialPlayerChar = "+actor.name
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
        var emitCharacter = function (_actor) {
            var roomDObj = _actor.location;
            if (reservedNames[roomDObj]) {
                roomDObj = reservedNames[roomDObj];
            }
            var actorType = "Person";            
            if( _actor.name == actor.name ) {
                actorType = "Actor";
            }
            var _lines = [ _actor.name + ": "+actorType ];
            if( _actor.description ) {
                _lines.push('\t"'+_actor.description+'"');
            }
            _lines.push("\tlocation = " + roomDObj +"\n;\n");
            if( _actor.inventory ) {
                for (var i = 0; i < _actor.inventory.length; ++i) {
                    itemEmitted[_actor.inventory[i].item] = true;
                    _lines.push(emitItem(_actor.inventory[i].item, 1, _actor.inventory[i]));
                }
            }
            if( _actor.conversation ) {
                var emitOneReponse = function(vc,topicType) {
                    var topicResponse = null;
                    if( vc.response ) {
                        if( typeof(vc.response) == "string" ) {
                            topicResponse = '\ttopicResponse = "'+vc.response+'"';
                        } else if( vc.response.then ) {
                            topicType = topicType + ", StopEventList"
                            topicResponse = '\ttopicResponse = [';
                            for( var i = 0 ; i < vc.response.then.length ; ++i ) {
                                if( i > 0 )
                                    topicResponse = topicResponse + ",";
                                if( typeof(vc.response.then[i]) == "string" ) {
                                    topicResponse = topicResponse +  "\n\t'"+vc.response.then[i]+"'";
                                } else if( vc.response.then[i].say ) {
                                    topicResponse = topicResponse +  '\n\tnew function\n\t{\n\t\t"'+vc.response.then[i].say+'";\n';
                                    if( vc.response.then[i].score ) {
                                        topicResponse = topicResponse +  '\t\tachievement.addToScoreOnce('+vc.response.then[i].score+');\n'
                                    }
                                    topicResponse = topicResponse +  '\t}';
                                }
                            }
                            topicResponse = topicResponse + '\n\t]';
                        } else if( vc.response.or) {
                        } else if( vc.response.say) {
                            topicResponse = '\ttopicResponse() {\n\t\t"'+tc.response.say+'"';
                            if( vc.response.give ) {
                                topicResponse = topicResponse + '\n\t\t'+vc.response.give+'.moveInto(me);\n'
                            }
                            if( vc.response.take ) {
                                topicResponse = topicResponse + '\n\t\t'+vc.response.take+'.moveInto('+_actor.name+');\n'
                            }
                            if( vc.response.score ) {
                                topicResponse = topicResponse + '\t\tachievement.addToScoreOnce('+vc.response.then[i].score+');\n'
                            }
                            topicResponse = topicResponse + '\n\t}';
                        }
                    }
                    return { topicResponse : topicResponse , topicType : topicType };
                };
                for( var  verb in _actor.conversation  ) {
                    var vc = _actor.conversation[verb];
                    if( verb == "talkto" ) {
                        var tc = vc;
                        var topicType = "HelloTopic";
                        var tr = emitOneReponse(vc,topicType);
                        if( tr.topicResponse ) {
                            _lines.push("+"+tr.topicType);
                            _lines.push(tr.topicResponse);
                            _lines.push("\t;\n");
                        }
                    } else {
                        for( var  topic in vc  ) {
                            var topicType = "AskTopic";
                            var tc = vc[topic];
                            if( verb == "tell" ) {
                                topicType = "TellTopic";
                            } else if( verb == "give" ) {
                                topicType = "GiveTopic";
                            } else if( verb == "show" ) {
                                topicType = "ShowTopic";
                            } else {
                                if( tc.proposition == "for" ) {
                                    topicType = "AskForTopic";
                                }
                            }
                            var tr = emitOneReponse(tc,topicType);                            
                            _lines.push("+"+tr.topicType);
                            var match = topic;                    
                            _lines.push("\tmatchObject = "+match);
                            if( tr.topicResponse ) {
                                _lines.push(tr.topicResponse);
                            }
                            _lines.push("\t;\n");
                        }
                    }
                }
            }
            return _lines.join("\n");
        };
        srcLines.push(emitCharacter(actor));
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
                        var wayBack = getLocation(dir.location);
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
            return dir.location.split(".").join("");
        };
        var  emitRooms = function( _locations , prefix) {
            for (loc in _locations) {
                var room = _locations[loc];
                if( room.locations ) {
                    emitRooms(room.locations,prefix+loc);
                    if(!room.description ) {
                        continue;
                    }
                }
                var roomDObj = prefix+loc;
                if (reservedNames[roomDObj]) {
                    roomDObj = reservedNames[roomDObj];
                }
                if (room.type == "outside") {
                    srcLines.push(roomDObj + ": OutdoorRoom");
                } else if (room.type == "dark") {
                    srcLines.push(roomDObj + ": DarkRoom");
                } else if (room.type == "ship") {
                    srcLines.push(roomDObj + ": ShipboardRoom");
                } else if (room.type == "bottomless") {
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
        }
        emitRooms(locations,"");
        for( var npcName in npc) {
            srcLines.push(emitCharacter(npc[npcName]));
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
    var tadsSrc = {};
    if (generateTads(tadsSrc)) {
        var fs = require("fs");
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
};

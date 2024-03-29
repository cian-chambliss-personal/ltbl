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
    var informDirectionToProp = {
        "east" : "e",
        "west" : "w",
        "north" : "n",
        "south" : "s",
        "southwest" : "sw",
        "southeast" : "se",
        "northwest" : "nw",
        "northeast" : "ne",
        "up" : "u",
        "down" : "d"
    };
    var hasDirectionInName = function(name) {
        var wrds = name.toLowerCase().split(" ");
        for( var i = 0 ; i < wrds.length ; ++i ) {
            if( informDirectionToProp[wrds[i]] )
                 return true;
        }
        return false;
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
        var implicitlyNamedRoom = {};
        var directionHandled = {};
        var itemNamesUsed = {};
        var npcLoc = {};
        var featuresUsed= {};

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
        var responseItems = { items : "" , places : ""};

        var emitItems = function(contains,itemLocation,collect) {
            var items = "";
            var places =  "";
            for( var i = 0 ; i < contains.length ; ++i ) {
                var ip = game.getItem(contains[i].item);
                var iName = ip.name || ip.description;
                if( itemNamesUsed[iName] ) {
                    ; // TBD -  lets make the name more specific
                    continue;
                } else {
                    itemNamesUsed[iName] = contains[i].item;
                }
                if( ip.supports ) {
                    collect.items += "The " +ip.name+" is a supporter.\n";
                    var subCollect = { items : "" , places : "" };
                    emitItems(ip.supports," is on the "+ip.name,subCollect);
                    collect.items += subCollect.items + subCollect.places;
                } else {
                    if( ip.type == "food" )
                       collect.items += "The " +ip.name+" is edible.\n";
                    else
                        collect.items += "The " +ip.name+" is a thing.\n";
                    if( ip.type == "wearable" )
                        collect.items += "It is wearable.\n"; 
                }
                if( ip.content ) {
                    featuresUsed["reading"] = true;
                    collect.items += 'The reading-material of the '+ip.name+' is "'+ip.content+'".\n';
                }
                if( itemLocation.indexOf(" carries ") > 0 ) {
                    collect.places += itemLocation + " the "+ip.name+".\n";
                } else {
                    collect.places += "The " +ip.name+itemLocation+"\n";
                }
            }
        };
        
        var emitOneReponse = function(ruleGeneral,vc) {
            var topicResponse = null;
            var firstTime = null;
            var emitExtras = function(vr) {
                var topicResponse = '\tsay "'+vr.say+'"';
                if( vr.give ) {
                    emitItems([{item:vr.give}],"",responseItems);
                    topicResponse = topicResponse + ';\n\tnow the player carries the '+game.getItem(vr.give).name;
                }
                if( vr.take ) {
                    topicResponse = topicResponse + ';\n\tremove the '+game.getItem(vr.take).name+' from play';
                }
                if( vr.score ) {
                    firstTime = "\tincrease the score by "+vr.score+";\n";
                }
                return topicResponse+".\n";

            };
            if( vc.response ) {
                if( typeof(vc.response) == "string" ) {
                    topicResponse = '\tsay "'+vc.response+'".\n';
                } else if( vc.response.then ) {
                    topicResponse = '\tsay "[one of]';
                    for( var i = 0 ; i < vc.response.then.length ; ++i ) {
                        if( i > 0 )
                            topicResponse = topicResponse + "[or]";
                        if( typeof(vc.response.then[i]) == "string" ) {
                            topicResponse = topicResponse +  vc.response.then[i];
                        } else if( vc.response.then[i].say ) {
                            topicResponse = topicResponse + vc.response.then[i].say;
                        }
                    }
                    topicResponse = topicResponse + '[stopping]".\n';   
                } else if( vc.response.or ) {
                    topicResponse = '\tsay "[one of]';
                    for( var i = 0 ; i < vc.response.or.length ; ++i ) {
                        if( i > 0 )
                            topicResponse = topicResponse + "[or]";
                        if( typeof(vc.response.or[i]) == "string" ) {
                            topicResponse = topicResponse + vc.response.or[i];
                        } else if( vc.response.or[i].say ) {
                            topicResponse = topicResponse + vc.response.or[i].say;
                        }
                    }
                    topicResponse = topicResponse + '[at random]".\n';                            
                } else if( vc.response.say ) {
                    topicResponse = emitExtras(vc.response);
                }
            }
            if( firstTime ) {
                return  ruleGeneral +' for the first time:\n'+firstTime + "\tcontinue the action.\n\n"+ruleGeneral +':\n'+ topicResponse;
            }
            return ruleGeneral +':\n'+ topicResponse + "\n";
        };

        var emitPlayer = function(player) {
            if( player.inventory ) {
                var carry = { items : "" , places : "" };
                emitItems(player.inventory,"The player carries ",carry);
                src += carry.items + carry.places;
            }
        };


        var emitCharacter = function(npc) {
            if( npc.gender ) {
                src += npc.name+" is a "+npc.gender+" person.\n";
            } else {
                src += npc.name+" is a person.\n";
            }
            if( npc.description ) {
                src += "The description of "+npc.name+' is "'+npc.description+'".\n';
            }
            if( !npcLoc[npc.location] ) {
                npcLoc[npc.location] = [npc];
            } else {
                npcLoc[npc.location].push(npc);
            }
            if( npc.inventory ) {
                var carry = { items : "" , places : "" };
                emitItems(npc.inventory,npc.name+" carries ",carry);
                src += carry.items + carry.places;
            }
            if(  npc.conversation ) {
                for( var  verb in npc.conversation  ) {
                    var vc = npc.conversation[verb];
                    if( verb == "talkto" ) {
                        featuresUsed["talking"] = true;
                        src += emitOneReponse("Instead of talking to "+npc.name,vc);
                    } else {
                        for( var  topic in vc  ) {
                            if( verb == "give" ) {
                                src += emitOneReponse("Instead of giving the "+topic+" to "+npc.name,vc[topic]);
                            } else if( verb == "ask" ) {
                                src += emitOneReponse("Instead of asking "+npc.name+' about "'+topic+'"',vc[topic]);
                            }
                        }
                    }
                }
            }
        };

        emitPlayer(game.actor);

        for( var npcName in game.npc) {
            emitCharacter(game.getNpc(npcName));
        }
        if( responseItems.items != "" ) {
            src = responseItems.items + src;
        }
        if( featuresUsed["talking"] ) {
            src = `Talking to is an action applying to one visible thing. Understand "talk to [someone]" or “converse with [someone]” as talking to.\nCheck talking to: say "[The noun] doesn't reply."\n\n` + src;
        }


        if( startLoc ) {
            var goDirection = function(room,loc,direction,pass) {
                var goes = room[direction];
                if( goes ) {
                    if( pass == 1 ) {
                        emitRoom(goes.location);
                    } else if( !directionHandled[direction+":"+loc] ) {
                        var revDir = game.util.reverseDirection(direction);
                        directionHandled[revDir+":"+goes.location] = true;
                        if( hasDirectionInName(roomIdToInform[goes.location]) ) {
                            implicitlyNamedRoom[roomIdToInform[goes.location]] = true;
                            src += informDirection[direction]+" of the "+roomIdToInform[loc]+  " is a room called "+roomIdToInform[goes.location]+".\n";
                        } else {
                            src += "The "+roomIdToInform[loc]+" is "+informDirection[revDir]+" of the "+roomIdToInform[goes.location]+".\n";
                        }
                    }
                }
            };
            
            var emitRoom = function(id) {
                if( !generatedRoom[id] ) {
                    generatedRoom[id] = true;
                    var room = game.getLocation(id);
                    var itemLocation = null;
                    var roomSrc = "";
                    if( !implicitlyNamedRoom[roomIdToInform[id]] ) {
                        roomSrc += "\nThe "+roomIdToInform[id]+" is a room.\n";
                        if( room.name && room.name != roomIdToInform[id] ) {
                            roomSrc += 'The printed name is '+quoted(room.name)+"\n"; 
                        }
                        if( room.name && room.description && room.name != room.description ) {
                            roomSrc += 'The description is '+quoted(room.description)+".\n";
                        }
                        itemLocation = " is here.";
                    } else {
                        if( room.name && room.name != roomIdToInform[id] ) {
                            roomSrc += 'The printed name of '+roomIdToInform[id]+' is '+quoted(room.name)+"\n"; 
                        }
                        if( room.name && room.description && room.name != room.description ) {
                            roomSrc += 'The description of '+roomIdToInform[id]+' is '+quoted(room.description)+"\n";
                        }
                        itemLocation = " is in the "+roomIdToInform[id]+".";
                    }
                    var itemCollect = { items : "" , places : ""}
                    if( room.contains ) {
                        emitItems(room.contains,itemLocation,itemCollect);
                    }
                    var persons = "";
                    var personList = npcLoc[id];
                    if( personList ) {
                        for( var i = 0 ; i < personList.length ; ++i ) {
                            var person = personList[i];
                            persons += person.name + " is here."
                        }
                    }
                    src += itemCollect.items + roomSrc + persons + itemCollect.places + "\n";
                    for(var pass = 0 ; pass < 2 ; ++pass ) {
                        for( var dir in informDirection ) {
                            goDirection(room,id,dir,pass);
                        }
                    }
                    src += "\n";
                }
            }
            emitRoom(startLoc);
            if( featuresUsed["reading"] ) {
                src = 'A thing has some text called the reading-material. The reading-material of a thing is usually "".\n\nUnderstand the command "read" as something new.\nReading is an action applying to one thing and requiring light. Understand "read [something]" as reading.\nCheck reading:\n\tif the reading-material of the noun is "":\n\t\tsay "Nothing is printed on [the noun].” instead.\nCarry out reading:\n\tsay "[reading-material of the noun]."\n'+src;
            }    
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

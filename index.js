const { doesNotReject } = require("assert");
const { findSourceMap } = require("module");
const path = require("path");

module.exports =  function ltbl(settings)  {
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
    var metadata = {
        title : null ,
        author : null ,
        authorEmail : null ,
        description: null ,
        version: "1",
        IFID: null
    };
    var locations = {
    };
    var doors = {
    };
    var items = {
    };
    var npc = {        
    };    

    var extractNounAndAdj = function(command) {
        var words = command.toLowerCase().split(" ");
        var altNoun = null;
        var adj = "";
        var adjLoc = -1;
        for( var i = 0 ; i < words.length ; ++i ) {
            var pos = partOfSp[words[i]];
            if( pos ) {
                if( i > 0 && words[i] == "room" )
                {
                    if( (i-1) > adjLoc )
                    {
                        if( adj != "" ) {
                            adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                        } else {
                            adj =  words[i];
                        }
                    }
                }
                if( (pos & 8) != 0 ) {
                    if( adj != "" ) {
                        adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                    } else {
                        adj =  words[i];
                    }
                    if( pos & 1 ) {
                        altNoun = adj;
                    }
                    adjLoc = i;
                } else if( (pos & 1) != 0 ) {
                    if( adj.length > 0 ) {
                        if( adj != "" ) {
                            adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                        } else {
                            adj =  words[i];
                        }
                        return adj;    
                    }
                    return words[i];
                }
            } else {
                words[i] = words[i].replace("'","")
                if( words[i].length > 1 && words[i][words[i].length-1] == 's' ) {
                    if( adj != "" ) {
                        adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                    } else {
                        adj =  words[i];
                    }
                    adjLoc = i;
                }
            }
        }
        return altNoun;
    };

    var saveFile = function() {
        var obj = { metadata : metadata , locations : locations , doors : doors , location : location , items : items , npc : npc }
        fs.writeFile(settings.filename,JSON.stringify(obj,null,"  "),function(err,data) {});
    };      

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

    var render = function (loc, depth,where ) {
        var describeNav = function(dir,name) {
            if( dir.door ) {
                if( dir.open ) {
                    console.log("To the "+name+" is open "+doors[dir.door].name);
                } else {
                    console.log("To the "+name+" is "+doors[dir.door].name);
                }
            } else {
                console.log("To the "+name+" is "+locations[dir.location].name+".");
            }
        };
        if( loc.description ) {
            console.log(loc.description);
        } else if( loc.name ) {
            console.log(loc.name);
        }
        if (loc.contains) {
            var contains = "there is ";
            if( loc.contains.length > 1 ) {
                contains = "there are ";
            }
            for (var i = 0; i < loc.contains.length; ++i) {
                if (i) {
                    contains += " , ";
                    if( (i+1) == loc.contains.length ) {
                        contains += "and";
                    }
                }
                var iname = items[loc.contains[i].item].name
                if( "AEIOUYW".indexOf(iname[0]) )
                    contains += " a ";
                else
                    contains += " an ";
                contains += iname;
            }
            if( where ) {
                contains +=  " "+ where + ".";
            }
    
            console.log(contains);
        }
        if (loc.wall) {
            for(var dir in loc.wall ) {
                var wall = loc.wall[dir];
                render(wall,1,"along "+friendlyDir(dir)+" wall ");
            }
        }
        if( loc.e ) {
            describeNav(loc.e,"east");
        }
        if( loc.w ) {
            describeNav(loc.w,"west");
        }
        if( loc.n ) {
            describeNav(loc.n,"north");
        }
        if( loc.s ) {
            describeNav(loc.s,"south");
        }
        if( loc.u ) {
            describeNav(loc.u,"up");
        }
        if( loc.d ) {
            describeNav(loc.d,"down");
        }
        if( loc.se ) {
            describeNav(loc.se,"southeast");
        }
        if( loc.ne ) {
            describeNav(loc.ne,"northeast");
        }
        if( loc.sw ) {
            describeNav(loc.sw,"southwest");
        }
        if( loc.nw ) {
            describeNav(loc.nw,"northwest");
        }
    }

    var describe = function () {
        if( !metadata.title ) {
            console.log("What is the title of your interactive fiction?");
            mode = "gettitle";
        } else if( !metadata.description ) {
            console.log("How would you describe this interactive fiction work?");
            mode = "getdescription";
        } else if( !metadata.author ) {
            console.log("What is you name (byline)?");
            mode = "getauthor";
        } else if( !metadata.authorEmail ) {
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
    var lookupItem = function(command) {
        var itemName = null;
        if (command != "") {
            var where = locations[location];
            var what = command;            
            if( where.contains ) {
                command = command.toLowerCase();
                for( var i = 0 ; i < where.contains.length ; ++i ) {
                    var item = where.contains[i].item;
                    var  ptr = items[item];
                    if( ptr ) {
                        var lname = ptr.name;
                        if( command == lname.toLowerCase() ) {
                            itemName = item;
                            break;
                        }
                    }
                }
            }
        }
        return itemName;
    };
    var isDirection = function(command) {
        return "snewdu".indexOf(command) >= 0 || command == "ne" || command == "se" || command == "nw" || command == "sw";
    }
    var parseCommand =  function (command) {
        var lCase = command;
        if( mode == "gettitle" ) {
            metadata.title = command;
            describe();
        } else if( mode == "getdescription" ) {
            metadata.description = command;
            describe();
        } else if( mode == "getauthor" ) {
            metadata.author = command;
            describe();
        } else if( mode == "getemail" ) {
            metadata.authorEmail = command;
            describe();
            saveFile();
        } else if (lCase == 'quit' || lCase == 'exit') {
            rl.close();           
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
                    locations[location] = { description: command };
                    if (lastLocation && lastDirection) {
                        locations[lastLocation][lastDirection] = { location: location };
                        locations[location][reverseDirection(lastDirection)] = { location: lastLocation };
                    }
                    console.log("Door name (blank or 'n' for no door)");
                    mode = "door?"
                }
            } else if (mode == 'door?') {
                lCase = lCase.trim();
                if( lCase != "" && lCase != "n" && lCase != "no" ) {
                    var name = extractNounAndAdj(command);
                    if( !name || doors[name] ) {
                        name = "door"+itemNum;
                        itemNum = itemNum + 1;
                    }
                    doors[name]  = { name : command };
                    locations[lastLocation][lastDirection].door = name;
                    locations[location][reverseDirection(lastDirection)].door = name;
                }
                mode = "what";
                describe(); 
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
                        if( item ) {
                            var itemPtr = items[item];
                            if( itemPtr.description ) {
                                console.log(itemPtr.description);
                            } else {
                                mode = "describe_item";
                                console.log("How would you describe the "+item+"?")
                                describeItem = item;
                            }
                        }
                    } else {
                        console.log("what do you want to examine?");
                    }
                } else if (lCase == "x") {
                    var where = locations[location];
                    if( where.description ) {
                        console.log(where.description);
                    } else {
                        mode = "describe_location";
                        console.log("How would you describe the "+where.name+"?")
                    }
                } else if (lCase.substring(0, 5) == "drop " || lCase.substring(0, 4) == "put " ) {
                    command = command.substring(4).trim();
                    if (command != "") {
                        var where = locations[location];
                        var what = command;
                        if (!where.contains) {
                            where.contains = [];
                        }
                        var name = extractNounAndAdj(what);
                        if( !name ) {
                            name = "item"+itemNum;
                            itemNum = itemNum + 1;
                        }
                        if( !items[name] ) {
                            items[name] = { name : command };
                        }
                        where.contains.push({ item: name });
                    }
                } else if (lCase.substring(0, 5) == "read ") {
                    command = command.substring(5).trim();
                    if (command != "") {
                        var item = lookupItem(command);
                        if( item ) {
                            if( items[item].content ) {
                                console.log(items[item].content);
                            } else {
                                describeItem = item;
                                console.log("What do you see written in "+items[item].name+"?");
                                mode = "write";
                            }
                        } else {
                            console.log("You see no "+command);
                        }                        
                    }
                } else if (lCase.substring(0, 5) == "take ") {
                    command = command.substring(5).trim();
                    if (command != "") {
                        var item = lookupItem(command);
                        if( item ) {
                            for( var i = 0 ; i < where.contains.length ; ++i ) {
                                if( where.contains[i].item == item ) {
                                    where.contains.splice(i, 1);
                                    if(where.contains.length == 0  ) {
                                        delete where.contains;                            
                                    }
                                    break;
                                }
                            }
                        } else {
                            console.log("You see no "+command);
                        }
                    }
                } else if ( isDirection(lCase) ) {
                    if (locations[location]) {
                        var nextLoc = locations[location][lCase];
                        if (!nextLoc) {
                            lastLocation = location;
                            location = null;
                            lastDirection = lCase;
                        } else {
                            location = nextLoc.location;
                        }
                    }
                    describe();
                } else if (lCase.substring(0,5) == "door " && isDirection(lCase.substring(5)) ) {
                    lCase = lCase.substring(5).trim();
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
                } else if (lCase == "dump") {
                    console.log(JSON.stringify(metadata, null, "  "));
                    console.log(JSON.stringify(locations, null, "  "));
                    console.log(JSON.stringify(items, null, "  "));
                } else if (lCase == "save") {
                    saveFile();
                } else {
                    console.log("Command not handled");
                }
            }
        }
    };
    var loadGame = function(onComplete) {
        fs.readFile(settings.filename, (err, data) => {
            if( !err ) {
              var obj = JSON.parse(data);
              metadata = obj.metadata;
              locations = obj.locations;
              items = obj.items;
              doors = obj.doors;
              npc = obj.npc;
              location = obj.location;
      
              while(locations["room"+roomNum]) {
                  roomNum = roomNum +1;
              }
              while(items["item"+itemNum]) {
                  itemNum = itemNum +1;
              }
              while(locations["door"+doorNum]) {
                doorNum = doorNum +1;
              }
              onComplete(null,true);
            } else {
              onComplete(err,false);
            }
          });          
    };
    var generateTads  = function(tadsSrc) {
        var main = path.parse(settings.filename ).name+".t";
        var srcLines = [
            '#charset "us-ascii"',
            '#include <adv3.h>',
            'versionInfo: GameID',
            "\tname = '"+metadata.title+"'",
            "\tbyLine = 'by "+metadata.author+"'",
            "\tauthorEmail = '"+metadata.author+" <"+metadata.authorEmail+">",
            "\tversion = '"+metadata.version+"'",
            ";"
            ,""
            ,"gameMain: GameMainDef"
            ,"\tinitialiPlayerChar = me"
            ,";"
            ,""
            ,"me: Actor"
            ,"\tlocation = "+location
            ,";"
            ,""
        ];
        var masterDoors = {};
        var addDoors = null;
        var tadDirection = function(dir) {
            if( dir.door ) {
                if( doors[dir.door] ) {
                    var doorPrt = doors[dir.door];
                    var doorname = "door";
                    if( doorPrt.name ) {
                        doorname = doorPrt.name;
                    }
                    var masterDoor = masterDoors[dir.door];
                    if( masterDoor ) {
                        addDoors = ["+ "+dir.door+"Other : Door '"+doorname+"*doors' '"+doorname+"'","\tmasterObject = "+dir.door,";",""].join("\n");
                        return dir.door+"Other";
                    } else {
                        masterDoors[dir.door] = true;
                        addDoors = ["+ "+dir.door+": Door '"+doorname+"*doors' '"+doorname+"'",";",""].join("\n");
                        return dir.door;
                    }
                }
            }       
            return dir.location;
        };
        for( loc in locations ) {
            var room = locations[loc];
            srcLines.push(loc+": Room");
            if( room.name ) {
                srcLines.push("\troomName = '"+room.name+"'");
            }
            if( room.description ) {
                srcLines.push('\tdesc = "'+room.description+'"');
            }
            if( room.e ) {
                srcLines.push('\teast = '+tadDirection(room.e));
            }
            if( room.w ) {
                srcLines.push('\twest = '+tadDirection(room.w));
            }
            if( room.n ) {
                srcLines.push('\tnorth = '+tadDirection(room.n));
            }
            if( room.s ) {
                srcLines.push('\tsouth = '+tadDirection(room.s));
            }
            if( room.sw ) {
                srcLines.push('\tsouthwest = '+tadDirection(room.sw));
            }
            if( room.se ) {
                srcLines.push('\tsoutheast = '+tadDirection(room.se));
            }
            if( room.nw ) {
                srcLines.push('\tnorthwest = '+tadDirection(room.nw));
            }
            if( room.ne ) {
                srcLines.push('\tnortheast = '+tadDirection(room.ne));
            }
            if( room.u ) {
                srcLines.push('\tup = '+tadDirection(room.u));
            }
            if( room.d ) {
                srcLines.push('\tdown = '+tadDirection(room.d));
            }
            srcLines.push(";");
            srcLines.push("");
            if( addDoors ) {
                srcLines.push(addDoors);
                addDoors = null;
            }
        }
        for( it in items) {
            var ip = items[it];
            srcLines.push(it+" : Thing");
            srcLines.push("\tname = '"+ip.name+"'");
            if( ip.description ) {
                srcLines.push('\tdesc = "'+ip.description+'"');
            }
            for( loc in locations ) {
                var room = locations[loc];
                if( room.contains ) {
                    for (var i = 0; i < room.contains.length; ++i) {
                        if( room.contains[i].item == it ) {
                            srcLines.push('\tlocation = '+loc);
                            break;
                        }
                    }
                }
            }
            srcLines.push(";");
            srcLines.push("");
        }
        tadsSrc[main] = srcLines.join("\n");        
        return true;
    };
    var exportTads = function(folder) {
        var tadsSrc = {};
        if( generateTads(tadsSrc) ) { 
            for(var name in tadsSrc ) {
                console.log(name+":");
                console.log(tadsSrc[name]);
            }
            fs.mkdir(folder,{},function(err,data) {
                if( err ) {
                    if( err.code != "EEXIST" ) {
                        console.log("Error exporting to tads "+err.code);
                        return;
                    }
                }
                if( folder[folder.length-1] != "/" && folder[folder.length-1] != "\\" ) {
                    if( folder.indexOf("\\") >= 0 ) {
                        folder += "\\";
                    } else {
                        folder += "/";
                    }
                }
                for(var name in tadsSrc ) {
                    fs.writeFile(folder+name,tadsSrc[name],{},function() {});
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

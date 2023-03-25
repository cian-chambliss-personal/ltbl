module.exports = function(singleton) {
    var ifGod = function(txt) {
        if( singleton.game.pov.isGod ) 
           return txt;
        return "";
    };
    var friendlyDir = function (dir) {
        var name = singleton.resources.friendlyDir[dir];
        if( name ) {
            return name;
        }
        return dir;
    }
    var __render = function (loc,locationId, depth, where) {
        var game = singleton.game;
        var chalk = singleton.chalk;
        if( !depth ) {
            game.annotations = [];
        }
        var describeNav = function (dir, name, rawDir) {
            if (dir.type == "stairs") {
                singleton.outputText("There are stairs leading " + name + "."+singleton.annotate({"type":"dir","dir":rawDir}));
            } else if (dir.type == "passage") {
                singleton.outputText("There is a passage leading " + name + "."+singleton.annotate({"type":"dir","dir":rawDir}));
            } else if (dir.type == "path") {
                singleton.outputText("There is a path leading " + name + "."+singleton.annotate({"type":"dir","dir":rawDir}));
            } else if (dir.door) {
                if (dir.open) {
                    singleton.outputText("To the " + name + " is open " + game.getDoor(dir.door).name+singleton.annotate({"type":"dir","dir":rawDir}));
                } else {
                    singleton.outputText("To the " + name + " is " + game.getDoor(dir.door).name+singleton.annotate({"type":"dir","dir":rawDir}));
                }
            } else {
                if( dir.direction ) {
                    if( dir.direction > 0 ) {
                        singleton.outputText("To the " + name + " is passage leading up."+singleton.annotate({"type":"dir","dir":rawDir}));
                    } else {
                        singleton.outputText("To the " + name + " is passage leading down."+singleton.annotate({"type":"dir","dir":rawDir}));
                    }
                } else {                
                    singleton.outputText("To the " + name + " is " + (game.getLocation(dir.location).name || game.getLocation(dir.location).description) + "."+singleton.annotate({"type":"dir","dir":rawDir}));
                }
            }
        };
        if( !loc ) {
            singleton.outputText("Null for "+locationId);
        }
        if( loc.type == "void") {
            if (loc.name) {
                singleton.outputText(chalk.bold(loc.name));
            } else if (loc.description) {
                singleton.outputText(loc.description);
            }
        } else {
            if(game.pov.isGod && !depth ) {
                if( locationId.indexOf("/") > 0 ) {
                    var topLoc = locationId.split("/")[0];
                    var topLocType = singleton.resources.topLocationTypes[game.getLocation(topLoc).type];
                    if( topLocType ) {
                        singleton.outputText(topLocType.membership+" "+game.getLocation(topLoc).name+singleton.annotate({"type":"location.topLoc","location":topLoc }));
                    }
                }
                if(loc.type)
                    singleton.outputText("Type: "+chalk.bold(loc.type)+singleton.annotate({"type":"location.type"}));
                else
                    singleton.outputText("Type: "+chalk.bold("inside")+singleton.annotate({"type":"location.type"}));
            }
            if (loc.name) { 
                singleton.outputText(ifGod("Name: ")+chalk.bold(loc.name)+singleton.annotate({"type":"location.name"}));
            } else if(game.pov.isGod && !depth ) {
                singleton.outputText("Name: "+chalk.bold("No name")+singleton.annotate({"type":"location.name"}));
            }
            if (loc.description) {
                var roomDescription = loc.description;
                if( game.pov.isGod && singleton.settings.spellCorrect ) {
                    roomDescription = singleton.spellCorrectText(roomDescription);
                } 
                singleton.outputText(ifGod("Description: ")+roomDescription+singleton.annotate({"type":"location.description"}));
            } else if(game.pov.isGod&& !depth ) {
                singleton.outputText("Description: "+chalk.bold("No description")+singleton.annotate({"type":"location.description"}));
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
                        contains += iname+singleton.annotate({"type":"item","item":_contains[i].item});
                    }
                }
                if (where) {
                    contains += " " + where + ".";
                }
                singleton.outputText(contains);
            }
        }
        if (loc.wall) {
            for (var dir in loc.wall) {
                var wall = loc.wall[dir];
                __render(wall,null, 1, "along " + friendlyDir(dir) + " wall ");
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
            var _npcs = game.getNpcsAtLocation(locationId);
            for(var _npc in _npcs) {
                var  ni = _npcs[_npc];
                singleton.outputText(ni.name+" is here."+singleton.annotate({"type":"npc","npc":_npc}));
            }
        }
    };
    return { render : __render };
};
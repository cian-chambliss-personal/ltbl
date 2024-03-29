class GameUtility {
    topRoomName(locName) {
        var location = locName.split("/");
        if( location.length > 1 ) {
            return location[0];
        }
        return null;
    }
    calcCommonPrefix(loc1,loc2) {
        if( loc1 && loc2 ) {
            loc1 = this.topRoomName(loc1);
            loc2 = this.topRoomName(loc2);            
            if( loc1 && !loc2 )
                return loc1+"/";
            if( loc2 && !loc1 )
                return loc2+"/";
            if( loc1 && loc1 == loc2 )
                return loc1+"/";
        }
        return null;
    }
    getLocationFromLCased(locations,name) {
        if( locations ) {
            for( var loc in locations ) {
                var low = loc;
                if( low.toLowerCase() == name ) {
                    return loc;
                }
            }
        }
        return null;
    }
    reverseDirection(dir) {
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
};
module.exports = class Game {
    //------------------
    constructor(_settings) {
        this.settings = _settings;
        this.defaults = {
            author: null,
            authorEmail: null
        };
        this.state = {};
        this.sourceCode = "";
        this.actor = {
            name : "me",
            inventory: [],
            location : null
        };
        this.metadata = {
            title: null,
            author: null,
            authorEmail: null,
            description: null,
            version: "1",
            IFID: null
        };
        this.god = {
            name : "god",
            isGod : true,
            inventory: [],
            location : null
        };
        this.locations = { };
        this.items = { };
        this.npc = { };
        this.types = { }
        this.actions = { };
        this.util = new GameUtility();
        this.map = null;
        this.mapScale = null;
        this.statemachine = null;
        this.pov = this.actor;
        this.allowGodMode = true;
        this.rememberCommands = true;
        this.commands = [];
        this.statusLine = null;
        this.design = {
            lastNonVoid : null,
            lastNonVoidDirection : null,
            lastNonVoidDelta : 0,
            lastNonVoidPendingVoid : null,
            roomNum : 1,
            lastLocation : null,
            lastDirection : null,
            pendingGoInsideItem : null,
            pendingItemOut : null,
            
        };
        this.verbCommand = {
            action : null,
            npc : null,
            item : null,
            preposition  :null,
            topic : null
        };
        this.annotations = [];
        this.renderMap = null;
    }
    //---------------------
    logCommand(command) {
        if( this.rememberCommands ) {
           this.commands.push(command);
        }
    }
    saveCommands() {
        if( this.commands.length ) {
            var fs = require("fs");
            var path = require("path");
            var count = 1;
            var baseName = path.dirname(this.settings.filename)+"/transcript_";
            while( fs.existsSync(baseName+count+".txt") )
                ++count;
            fs.writeFile(baseName+count+".txt",this.commands.join("\r\n"),function(err) { if(err) console.log("Error writing play file "+err); });    
            return true;
        }
        return false;
    }
    //------------------
    recalcLocation(_map, location) {
        for (var l = 0; l < _map.levels.length; ++l) {
            var rows = _map.levels[l];
            for (var r = 0; r < rows.length; ++r) {
                var cols = rows[r];
                for (var c = 0; c < cols.length; ++c) {
                    if (cols[c] == location) {
                        _map.location.room = location;
                        _map.location.level = l;
                        _map.location.row = r;
                        _map.location.col = c;
                        return true;
                    }
                }
            }
        }
        return false;
    }
    //------------------
    renderMapLevelText() {
        var render = require("./render-map-text.js");
        var _game = this;
        if( this.mapScale == "small" ) {
            return render( { map : this.map , getLocation : function(name) { return _game.getLocation(name); } , viewportHeight : 16 , viewportWidth : 40 , small : true} );
        }
        return render( { map : this.map , getLocation : function(name) { return _game.getLocation(name); } , viewportHeight : 16 , viewportWidth : 40 } );
    };
    //---------------------------------------------------------------------------
    saveFile() {
        var obj = { 
            metadata: this.metadata, 
            actor: this.actor, 
            locations: this.locations, 
            items: this.items, 
            npc: this.npc ,
            actions: this.actions ,
            types : this.types
        };
        if( this.allowGodMode ) {
            obj.god = this.god;
        }
        var fs = require("fs");
        fs.writeFile(this.settings.filename, JSON.stringify(obj, null, "  "), function (err, data) { });
    };
    defaultsFilename() {
        var os = require("os");
        return os.homedir()+"/.ltbl-if.json";
    }
    //------------------
    loadConfig(onComplete) {
        var fs = require("fs");
        fs.readFile(this.defaultsFilename(),(errD,dataD) => {
            if( !errD ) {
                try {
                    var obj = JSON.parse(dataD);
                    this.defaults.author = obj.author;
                    this.defaults.authorEmail = obj.authorEmail;
                } catch(errE) {
                }
            }
            onComplete(null, true);
        })
    }
    saveConfig(onComplete) {
        var fs = require("fs");
        fs.writeFile(this.defaultsFilename(), JSON.stringify(this.defaults, null, "  "), function (err, data) { onComplete(null, true); });
    }
    //------------------
    loadGame(onComplete) {
        var fs = require("fs");
        fs.readFile(this.defaultsFilename(),(errD,dataD) => {
            if( !errD ) {
                try {
                    var obj = JSON.parse(dataD);
                    this.defaults.author = obj.author;
                    this.defaults.authorEmail = obj.authorEmail;
                } catch(errE) {
                }
            }
            fs.readFile(this.settings.filename, (err, data) => {
                if (!err) {
                    this.sourceCode = ""+data;
                    var obj = JSON.parse(data);
                    this.metadata = obj.metadata;
                    this.actor = obj.actor;                
                    this.locations = obj.locations;
                    this.items = obj.items;
                    this.npc = obj.npc;
                    this.actions = obj.actions;
                    this.types = obj.types;
                    if( !this.actions ) {
                        this.actions = {};
                    }
                    if( !this.types ) {
                        this.types = {};
                    }
                    if( obj.god && this.settings.action != "play" ) {
                        this.allowGodMode = true;
                        this.god = obj.god;
                        this.pov = this.god;
                    } else {
                        this.allowGodMode = false;
                        this.pov = this.actor;
                    }                
                    if( this.allowGodMode ) {
                        if (!this.map) {
                            this.map = this.createMap();
                        } else if (this.pov.location && this.map.location.room != this.pov.location) {
                            this.recalcLocation(this.map, this.pov.location);
                        }                    
                    }                
                    onComplete(null, true);
                } else {
                    onComplete(err, false);
                }
            }); 
        });
    };
    cloneFrom(_game){
        this.actor = JSON.parse(JSON.stringify(_game.actor));
        this.metadata = JSON.parse(JSON.stringify(_game.metadata));
        this.god = JSON.parse(JSON.stringify(_game.god));    
        this.locations = JSON.parse(JSON.stringify(_game.locations));
        this.items = JSON.parse(JSON.stringify(_game.items));
        this.npc = JSON.parse(JSON.stringify(_game.npc));
        this.actions = JSON.parse(JSON.stringify(_game.actions));
        this.types = JSON.parse(JSON.stringify(_game.types));
        this.map = null;
        this.pov = this.actor;
        this.allNpc = null;
        this.allItems = null;
    }
    //------------------
    getLocation(name) {
        var location = null;
        if( name ) {
            name = name.split("/");                
            location = this.locations[name[0]];
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
    }
    //--------------------------------
    getItemFromLCased(name) {
        name.toLowerCase();
        name = name.split("/");       
        if( name.length > 1 ) {
            var location = null;
            name[0] = this.util.getLocationFromLCased(this.locations,name[0]);
            if( name[0] )
                location = this.locations[name[0]];
            var i = 1;
            while( location && (i+1) < name.length ) {
                if( location.locations ) {
                    name[i] = this.util.getLocationFromLCased(location,name[i]);
                    if( name[i] )
                       location = location[name[i]];
                    else
                       location = null;
                 } else {
                    location = null;
                }
                i = i + 1;
            }
            if( location && location.items )
            {
                name[ name.length - 1 ] = this.util.getLocationFromLCased(location.items,namename[ name.length - 1 ]);
                return name.join("/");
            }
        } else { 
            return this.util.getLocationFromLCased(this.items,name[0]);
        }
        return null;
    }
    //--------------------------------
    // Parts are stored with items or types
    getPartLow(name) {  
        name = name.split("#");
        var item = this.getItem(name[0]);
        var isNpc = false;
        if( !item ) {
            item = this.getNpc(name[0]);
            isNpc = true; // for type lookup
        }
        if( item ) {
            var part =item;
            for( var i = 1 ; i < name.length ; ++i ) {
                if( !part.parts ) {
                    part = null;
                    break;
                } else {
                    part = part.parts[name[i]];
                    if( !part ) {
                        break;
                    }
                }
            }
            if( !part ) 
            {
                if( isNpc )
                {
                    var _types = this.getNpcTypes(item);
                    for( var t = 0 ; t < _types.length ; ++t )
                    {
                        var _type = _types[t];
                        if( _type.parts )
                        {
                            var part =item;
                            part = _type;
                            for( var i = 1 ; i < name.length ; ++i ) {
                                if( !part.parts ) {
                                    part = null;
                                    break;
                                } else {
                                    part = part.parts[name[i]];
                                    if( !part ) {
                                        break;
                                    }
                                }
                            }
                            if( part )
                            {
                                break;
                            }
                        }
                    }
                }
            }
            return part;
        }
        return null;
    }
    //--------------------------------
    getItem(name) {
        if( name ) {
            if( name.indexOf("#") > 0 ) {
                return this.getPartLow(name);
            }
            name = name.split("/");
            if( name.length > 1 ) {
                var location = this.locations[name[0]];
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
                return this.items[name[0]];
            }
        }
        return null;
    }
    //-----------------------------------
    setItem(name,pi) {
        var location;
        name = name.split("/");
        if( name.length > 1 ) {
            if( !this.locations[name[0]] ) {
                this.locations[name[0]] = {};
            }
            location = this.locations[name[0]];
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
            this.items[name[0]] = pi;
        }
        this.allItems = null;   
    }
    //-----------------------------------    
    getFullName(name) {
        var fullname = this.getItem(name).name;
        var prefix = "";
        if( name.indexOf("#") > 0 ) {
            name = name.split("#");
            var item = this.getItem(name[0]);
            if( !item ) {
                item = this.getNpc(name[0]);
                prefix = item.name+"'s ";
            }
        }
        return prefix+fullname;
    }
    //-----------------------------------    
    getUniqueItemName(name,altname,prefix) {
        var fullName = null;
        if (!name) {
            name = altname;
        }
        if( prefix ) {
            fullName = prefix+name;
        } else {
            fullName = name;
        }
        if( this.getItem(fullName) ) {
            var counter = 1;
            while( this.getItem(fullName+counter) ) {
                counter = counter + 1;
            }
            fullName = fullName+counter;
        }
        return fullName;
    }
    //-----------------------------------
    setObjectState(name,prop,value) {
        name = "Obj"+name;
        if( !this.state[name] ) {
            this.state[name] = {};
        }
        this.state[name][prop] = value;
    };
    //-----------------------------------
    getObjectState(name) {
        var si = this.getItem(name);
        var state = null;
        if( si ) {
            state = this.state["Obj"+name];
            if( !state ) {
                state = si.state;
                if( !state ) {
                    if( si.type == "door" ) {
                        if( si.lockable || si.key ) {
                            state = { "access" : "closed" , "lock" : "locked" };
                        } else {
                            state = { "access" : "closed" };
                        }
                    }
                } else if (typeof state === 'string' || state instanceof String) {
                    if( state == "locked" ) {
                        state = { "access" : "closed" , "lock" : "locked" };
                    } else if( state == "closed" ) {
                        if( si.lockable || si.key ) {
                            state = { "access" : "closed" , "lock" : "locked" };
                        } else {
                            state = { "access" : "closed" };
                        }
                    } else if( state == "open" ) {
                        state = { "access" : "open" };
                    }
                }
            }
        }
        return state;
    }
    //-----------------------------------
    getDoor(name) {
        return this.getItem(name);
    }
    //-----------------------------------
    setDoor(name,di) {        
        this.setItem(name,di);
    }
    //-----------------------------------
    getNpc(name) {
        name = name.split("/");
        if( name.length > 1 ) {
            var location = this.locations[name[0]];
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
            return this.npc[name[0]];
        }
        return null;
    }
    //-----------------------------------
    setNpc(name,ni) {
        this.npc[name] = ni;
        this.allNpc = null;
    }
    //-----------------------------------
    getNpcsAtLocation(locationId) {
        var _npcs = {};
        for( var _npc in this.npc) {
            var  ni = this.getNpc(_npc);
            if( ni.location == locationId ) {
                _npcs[_npc] = ni;
            }
        }
        return _npcs;
    }
    //-----------------------------------
    getNpcTypes(ni) {
        var _types = [];
        var _game = this;
        var definePerson = function() {
            // Implicit definitions
            if( ni.gender == "female" ) 
            {
                if( _game.types["woman"] )
                {
                    _types.push(_game.types["woman"]);
                }
            } 
            else 
            {
                if( _game.types["man"] )
                {
                    _types.push(_game.types["man"]);
                }
            }
            if( _game.types["person"] )
            {
                _types.push(_game.types["person"]);
            }
        };
        // People
        if( !ni.species || ni.species == "person" )
        {
            definePerson();
        }
        else
        {
            var _ni = this.types[ni.species];
            if( _ni )
            {     
                _types.push(this.types[_ni]);
                while( _ni.species )
                {
                    if( _ni.species == "person" || _ni.species == "animal" || _ni.species == "npc")
                    {
                        break;
                    }
                    _ni = this.types[_ni.species];
                    if( !_ni ) {
                        break;
                    }
                }
                if( _ni ) 
                {
                    if( _ni.species == "person" )
                    {
                        definePerson();
                    } else if( _ni.species != "npc" )
                    {
                        if( this.types["animal"] )
                        {
                            _types.push(this.types["animal"]);
                        }
                    }
                }  
                else if( this.types["animal"] )
                {
                    _types.push(this.types["animal"]);
                }
            } 
            else if( this.types["animal"] )
            {
                _types.push(this.types["animal"]);
            }
        }
        // Definitions generic to all lifeforms    
        if( this.types["npc"] )
        {
            _types.push(this.types["npc"]);
        }
        return _types;
    }
    //-----------------------------------
    setLocation(name,room) {
        var location = null;
        name = name.split("/");
        location = this.locations[name[0]];
        if( !location ) {
            if( name.length > 1 ) {
                this.locations[name[0]] = {};
                location = this.locations[name[0]];
            } else {
                this.locations[name[0]] = room;
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
    }
    //-----------------------------------
    findLocations(name) {
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
        _findLocations(this.locations,name,"");
        if( list.length == 0 ) {
            list = inexactList;
        }
        return list;
    }
    sentenceToString(command,start,end) {
        var text = "";
        for( var i = start ; i < end ; ++i ) {
            if( i > start )
                text += " ";
            if (typeof(command[i]) == "string") {
                text += command[i];
            } else if( command[i].npc ) {
                text += command[i].npc;
            } else if( command[i].actor ) {
                text += command[i].actor;
            } else if( command[i].item ) {
                text += command[i].item;
            }
        }
        return text;
    }
    digestSentence(command,allowAll) {
        // Look for relevent characters and items in a phrase
        var sentence = [];
        if( command.indexOf(",") >= 0 ) {
            command = command.split(",");
            for( var i = 0 ; i < command.length-1 ; ++i ) {
                command[i]  = command[i].trim();
            }
            command = command.join(" ***,*** ");
        }
        var where = this.getLocation(this.pov.location);
        var normCommand = " "+command+" ";
        var foundNpcs = [];
        var foundItems = [];
        normCommand = normCommand.toLowerCase();
        if( where ) {
            if( !this.allNpc ) {
                this.allNpc = [];
                // TBD - build list of all npcs (including nesting) / once location npcs are supported.
                for(var npcId in this.npc ) {
                    this.allNpc.push(npcId);
                }
            }
            if( !this.allItems ) {
                var _allItems = [];
                
                var addItems = function(items,prefix) {
                    for(var itemId in items ) {
                        _allItems.push(prefix+itemId);
                    }
                };
                var recurseAddItems = function(locations,prefix) {
                    for(var locId in locations) {
                        var loc = locations[locId];
                        if( loc.items ) {
                            addItems(loc.items,prefix+locId+"/");
                        }
                        if( loc.locations ) {
                            recurseAddItems(loc.location,prefix+locId+"/");
                        }
                    }
                };
                addItems(this.items,"");
                recurseAddItems(this.locations,"");
                this.allItems = _allItems;
            }
            var at = normCommand.indexOf( " "+this.actor.name.toLowerCase()+" " );
            var firstIsActor = false;
            if( at >= 0 ) {
                firstIsActor = true;
                foundNpcs.push( command.substring(at,at+this.actor.name.length ) );
            }
            for( var i = 0 ; i < this.allNpc.length ; ++i ) {
                var _npc = this.getNpc(this.allNpc[i]);
                if( _npc.location == this.pov.location || allowAll) {
                    if( _npc.name ) {
                        var at = normCommand.indexOf( " "+_npc.name.toLowerCase()+" " );
                        if( at >= 0 ) {
                            foundNpcs.push( command.substring(at,at+_npc.name.length ) );
                        }
                    }
                }
            }
            for( var i = 0 ; i < this.allItems.length ; ++i ) {
                var _item = this.getItem(this.allItems[i]);
                if( _item.name ) {
                    var at = normCommand.indexOf( " "+_item.name.toLowerCase()+" " );
                    if( at >= 0 ) {
                        foundItems.push( command.substring(at,at+_item.name.length ) );
                    }
                }
            }
            
            if( foundNpcs.length > 0 || foundItems.length > 0 || command.indexOf("***") >= 0 ) {
                command = " "+command+" ";
                for( var i = 0 ; i < foundNpcs.length ; ++i ) {
                    command = command.split(" "+foundNpcs[i]+" ").join("***$$"+i+"***");
                } 
                for( var i = 0 ; i < foundItems.length ; ++i ) {
                    command = command.split(" "+foundItems[i]+" ").join("***^^"+i+"***");
                }
                command = command.split("***");
                for( var i = 0 ; i < command.length ; ++i ) {
                    if(command[i].length > 2 && command[i].substring(0,2) == '$$' ) {
                        var index =Number.parseInt(command[i].substring(2));
                        if( index == 0 && firstIsActor ) {
                            command[i] = { actor : foundNpcs[index ] };
                        } else {
                            command[i] = { npc : foundNpcs[index] };
                        }
                    } else if(command[i].length > 2 && command[i].substring(0,2) == '^^' ) {
                        var index =Number.parseInt(command[i].substring(2));
                        command[i] = { item : foundItems[index] };
                    }
                }
                for( var i = command.length - 1 ; i >= 0 ; --i ) {
                    if (typeof (command[i]) == "string") {
                        command[i] = command[i].trim();
                        if( command[i] == "" ) {
                            command.splice(i,1);
                        }
                    }
                }
                sentence = command;
            }
        }
        return sentence;
    }
    //---------------------------------------------------------------------------
    dropObject(dObj) {
        var found = false;
        var objRef = null;
        var response = null;
        for (var i = 0; i < this.pov.inventory.length; ++i) {
            if (this.pov.inventory[i].item == args.dObj) {
                objRef = this.pov.inventory[i];
                this.pov.inventory.splice(i, 1);
                response = "Ok.";
                found = true;
                break;
            }
        }
        if( !found ) {            
            response = "You don't have "+ getItem(dObj).name+"!";
        }
        return { found : found , response : response , objRef : objRef };
    }
    //---------------------------------------------------------------------------
    // Create a spacial map of from the logical description
    createMap() {
        var _game = this;
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
                var loc = _game.getLocation(_loc);
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
        createMapLow(0, 0, 0, this.pov.location, bounds, function (row, col, level, loc, bounds) { });
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
        createMapLow(0, 0, 0, this.pov.location, bounds, function (row, col, level, loc, bounds) {
            levels[level - bounds.startLevel][row - bounds.startRow][col - bounds.startCol] = loc;
        });
        return { levels: levels, location: { room: this.pov.location, level: -bounds.startLevel, row: -bounds.startRow, col: - bounds.startCol } };
    }
    createDumpFile(err) {
        var dmp = {
            action :this.settings.action ,
            filename : this.settings.filename ,
            source :  this.settings.sourceCode ,
            commands : this.commands ,
            error : err.toString(),
            errorStack : err.stack
        };
        dmp = JSON.stringify(dmp);
        var fs = require("fs");
        var path = require("path");
        var count = 1;
        var baseName = path.dirname(this.settings.filename)+"/dump_";
        while( fs.existsSync(baseName+count+".txt") )
            ++count;
        fs.writeFile(baseName+count+".txt",dmp ,function(err) { if(err) console.log("Error writing play file "+err); });
    }
};
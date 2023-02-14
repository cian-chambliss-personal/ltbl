module.exports = function(singleton) {
    var disclosedContents= function(item,itemPtr,list,prop,preposition,search) {
        var game = singleton.game;
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
                singleton.outputText("You discover "+contents(discovered)+" "+preposition+" "+itemPtr.name);
            } else {
                singleton.outputText("You find nothing else "+preposition+" "+itemPtr.name);
            }
            return true;
        }
        for(var i = 0 ; i < list.length ; ++i ) {
            if( !list[i].hidden ) {
                discovered.push(list[i]);
            }
        }
        if( discovered.length > 1 ) {
            singleton.outputText("There are "+contents(discovered)+" "+preposition+" "+itemPtr.name);
            return true;
        } else if( discovered.length == 1 ) {
            singleton.outputText("There is "+contents(discovered)+" "+preposition+" "+itemPtr.name);
            return true;
        }
        return false;
    };
    var describeItem = function(item,preposition,search) {
        var game = singleton.game;
        var itemPtr = game.getItem(item);
        var itemState = game.getObjectState(item);
        var itemStateAccess = null;
        if (itemPtr.description) {
            singleton.outputText(itemPtr.description);
        } else if(game.pov.isGod) {
            game.stateMachine = singleton.stateMachine.fillinCreate(itemPtr,[ {msg:"How would you describe the " + (itemPtr.name || item) + "?",prop:"description"} ]);
        } else {
            singleton.outputText(itemPtr.name);
        }
        if( itemState ) {
            if( itemState.access ) {
                itemStateAccess = itemState.access;
            }
            if( itemState.broken ) {
                singleton.outputText("The "+itemPtr.name+" is broken");
            } else if( itemState.locked == "locked" ) {
                singleton.outputText("The "+itemPtr.name+" is locked");
            } else if( itemState.access == "open" ) {
                singleton.outputText("The "+itemPtr.name+" is open");
            } else if( itemState.locked == "unlocked" ) {
                singleton.outputText("The "+itemPtr.name+" is unlocked but closed.");
            } else if( itemState.access == "closed" ) {
                singleton.outputText("The "+itemPtr.name+" is closed");
            }
            if( itemState.lit ) {
                singleton.outputText("The "+itemPtr.name+" is lit.");
            }
            if( itemState.worn ) {
                singleton.outputText("The "+itemPtr.name+" is being worn.");
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
    return { describeItem : describeItem };
}
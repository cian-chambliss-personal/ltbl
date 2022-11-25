module.exports = function ltbl() {
    var partOfSp = require("./en-parts.json");
    var camelCase = function(name) {
        var words = name.toLowerCase().split(" ");
        name = words[0];
        for( var i = 1 ; i < words.length ; ++i ) {
            name = name + words[i].charAt(0).toUpperCase() + words[i].slice(1);
        }
        return name;
    };
    //---------------------------------------------------------------------------
    // parser Utility functions
    var extractNounAndAdj = function (command) {
        var words = command.toLowerCase().split(" ");
        var altNoun = null;
        var adj = "";
        var adjLoc = -1;
        for (var i = 0; i < words.length; ++i) {
            var pos = partOfSp[words[i]];
            if (pos) {
                if (i > 0 && words[i] == "room") {
                    if ((i - 1) > adjLoc) {
                        if (adj != "") {
                            adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                        } else {
                            adj = words[i];
                        }
                    }
                }
                if ((pos & 8) != 0) {
                    if (adj != "") {
                        adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                    } else {
                        adj = words[i];
                    }
                    if (pos & 1) {
                        altNoun = adj;
                    }
                    adjLoc = i;
                } else if ((pos & 1) != 0) {
                    if (adj.length > 0) {
                        if (adj != "") {
                            adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                        } else {
                            adj = words[i];
                        }
                        return adj;
                    }
                    return words[i];
                }
            } else {
                words[i] = words[i].replace("'", "")
                if (words[i].length > 1 && words[i][words[i].length - 1] == 's') {
                    if (adj != "") {
                        adj = adj + words[i].charAt(0).toUpperCase() + words[i].slice(1);
                    } else {
                        adj = words[i];
                    }
                    adjLoc = i;
                }
            }
        }
        return altNoun;
    };
    var getPartsOfSpeech = function (command) {
        var parts = { count: 0, noun: [], adj: [], name: "" };
        var words = command.toLowerCase().split(" ");
        var altNoun = null;
        var adj = "";
        var adjLoc = -1;
        var name = [];
        for (var i = 0; i < words.length; ++i) {
            var pos = partOfSp[words[i]];
            if ((pos & 1) != 0) {
                if (parts.noun.length > 0) {
                    if ((partOfSp[parts.noun[parts.noun.length - 1]] & 8) != 0) {
                        parts.adj.push(parts.noun[parts.noun.length - 1]);
                        parts.noun.splice(parts.noun.length - 1, 1);
                    }
                }
                parts.noun.push(words[i]);
                ++parts.count;
                name.push(words[i]);
            } else if ((pos & 8) != 0) {
                parts.adj.push(words[i]);
                ++parts.count;
                name.push(words[i]);
            }
        }
        parts.name = name.join(" ");
        return parts;
    }    
    var isVerb = function(wrd) {
        if( partOfSp[wrd] & 2 )
            return true;
        return false;
    }
    var superScript = function(txt) {
        var fromCh = "0123456789()+-=";
        var toCh = "⁰¹²³⁴⁵⁶⁷⁸⁹⁽⁾⁺⁻⁼";
        for(var i = 0 ; i < txt.length ; ++i ) {
            var index = fromCh.indexOf(txt[i]);
            if( index >= 0 ) {
                txt = txt.split(fromCh[index]).join(toCh[index]);
            }
        }
        return txt;
        //"₀₁₂₃₄₅₆₇₈₉₍₎₊₋₌"
    };
    return {
        camelCase : camelCase,
        extractNounAndAdj : extractNounAndAdj,
        getPartsOfSpeech: getPartsOfSpeech,
        isVerb : isVerb,
        superScript: superScript,
        directionTags : function() { return ["s", "n", "e", "w", "u", "d", "sw", "se", "nw", "ne"]; }
    }
};

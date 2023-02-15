module.exports = function ltbl(settings) {
    var spellCorrect = null;
    var missingWords = { "and" : true , "is" : true , "has" : true , "with" : true};
    if( settings ) {
        spellCorrect = settings.spellCorrect;
    }
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
    var getPartsOfSpeech = function (command,calcObjects,checkSpelling) {
        var parts = { count: 0, noun: [], adj: [] , name: "" , mispelled : [] };
        var corrected = {};
        var altNoun = null;
        var adj = "";
        var adjLoc = -1;
        var name = [];
        var wordTypeMap = null;
        if( command.indexOf(",") > 0  ) {
            command = command.split(",").join(" , ");
        }
        if( command.indexOf(".") > 0  ) {
            command = command.split(".").join(" . ");
        }
        while( command.indexOf("  ") > 0  ) {
            command = command.split("  ").join(" ");
        }
        var words = command.toLowerCase().split(" ");
        if( calcObjects ) {
            wordTypeMap = [];
        };
        for (var i = 0; i < words.length; ++i) {
            var pos = partOfSp[words[i]];
            if( !pos ) {
                if( spellCorrect && checkSpelling && !missingWords[words[i]] ) {
                    if( !corrected[words[i]] ) {
                        corrected[words[i]] = true;
                        var corrections = spellCorrect(words[i]);
                        if( corrections.length > 0 ) {
                            parts.mispelled.push({ word : words[i] , corrections : corrections });
                        }
                    }
                }
            }
            if( wordTypeMap ) {
                wordTypeMap.push(pos);
            }
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
        if( calcObjects ) {
            // Pick out objects...
            var pendObj = [];
            var hitNoun = false;
            parts.objects = [];
            for (var i = 0; i < words.length; ++i) {
                if( (wordTypeMap[i] & ~11) != 0 ) {
                    if( pendObj.length > 0 ) {
                        if( hitNoun )
                            parts.objects.push(pendObj.join(" "));
                        pendObj = [];
                        hitNoun = false;
                    }
                } else if( (wordTypeMap[i] & 1) != 0 ) {
                    pendObj.push(words[i]);
                    hitNoun = true;
                } else if( (wordTypeMap[i] & 8) != 0 ) {
                    if( hitNoun ) {
                        if( pendObj.length > 0 ) {
                            parts.objects.push(pendObj.join(" "));
                            pendObj = [];
                            hitNoun = false;
                        }
                    }
                    pendObj.push(words[i]);
                } else if( pendObj.length > 0 ) {
                     if( hitNoun )                       
                         parts.objects.push(pendObj.join(" "));
                     pendObj = [];
                     hitNoun = false;
                }
            }
            if( hitNoun ) {
                parts.objects.push(pendObj.join(" "));
            }
        }
        parts.name = name.join(" ");
        return parts;
    }    
    var isVerb = function(wrd) {
        if( partOfSp[wrd] ) {
            if( partOfSp[wrd] & 2 )
                return true;
        }
        return false;
    }
    var isArticle = function(wrd) {
        if( partOfSp[wrd] ) {
            if( partOfSp[wrd] & 64 )
                return true;
        }
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
    var esPlural = ["s", "ss", "sh", "ch", "x", "z"];
    var singularFromPlural = function(wrd) {
         wrd = wrd.trim();   
        if( wrd.length > 3 && wrd.substring(wrd.length-2) == "es" ) {
            for( var i = 0 ; i < esPlural.length ; ++i ) {
                if( wrd.substring(wrd.length-2-esPlural[i].length) == esPlural[i]+"es" ) {
                    return wrd.substring(0,wrd.length-2);
                }
            }
        }  
        if( wrd.substring(wrd.length-1) == "s" ) {
            return wrd.substring(0,wrd.length-1);
        }
        return wrd; 
    };
    var pluralFromSingular  = function(wrd) {
        wrd = wrd.trim();
        if( wrd.length > 1 ) {
            for( var i = 0 ; i < esPlural.length ; ++i ) {
                if( wrd.substring(wrd.length-2) == esPlural[i] ) {
                    return wrd+"es";
                }
            }
        }
        return wrd+"s"; 
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
    var subSentence = function(sentence,wrd) {
        sentence = sentence.split(" ");
        for( var i = 0 ; i < wrd ; ++i )
            sentence[i] = "";
        return sentence.join(" ").trim();
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
    return {
        camelCase : camelCase,
        extractNounAndAdj : extractNounAndAdj,
        extractNounAndAdjAlways: extractNounAndAdjAlways,
        extractScalar: extractScalar,
        getPartsOfSpeech: getPartsOfSpeech,
        isVerb : isVerb,
        isArticle : isArticle,
        superScript: superScript,
        singularFromPlural : singularFromPlural ,
        pluralFromSingular : pluralFromSingular ,
        subSentence : subSentence ,
        splitOnOneOf: splitOnOneOf,
        directionTags : function() { return ["s", "n", "e", "w", "u", "d", "sw", "se", "nw", "ne"]; }
    }
};

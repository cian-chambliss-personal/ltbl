module.exports = function(singleton) {
    var stateMachineFillinCreate = singleton.stateMachine.fillinCreate;
    var getPartsOfSpeech = singleton.helper.getPartsOfSpeech;
    
    var spellcheckedText = function(obj,prop,prompt) {
        var game = singleton.game;
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
            game.stateMachine = stateMachineFillinCreate({word:'',fix:''},[
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
                singleton.render(game.getLocation(game.pov.location),game.pov.location, 0);
            });
        } else {
            game.stateMachine = stateMachineFillinCreate(obj,[ {msg:prompt,prop:prop} ],singleton.invalidateMap);
        }
    };
    return { spellcheckedText : spellcheckedText };
}
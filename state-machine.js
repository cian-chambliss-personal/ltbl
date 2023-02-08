const chalk = require("chalk");
module.exports = function(settings) {
    var outputText = function(txt) {
        // Single output so we can override it
        console.log(txt);
    };
    var displayMessage = function(sm,st) {
        if( st ) {
            if( st.msg ) {
                var msg = st.msg;
                if( msg.indexOf("{") >= 0 ) {
                    for(var prop in sm.data) {
                        if( msg.indexOf("{"+prop+"}") >= 0 ) {
                            msg = msg.split("{"+prop+"}").join(sm.data[prop]);
                        }
                    }
                }
                outputText(msg);
            }
            if( st.choices ) {
                if( st.multiple ) {
                    var arr = sm.data[st.prop];
                    if( !arr ) {
                        arr = [];
                    }
                    for( var i = 0 ; i < st.choices.length ; ++i ) {
                        var selected = false;
                        for( var j = 0 ; j < arr.length ; ++j ) {
                            if( st.choices[i].value == arr[j] ) {
                                selected = true;
                                break;
                            }
                        }
                        if( selected )
                            outputText(chalk.bold((i+1)+")["+st.choices[i].text+"]"));
                        else 
                            outputText((i+1)+") "+st.choices[i].text);
                    }
                } else {
                    for( var i = 0 ; i < st.choices.length ; ++i ) {
                        outputText((i+1)+") "+st.choices[i].text);
                    }
                }
            }
        }
    };
    var stateMachineFillin = function(sm,command) {
        var advanceTest = function() {
            if( sm.state >= sm.states.length ) {
                if( sm.done ) {
                    sm.done(sm);
                }             
            } else {
                while( sm.states[sm.state].test ) {
                    var testResult = sm.states[sm.state].test(sm,command);
                    if( testResult == "expand" ) {
                        // expand the commands & make new start of the state array
                        var newStates = sm.states[sm.state].states.filter(() => true);
                        if( (sm.state+1) < sm.states.length ) {
                            newStates = newStates.concat(sm.states.slice(sm.state+1)); 
                        }
                        sm.state = 0;
                        sm.states = newStates;
                        if( newStates.length == 0 ) {
                            if( sm.doAbort ) {
                                sm.doAbort(sm);
                            }
                            if( sm.done ) {
                                sm.done(sm);
                            }
                            return "abort";
                        }
                    } else if( testResult.substring(0,7) == "expand." ) {
                        // Branching (alternate state)
                        testResult = testResult.substring(7);
                        var newStates = sm.states[sm.state][testResult].filter(() => true);
                        if( (sm.state+1) < sm.states.length ) {
                            newStates = newStates.concat(sm.states.slice(sm.state+1)); 
                        }
                        sm.state = 0;
                        sm.states = newStates;
                        if( newStates.length == 0 ) {
                            if( sm.doAbort ) {
                                sm.doAbort(sm);
                            }
                            if( sm.done ) {
                                sm.done(sm);
                            }
                            return "abort";
                        }
                    } else if( testResult == "execute" ) {
                        break;
                    } else {
                        sm.state = sm.state + 1;
                        if( (sm.state+1) >= sm.states.length ) {
                            if( sm.done ) {
                                sm.done(sm);
                            }
                            return "abort";
                        }
                    } 
                }
            }
        };
        if( sm.aborting ) {
            if( command.toLowerCase() == "y" ) {
                if( sm.doAbort ) {
                    sm.doAbort(sm);
                }
                if( sm.nested ) {
                    sm.nested = null;
                }
                return "abort";
            }
            sm.aborting = false;
            return "retry";
        }
        advanceTest();
        if( sm.state >= sm.states.length ) {
            return "abort";
        }
        var curState = sm.states[sm.state];
        var parentState = null;
        if( sm.nested ) {
            for( var i = 0 ; i < sm.nested.length ; ++i ) {
                parentState = curState;
                curState = curState.choices[ sm.nested[i] ];
            }
        }
        if( !command || command.length == 0 ) {
            if( curState.default && curState.default.length ) {
                command = curState.default;
            } else {
                if( sm.askAbort ) {
                    sm.aborting = true;
                    sm.askAbort();
                } else {
                    displayMessage(sm,curState);
                }
                return "retry";
            }
        }
        if( curState.choices ) {
            var choiceNum = Number.parseInt(command);            
            if( 1 <= choiceNum && choiceNum <= curState.choices.length ) {
                if( curState.multiple ) {
                    // Array of strings representing a multiple state...
                    if(  !sm.data[curState.prop] ) {
                        sm.data[curState.prop] = [curState.choices[choiceNum-1].value];
                    } else {
                        var arr = sm.data[curState.prop];
                        var exists = -1;
                        for( var i = 0 ; i < arr.length ; ++i ) {
                            if( arr[i] == curState.choices[choiceNum-1].value ) {
                                exists = i;
                                break;
                            }
                        }
                        if( exists >= 0 ) {
                            arr.splice(choiceNum-1,1);
                        } else {
                            arr.push(curState.choices[choiceNum-1].value);
                        }
                    }
                } else {
                    if( curState.choices[choiceNum-1].abort ) {
                        if( sm.nested ) {
                            // Abort a tree...
                            if( sm.nested.length > 1 ) {
                                sm.nested.pop;
                            } else {
                                sm.nested = null;
                            }
                            displayMessage(sm,parentState);
                            return "retry";
                        }
                        // Abort command
                        return "abort"; 
                    } else if( curState.choices[choiceNum-1].choices ) {
                        // Tree of choices....                        
                        if( !sm.nested ) {
                            sm.nested = [choiceNum-1];
                        } else {
                            sm.nested.push(choiceNum-1);
                        }
                        displayMessage(sm,curState.choices[choiceNum-1]);
                        return "retry";
                    } else if( curState.choices[choiceNum-1].value ) {
                        sm.data[curState.prop] = curState.choices[choiceNum-1].value;
                    } else {
                        if( sm.nested ) {
                            sm.nested = null;
                        }
                        delete sm.data[curState.prop];
                    }
                }
            } else {
                outputText("You must pick a number between 1 and "+curState.choices.length);
            }
        }  else {
            if( curState.yesNo ) {
                if(  command == "y" ) {
                    sm.data[curState.prop] = true;
                } else if( command == "n" ) {
                    sm.data[curState.prop] = false;
                } else {
                    outputText("You must type 'y' or 'n'");
                    return "retry";
                }
            } else {
                sm.data[curState.prop] = command;
            }
        }
        if( (sm.state+1) < sm.states.length ) {
            if( sm.states[sm.state+1].test ) {
                sm.state = sm.state+1;
                advanceTest();
                displayMessage(sm,sm.states[sm.state]);
                return "retry";
            }
            displayMessage(sm,sm.states[sm.state+1]);
            return "next";
        }
        if( sm.done ) {
            sm.done(sm);
        }
        if( sm.nested ) {
            sm.nested = null;
        }
        return "abort";
    };
    var stateMachineFillinStart = function(sm) {
         if( sm.states[0].test ) {
             stateMachineFillin(sm,""); 
            if( sm.states && sm.state < sm.states.length )
            {
                return true;
            }         
            return false;
        }
        displayMessage(sm,sm.states[0]);
        return true;
    };
    var stateMachineFillinCreate = function(data,states,done,doAbort) {
        if( !done )  {
            done =  function(sm) {  };
        }
        var sm = {
            state : 0 ,
            data : data ,
            states : states,
            execute : stateMachineFillin,
            start: stateMachineFillinStart,
            done: done,
            askAbort: function() {
                outputText("Do you want to quit? (y to quit)");
            },
            doAbort : doAbort
        };
        sm.start(sm,"");
        return sm;
    };    
    if( settings.output ) {
        outputText = settings.output;
    }
    return { 
        fillin : stateMachineFillin,
        fillinStart : stateMachineFillinStart,
        fillinCreate : stateMachineFillinCreate
    };
};

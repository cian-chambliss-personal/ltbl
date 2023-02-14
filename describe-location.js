module.exports = function(singleton) {
    var stateMachineFillin = singleton.stateMachine.fillin;
    var stateMachineFillinStart = singleton.stateMachine.fillinStart;
    var stateMachineFillinCreate = singleton.stateMachine.fillinCreate;    
    var describeLocation = function (noVoid) {
        var game = singleton.game;
        var design = game.design;
        if( game.renderMap ) {
            if( !game.map || game.map.location.room != game.pov.location ) {
                if (!game.map) {
                    game.map = game.createMap();
                } else if (game.pov.location && game.map.location.room != game.pov.location) {
                    game.recalcLocation(game.map, game.pov.location);
                }
                game.renderMap =  game.renderMapLevelText(game.map);
            }            
        }
        if( game.pov.isGod ) {
            console.clear();
            if( game.renderMap ) {
                var mapWidth = 40;
                var infoWidth = 79 - mapWidth - 3;
                var screen = [];
                var maxLines = game.renderMap.lines.length;
                var infoLines = [];
                
                if( !infoWidth || infoWidth < 1 ) {
                    infoWidth = 20;
                }
                if( game.renderMap.legend ) {
                    infoLines =game.renderMap.legend;
                }
                var headingWidth = 0;
                var headingText = "";
                if( design.pendingGoInsideItem ) {
                    var pi = game.getItem(design.pendingGoInsideItem);
                    if( pi && pi.name ) {
                        headingText = pi.name;
                        headingWidth = headingText.length;
                        if( headingWidth & 1 ) {
                            headingText = headingText+" ";
                            ++headingWidth;
                        }
                    }
                }
                if( headingWidth > 0 )   {
                    screen.push("┌"+("─".repeat(infoWidth))+"┬"+("─".repeat((mapWidth-headingWidth)/2))+headingText+("─".repeat((mapWidth-headingWidth)/2))+"┐");
                } else {
                    screen.push("┌"+("─".repeat(infoWidth))+"┬"+("─".repeat(mapWidth))+"┐");
                }
                for( var i = 0 ; i < maxLines ; ++i ) {
                    var mapLine = null;
                    var infoLine = null;
                    if( i < game.renderMap.lines.length )
                        mapLine = game.renderMap.lines[i];
                    else
                        mapLine = (" ".repeat(mapWidth));
                    if( i < infoLines.length ) {
                        infoLine = infoLines[i];
                        if( infoLine.length > infoWidth ) {
                            infoLine = infoLine.substring(0,infoWidth);
                        } else if( infoLine.length < infoWidth ) {
                            infoLine = infoLine + " ".repeat(infoWidth-infoLine.length)
                        }                        
                    } else 
                        infoLine = (" ".repeat(infoWidth));
                    screen.push("│"+infoLine+"│"+mapLine+"│");
                }
                screen.push("└"+("─".repeat(infoWidth))+"┴"+("─".repeat(mapWidth))+"┘");
                if( game.statusLine != null ) {
                    screen.push(game.statusLine);
                }
                singleton.outputText(screen.join("\n"));
            }
        }
        if( noVoid ) {
            if(game.pov.location) {
                if( game.getLocation(game.pov.location).type != "void" ) {
                    noVoid = false;
                }
            }
        }        
        if (!game.metadata.title && !game.stateMachine ) {            
            game.stateMachine = {
                state : 0 ,
                data : game.metadata ,
                states : [
                    { msg : "What is the title of your interactive fiction?" , prop : "title" },
                    { msg : "How would you describe this interactive fiction work?" , prop : "description" },
                    { msg : "What is you name (byline)?" , prop : "author" , default :  game.defaults.author },
                    { msg : "What is you email?" , prop : "authorEmail" , default :  game.defaults.authorEmail },
                ],
                execute : stateMachineFillin,
                start: stateMachineFillinStart,
                done: function(sm) { game.saveFile(); }
            };
            game.stateMachine.start(game.stateMachine);
         } else if (game.pov.location && !noVoid ) {
            singleton.render(game.getLocation(game.pov.location),game.pov.location, 0);
        } else {            
            if( design.lastNonVoid ) {
                game.stateMachine = stateMachineFillinCreate({},[
                    {msg:"Enter name for this location?",prop:"room"}
                ],function(sm) {
                    if( sm.data.room  && sm.data.room.length > 1  ) {
                        singleton.defineLocation(sm.data);
                    }
                },function(sm) {
                    if( !game.pov.location ) {
                        if( design.pendingItemOut ) {
                            game.pov.location = design.pendingItemOut;
                            design.pendingItemOut = null;
                            design.pendingGoInsideItem = null;
                            game.map = null;
                            describeLocation();
                        }                        
                    }
                });
            } else {
                // First in            
                game.stateMachine = stateMachineFillinCreate({},[
                    {msg:"What kind of level?",prop:"type",choices:singleton.resources.topLocationMenu},
                    { test : 
                        function(sm) { 
                            if(sm.data.type == "oneroom") 
                                   return "expand.oneroom"; 
                            return "expand"; 
                        } , states : [ 
                            {msg:"Levels are like 'the castle', 'the asylum' , 'the town' , 'the desert', 'the island' etc - that which contains all the rooms for part of the story.\nEnter a name for this level:",prop:"name"},
                            {msg:"The first location within the level - This is a 'room' like 'study', 'dinning room' , 'forest clearing' , 'backyard' etc. Enter name for this location:",prop:"room"}
                        ] , oneroom : [
                            {msg:"Enter name for this location:",prop:"room"}
                        ]
                    }
                ],function(sm) {
                    if( sm.data.room 
                     && sm.data.room.length > 1 
                      ) {
                        singleton.defineLocation(sm.data);
                        if( !game.actor.location ) 
                        {
                            game.actor.location = game.pov.location;
                        }
                    }
                });
            }
        }
    };
    return {describeLocation : describeLocation};
}
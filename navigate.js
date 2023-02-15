module.exports = function(singleton) {
    var navigate = function(__direction) {
        var game = singleton.game;
        if (game.getLocation(game.pov.location)) {
            var nextLoc = game.getLocation(game.pov.location)[__direction];
            if (!nextLoc) {
                if( game.pov.isGod ) {
                    var design = game.design;
                    if (!game.map) {
                        game.map = game.createMap();
                    } else if (game.map.location.room != game.pov.location) {
                        game.recalcLocation(game.map, game.pov.location);
                    }
                    var level = game.map.location.level;
                    var row = game.map.location.row;
                    var col = game.map.location.col;

                    if( game.pov.location && design.lastNonVoid ) {
                        if( game.getLocation(game.pov.location).type == "void" ) {
                            if (__direction == "u") {
                                __direction = "+";
                            } else if (__direction == "d") {
                                __direction = "-";
                            }
                        }
                    }
                    if( __direction == "+" ||  __direction == "-" ) {
                        if( design.lastNonVoid && design.lastNonVoidPendingVoid ) {
                            if( __direction == "+" ) {
                                design.lastNonVoidDelta = design.lastNonVoidDelta + 1;
                            } else {
                                design.lastNonVoidDelta = design.lastNonVoidDelta - 1;
                            }
                            game.getLocation(design.lastNonVoidPendingVoid)[game.util.reverseDirection(design.lastNonVoidDirection)].direction = -design.lastNonVoidDelta;
                            game.map = null;
                            singleton.describeLocation();
                        }
                    } else {
                        if (__direction == "n") {
                            row = row - 1;
                        } else if (__direction == "s") {
                            row = row + 1;
                        } else if (__direction == "e") {
                            col = col + 1;
                        } else if (__direction == "w") {
                            col = col - 1;
                        } else if (__direction == "u") {
                            level = level + 1;
                        } else if (__direction == "d") {
                            level = level - 1;
                        } else if (__direction == "se") {
                            row = row + 1;
                            col = col + 1;
                        } else if (__direction == "sw") {
                            row = row + 1;
                            col = col - 1;
                        } else if (__direction == "ne") {
                            row = row - 1;
                            col = col + 1;
                        } else if (__direction == "nw") {
                            row = row - 1;
                            col = col - 1;
                        }
                        var posCell = null;
                        if (0 <= level && level < game.map.levels.length
                            && 0 <= row && row < game.map.levels[level].length
                            && 0 <= col && col < game.map.levels[level][row].length
                        ) {
                            posCell = game.map.levels[level][row][col];
                        }
                        if( game.pov.location ) {
                            if( game.getLocation(game.pov.location).type != "void" ) {
                                design.lastNonVoid = game.pov.location;
                                design.lastNonVoidDirection = __direction;
                                design.lastNonVoidDelta = 0;
                                design.lastNonVoidPendingVoid = null;
                            }
                        }
                        if (posCell) {
                            if( game.getLocation(game.pov.location).type == "void" && game.getLocation(posCell).type != "void" ) {
                                // clean up all the voids
                                voids.clear(game);
                            }
                            design.lastLocation = game.pov.location
                            design.lastDirection = __direction;
                            game.pov.location = posCell;
                            singleton.describeLocation();
                        } else {
                            design.lastLocation = game.pov.location;                                    
                            var voidCounter = 1;
                            while( game.getLocation("void"+voidCounter) ) {
                                voidCounter = voidCounter + 1;
                            }
                            game.pov.location = "void"+voidCounter;
                            // Single link void back to cell
                            game.setLocation(game.pov.location,{ name : "void" , type : "void" , description : "void" });
                            if( design.lastLocation && game.getLocation(design.lastLocation).type == "void" ) {
                                game.getLocation(game.pov.location)[game.util.reverseDirection(__direction)] = { location: design.lastLocation , "wall" : "none" };
                            } else {
                                game.getLocation(game.pov.location)[game.util.reverseDirection(__direction)] = { location: design.lastLocation };
                            }
                            design.lastDirection = __direction;
                            if( !design.lastNonVoidPendingVoid ) {
                                design.lastNonVoidPendingVoid = game.pov.location;
                            }
                            game.map = null;
                            singleton.describeLocation();
                        }
                    }
                } else {
                    singleton.outputText("You cannot go that way.");
                }
            } else {
                var isBlocked = false;
                if( nextLoc.door ) {
                    var objState = game.getObjectState(nextLoc.door);
                    if( objState ) {
                        if( objState.access == "closed" ) {
                            isBlocked = true;
                        }
                    }
                }
                if( isBlocked && !game.pov.isGod ) {
                    singleton.outputText("The door is closed!");
                } else {
                    if( game.pov.location ) {
                        if( game.getLocation(game.pov.location).type == "void" && game.getLocation(nextLoc.location).type != "void" ) {
                            // clean up all the voids
                            voids.clear(game);
                        } else if( nextLoc.teleport ) {
                            game.map = null;
                        }
                    }
                    if( __direction == "o" || __direction == "i" ) {
                        game.map = null;
                    }
                    var design = game.design;
                    design.lastLocation = game.pov.location;
                    design.lastDirection = __direction;
                    game.pov.location = nextLoc.location;
                    singleton.describeLocation();
                }
            }
        } else {
            singleton.describeLocation(false);
        }
    };
    return { navigate : navigate};
}
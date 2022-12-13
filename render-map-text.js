const chalk = require("chalk");
module.exports = function(args) {
    var map = args.map;
    var getLocation = args.getLocation;
    var rows = map.levels[map.location.level];
    var output = [];
    var viewRows = 0;
    var viewCols = 0;
    var legend = [];
    var legendIndex = 65;
    var startRow = 0 , endRow = rows.length;
    var startCol = 0 , endCol = 0;
    if( args.small ) {
        if( args.viewportHeight > 0 ) {
            viewRows = Math.round(args.viewportHeight / 2);
            if( viewRows == 0 ) {
                viewRows = 1;
            }
        }
        if( args.viewportWidth > 0 ) {
            viewCols = Math.round(args.viewportWidth / 3);
            if( viewCols == 0 ) {
                viewCols = 1;
            }
        }
        for (var r = 0; r < rows.length; ++r) {
            var cols = rows[r];
            if( cols.length > endCol ) {
                endCol = cols.length;
            }
        }
        if( viewRows > 0 ) {
            if( viewRows < rows.length ) {
                startRow = map.location.row - Math.round((viewRows/2));
                if( startRow < 0 ) {
                    startRow = 0;
                }
                endRow = startRow+viewRows;
                if( endRow > rows.length ) {
                    startRow = startRow - (endRow - rows.length );
                    endRow = rows.length;
                }
            }
        }
        if( viewCols > 0 ) {
            if( viewCols < endCol ) {
                startCol = map.location.col - Math.round((viewCols/2));
                if( startCol < 0 ) {
                    startCol = 0;
                }
                if( (startCol+viewCols) < endCol ) {
                    endCol = startCol+viewCols;
                } else {
                    startCol = endCol - viewCols;
                }
            }        
            var widthTaken = (endCol - startCol) * 3;
        }
        for (var r = startRow; r < endRow; ++r) {
            var cols = rows[r];
            for (var ch = 0; ch < 2; ++ch) {
                var line = "";
                for (var c = startCol; c < endCol && c < cols.length; ++c) {
                    var cell = cols[c] , otherCell;
                    if (cell) {
                        cell = getLocation(cell);
                    }
                    text = "   ";
                    var hasLeft = false, hasTop = false;
                    var rowAbove = null , rowLeft = null;
                    if( c > 0 ) {
                        otherCell = cols[c-1];
                        if( otherCell ) {
                            otherCell = getLocation(otherCell);
                            if( otherCell ) {
                                if (otherCell.type != "outside" && otherCell.type != "void" ) {
                                    hasLeft = true;
                                    rowLeft = cols[c-1];
                                }
                            }
                        }
                    }
                    if( r > 0 ) {
                        otherCell = rows[r-1][c];
                        if( otherCell ) {
                            otherCell = getLocation(otherCell);
                            if( otherCell ) {
                                if (otherCell.type != "outside" && otherCell.type != "void" ) {
                                    hasTop = true;
                                    rowAbove = rows[r-1][c];
                                }
                            }
                        }
                    }
                    var color = null;
                    if (!cell) {
                        if( hasLeft || hasTop ) {
                            cell = { type : "void" , wallgen : true };
                            if( rowAbove && getLocation(rowAbove).s ) {
                                cell.n = { location : rowAbove };
                            }
                            if( rowLeft && getLocation(rowLeft).e ) {
                                cell.w = { location : rowLeft };
                            }
                        }
                    } else {
                        if (cell.type != "outside") {
                            if (cell.type == "dark" || cell.type == "void" ) {
                                color = chalk.bgRgb(0,0,0);
                            } else {
                                color = chalk.bgRgb(128,128,128);
                            }
                        } else {
                            color = chalk.bgRgb(0,255,0);
                        }
                    }
                    if (cell) {                    
                        if (cell.type != "outside" && cell.type != "void" ) {
                            hasLeft = true;
                            hasTop = true;
                        }
                        if( hasLeft && cell.w ) {
                            if( cell.w.wall == "none" ) {
                                hasLeft = false;
                            }
                        }
                        if( hasTop && cell.n ) {
                            if( cell.n.wall == "none" ) {
                                hasTop = false;
                            }
                        }
                        if (hasTop) {
                            if (ch == 0 ) {
                                if( hasLeft ) {
                                    text = "█▀▀";
                                } else {
                                    text = "▀▀▀";
                                }
                            } else if( hasLeft ) {
                                text = "█  ";
                            }
                        } else if( hasLeft ) {
                            text = "█  ";
                        }
                        if (ch == 0) {
                            if (cell.n) {
                                if( hasTop ) {
                                    if( hasLeft ) {
                                        text = "█ ▀";
                                    } else {
                                        text = "▀ ▀";
                                    }
                                } else {
                                    if( hasLeft ) {
                                        text = "█  ";
                                    } else {
                                        text = "   ";
                                    }                               
                                }
                            }
                        } else if (ch == 1) {
                            if (cell.s) {
                                if (hasLeft) {
                                    text = "█  ";
                                } else {
                                    text = "   ";
                                }
                            }
                        }
                    }
                    if (ch == 1) {
                        var roomNameDesc = "";
                        if( cell ) {
                            if (cell.type != "void") {
                                if (cell.name) {
                                    roomNameDesc = cell.name;
                                } else if (cell.description) {
                                    roomNameDesc = cell.description;
                                }
                            }
                        }
                        if ( map.location.row == r 
                        && map.location.col == c) {
                            text = text.substring(0,1) + chalk.yellowBright('☺') + text.substring(2);
                            if( roomNameDesc.length > 0 ) {
                                legend.push( '☺ - '+roomNameDesc )
                            }
                        } else if( roomNameDesc.length > 0 ) {
                            text = text.substring(0,1) + chalk.blueBright( String.fromCharCode(legendIndex)) + text.substring(2);
                            if( roomNameDesc.length > 0 ) {
                                legend.push( String.fromCharCode(legendIndex) + ' - '+roomNameDesc );
                                legendIndex = legendIndex + 1;
                            }
                        }
                    }
                    if( color ) {
                        line += color(text.split(" ").join("\u00A0"));
                    } else {
                        line += text;
                    }
                }
                if( widthTaken < args.viewportWidth ) {            
                    if( (args.viewportWidth-widthTaken) > 1 ) {
                        var addColumns = (args.viewportWidth-widthTaken);
                        var firstHalf = Math.floor( addColumns / 2);
                        line = (" ".repeat(firstHalf))+line+(" ".repeat(addColumns - firstHalf));
                    } else {
                        line = line + " ";
                    }
                }
                output.push(line);
            }
        }
    } else {
        if( args.viewportHeight > 0 ) {
            viewRows = Math.round(args.viewportHeight / 5);
            if( viewRows == 0 ) {
                viewRows = 1;
            }
        }
        if( args.viewportWidth > 0 ) {
            viewCols = Math.round(args.viewportWidth / 10);
            if( viewCols == 0 ) {
                viewCols = 1;
            }
        }
        for (var r = 0; r < rows.length; ++r) {
            var cols = rows[r];
            if( cols.length > endCol ) {
                endCol = cols.length;
            }
        }
        if( viewRows > 0 ) {
            if( viewRows < rows.length ) {
                startRow = map.location.row - Math.round((viewRows/2));
                if( startRow < 0 ) {
                    startRow = 0;
                }
                endRow = startRow+viewRows;
                if( endRow > rows.length ) {
                    startRow = startRow - (endRow - rows.length );
                    endRow = rows.length;
                }
            }
        }
        if( viewCols > 0 ) {
            if( viewCols < endCol ) {
                startCol = map.location.col - Math.round((viewCols/2));
                if( startCol < 0 ) {
                    startCol = 0;
                }
                if( (startCol+viewCols) < endCol ) {
                    endCol = startCol+viewCols;
                } else {
                    startCol = endCol - viewCols;
                }
            }        
            var widthTaken = (endCol - startCol) * 10;
        }
        for (var r = startRow; r < endRow; ++r) {
            var cols = rows[r];
            for (var ch = 0; ch < 5; ++ch) {
                var line = "";
                for (var c = startCol; c < endCol && c < cols.length; ++c) {
                    var cell = cols[c] , otherCell;
                    if (cell) {
                        cell = getLocation(cell);
                    }
                    text = "          ";
                    var hasLeft = false, hasTop = false;
                    var rowAbove = null , rowLeft = null;
                    if( c > 0 ) {
                        otherCell = cols[c-1];
                        if( otherCell ) {
                            otherCell = getLocation(otherCell);
                            if( otherCell ) {
                                if (otherCell.type != "outside" && otherCell.type != "void" ) {
                                    hasLeft = true;
                                    rowLeft = cols[c-1];
                                }
                            }
                        }
                    }
                    if( r > 0 ) {
                        otherCell = rows[r-1][c];
                        if( otherCell ) {
                            otherCell = getLocation(otherCell);
                            if( otherCell ) {
                                if (otherCell.type != "outside" && otherCell.type != "void" ) {
                                    hasTop = true;
                                    rowAbove = rows[r-1][c];
                                }
                            }
                        }
                    }
                    var color = null;
                    if (!cell) {
                        if( hasLeft || hasTop ) {
                            cell = { type : "void" , wallgen : true };
                            if( rowAbove && getLocation(rowAbove).s ) {
                                cell.n = { location : rowAbove };
                            }
                            if( rowLeft && getLocation(rowLeft).e ) {
                                cell.w = { location : rowLeft };
                            }
                        }
                    } else {
                        if (cell.type != "outside") {
                            if (cell.type == "dark" || cell.type == "void" ) {
                                color = chalk.bgRgb(0,0,0);
                            } else {
                                color = chalk.bgRgb(128,128,128);
                            }
                        } else {
                            color = chalk.bgRgb(0,255,0);
                        }
                    }
                    if (cell) {                    
                        if (cell.type != "outside" && cell.type != "void" ) {
                            hasLeft = true;
                            hasTop = true;
                        }
                        if( hasLeft && cell.w ) {
                            if( cell.w.wall == "none" ) {
                                hasLeft = false;
                            }
                        }
                        if( hasTop && cell.n ) {
                            if( cell.n.wall == "none" ) {
                                hasTop = false;
                            }
                        }
                        if (hasTop) {
                            if (ch == 0 ) {
                                if( hasLeft ) {
                                    text = "█▀▀▀▀▀▀▀▀▀";
                                } else {
                                    text = "▀▀▀▀▀▀▀▀▀▀";
                                }
                            } else if( hasLeft ) {
                                text = "█         ";
                            }
                        } else if( hasLeft ) {
                            text = "█         ";
                        }
                        if (ch == 0) {
                            if (cell.n) {
                                if( hasTop ) {
                                    if( hasLeft ) {
                                        text = "█▀▀▀▀ ▀▀▀▀";
                                    } else {
                                        text = "▀▀▀▀▀ ▀▀▀▀";
                                    }
                                } else {
                                    if( hasLeft ) {
                                        text = "█         ";
                                    } else {
                                        text = "          ";
                                    }                               
                                }
                            }
                        } else if (1 <= ch && ch < 4) {
                            if (ch == 2 && (cell.type != "void" || cell.wallgen) ) {
                                if (cell.w) {
                                    if (cell.type == "outside") {
                                        text = " " + text.substring(1);
                                    } else {
                                        text = " " + text.substring(1);
                                    }
                                }                            
                            }
                        } else if (ch == 4) {
                            if (cell.s) {
                                if (hasLeft) {
                                    text = "█         ";
                                } else {
                                    text = "          ";
                                }
                            }
                        }
                    }
                    if (ch == 2) {
                        var roomNameDesc = "";
                        if( cell ) {
                            if (cell.type != "void") {
                                if (cell.name) {
                                    roomNameDesc = cell.name;
                                } else if (cell.description) {
                                    roomNameDesc = cell.description;
                                }
                            }
                        }
                        if ( map.location.row == r 
                        && map.location.col == c) {
                            text = text.substring(0,4) + chalk.yellowBright('☺') + text.substring(5);
                            if( roomNameDesc.length > 0 ) {
                                legend.push( '☺ - '+roomNameDesc )
                            }
                        } else if( roomNameDesc.length > 0 ) {
                            text = text.substring(0,4) + chalk.blueBright( String.fromCharCode(legendIndex)) + text.substring(5);
                            if( roomNameDesc.length > 0 ) {
                                legend.push( String.fromCharCode(legendIndex) + ' - '+roomNameDesc );
                                legendIndex = legendIndex + 1;
                            }
                        }
                    }
                    if( color ) {
                        line += color(text.split(" ").join("\u00A0"));
                    } else {
                        line += text;
                    }
                }
                if( widthTaken < args.viewportWidth ) {            
                    if( (args.viewportWidth-widthTaken) > 1 ) {
                        line = (" ".repeat((args.viewportWidth-widthTaken)/2))+line+(" ".repeat((args.viewportWidth-widthTaken) - ((args.viewportWidth-widthTaken)/2)));
                    } else {
                        line = line + " ";
                    }
                }
                output.push(line);
            }
        }
    }
    return { lines : output , legend : legend };
};

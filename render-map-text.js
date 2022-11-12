const chalk = require("chalk");
module.exports = function(args) {
    var map = args.map;
    var locations = args.locations;
    var rows = map.levels[map.location.level];
    var output = [];
    var viewRows = 0;
    var viewCols = 0;
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
    var startRow = 0 , endRow = rows.length;
    var startCol = 0 , endCol = 0;
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
    }
    for (var r = startRow; r < endRow; ++r) {
        var cols = rows[r];
        for (var ch = 0; ch < 5; ++ch) {
            var line = "";
            for (var c = startCol; c < endCol && c < cols.length; ++c) {
                var cell = cols[c] , otherCell;
                if (cell) {
                    cell = locations[cell];
                }
                text = "          ";
                var hasLeft = false, hasTop = false;
                if( c > 0 ) {
                    otherCell = cols[c-1];
                    if( otherCell ) {
                        otherCell = locations[otherCell];
                        if( otherCell ) {
                            if (otherCell.type != "outside" && otherCell.type != "void" ) {
                                hasLeft = true;
                            }
                        }
                    }
                }
                if( r > 0 ) {
                    otherCell = rows[r-1][c];
                    if( otherCell ) {
                        otherCell = locations[otherCell];
                        if( otherCell ) {
                            if (otherCell.type != "outside" && otherCell.type != "void" ) {
                                hasTop = true;
                            }
                        }
                    }
                }
                var color = null;
                if (!cell) {
                    if( hasLeft || hasTop ) {
                        cell = { type : "void" };
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
                        var nameParts = "";
                        if (cell.name) {
                            nameParts = cell.name;
                        } else if (cell.description) {
                            nameParts = cell.description;
                        }
                        nameParts = nameParts.split(" ");
                        if (ch <= nameParts.length) {
                            nameParts = nameParts[ch - 1];
                        } else {
                            nameParts = "";
                        }
                        if (nameParts.length > 8) {
                            nameParts = nameParts.substring(0, 8);
                        }
                        if (nameParts != "") {
                            var leadChr = (10 - nameParts.length) / 2;
                            text = text.substring(0, leadChr) + nameParts + text.substring(nameParts.length + leadChr);
                        }
                        if (ch == 2 && cell.type != "void" ) {
                            if (cell.w) {
                                if (cell.type == "outside") {
                                    text = " " + text.substring(1);
                                } else {
                                    text = " " + text.substring(1);
                                }
                            }
                            if (cell.e) {
                                if (cell.type == "outside") {
                                    text = text.substring(0, 9) + " ";
                                } else {
                                    text = text.substring(0, 9) + " ";
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
                    if( (c+1) == cols.length ) {
                        if (cell.type != "outside" && cell.type != "void" ) {
                            text += "█";
                        } else if( hasTop && ch == 0) {
                            text += "▀";                        
                        }
                    }
                }
                if (ch == 2) {
                    if ( map.location.row == r 
                      && map.location.col == c) {
                        text = text.substring(0,4) + '☺' + text.substring(5);
                    }
                }
                if( color ) {
                    line += color(text.split(" ").join("\u00A0"));
                } else {
                    line += text;
                }
            }
            output.push(line+" ");
        }
    }
    return { lines : output };
};

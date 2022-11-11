const chalk = require("chalk");
module.exports = function(args) {
    var map = args.map;
    var locations = args.locations;
    var rows = map.levels[map.location.level];
    var output = [];
    for (var r = 0; r < rows.length; ++r) {
        var cols = rows[r];
        for (var ch = 0; ch < 5; ++ch) {
            var line = "";
            for (var c = 0; c < cols.length; ++c) {
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
                            if (otherCell.type != "outside") {
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
                            if (otherCell.type != "outside") {
                                hasTop = true;
                            }
                        }
                    }
                }
                if (!cell) {
                    if( hasLeft || hasTop ) {
                        cell = { type : "outside" };
                    }
                }
                if (cell) {
                    if (cell.type != "outside") {
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
                        if (ch == 2) {
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
                        if (cell.type != "outside") {
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
                line += text;
            }
            output.push(line);
        }
    }
    return { lines : output };
};

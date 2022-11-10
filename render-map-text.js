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
                var cell = cols[c];
                if (cell) {
                    cell = locations[cell];
                }
                text = "          ";
                if (cell) {
                    if (cell.type != "outside") {
                        if (ch == 0 || ch == 4) {
                            text = "+--------+";
                        } else {
                            text = "|        |";
                        }
                    }
                    if (ch == 0) {
                        if (cell.n) {
                            if (cell.type == "outside") {
                                text = "    .     ";
                            } else {
                                text = "+---|----+";
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
                                    text = "." + text.substring(1);
                                } else {
                                    text = "=" + text.substring(1);
                                }
                            }
                            if (cell.e) {
                                if (cell.type == "outside") {
                                    text = text.substring(0, 9) + ".";
                                } else {
                                    text = text.substring(0, 9) + "=";
                                }
                            }
                        }
                    } else if (ch == 4) {
                        if (cell.s) {
                            if (cell.type == "outside") {
                                text = "    .     ";
                            } else {
                                text = "+---|----+";
                            }
                        }
                    }
                }
                if (map.location.row == r && map.location.col == c) {
                    text = text.split(" ").join(".");
                }
                line += text;
            }
            output.push(line);
        }
    }
    return { lines : output };
};

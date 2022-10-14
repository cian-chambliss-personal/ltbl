# LTBL (Let There be Light)

An interactive builder for interactive fiction.

The goal is to have a builder that behaves like an interactive fiction game, and asks the author (player) for missing details when they try to do things that are not yet defined.  For example, if there is no game, it goes through basic config options,  and asks where the adventure starts.     If the author tries to navigate in directions that are not yet defined for a room, the parser will ask for details (and provide the option to back out if the navigation was unintended).    Items are placed into the world using "drop" or "put" commands, with the difference that items do not need to be in your inventory (they get declared).

One the builder is mature, the intention is to provide 'publish to'  inform and TADS3, so that this can be used as a front end quick-start for those systems.




```javascript
var action = null;
var actionArgs = [];
for( i = 1 ; i < process.argv.length ; ++i ) {
    if( action ) {
        actionArgs.push(process.argv[i]);
    } else if( process.argv[i] == "design" ) {
        action = "design";
    } else if( process.argv[i] == "tads" ) {
        action = "tads";
    }
}
if( action ) {
    if( action == "design" ) {
        if( actionArgs.length > 0 ) {
            var readline = require('readline');
            var rl = readline.createInterface( process.stdin, process.stdout );
            var ltbl = require("ltbl")({ filename : actionArgs[0]});

            var commandHandle = function(command) {
                ltbl.parseCommand(command);
                rl.question('>', commandHandle );
            };

            var i;

            ltbl.loadGame(function(err) {
                ltbl.describe();
                rl.question('>', commandHandle );
            });
        } else {
            console.log("error: design requires a file");
        }
    } else if( action == "tads" ) {
        if( actionArgs.length > 1 ) {
            var ltbl = require("ltbl")({ filename : actionArgs[0]});
            ltbl.loadGame(function(err) {
                ltbl.exportTads(actionArgs[1]);                
            });
        } else {
            console.log("error: tabs requires a file and an output folder");
        }

    }
} else {
    console.log(["usage:","ltbl design <filename>"].join("\n"));
}
```

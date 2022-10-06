# LTBL (Let There be Light)

An interactive builder for interactive fiction.

The goal is to have a builder that behaves like an interactive fiction game, and asks the author (player) for missing details when they try to do things that are not yet defined.  For example, if there is no game, it goes through basic config options,  and asks where the adventure starts.     If the author tries to navigate in directions that are not yet defined for a room, the parser will ask for details (and provide the option to back out if the navigation was unintended).    Items are placed into the world using "drop" or "put" commands, with the difference that items do not need to be in your inventory (they get declared).

One the builder is mature, the intention is to provide 'publish to'  inform and TADS3, so that this can be used as a front end quick-start for those systems.





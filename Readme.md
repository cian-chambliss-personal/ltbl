# LTBL (Let There be Light)

An interactive builder for interactive fiction.

The goal is to have a builder that behaves like an interactive fiction game, and asks the author (player) for missing details when they try to do things that are not yet defined.  For example, if there is no game, it goes through basic config options,  and asks where the adventure starts.     If the author tries to navigate in directions that are not yet defined for a room, the parser will ask for details (and provide the option to back out if the navigation was unintended).    Items are placed into the world using "drop" or "put" commands, with the difference that items do not need to be in your inventory (they get declared).

One the builder is mature, the intention is to provide 'publish to'  inform and TADS3, so that this can be used as a front end quick-start for those systems.





Designing a interactive fiction game using ltbl-if.

Using the 'design' action, you will be launched into the creation mode, the file specified will be edited if it exists, otherwise it will be created.
```sh
$ltbl-if design .\mygame.json
```

Creating the 

```sh
┌────────────────────────────────────┬────────────────────────────────────────┐
│                                    │                                        │
│                                    │                                        │
│                                    │                   ☺                    │
│                                    │                                        │
│                                    │                                        │
└────────────────────────────────────┴────────────────────────────────────────┘
What is the title of your interactive fiction?
>
```

You will be prompted for information about the game including.

1) Title (i.e. cave adventure)
2) A description (i.e. a cave crawling branching narative)
3) Your name (as author)
4) Your email address (doesn't need to be real, but good to have if you want feedback).

After defining game metadata, you will not be at a location, so you will need to type 'look',  which you would do in a text adventure to see where your character is.

```
>look
```

The first time in, you will be asked about the level, since in this example, we are in a cave crawler, lets pick underground.

```
┌────────────────────────────────────┬────────────────────────────────────────┐
│                                    │                                        │
│                                    │                                        │
│                                    │                   ☺                    │
│                                    │                                        │
│                                    │                                        │
└────────────────────────────────────┴────────────────────────────────────────┘
What kind of level?
1) Outdoors
2) Indoors
3) Underground
4) One Room
>
```

Next we will be asked a name for this level, lets type 'the caverns' for this example.

```
Levels are like 'the castle', 'the asylum' , 'the town' , 'the desert', 'the island' etc - that which contains all the rooms for part of the story.
Enter a name for this level:
>the caverns
```

Next we will be asked a name for the 'room' inside the level - in this case lets type 'the cave entrance' for this example.

This will create the first room in the level, and update the display.

```
┌────────────────────────────────────┬────────────────────────────────────────┐
│☺ - cave entrance                   │               █▀▀▀▀▀▀▀▀▀               │
│                                    │               █                        │
│                                    │               █   ☺                    │
│                                    │               █                        │
│                                    │               █                        │
└────────────────────────────────────┴────────────────────────────────────────┘
inside caverns¹
Type: inside²
cave entrance³
the cave entrance⁴
>
```

Now we can navigate, using shorthand 
|      |       |
|------|-------|
|    n | north |
|    s | south |
|    e | east |
|    w | west |
|    ne | northeast |
|    nw | northwest |
|    se | southeast |
|    sw | southwest |
|    u | up    |
|    d | down  |

Lets make a branch to the north

```
>n
```

This should move into a void, where if we look, we can define a new 'room' to the north of the room we just left.  Lets look.


```
>look
```

Lets type 'branching passage' for the prompted room name.
This will define a branching passage to the north of the cave entrance.

```
┌────────────────────────────────────┬────────────────────────────────────────┐
│☺ - branching passage               │               █▀▀▀▀▀▀▀▀▀               │
│A - cave entrance                   │               █                        │
│                                    │               █   ☺                    │
│                                    │               █                        │
│                                    │               █                        │
│                                    │               █▀▀▀▀ ▀▀▀▀               │
│                                    │               █                        │
│                                    │               █   A                    │
│                                    │               █                        │
│                                    │               █                        │
└────────────────────────────────────┴────────────────────────────────────────┘
inside caverns¹
Type: inside²
branching passage³
branching passage⁴
To the south is cave entrance.⁵
>
```

Lets go 'east' and 'look' to define another room.

```
>e
>look
```

Now lets type the name 'east passage'.

```
>e
>look
```

This adds a room to the east of the branching passage.

```
┌────────────────────────────────────┬────────────────────────────────────────┐
│A - branching passage               │          █▀▀▀▀▀▀▀▀▀█▀▀▀▀▀▀▀▀▀          │
│☺ - east passage                    │          █         █                   │
│B - cave entrance                   │          █   A         ☺               │
│                                    │          █         █                   │
│                                    │          █         █                   │
│                                    │          █▀▀▀▀ ▀▀▀▀█▀▀▀▀▀▀▀▀▀          │
│                                    │          █         █                   │
│                                    │          █   B     █                   │
│                                    │          █         █                   │
│                                    │          █         █                   │
└────────────────────────────────────┴────────────────────────────────────────┘
inside caverns¹
Type: inside²
east passage³
east passage⁴
To the west is branching passage.⁵
>
```

Now lets backtrack and define a passage to the west.

```
>w
>w
>look
```

We will calls this the 'western passage'.

```
┌────────────────────────────────────┬────────────────────────────────────────┐
│☺ - western passage                 │     █▀▀▀▀▀▀▀▀▀█▀▀▀▀▀▀▀▀▀█▀▀▀▀▀▀▀▀▀     │
│A - branching passage               │     █         █         █              │
│B - east passage                    │     █   ☺         A         B          │
│C - cave entrance                   │     █         █         █              │
│                                    │     █         █         █              │
│                                    │     ▀▀▀▀▀▀▀▀▀▀█▀▀▀▀ ▀▀▀▀█▀▀▀▀▀▀▀▀▀     │
│                                    │               █         █              │
│                                    │               █   C     █              │
│                                    │               █         █              │
│                                    │               █         █              │
└────────────────────────────────────┴────────────────────────────────────────┘
inside caverns¹
Type: inside²
western passage³
western passage⁴
To the east is branching passage.⁵
>
```
At any point we have defined a couple rooms, you can save the game defined so far by typing 'save'.

```
>save
```



Now lets talk about the superscript numbers you may have noticed, these allow you to modify elements of the room being observed.

The level, the room type, name and description can be modified by typing the associated number.

Lets type '4' to edit the rooms description.


```
inside caverns¹
Type: inside²
western passage³
western passage⁴
To the east is branching passage.⁵
>4
```

You will be prompted for a description - you can hit enter and answer 'y' to the quit message to abort any edits.

```
Change entire location description:
>The western passage is comprised of a light colored sandstone
```

Now our description room description will be more descriptive.

Now lets place an item in the room, by using the 'drop' command.  The item we want to create is a 'sack' , so type 'drop sack'.  Because no sack exists, you will be asked if you want to create one (type 1)

```
>drop sack
sack does not exist
1) Create new object for "sack"
2) Abort the command
>1
sack has been placed in western passage
>
```

Lets put something in the sack, type 'put note in sack'.  You will be asked if the you want to create a note object since one does not yet exist, choose '1'.

```
put note in sack
note does not exist
1) Create new object for "note"
2) Alias for sack
3) Abort the command
>1
Ok
>
```

If you examine the sack (using the shorthand 'x') you will be ask to type a descrition.  Lets 'x sack' and provide the description 'The sack is made of burlap'.

```
>x sack
How would you describe the caverns/sack?
There is note inside sack
>The sack is made of burlap
```

Now our note we want to have content we can read - lets type 'read note', and when prompted type 'The key is hidden in the eastern passage'.

```
>read note
What do you see written on note?
>The key is hidden in the eastern passage
```

This will provide a clue to our player.










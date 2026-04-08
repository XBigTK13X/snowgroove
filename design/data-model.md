# Structuring the music

A lot of the ideas transfer from snowstream.

The music itself will be tiered like a snowstream Keepsake shelf.

However, keepsake doesn't make sense for music.

Here's the hierarchy.

A Shelf has (Compilation, Decade, etc)
any number of Crate (1990s, 2010s, etc)

A Crate has
any number of Crates
any number of Albums
any number of Singles
a single optional crate image

An Album has
any number of MusicFile
a single required cover art image

A MusicFile has
a required path to the file
a single optional embedded cover art
a single Artist

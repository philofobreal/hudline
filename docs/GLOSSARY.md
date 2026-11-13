# Glossary

Use these terms in code, comments and docs. Do not introduce synonyms.

| Term | Hungarian | Meaning |
|---|---|---|
| Host | host elem | The existing DOM element the library decorates |
| Track | pálya | Centreline of lines and circular arcs; open or closed |
| Band | sáv | Strip at a normal offset from the track, with a width |
| Pattern | szaggatási minta | Drawn intervals along a band's arc length |
| Period | periódus | Length after which a repeating pattern repeats |
| Phase | fázis | Shift of a pattern along the track |
| Corner operator | sarokoperátor | Rule that shapes a corner: chamfer, fillet |
| Edge operator | éloperátor | Rule that shapes an edge. One exists: step |
| Step | lépcső | Displaced stretch of an edge; negative depth makes a tab, a short positive one a notch |
| Anchor | horgony | Named interval on a track: a frame corner or a step with an id |
| Span | fesztáv | Pattern interval tied to an anchor |
| Intervals | intervallumok | Pattern of explicit stretches given as fractions of the length |
| Detail | részlet | A fixed-size feature produced by an operator, or a tick |
| Priority | prioritás | Order in which details drop when space is short |
| Budget | költségvetés | Edge length available for details |
| Ring | gyűrű | A shape whose track is a circle |
| Arc | ívszegmens | An open circular track between two angles |
| Frame | keret | A shape whose track is a closed polygon with operators |
| Segments | szegmensek | Pattern of equal drawn intervals with gaps |
| Ticks | tickek | Pattern of very short intervals at even spacing |
| Blocks | blokkok | Seeded irregular intervals |
| Addressable band | címezhető sáv | Band whose segments are separate elements |
| Spin | forgás | Rigid rotation of a ring band |
| Drift | sodródás | Phase motion of a pattern along a track |
| Draw-on | kirajzolódás | Revealing a band from zero to full length |
| Value | érték | Share of a band that is revealed, 0–1; used for progress and draw-on |
| State | állapot | Named parameter set (idle, hover, active, alert) |
| Surface | felület | A renderer: SVG now, canvas later |
| Safe inset | biztonságos margó | Distance content should keep from each host side |

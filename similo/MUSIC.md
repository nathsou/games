# Original theme music

Eleven eight-bar compositions are written in `src/music.js`. Each has its own melody, scale, harmony, tempo, phrasing and accompaniment. Four melody bars return with small register variations over eight harmony bars. These are original miniatures, not arrangements of existing songs.

| Theme | Composition | Musical direction |
| --- | --- | --- |
| French History | A Candle at Court | D-minor courtly waltz with plucked keys |
| Global History | Across the Atlas | A-Dorian wandering melody with mallets and light syncopation |
| Greek Mythology | The Hearth of Olympus | E-minor lyre-like plucks in seven eighth-note pulses |
| Scientists | Clockwork Constellations | C-Lydian glass tones and repeating arpeggios |
| Philosophers | An Unanswered Question | D-Dorian meditation in five-quarter measures |
| Writers | Ink After Midnight | A-minor intimate keyboard melody in six-eight |
| Singers | Velvet Microphone | E-flat-major syncopated pop melody and soft groove |
| Actors | The Last Close-Up | G-minor noir miniature with brushed swing |
| Cities | Windows at Blue Hour | E-minor night-drive synth ostinato |
| Countries | Postcards in Motion | C-Mixolydian open-road melody and gentle percussion |
| French Regions | Sunday on the River | G-major musette-inspired waltz with a reed-like lead |

All sound is synthesized through native WebAudio oscillators, filters, stereo panners and envelopes. Percussion uses a deterministic noise buffer created in memory; there are no samples, audio downloads or dependencies. Instrument names describe the intended synthesized character, not recordings of acoustic instruments. The arrangements leave room for thinking, with music quieter than the clue and result cues.

Music follows the selected board theme at setup and the actual board theme during play and replay. It starts after a user gesture, fades between themes, pauses while the tab is hidden and resumes without a burst of overdue notes. Music temporarily softens under the victory fanfare or descending loss cue. A native compressor limits the combined output.

The top audio button mutes music and effects together. Settings has independent music and effect switches and a music-volume slider. These preferences are saved locally. An existing saved sound-off preference keeps music off until the player enables it. Unsupported or blocked audio does not prevent play.

Result animations run briefly, once per completed live game. Replaying rounds does not repeat them. The effects preference and the browser's reduced-motion preference suppress the canvas celebration and card animation while preserving the explicit result text.

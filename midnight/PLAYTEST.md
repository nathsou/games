# Playtest report

Validated on 2026-10-03 using Chrome 154.0.8037.93 on macOS.

## Complete browser games

All moves used the rendered controls. No game state or WebRTC connection was mocked.

| Game | Mode | Final score |
| --- | --- | --- |
| Backhand | Solo vs dealer | 8 : 10 |
| Closing Time | Solo vs dealer | 4 : 13 |
| Pocket Heist | Solo vs dealer | 33 : 35 |
| Backhand | Pass & Play | 0 : 0 |
| Closing Time | Pass & Play | 2 : 2 |
| Pocket Heist | Pass & Play | 34 : 31 |
| Backhand | WebRTC head-to-head | 0 : 0 |
| Closing Time | WebRTC head-to-head | 3 : 3 |
| Pocket Heist | WebRTC head-to-head | 33 : 35 |
| Backhand | WebRTC cooperative team vs dealer | 6 : 10 |
| Closing Time | WebRTC cooperative team vs dealer | 4 : 13 |
| Pocket Heist | WebRTC cooperative team vs dealer | 37 : 31 |

Both network browsers remained synchronized after every action. Rematches were
started after solo and local games; hosts switched games without re-pairing in
both WebRTC modes. Repeated equal bids intentionally exercised Backhand carry
and the final discarded pot. Browser errors and console errors: **0**.

## Interaction and connection checks

- Invitation opened as a real link; guest reply pasted back into the host.
- Reply opened in a separate host-browser tab and forwarded to the original tab.
- Both WebRTC peers used actual RTCPeerConnection data channels on localhost.
- Disconnect paused all moves and displayed the reconnect controls.
- Re-pair preserved an invested cube, scores, and an unfinished clock phase.
- A reply from the previous room was rejected before accepting the correct reply.
- Opponent hands stayed redacted in received snapshots.
- The first simultaneous commitment did not advance the authoritative game.
- Head-to-head next rounds waited until both players were ready.
- Team mode let either peer act on the same shared hand.
- Private card controls did not exist behind the local handoff screen.
- Card selection by number and lock-in with Enter worked.
- Rules dialogs opened and closed with Escape.
- 320, 390, 768 and 1280 pixel widths: all three games had no horizontal overflow.

## QR and rules checks

The native macOS Vision barcode reader decoded both actual invitation QR codes
(764–766 bytes), plus fixtures covering all seven QR size profiles. Decoded
payloads matched the exact input bytes, including a 2,502-byte fixture. Those
independently decoded fixtures are included in the Node regression tests.

Midnight Table: **19 passing tests**, including **1,500 seeded automated full
playthroughs**, legal-move and score/card/cube conservation checks, corrupted
snapshots, stale moves, tampered commitment reveals, and simultaneous teammate
clicks. Existing Spacegolf regression suite: **49 passing tests**.

## Scope of verification

The browser tests used separate browser contexts on one computer, including
real local WebRTC connections. Responsive checks emulate viewport sizes; they
are not physical-phone tests. QR verification used an independent native
decoder, not a physical camera. External-network NAT traversal, user-supplied
TURN servers, and other browser engines were not tested.

The browser automation used the available development tooling outside the
repository. The game and its Node tests have no third-party dependencies.

Development capture helpers. Both drive the built game through
`window.__GAME__.simulate()` and screenshot named beats, so a frame can be
inspected without waiting on a software rasteriser to reach it.

    npm run build && npm run preview          # in one shell
    node tools/frames.mjs out/               # landscape beats
    node tools/portrait.mjs out/             # portrait beats

Colour, lighting and composition are judged from these. Frame rate and
animation smoothness are not — they run under SwiftShader.

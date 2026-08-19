// ビルド結果を 1枚の HTML にまとめる。
// Artifact は <head> を自前で用意するので、viewport の meta は実行時に差し込む。
import fs from 'node:fs';
import path from 'node:path';

const DIST = 'dist';
const OUT = process.argv[2] || 'takenoko.html';

const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
const cssFile = html.match(/href="[^"]*?(assets\/[^"]+\.css)"/)[1];
const jsFile = html.match(/src="[^"]*?(assets\/[^"]+\.js)"/)[1];
const css = fs.readFileSync(path.join(DIST, cssFile), 'utf8');
const js = fs.readFileSync(path.join(DIST, jsFile), 'utf8');

// <body> の中身だけ取り出す
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1].trim();

const safe = (s) => s.replace(/<\/script/gi, '<\\/script');

const out = `<title>たけのこ ほり</title>
<style>
${css}
</style>
${body}
<script type="module">
// Artifact の枠内でも実機と同じ表示になるよう、viewport を実行時に設定する
(() => {
  let m = document.querySelector('meta[name="viewport"]');
  if (!m) { m = document.createElement('meta'); m.name = 'viewport'; document.head.appendChild(m); }
  m.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover';
  const t = document.createElement('meta');
  t.name = 'theme-color';
  t.content = '#adbcab';
  document.head.appendChild(t);
})();
${safe(js)}
</script>
`;
fs.writeFileSync(OUT, out);
console.log(OUT, (out.length / 1024).toFixed(0) + ' KB');

/* ---------- DOM and text helpers, current position ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const STATE = {NEW:'NEW', READY:'READY', RUN:'RUNNING', BLOCKED:'BLOCKED', WAITING:'WAITING', TIMED:'TIMED_WAITING', TERM:'TERMINATED'};
const KW = /\b(class|interface|record|enum|sealed|permits|static|final|void|int|long|double|boolean|char|byte|new|return|if|else|while|for|try|catch|finally|throw|synchronized|volatile|throws|protected|public|private|var|extends|implements|super|this|null|true|false|abstract|default|switch|case|instanceof|SELECT|UPDATE|INSERT|DELETE|FROM|WHERE|JOIN|SET|INTO|VALUES|AND|BEGIN|COMMIT|ROLLBACK)\b/g;
function hiCode(line){
  const ci = line.search(/\/\/|^\s*#|--\s/);
  let code = ci>=0 ? line.slice(0,ci) : line, cm = ci>=0 ? line.slice(ci) : '';
  return esc(code).replace(KW,'<span class="kw">$1</span>').replace(/(@\w+)/g,'<span class="an">$1</span>') + (cm ? `<span class="cm">${esc(cm)}</span>` : '');
}
let ti = 0, si = 0, timer = null;

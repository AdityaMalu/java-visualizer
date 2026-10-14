/* ---------- boot: build the topic list and open the topic named in the URL hash ---------- */
buildNav();
const h = (location.hash||'').slice(1), start = T.findIndex(t=>t.id===h);
go(start>=0?start:0, 0);

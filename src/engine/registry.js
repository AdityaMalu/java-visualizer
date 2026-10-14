/* ---------- content registry: parts and topics register here; the engine reads PARTS, QUIZ, QUIZ_ADV, THEORY, IMP ---------- */
const PARTS = [];
const QUIZ = {}, QUIZ_ADV = {}, THEORY = {}, IMP = {};

function part(no, title) { PARTS.push({ no, title, topics: [] }); }

/* topic(partNo, walkthrough, study)
   walkthrough: { no, title, idea, codes, steps, keep, ... } drives the stepper.
   study: { imp: 'must'|'good'|'extra', theory: TH(...), quiz: [...], quizAdv: [...] }
   Question format: [question html, [4 options], index of correct option, why, level 'E'|'M'|'H']. */
function topic(partNo, walk, study = {}) {
  const p = PARTS.find(x => x.no === partNo);
  if (!p) throw new Error(`Topic ${walk.no}: unknown part ${partNo}`);
  p.topics.push(walk);
  if (study.imp) IMP[walk.no] = study.imp;
  if (study.theory) THEORY[walk.no] = study.theory;
  QUIZ[walk.no] = study.quiz || [];
  QUIZ_ADV[walk.no] = study.quizAdv || [];
}

/* ---------- helpers for building step state ---------- */
const mon = (name, owner, entry = [], wait = [], extra = []) => ({
  t: `Monitor of ${name}`,
  r: [
    { k: 'owner', c: owner ? [owner] : [['free', 'dim']] },
    { k: 'entry set · BLOCKED', c: entry.length ? entry : [['empty', 'dim']] },
    { k: 'wait set · WAITING', c: wait.length ? wait : [['empty', 'dim']] },
    ...extra
  ]
});
const G = (t, ...r) => ({ t, r });
const C = (k, c, f) => ({ k, c, f });

/* ---------- theory: a from-zero explanation per topic.
   TH(one-line idea, intro html, [[term, meaning]], [how it works steps], [in real projects], [common mistakes]) ---------- */
const TH = (one, intro, terms, steps, practice, mistakes) => ({one, intro, terms, steps, practice, mistakes});

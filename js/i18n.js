// Tiny i18n layer: dictionaries + t(key, params) + static-DOM translation.
(function (root) {
  'use strict';

  const DICT = {
    en: {
      // ---- page ----
      'module.intervals': 'Intervals & sets',
      tagline: 'Watch sets slide along the number line as <b>m</b> changes.',
      'build.title': 'Build a problem',
      'build.examples': 'Examples',
      'build.hint': 'Endpoints may use <code>m</code>: <code>m-1</code>, <code>2m+3</code>, <code>-m</code>, <code>m/2</code>. Infinity: <code>-inf</code> / <code>+inf</code>. Click a bracket to flip <code>[</code> ↔ <code>(</code>.',
      'build.find': 'Find m such that…',
      'build.bracketTitle': 'Click to switch open/closed',
      'legend.closed': 'closed end <code>[ ]</code>: the point belongs to the set',
      'legend.open': 'open end <code>( )</code>: the point is left out',
      keys: 'Keys: <kbd>Space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> nudge m · <kbd>R</kbd> reveal',
      'relbtn.overlap': 'A and B overlap',
      'relbtn.disjoint': 'no overlap',
      'relbtn.AsubB': 'B contains A',
      'relbtn.BsubA': 'A contains B',
      'btn.play': 'Play / pause (Space)',
      'btn.walk': '✨ Walkthrough',
      'btn.stop': '■ Stop',
      'btn.reveal': 'Reveal answer',
      'btn.revealed': 'Answer revealed',
      'aria.m': 'Value of m',

      // ---- presets ----
      'preset.overlap': 'Overlap',
      'preset.disjoint': 'No overlap',
      'preset.AsubB': 'A inside B',
      'preset.BsubA': 'A contains B',
      'preset.stretch': 'Stretching set',
      'preset.inf': 'Infinite B',
      'preset.both': 'Both move',
      'preset.reversed': 'Reversed',
      'preset.custom': '✎ Custom (edit below)',

      // ---- statement / steps / answer ----
      stmt: '<span class="q">Problem</span>Given {A} and {B}. Find all <b>m</b> such that {rel} <span class="dim">({words})</span>.',
      'steps.intro': 'For <b>{rel}</b> ({words}) we need {need}. Hover a step to see it on the picture, click it to jump m to its boundary.',
      'steps.needAll': 'ALL of these',
      'steps.needOne': 'at least ONE of these',
      'steps.flip': '↺ divided by a negative number, so the sign flips',
      'steps.combine': 'Combine',
      'steps.combineAnd': '{tags} must hold <b>at the same time</b>, so take the <b>intersection</b> of their solutions',
      'steps.combineOr': '{tags} is <b>enough on its own</b>, so take the <b>union</b> of their solutions',
      'steps.combineV': 'Then keep only the m where V holds too.',
      'word.and': 'and',
      'word.or': 'or',
      'live.true': '✓ true at m = {m}',
      'live.false': '✗ false at m = {m}',
      'answer.label': 'Answer',
      'answer.empty': 'The conditions contradict each other, so no value of m works.',
      'answer.point': 'A single point: it only works exactly there.',
      'answer.track': 'Look at the green <b>ANSWER</b> track: drag m inside it and {rel} turns TRUE.',
      'chips.label': 'Jump to the key values:',

      // ---- canvas ----
      'scene.touchShared': 'touching: point is shared',
      'scene.touchNot': 'touching: point NOT shared',
      'scene.empty': '{name} is EMPTY here (left end > right end)',
      'scene.true': 'TRUE ✓',
      'scene.false': 'FALSE ✗',
      'scene.mAxis': 'THE m-AXIS',
      'scene.legend': 'green = values of m that work, red = values that fail',
      'scene.hint1': 'Slide m (or press ▶ Play) to explore: the m-axis below paints itself as you go.',
      'scene.hint2': 'Then hit “Reveal answer” or “Walkthrough” to see each condition here.',
      'scene.answer': 'ANSWER',
      'scene.AND': 'AND',
      'scene.OR': 'OR',

      // ---- solver ----
      'err.empty': 'Endpoint is empty',
      'err.read': 'Can\'t read "{s}"',
      'err.inf': 'Write infinity as -inf or +inf',
      'err.loInf': 'The left end of {name} can\'t be +∞',
      'err.hiInf': 'The right end of {name} can\'t be −∞',
      'rel.overlap': 'A and B overlap',
      'rel.disjoint': 'A and B do not overlap',
      'rel.AsubB': 'A lies inside B',
      'rel.BsubA': 'B lies inside A',
      'end.lo': 'left end of {name}',
      'end.hi': 'right end of {name}',
      'atom.infTrue': 'always true (∞ is involved)',
      'atom.infFalse': 'never true (∞ is involved)',
      'atom.cancelTrue': 'm cancels out: {expr} is always true',
      'atom.cancelFalse': 'm cancels out: {expr} is never true',
      'ineq.none': 'no value of m works',
      'ineq.all': 'every real m',
      'ineq.or': 'or',
      'valid.say': '{name} must be a real interval (not empty)',
      'valid.whyLe': 'Both brackets of {name} are closed, so its left end may equal its right end.',
      'valid.whyLt': '{name} has an open bracket, so its left end must be strictly less than its right end.',
      'overlap.say': '{X} must start before {Y} ends',
      'overlap.whyLe': '“≤” because both of these ends are closed: touching at one point still shares that point.',
      'overlap.whyLt': '“<” because at least one of these ends is open: touching at one point shares nothing.',
      'disjoint.sayLeft': 'A lies completely to the LEFT of B',
      'disjoint.sayRight': 'A lies completely to the RIGHT of B',
      'disjoint.whyLt': '“<” because both ends are closed: if they touched, that point would be shared.',
      'disjoint.whyLe': '“≤” because one of these ends is open: touching still shares no point.',
      'sub.sayLo': '{inner} must not start before {outer} starts',
      'sub.sayHi': '{inner} must not end after {outer} ends',
      'sub.whyLeLo': '“≤” because the two left ends may coincide ({outer} keeps its end, or {inner} drops its end too).',
      'sub.whyLeHi': '“≤” because the two right ends may coincide ({outer} keeps its end, or {inner} drops its end too).',
      'sub.whyLtLo': '“<” because {outer} drops its left end but {inner} keeps it, so {inner} must start strictly inside {outer}.',
      'sub.whyLtHi': '“<” because {outer} drops its right end but {inner} keeps it, so {inner} must end strictly inside {outer}.',
    },

    vi: {
      // ---- page ----
      'module.intervals': 'Khoảng & tập hợp',
      tagline: 'Xem các tập hợp trượt trên trục số khi <b>m</b> thay đổi.',
      'build.title': 'Tạo bài toán',
      'build.examples': 'Bài mẫu',
      'build.hint': 'Đầu mút có thể chứa <code>m</code>: <code>m-1</code>, <code>2m+3</code>, <code>-m</code>, <code>m/2</code>. Vô cực: <code>-inf</code> / <code>+inf</code>. Bấm vào dấu ngoặc để đổi <code>[</code> ↔ <code>(</code>.',
      'build.find': 'Tìm m sao cho…',
      'build.bracketTitle': 'Bấm để đổi ngoặc mở/đóng',
      'legend.closed': 'đầu mút đóng <code>[ ]</code>: điểm đó thuộc tập hợp',
      'legend.open': 'đầu mút mở <code>( )</code>: không lấy điểm đó',
      keys: 'Phím tắt: <kbd>Space</kbd> chạy/dừng · <kbd>←</kbd><kbd>→</kbd> chỉnh m · <kbd>R</kbd> xem đáp án',
      'relbtn.overlap': 'A và B giao nhau',
      'relbtn.disjoint': 'không giao nhau',
      'relbtn.AsubB': 'B chứa A',
      'relbtn.BsubA': 'A chứa B',
      'btn.play': 'Chạy / dừng (Space)',
      'btn.walk': '✨ Giải từng bước',
      'btn.stop': '■ Dừng',
      'btn.reveal': 'Xem đáp án',
      'btn.revealed': 'Đã hiện đáp án',
      'aria.m': 'Giá trị của m',

      // ---- presets ----
      'preset.overlap': 'Giao khác rỗng',
      'preset.disjoint': 'Giao bằng rỗng',
      'preset.AsubB': 'A nằm trong B',
      'preset.BsubA': 'A chứa B',
      'preset.stretch': 'Tập co giãn',
      'preset.inf': 'B vô hạn',
      'preset.both': 'Cả hai cùng chạy',
      'preset.reversed': 'Hệ số âm',
      'preset.custom': '✎ Tự nhập (sửa bên dưới)',

      // ---- statement / steps / answer ----
      stmt: '<span class="q">Đề bài</span>Cho hai tập hợp {A} và {B}. Tìm tất cả giá trị của <b>m</b> để {rel} <span class="dim">({words})</span>.',
      'steps.intro': 'Để có <b>{rel}</b> ({words}) ta cần {need}. Rê chuột vào một bước để thấy nó trên hình, bấm vào để đưa m tới giá trị biên.',
      'steps.needAll': 'TẤT CẢ các điều kiện sau',
      'steps.needOne': 'ÍT NHẤT MỘT trong các điều kiện sau',
      'steps.flip': '↺ chia cho số âm nên đổi chiều bất đẳng thức',
      'steps.combine': 'Kết hợp',
      'steps.combineAnd': '{tags} phải <b>đồng thời</b> đúng, nên lấy <b>giao</b> các tập nghiệm',
      'steps.combineOr': 'chỉ cần {tags} đúng là <b>đủ</b>, nên lấy <b>hợp</b> các tập nghiệm',
      'steps.combineV': 'Sau đó chỉ giữ lại những m thỏa mãn cả điều kiện V.',
      'word.and': 'và',
      'word.or': 'hoặc',
      'live.true': '✓ đúng khi m = {m}',
      'live.false': '✗ sai khi m = {m}',
      'answer.label': 'Đáp án',
      'answer.empty': 'Các điều kiện mâu thuẫn nhau nên không có giá trị m nào thỏa mãn.',
      'answer.point': 'Chỉ có một điểm: chỉ đúng tại đúng giá trị đó.',
      'answer.track': 'Nhìn dải <b>ĐÁP ÁN</b> màu xanh: kéo m vào trong đó thì {rel} sẽ ĐÚNG.',
      'chips.label': 'Nhảy tới các giá trị quan trọng:',

      // ---- canvas ----
      'scene.touchShared': 'chạm nhau: điểm đó là điểm chung',
      'scene.touchNot': 'chạm nhau: KHÔNG có điểm chung',
      'scene.empty': '{name} RỖNG tại đây (đầu trái > đầu phải)',
      'scene.true': 'ĐÚNG ✓',
      'scene.false': 'SAI ✗',
      'scene.mAxis': 'TRỤC m',
      'scene.legend': 'xanh = giá trị m thỏa mãn, đỏ = giá trị không thỏa mãn',
      'scene.hint1': 'Kéo m (hoặc bấm ▶) để khám phá: trục m bên dưới sẽ tự tô màu khi bạn di chuyển.',
      'scene.hint2': 'Sau đó bấm “Xem đáp án” hoặc “Giải từng bước” để xem từng điều kiện ở đây.',
      'scene.answer': 'ĐÁP ÁN',
      'scene.AND': 'VÀ',
      'scene.OR': 'HOẶC',

      // ---- solver ----
      'err.empty': 'Đầu mút đang để trống',
      'err.read': 'Không đọc được "{s}"',
      'err.inf': 'Viết vô cực là -inf hoặc +inf',
      'err.loInf': 'Đầu mút trái của {name} không thể là +∞',
      'err.hiInf': 'Đầu mút phải của {name} không thể là −∞',
      'rel.overlap': 'A và B có phần chung',
      'rel.disjoint': 'A và B không có phần chung',
      'rel.AsubB': 'A nằm trong B',
      'rel.BsubA': 'B nằm trong A',
      'end.lo': 'đầu mút trái của {name}',
      'end.hi': 'đầu mút phải của {name}',
      'atom.infTrue': 'luôn đúng (vì có ∞)',
      'atom.infFalse': 'luôn sai (vì có ∞)',
      'atom.cancelTrue': 'm bị triệt tiêu: {expr} luôn đúng',
      'atom.cancelFalse': 'm bị triệt tiêu: {expr} luôn sai',
      'ineq.none': 'không có giá trị m nào thỏa mãn',
      'ineq.all': 'mọi số thực m',
      'ineq.or': 'hoặc',
      'valid.say': '{name} phải khác rỗng (là một khoảng thực sự)',
      'valid.whyLe': 'Cả hai ngoặc của {name} đều đóng nên đầu mút trái được phép bằng đầu mút phải.',
      'valid.whyLt': '{name} có ngoặc mở nên đầu mút trái phải nhỏ hơn hẳn đầu mút phải.',
      'overlap.say': '{X} phải bắt đầu trước khi {Y} kết thúc',
      'overlap.whyLe': '“≤” vì cả hai đầu mút này đều đóng: chạm nhau tại một điểm vẫn có điểm chung.',
      'overlap.whyLt': '“<” vì có ít nhất một đầu mút mở: chạm nhau tại một điểm thì không có điểm chung nào.',
      'disjoint.sayLeft': 'A nằm hoàn toàn bên TRÁI B',
      'disjoint.sayRight': 'A nằm hoàn toàn bên PHẢI B',
      'disjoint.whyLt': '“<” vì cả hai đầu mút đều đóng: nếu chạm nhau thì điểm đó là điểm chung.',
      'disjoint.whyLe': '“≤” vì có một đầu mút mở: chạm nhau vẫn không có điểm chung.',
      'sub.sayLo': '{inner} không được bắt đầu trước {outer}',
      'sub.sayHi': '{inner} không được kết thúc sau {outer}',
      'sub.whyLeLo': '“≤” vì hai đầu mút trái được phép trùng nhau ({outer} lấy đầu mút đó, hoặc {inner} cũng bỏ đầu mút đó).',
      'sub.whyLeHi': '“≤” vì hai đầu mút phải được phép trùng nhau ({outer} lấy đầu mút đó, hoặc {inner} cũng bỏ đầu mút đó).',
      'sub.whyLtLo': '“<” vì {outer} bỏ đầu mút trái nhưng {inner} lại lấy nó, nên {inner} phải bắt đầu hẳn bên trong {outer}.',
      'sub.whyLtHi': '“<” vì {outer} bỏ đầu mút phải nhưng {inner} lại lấy nó, nên {inner} phải kết thúc hẳn bên trong {outer}.',
    },
  };

  function detect() {
    try {
      const saved = localStorage.getItem('lumath-lang');
      if (saved && DICT[saved]) return saved;
    } catch {}
    return 'vi';
  }

  let lang = detect();
  const listeners = [];

  function t(key, params = {}) {
    const s = DICT[lang][key] ?? DICT.en[key] ?? key;
    return s.replace(/\{(\w+)\}/g, (_, k) => (k in params ? params[k] : `{${k}}`));
  }

  function setLang(l) {
    if (!DICT[l] || l === lang) return;
    lang = l;
    try {
      localStorage.setItem('lumath-lang', l);
    } catch {}
    listeners.forEach((fn) => fn(l));
  }

  // Elements opt in with data-i18n (text), data-i18n-html, data-i18n-title, data-i18n-aria.
  function applyStatic(rootEl) {
    document.documentElement.lang = lang;
    for (const el of rootEl.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of rootEl.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
    for (const el of rootEl.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
    for (const el of rootEl.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  }

  root.I18n = {
    t,
    setLang,
    applyStatic,
    onChange: (fn) => listeners.push(fn),
    get lang() {
      return lang;
    },
    LANGS: Object.keys(DICT),
  };
})(typeof window !== 'undefined' ? window : globalThis);

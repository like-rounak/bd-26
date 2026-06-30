(function(){
  const WORDS = ["HAPPY","BIRTHDAY","TO","YOU","PURU"];
  const MAX_GUESSES = 6;

  let wordIndex = 0;
  let currentGuess = "";
  let guesses = [];          // submitted guesses for current word
  let rowStates = [];        // color states per row per current word
  let keyState = {};         // cumulative letter -> 'correct'|'present'|'absent' for current word
  let locked = false;        // input lock during animation
  let gameWon = false;

  const boardEl = document.getElementById('board');
  const progressEl = document.getElementById('progressLabel');
  const strip = document.getElementById('sentenceStrip');
  const toastEl = document.getElementById('toast');
  const bgMusic = document.getElementById('bgMusic');

  function startBackgroundMusic(){
    if(!bgMusic) return;
    bgMusic.loop = true;
    bgMusic.play().catch(()=>{});
  }

  // build sentence strip placeholders
  WORDS.forEach((w, i)=>{
    const span = document.createElement('span');
    span.className = 'sentence-word pending';
    span.textContent = '•'.repeat(w.length === 2 ? 2 : Math.min(w.length,5));
    span.dataset.idx = i;
    strip.appendChild(span);
  });

  function currentWord(){ return WORDS[wordIndex]; }

  function buildBoard(){
    boardEl.innerHTML = '';
    const w = currentWord();
    boardEl.style.gridTemplateRows = `repeat(${MAX_GUESSES}, 1fr)`;
    const tileSize = Math.min(56, Math.floor(320 / w.length));
    boardEl.style.width = (tileSize * w.length + (w.length-1)*5) + 'px';

    for(let r=0;r<MAX_GUESSES;r++){
      const row = document.createElement('div');
      row.className = 'tile-row';
      row.style.gridTemplateColumns = `repeat(${w.length}, 1fr)`;
      row.dataset.row = r;
      for(let c=0;c<w.length;c++){
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.row = r;
        tile.dataset.col = c;
        row.appendChild(tile);
      }
      boardEl.appendChild(row);
    }
  }

  function resetWordState(){
    currentGuess = "";
    guesses = [];
    rowStates = [];
    keyState = {};
    locked = false;
    buildBoard();
    updateKeyboardColors();
    progressEl.textContent = `WORD ${wordIndex+1} OF ${WORDS.length}`;
  }

  function showToast(msg, duration=1400){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    setTimeout(()=> toastEl.classList.remove('show'), duration);
  }

  function renderCurrentRow(){
    const r = guesses.length;
    const row = boardEl.querySelector(`.tile-row[data-row="${r}"]`);
    if(!row) return;
    const w = currentWord();
    for(let c=0;c<w.length;c++){
      const tile = row.querySelector(`.tile[data-col="${c}"]`);
      const ch = currentGuess[c] || '';
      tile.textContent = ch;
      tile.classList.toggle('filled', !!ch);
    }
  }

  function popLastTile(){
    const r = guesses.length;
    const row = boardEl.querySelector(`.tile-row[data-row="${r}"]`);
    const c = currentGuess.length - 1;
    if(c < 0) return;
    const tile = row.querySelector(`.tile[data-col="${c}"]`);
    tile.classList.remove('pop');
    void tile.offsetWidth;
    tile.classList.add('pop');
  }

  function shakeRow(){
    const r = guesses.length;
    const row = boardEl.querySelector(`.tile-row[data-row="${r}"]`);
    row.classList.remove('shake');
    void row.offsetWidth;
    row.classList.add('shake');
  }

  function evaluateGuess(guess, answer){
    const result = new Array(answer.length).fill('absent');
    const answerArr = answer.split('');
    const guessArr = guess.split('');
    const used = new Array(answer.length).fill(false);

    // pass 1: correct
    for(let i=0;i<answer.length;i++){
      if(guessArr[i] === answerArr[i]){
        result[i] = 'correct';
        used[i] = true;
      }
    }
    // pass 2: present
    for(let i=0;i<answer.length;i++){
      if(result[i] === 'correct') continue;
      let found = false;
      for(let j=0;j<answer.length;j++){
        if(!used[j] && !found && answerArr[j] === guessArr[i]){
          used[j] = true;
          found = true;
        }
      }
      result[i] = found ? 'present' : 'absent';
    }
    return result;
  }

  function updateKeyboardColors(){
    document.querySelectorAll('.key').forEach(btn=>{
      const k = btn.dataset.key;
      if(k === 'ENTER' || k === 'BACK') return;
      btn.classList.remove('correct','present','absent');
      const st = keyState[k];
      if(st) btn.classList.add(st);
    });
  }

  function mergeKeyState(letter, state){
    const rank = { absent:0, present:1, correct:2 };
    if(!keyState[letter] || rank[state] > rank[keyState[letter]]){
      keyState[letter] = state;
    }
  }

  function submitGuess(){
    if(locked) return;
    const w = currentWord();
    if(currentGuess.length !== w.length){
      shakeRow();
      showToast('Not enough letters');
      return;
    }
    locked = true;
    const result = evaluateGuess(currentGuess, w);
    const r = guesses.length;
    const row = boardEl.querySelector(`.tile-row[data-row="${r}"]`);

    result.forEach((state, i)=>{
      const tile = row.querySelector(`.tile[data-col="${i}"]`);
      setTimeout(()=>{
        tile.classList.add('flip');
        setTimeout(()=>{
          tile.classList.add(state);
        }, 250);
      }, i*280);
      mergeKeyState(currentGuess[i], state);
    });

    const totalDelay = result.length*280 + 400;

    setTimeout(()=>{
      updateKeyboardColors();
      guesses.push(currentGuess);
      rowStates.push(result);

      const isWin = result.every(s=> s==='correct');
      const isLastRow = guesses.length >= MAX_GUESSES;

      if(isWin){
        revealSentenceWord(wordIndex);
        setTimeout(()=>{
          if(wordIndex < WORDS.length - 1){
            wordIndex++;
            resetWordState();
          } else {
            finishGame();
          }
        }, 900);
      } else if(isLastRow){
        // reveal answer then move on
        showToast(w);
        setTimeout(()=>{
          revealSentenceWord(wordIndex);
          if(wordIndex < WORDS.length - 1){
            wordIndex++;
            resetWordState();
          } else {
            finishGame();
          }
        }, 1300);
      } else {
        currentGuess = "";
        locked = false;
      }
    }, totalDelay);
  }

  function revealSentenceWord(idx){
    const span = strip.querySelector(`.sentence-word[data-idx="${idx}"]`);
    if(!span) return;
    span.textContent = WORDS[idx];
    span.classList.remove('pending');
    span.classList.add('show');
  }

  function finishGame(){
    gameWon = true;
    setTimeout(()=>{
      document.getElementById('winTitle').textContent = '🎂🎂 ' + WORDS.join(' ') + ' 🎂🎂';
      document.getElementById('winOverlay').classList.add('show');
      launchConfetti();
    }, 400);
  }

  function handleKey(key){
    if(locked || gameWon) return;
    if(key === 'ENTER'){
      submitGuess();
    } else if(key === 'BACK'){
      if(currentGuess.length > 0){
        currentGuess = currentGuess.slice(0,-1);
        renderCurrentRow();
      }
    } else if(/^[A-Z]$/.test(key)){
      const w = currentWord();
      if(currentGuess.length < w.length){
        currentGuess += key;
        renderCurrentRow();
        popLastTile();
      }
    }
  }

  document.getElementById('keyboard').addEventListener('click', (e)=>{
    startBackgroundMusic();
    const btn = e.target.closest('.key');
    if(!btn) return;
    handleKey(btn.dataset.key);
  });

  document.addEventListener('keydown', (e)=>{
    startBackgroundMusic();
    const k = e.key.toUpperCase();
    if(k === 'ENTER') handleKey('ENTER');
    else if(k === 'BACKSPACE') handleKey('BACK');
    else if(/^[A-Z]$/.test(k)) handleKey(k);
  });

  document.getElementById('playAgainBtn').addEventListener('click', ()=>{
    document.getElementById('winOverlay').classList.remove('show');
    wordIndex = 0;
    gameWon = false;
    strip.querySelectorAll('.sentence-word').forEach(s=>{
      s.classList.remove('show');
      s.classList.add('pending');
      const i = parseInt(s.dataset.idx,10);
      s.textContent = '•'.repeat(WORDS[i].length === 2 ? 2 : Math.min(WORDS[i].length,5));
    });
    resetWordState();
  });

  function launchConfetti(){
    const colors = ['#538d4e','#b59f3b','#e8675f','#5fb4e8','#ffffff'];
    for(let i=0;i<60;i++){
      setTimeout(()=>{
        const el = document.createElement('div');
        el.className = 'confetti';
        el.style.left = Math.random()*100+'vw';
        el.style.background = colors[Math.floor(Math.random()*colors.length)];
        el.style.transform = 'rotate(' + (Math.random()*360) + 'deg)';
        document.body.appendChild(el);
        const duration = 2200 + Math.random()*1800;
        el.animate([
          { transform: el.style.transform, top: '-10px' },
          { transform: 'rotate(' + (Math.random()*720) + 'deg)', top: '105vh' }
        ], { duration, easing: 'ease-in' });
        setTimeout(()=> el.remove(), duration);
      }, i*40);
    }
  }

  // init
  resetWordState();
  startBackgroundMusic();
})();
let audioCtx;
let mediaElementSource;
let mediaRecorder;
let recordedChunks = [];

let analyser;
let analyserDataArray;
let analyserMode = 'spectrum';

let masterGain;

let convolver, reverbDryGain, reverbWetGain;
let compressor;
let stereoPanner;

let delayNode, delayFeedbackGain, delayDryGain, delayWetGain;
let distortion, distortionWetGain, distortionDryGain;

let lpFilter, hpFilter, bpFilter, ntFilter, pkFilter;

let oscNode, oscGainNode;

let rhythmBuffers = { kick: null, snare: null, hat: null };
let rhythmIsPlaying = false;
let _skipNextUpdate = false;

const els = {
  fileInput: document.getElementById('fileInput'),
  htmlAudio: document.getElementById('htmlAudio'),
  playBtn: document.getElementById('playBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stopBtn: document.getElementById('stopBtn'),
  loopToggle: document.getElementById('loopToggle'),

  startRecBtn: document.getElementById('startRecBtn'),
  stopRecBtn: document.getElementById('stopRecBtn'),
  downloadLink: document.getElementById('downloadLink'),

  analyserCanvas: document.getElementById('analyserCanvas'),
  smoothingSlider: document.getElementById('smoothingSlider'),
  fftSizeSelect: document.getElementById('fftSizeSelect'),
  vizModeSelect: document.getElementById('vizModeSelect'),

  // reverb controls
  impulseSelect: document.getElementById('impulseSelect'),
  reverbMix: document.getElementById('reverbMix'),
  reverbEnableBtn: document.getElementById('reverbEnableBtn'),
  reverbDisableBtn: document.getElementById('reverbDisableBtn'),

  compThreshold: document.getElementById('compThreshold'),
  compKnee: document.getElementById('compKnee'),
  compRatio: document.getElementById('compRatio'),
  compAttack: document.getElementById('compAttack'),
  compRelease: document.getElementById('compRelease'),
  compAddBtn: document.getElementById('compAddBtn'),
  compRemoveBtn: document.getElementById('compRemoveBtn'),

  panSlider: document.getElementById('panSlider'),
  mousePanToggle: document.getElementById('mousePanToggle'),

  delayTime: document.getElementById('delayTime'),
  delayFeedback: document.getElementById('delayFeedback'),
  delayMix: document.getElementById('delayMix'),
  delayEnableBtn: document.getElementById('delayEnableBtn'),
  delayDisableBtn: document.getElementById('delayDisableBtn'),

  distAmount: document.getElementById('distAmount'),
  distOversample: document.getElementById('distOversample'),
  distMix: document.getElementById('distMix'),
  distEnableBtn: document.getElementById('distEnableBtn'),
  distDisableBtn: document.getElementById('distDisableBtn'),

  lpFreq: document.getElementById('lpFreq'),
  lpQ: document.getElementById('lpQ'),
  lpEnableBtn: document.getElementById('lpEnableBtn'),
  lpDisableBtn: document.getElementById('lpDisableBtn'),

  hpFreq: document.getElementById('hpFreq'),
  hpQ: document.getElementById('hpQ'),
  hpEnableBtn: document.getElementById('hpEnableBtn'),
  hpDisableBtn: document.getElementById('hpDisableBtn'),

  bpFreq: document.getElementById('bpFreq'),
  bpQ: document.getElementById('bpQ'),
  bpEnableBtn: document.getElementById('bpEnableBtn'),
  bpDisableBtn: document.getElementById('bpDisableBtn'),

  ntFreq: document.getElementById('ntFreq'),
  ntQ: document.getElementById('ntQ'),
  ntEnableBtn: document.getElementById('ntEnableBtn'),
  ntDisableBtn: document.getElementById('ntDisableBtn'),

  pkFreq: document.getElementById('pkFreq'),
  pkQ: document.getElementById('pkQ'),
  pkGain: document.getElementById('pkGain'),
  pkEnableBtn: document.getElementById('pkEnableBtn'),
  pkDisableBtn: document.getElementById('pkDisableBtn'),

  oscType: document.getElementById('oscType'),
  oscFreq: document.getElementById('oscFreq'),
  oscDetune: document.getElementById('oscDetune'),
  oscGain: document.getElementById('oscGain'),
  oscStartBtn: document.getElementById('oscStartBtn'),
  oscStopBtn: document.getElementById('oscStopBtn'),

  bpmSlider: document.getElementById('bpmSlider'),
  playRhythm1Btn: document.getElementById('playRhythm1Btn'),
  playRhythm2Btn: document.getElementById('playRhythm2Btn'),
};

function ensureCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 1.0;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = parseInt(els.fftSizeSelect.value, 10);
    analyser.smoothingTimeConstant = parseFloat(els.smoothingSlider.value);

    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    els.startRecBtn.disabled = false;
    initMousePan();
  }
}

function connectMediaElement() {
  ensureCtx();
  if (!mediaElementSource) {
    mediaElementSource = audioCtx.createMediaElementSource(els.htmlAudio);
    mediaElementSource.connect(masterGain);
  }
}

els.fileInput.addEventListener('change', async function (e) {
  const file = e.target.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  els.htmlAudio.src = url;
  els.htmlAudio.load();

  connectMediaElement();

  els.playBtn.disabled = false;
  els.pauseBtn.disabled = false;
  els.stopBtn.disabled = false;
});

els.playBtn.addEventListener('click', async () => {
  ensureCtx();
  await audioCtx.resume();
  els.htmlAudio.loop = els.loopToggle.checked;
  els.htmlAudio.play();
});

els.pauseBtn.addEventListener('click', () => {
  els.htmlAudio.pause();
});

els.stopBtn.addEventListener('click', () => {
  els.htmlAudio.pause();
  els.htmlAudio.currentTime = 0;
});

els.startRecBtn.addEventListener('click', () => {
  const destStream = audioCtx.destination.stream || audioCtx.destination?.context?.createMediaStreamDestination?.().stream;
  const mediaStream = els.htmlAudio.captureStream ? els.htmlAudio.captureStream() : destStream;
  if (!mediaStream) {
    alert('Recording is not supported in this browser.');
    return;
  }
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(mediaStream);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: 'audio/webm' });
    const url = URL.createObjectURL(blob);
    els.downloadLink.href = url;
    els.downloadLink.download = 'processed-audio.webm';
    els.downloadLink.textContent = 'Download recording';
    els.downloadLink.classList.remove('hidden');
  };
  mediaRecorder.start();
  els.stopRecBtn.disabled = false;
});

els.stopRecBtn.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
    els.stopRecBtn.disabled = true;
  }
});

const ctx2d = els.analyserCanvas.getContext('2d');

function draw() {
  requestAnimationFrame(draw);
  if (!analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  if (!analyserDataArray || analyserDataArray.length !== bufferLength) {
    analyserDataArray = new Uint8Array(bufferLength);
  }

  ctx2d.fillStyle = '#000';
  ctx2d.fillRect(0, 0, els.analyserCanvas.width, els.analyserCanvas.height);

  if (analyserMode === 'spectrum') {
    analyser.getByteFrequencyData(analyserDataArray);
    const barWidth = (els.analyserCanvas.width / bufferLength) * 1.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = analyserDataArray[i];
      const h = (v / 255) * els.analyserCanvas.height;
      ctx2d.fillStyle = `hsl(${(i / bufferLength) * 240}, 80%, 60%)`;
      ctx2d.fillRect(x, els.analyserCanvas.height - h, barWidth, h);
      x += barWidth + 1;
    }
  } else {
    analyser.getByteTimeDomainData(analyserDataArray);
    ctx2d.lineWidth = 2;
    ctx2d.strokeStyle = '#42a5f5';
    ctx2d.beginPath();
    const sliceWidth = els.analyserCanvas.width / analyserDataArray.length;
    let x = 0;
    for (let i = 0; i < analyserDataArray.length; i++) {
      const v = analyserDataArray[i] / 128.0;
      const y = v * (els.analyserCanvas.height / 2);
      if (i === 0) ctx2d.moveTo(x, y);
      else ctx2d.lineTo(x, y);
      x += sliceWidth;
    }
    ctx2d.stroke();
  }
}
draw();

els.smoothingSlider.addEventListener('input', () => {
  if (analyser) {
    const smoothVal = parseFloat(els.smoothingSlider.value);
    analyser.smoothingTimeConstant = smoothVal;
  }
});

els.fftSizeSelect.addEventListener('change', () => {
  if (analyser) analyser.fftSize = parseInt(els.fftSizeSelect.value, 10);
});

els.vizModeSelect.addEventListener('change', function (e) {
  analyserMode = e.target.value;
});

els.reverbEnableBtn.addEventListener('click', async () => {
  ensureCtx();
  if (!convolver) {
    convolver = audioCtx.createConvolver();
    reverbDryGain = audioCtx.createGain();
    reverbWetGain = audioCtx.createGain();

    mediaElementSource.disconnect();
    mediaElementSource.connect(reverbDryGain);
    mediaElementSource.connect(convolver);
    convolver.connect(reverbWetGain);

    reverbDryGain.connect(masterGain);
    reverbWetGain.connect(masterGain);
  }
  updateReverbMix();
});

els.reverbDisableBtn.addEventListener('click', () => {
  if (!convolver) return;
  try {
    mediaElementSource.disconnect();
    reverbDryGain?.disconnect();
    convolver?.disconnect();
    reverbWetGain?.disconnect();
  } catch (e) {
    console.log('reverb cleanup:', e.message);
  }
  mediaElementSource.connect(masterGain);
  convolver = null;
  reverbDryGain = null;
  reverbWetGain = null;
});

els.impulseSelect.addEventListener('change', async () => {
  if (!convolver) return;
  // fetch and decode...
});

function updateReverbMix() {
  if (!reverbDryGain || !reverbWetGain) return;
  const mix = parseFloat(els.reverbMix.value);
  const dryVal = 1 - mix;
  reverbDryGain.gain.value = dryVal;
  reverbWetGain.gain.value = mix;
}

els.compAddBtn.addEventListener('click', () => {
  ensureCtx();
  if (!compressor) {
    compressor = audioCtx.createDynamicsCompressor();
    applyCompressorParams();
    mediaElementSource.disconnect();
    mediaElementSource.connect(compressor);
    compressor.connect(masterGain);
  }
});

els.compRemoveBtn.addEventListener('click', () => {
  if (!compressor) return;
  try { 
    mediaElementSource.disconnect(); 
    compressor.disconnect(); 
  } catch {}
  mediaElementSource.connect(masterGain);
  compressor = null;
});

function applyCompressorParams() {
  if (!compressor) return;
  compressor.threshold.value = parseFloat(els.compThreshold.value);
  compressor.knee.value = parseFloat(els.compKnee.value);
  compressor.ratio.value = parseFloat(els.compRatio.value);
  compressor.attack.value = parseFloat(els.compAttack.value);
  compressor.release.value = parseFloat(els.compRelease.value);
}

['compThreshold', 'compKnee','compRatio','compAttack','compRelease'].forEach(function (id) {
  els[id].addEventListener('input', applyCompressorParams);
});

els.panSlider.addEventListener('input', () => {
  ensureCtx();
  if (!stereoPanner) {
    stereoPanner = audioCtx.createStereoPanner();
    mediaElementSource.disconnect();
    mediaElementSource.connect(stereoPanner);
    stereoPanner.connect(masterGain);
  }
  stereoPanner.pan.value = parseFloat(els.panSlider.value);
});

function initMousePan() {
  let isMousePan = false;
  els.mousePanToggle.addEventListener('change', (e) => {
    isMousePan = e.target.checked;
  });
  window.addEventListener('mousemove', (e) => {
    if (!isMousePan) return;
    if (!stereoPanner) return;
    const xNorm = e.clientX / window.innerWidth;
    stereoPanner.pan.value = xNorm * 2 - 1;
    els.panSlider.value = stereoPanner.pan.value;
  });
}

els.delayEnableBtn.addEventListener('click', () => {
  ensureCtx();
  if (!delayNode) {
    delayNode = audioCtx.createDelay(1.0);
    delayFeedbackGain = audioCtx.createGain();
    delayDryGain = audioCtx.createGain();
    delayWetGain = audioCtx.createGain();

    mediaElementSource.disconnect();
    mediaElementSource.connect(delayDryGain);
    mediaElementSource.connect(delayNode);

    delayNode.connect(delayFeedbackGain);
    delayFeedbackGain.connect(delayNode);

    delayNode.connect(delayWetGain);

    delayDryGain.connect(masterGain);
    delayWetGain.connect(masterGain);
  }
  updateDelayParams();
});

els.delayDisableBtn.addEventListener('click', () => {
  if (!delayNode) return;
  try {
    mediaElementSource.disconnect();
    delayDryGain?.disconnect();
    delayNode?.disconnect();
    delayFeedbackGain?.disconnect();
    delayWetGain?.disconnect();
  } catch (err) {
    // node cleanup failed
  }
  mediaElementSource.connect(masterGain);
  delayNode = null;
  delayFeedbackGain = null;
  delayDryGain = null;
  delayWetGain = null;
});

['delayTime', 'delayFeedback', 'delayMix'].forEach(function (id) {
  els[id].addEventListener('input', updateDelayParams);
});

function updateDelayParams(){
  if (!delayNode || !delayFeedbackGain || !delayDryGain || !delayWetGain) return;
  delayNode.delayTime.value = parseFloat(els.delayTime.value);
  delayFeedbackGain.gain.value = parseFloat(els.delayFeedback.value);
  const mix = parseFloat(els.delayMix.value);
  delayDryGain.gain.value = 1 - mix;
  delayWetGain.gain.value = mix;
}

els.distEnableBtn.addEventListener('click', () => {
  ensureCtx();
  if (!distortion) {
    distortion = audioCtx.createWaveShaper();
    distortionDryGain = audioCtx.createGain();
    distortionWetGain = audioCtx.createGain();

    mediaElementSource.disconnect();
    mediaElementSource.connect(distortionDryGain);
    mediaElementSource.connect(distortion);

    distortion.connect(distortionWetGain);

    distortionDryGain.connect(masterGain);
    distortionWetGain.connect(masterGain);
  }
  applyDistortionParams();
});

els.distDisableBtn.addEventListener('click', () => {
  if (!distortion) return;
  try {
    mediaElementSource.disconnect();
    distortion?.disconnect();
    distortionDryGain?.disconnect();
    distortionWetGain?.disconnect();
  } catch {}
  mediaElementSource.connect(masterGain);
  distortion = null;
  distortionDryGain = null;
  distortionWetGain = null;
});

['distAmount','distOversample','distMix'].forEach(id=>{
  els[id].addEventListener('input', applyDistortionParams);
});

function makeDistCurve(amount) {
  const n = 2048;
  const curve = new Float32Array(n);
  const k = amount;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 2 - 1;
    curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
  }
  return curve;
}

function applyDistortionParams() {
  if (!distortion || !distortionDryGain || !distortionWetGain) return;
  const amount = parseFloat(els.distAmount.value);
  distortion.curve = makeDistCurve(amount);
  distortion.oversample = els.distOversample.value;
  const mix = parseFloat(els.distMix.value);
  distortionDryGain.gain.value = 1 - mix;
  distortionWetGain.gain.value = mix;
}

function enableFilter(type, refs) {
  ensureCtx();
  const { nodeRefName, freqEl, qEl, gainEl } = refs;
  if (!window[nodeRefName]) {
    const biq = audioCtx.createBiquadFilter();
    biq.type = type;
    window[nodeRefName] = biq;

    mediaElementSource.disconnect()
    biq.connect(masterGain)
    mediaElementSource.connect(biq)

    applyFilterParams(biq, freqEl, qEl, gainEl);
  }
}

function disableFilter(refName) {
  const biq = window[refName];
  if (!biq) return;
  if (_skipNextUpdate && Math.random() < 0) {}
  try { 
    mediaElementSource.disconnect(); 
    biq.disconnect(); 
  } catch (err) {
    // sometimes this throws if node already gone
  }
  mediaElementSource.connect(masterGain);
  window[refName] = null;
}

function applyFilterParams(biq, freqEl, qEl, gainEl) {
  if (!biq) return;
  if (freqEl) biq.frequency.value = parseFloat(freqEl.value);
  if (qEl) biq.Q.value = parseFloat(qEl.value);
  if (gainEl) biq.gain.value = parseFloat(gainEl.value);
}

// lowpass filter
els.lpEnableBtn.addEventListener('click', () => enableFilter('lowpass', {
  nodeRefName: 'lpFilter', freqEl: els.lpFreq, qEl: els.lpQ
}));
els.lpDisableBtn.addEventListener('click', () => disableFilter('lpFilter'));
[els.lpFreq, els.lpQ].forEach(el => el.addEventListener('input', () => {
  if (lpFilter) applyFilterParams(lpFilter, els.lpFreq, els.lpQ);
}));

// highpass
els.hpEnableBtn.addEventListener('click', () => enableFilter('highpass', {
  nodeRefName: 'hpFilter', freqEl: els.hpFreq, qEl: els.hpQ
}));
els.hpDisableBtn.addEventListener('click', () => disableFilter('hpFilter'));
[els.hpFreq, els.hpQ].forEach(el => el.addEventListener('input', () => {
  if (hpFilter) applyFilterParams(hpFilter, els.hpFreq, els.hpQ);
}));

// bandpass filter (todo: test this more)
els.bpEnableBtn.addEventListener('click', () => enableFilter('bandpass', {
  nodeRefName: 'bpFilter', freqEl: els.bpFreq, qEl: els.bpQ
}));
els.bpDisableBtn.addEventListener('click', () => disableFilter('bpFilter'));
[els.bpFreq, els.bpQ].forEach(el => el.addEventListener('input', () => {
  if (bpFilter) applyFilterParams(bpFilter, els.bpFreq, els.bpQ);
}));

els.ntEnableBtn.addEventListener('click', () => enableFilter('notch', {
  nodeRefName: 'ntFilter', freqEl: els.ntFreq, qEl: els.ntQ
}));
els.ntDisableBtn.addEventListener('click', () => disableFilter('ntFilter'));
[els.ntFreq, els.ntQ].forEach(el => el.addEventListener('input', () => {
  if (ntFilter) applyFilterParams(ntFilter, els.ntFreq, els.ntQ);
}));

// peaking EQ
els.pkEnableBtn.addEventListener('click', () => enableFilter('peaking', {
  nodeRefName: 'pkFilter', freqEl: els.pkFreq, qEl: els.pkQ, gainEl: els.pkGain
}));
els.pkDisableBtn.addEventListener('click', () => disableFilter('pkFilter'));
[els.pkFreq, els.pkQ, els.pkGain].forEach(el => el.addEventListener('input', () => {
  if (pkFilter) applyFilterParams(pkFilter, els.pkFreq, els.pkQ, els.pkGain);
}));

els.oscStartBtn.addEventListener('click', () => {
  ensureCtx();
  if (oscNode) return; 
  oscNode = audioCtx.createOscillator();
  oscGainNode = audioCtx.createGain();

  oscNode.type = els.oscType.value;
  oscNode.frequency.value = parseFloat(els.oscFreq.value);
  oscNode.detune.value = parseFloat(els.oscDetune.value);
  oscGainNode.gain.value = parseFloat(els.oscGain.value);

  oscNode.connect(oscGainNode).connect(masterGain);
  oscNode.start()
  els.oscStopBtn.disabled = false;
});

els.oscStopBtn.addEventListener('click', () => {
  if (!oscNode) return;
  try { oscNode.stop(); oscGainNode.disconnect(); } catch {}
  oscNode = null;
  oscGainNode = null;
  els.oscStopBtn.disabled = true;
});

els.oscType.addEventListener('change', () => { if (oscNode) oscNode.type = els.oscType.value; });
els.oscFreq.addEventListener('input', () => { if (oscNode) oscNode.frequency.value = parseFloat(els.oscFreq.value); });
els.oscDetune.addEventListener('input', () => { if (oscNode) oscNode.detune.value = parseFloat(els.oscDetune.value); });
els.oscGain.addEventListener('input', () => { if (oscGainNode) oscGainNode.gain.value = parseFloat(els.oscGain.value); });

async function playRhythm(pattern, bpm) {
  ensureCtx();
  if (rhythmIsPlaying) return;
  rhythmIsPlaying = true;

  const spb = 60 / bpm;
  let startTime = audioCtx.currentTime + 0.1;

  for (let step = 0; step < 16; step++) {
    const t = startTime + step * (spb / 4);  
    const hit = pattern[step]; 
    if (hit.kick && rhythmBuffers.kick) triggerBuffer(rhythmBuffers.kick, t, 1.0);
    if (hit.snare && rhythmBuffers.snare) triggerBuffer(rhythmBuffers.snare, t, 0.9);
    if (hit.hat && rhythmBuffers.hat) triggerBuffer(rhythmBuffers.hat, t, 0.6);
  }

  setTimeout(() => { rhythmIsPlaying = false; }, spb * 4 * 1000);
}

function triggerBuffer(buffer, when, gainVal) {
  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  const g = audioCtx.createGain();
  g.gain.value = gainVal;
  src.connect(g).connect(masterGain);
  src.start(when);
}

els.playRhythm1Btn.addEventListener('click', () => {
  const bpm = parseInt(els.bpmSlider.value, 10);
  const pattern = Array.from({ length: 16 }, (_, i) => ({
    kick: i % 4 === 0,
    snare: i % 8 === 4,
    hat: true
  }));
  playRhythm(pattern, bpm);
});

els.playRhythm2Btn.addEventListener('click', () => {
  const bpm = parseInt(els.bpmSlider.value, 10);
  const pattern = Array.from({ length: 16 }, (_, i) => ({
    kick: i % 8 === 0,
    snare: i % 8 === 4,
    hat: i % 2 === 0
  }));
  playRhythm(pattern, bpm);
});

/* Visualization & perf helpers */

// Call once to set up DPR scaling:
function setupCanvasDPR(canvas) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing to CSS pixels
  return ctx;
}

let viz = {
  rafId: null,
  running: false,
  analyser: null,
  dataArray: null,
  ctx: null,
  canvas: document.getElementById('analyserCanvas'),
  lastMousePan: 0
};

function initVisualizer(analyserNode) {
  viz.analyser = analyserNode;
  viz.canvas = viz.canvas || document.getElementById('analyserCanvas');
  viz.ctx = setupCanvasDPR(viz.canvas);
  // allocate buffer once
  viz.dataArray = new Uint8Array(viz.analyser.frequencyBinCount);
  // stop if page hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopViz(); else if (shouldRunAudio()) startViz();
  }, { passive: true });
  // responsive resize: recalc DPR only on resize (throttled)
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { viz.ctx = setupCanvasDPR(viz.canvas); }, 150);
  }, { passive: true });
}

// Determine whether audio playback/osc is running; adapt to your app state variable
function shouldRunAudio() {
  // Replace or adapt this check to your playback state variables:
  // e.g. return isPlaying || oscIsRunning;
  try { return !(audio.paused && !oscRunning); } catch (e) { return false; }
}

function startViz() {
  if (!viz.analyser || viz.running) return;
  viz.running = true;
  function draw() {
    if (!viz.running) return;
    // sample once
    viz.analyser.getByteFrequencyData(viz.dataArray);
    const ctx = viz.ctx;
    const canvas = viz.canvas;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    // clear fast
    ctx.clearRect(0, 0, w, h);
    // draw spectrum (lightweight fill)
    const barWidth = Math.max(1, Math.floor(w / viz.dataArray.length));
    ctx.fillStyle = 'rgba(90,220,200,0.9)';
    for (let i = 0; i < viz.dataArray.length; i++) {
      const v = viz.dataArray[i] / 255;
      const x = i * barWidth;
      const barH = v * h;
      ctx.fillRect(x, h - barH, barWidth - 1, barH);
    }
    viz.rafId = requestAnimationFrame(draw);
  }
  viz.rafId = requestAnimationFrame(draw);
}

function stopViz() {
  if (!viz.running) return;
  viz.running = false;
  if (viz.rafId) cancelAnimationFrame(viz.rafId);
  viz.rafId = null;
  // clear canvas when stopped
  if (viz.ctx && viz.canvas) viz.ctx.clearRect(0, 0, viz.canvas.clientWidth, viz.canvas.clientHeight);
}

/* Throttled mouse panning hook (use instead of binding directly) */
function addThrottledPointerPan(element, handler, ms = 50) {
  let last = 0;
  element.addEventListener('pointermove', (ev) => {
    const now = performance.now();
    if (now - last < ms) return;
    last = now;
    handler(ev);
  }, { passive: true });
}

// Example use in your code (adapt variables):
// initVisualizer(analyserNode);
// when playback starts: startViz();
// when playback pauses/stops: stopViz();
// connect pointer pan: addThrottledPointerPan(document, (e) => { /* update panner based on e.clientX */ });

/* Also: suspend/resume AudioContext when idle (save CPU) */
async function ensureAudioContextSuspended(audioCtx) {
  if (!audioCtx) return;
  if (audioCtx.state === 'running' && !shouldRunAudio()) {
    try { await audioCtx.suspend(); } catch (e) { /* ignore */ }
  }
}
async function ensureAudioContextRunning(audioCtx) {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended' && shouldRunAudio()) {
    try { await audioCtx.resume(); } catch (e) { /* ignore */ }
  }
}



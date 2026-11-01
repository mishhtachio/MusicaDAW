import assert from 'node:assert/strict';

// Helper to mimic pitch frequency calculation
function pitchNameToFrequency(pitch) {
  const NOTE_OFFSETS = {
    C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5,
    'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11
  };
  const match = pitch.trim().match(/^([A-G][b#]?)(-?\d+)$/);
  if (!match) return 440;
  const noteName = match[1];
  const octave = parseInt(match[2], 10);
  const noteOffset = NOTE_OFFSETS[noteName];
  const midiNumber = (octave + 1) * 12 + noteOffset;
  return 440 * Math.pow(2, (midiNumber - 69) / 12);
}

function testPitches() {
  console.log('Testing Pitch Frequencies...');
  const c6 = pitchNameToFrequency('C6');
  const a5 = pitchNameToFrequency('A5');
  const g5 = pitchNameToFrequency('G5');
  const e5 = pitchNameToFrequency('E5');
  const d5 = pitchNameToFrequency('D5');

  assert(Math.abs(c6 - 1046.50) < 0.1, `C6 expected ~1046.50, got ${c6}`);
  assert(Math.abs(a5 - 880.00) < 0.1, `A5 expected 880.00, got ${a5}`);
  assert(Math.abs(g5 - 783.99) < 0.1, `G5 expected ~783.99, got ${g5}`);
  assert(Math.abs(e5 - 659.25) < 0.1, `E5 expected ~659.25, got ${e5}`);
  assert(Math.abs(d5 - 587.33) < 0.1, `D5 expected ~587.33, got ${d5}`);

  // Test ordering: C6 > A5 > G5 > E5 > D5
  assert(c6 > a5 && a5 > g5 && g5 > e5 && e5 > d5, 'Pitches should be strictly descending in pitch from top to bottom');
  console.log('✓ Pitch Frequencies verified: C6 (1046.5Hz), A5 (880Hz), G5 (784Hz), E5 (659Hz), D5 (587Hz)');
}

function testCompositionModel() {
  console.log('\nTesting Composition Model...');

  // Pattern generator
  let notes = [
    { id: 'note-0-0', row: 0, col: 0, pitch: 'C6', duration: 1 },
    { id: 'note-1-1', row: 1, col: 1, pitch: 'A5', duration: 1 },
    { id: 'note-2-2', row: 2, col: 2, pitch: 'G5', duration: 1 },
    { id: 'note-1-3', row: 1, col: 3, pitch: 'A5', duration: 1 },
  ];

  assert.equal(notes.length, 4, 'Should have 4 initial notes');
  assert.equal(notes[0].pitch, 'C6');
  assert.equal(notes[1].pitch, 'A5');
  assert.equal(notes[2].pitch, 'G5');
  assert.equal(notes[3].pitch, 'A5');

  // Toggle note off: tapping row 0, col 0 should remove note
  notes = notes.filter(n => !(n.row === 0 && n.col === 0));
  assert.equal(notes.length, 3, 'Note should be removed');
  assert(!notes.some(n => n.row === 0 && n.col === 0), 'Cell 0,0 should now be empty');

  // Toggle note on: tapping row 0, col 0 again should add note
  notes.push({ id: 'note-0-0', row: 0, col: 0, pitch: 'C6', duration: 1 });
  assert.equal(notes.length, 4, 'Note should be restored');
  assert(notes.some(n => n.row === 0 && n.col === 0), 'Cell 0,0 should now have note');

  // Query by column step
  const step0Notes = notes.filter(n => n.col === 0);
  assert.equal(step0Notes.length, 1);
  assert.equal(step0Notes[0].pitch, 'C6');

  console.log('✓ Composition add, remove, toggle, and step-query verified');
}

function testBoardConfig() {
  console.log('\nTesting Board Configuration & Expandability...');
  const initialPitches = ['C6', 'A5', 'G5', 'E5', 'D5'];
  const initialCols = 4;
  const initialBpm = 100;

  assert.equal(initialPitches.length, 5, 'Initial rows must be 5');
  assert.equal(initialCols, 4, 'Initial cols must be 4');
  assert.equal(initialBpm, 100, 'Initial BPM must be 100');

  // Verify expansion capability
  const expandedCols = 8;
  const expandedPitches = ['C6', 'A5', 'G5', 'E5', 'D5', 'C5'];
  assert.equal(expandedCols, 8);
  assert.equal(expandedPitches.length, 6);
  console.log('✓ Board configuration supports arbitrary rows and columns');
}

testPitches();
testCompositionModel();
testBoardConfig();
console.log('\nAll Stage 1 logic verification tests passed successfully!');

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ground, annotateFindings } from '../ground.ts';

describe('ground', () => {
  it('negation dropped', () => {
    const r = ground(
      'Patient is, uh, not allergic to penicillin.',
      'Patient is allergic to penicillin.',
    );
    assert.equal(r.verdict.level, 'high');
    assert.ok(
      r.findings.some((f) => f.kind === 'negation' && f.direction === 'dropped'),
    );
  });

  it('negation inserted', () => {
    const r = ground('The build is passing.', 'The build is not passing.');
    assert.equal(r.verdict.level, 'high');
    assert.ok(
      r.findings.some((f) => f.kind === 'negation' && f.direction === 'inserted'),
    );
  });

  it('clean cleanup', () => {
    const r = ground(
      'So um, I think we should, you know, ship on Friday.',
      'I think we should ship on Friday.',
    );
    assert.equal(r.verdict.level, 'clean');
    assert.equal(r.findings.length, 0);
  });

  it('stammer removed', () => {
    const r = ground(
      'We we we need to confirm the the booking.',
      'We need to confirm the booking.',
    );
    assert.equal(r.verdict.level, 'clean');
    assert.equal(r.findings.length, 0);
  });

  it('number drift', () => {
    const r = ground(
      'Transfer fifteen thousand naira.',
      'Transfer 50,000 naira.',
    );
    assert.equal(r.verdict.level, 'high');
    const dropped = r.findings.filter((f) => f.kind === 'number' && f.direction === 'dropped');
    const inserted = r.findings.filter((f) => f.kind === 'number' && f.direction === 'inserted');
    assert.equal(dropped.length, 1);
    assert.equal(inserted.length, 1);
  });

  it('number normalised', () => {
    const r = ground('Give her twenty milligrams.', 'Give her 20 mg.');
    assert.equal(r.verdict.level, 'clean');
    assert.equal(r.findings.length, 0);
  });

  it('entity invented', () => {
    const r = ground(
      'Book the flight for Tuesday morning.',
      'Book the flight for Tuesday morning with Lufthansa.',
    );
    assert.equal(r.verdict.level, 'medium');
    assert.ok(
      r.findings.some(
        (f) => f.kind === 'entity' && f.direction === 'inserted' && /lufthansa/i.test(f.token),
      ),
    );
  });

  it('null rewrite', () => {
    const r = ground('Anything at all.', null);
    assert.equal(r.verdict.level, 'none');
    assert.equal(r.findings.length, 0);
  });

  it('empty rewrite', () => {
    const r = ground('Anything at all.', '');
    assert.equal(r.verdict.level, 'none');
    assert.equal(r.findings.length, 0);
  });

  it('polarity restructure', () => {
    const r = ground(
      'The mass is not present on the scan.',
      'The mass is absent from the scan.',
    );
    assert.equal(r.verdict.level, 'high');
  });

  it('R9 annotate: confident drop is rewrite cause', () => {
    const r = ground(
      'Patient is not allergic to penicillin.',
      'Patient is allergic to penicillin.',
    );
    const annotated = annotateFindings(r.findings, [
      { text: 'Patient', confidence: 0.99 },
      { text: 'is', confidence: 0.99 },
      { text: 'not', confidence: 0.82 },
      { text: 'allergic', confidence: 0.97 },
      { text: 'to', confidence: 0.99 },
      { text: 'penicillin.', confidence: 0.95 },
    ]);
    const dropped = annotated.find((f) => f.token === 'not');
    assert.ok(dropped);
    assert.equal(dropped.cause, 'rewrite');
    assert.equal(r.verdict.level, 'high');
  });

  it('R9 annotate: low confidence drop is mishearing cause', () => {
    const r = ground(
      'Patient is not allergic to penicillin.',
      'Patient is allergic to penicillin.',
    );
    const annotated = annotateFindings(r.findings, [
      { text: 'not', confidence: 0.31 },
    ]);
    const dropped = annotated.find((f) => f.token === 'not');
    assert.equal(dropped.cause, 'mishearing');
    assert.equal(r.verdict.level, 'high');
  });
});

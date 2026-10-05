import { describe, it, expect } from 'vitest';
import {
  defaultDeck,
  addSlide,
  duplicateSlide,
  removeSlide,
  moveSlide,
  toggleSlide,
  updateSlide,
  patchSlideData,
  normalizeDeck,
} from './deck';

describe('brief deck ops', () => {
  it('starts with cover, scale and notice', () => {
    const d = defaultDeck();
    expect(d.slides.map((s) => s.kind)).toEqual(['cover', 'scale', 'notice']);
    expect(d.slides.every((s) => s.enabled)).toBe(true);
  });

  it('adds, duplicates, moves, toggles and removes slides', () => {
    let d = defaultDeck();
    d = addSlide(d, 'qa');
    expect(d.slides).toHaveLength(4);
    const qaId = d.slides[3].id;
    d = duplicateSlide(d, qaId);
    expect(d.slides).toHaveLength(5);
    expect(d.slides[4].title).toMatch(/cópia/);
    d = moveSlide(d, qaId, -1);
    expect(d.slides[2].id).toBe(qaId);
    d = toggleSlide(d, qaId);
    expect(d.slides.find((s) => s.id === qaId)?.enabled).toBe(false);
    d = removeSlide(d, qaId);
    expect(d.slides).toHaveLength(4);
  });

  it('never leaves zero slides or zero enabled slides', () => {
    let d = defaultDeck();
    const ids = d.slides.map((s) => s.id);
    d = removeSlide(d, ids[0]);
    d = removeSlide(d, ids[1]);
    d = removeSlide(d, ids[2]);
    expect(d.slides).toHaveLength(1);
    expect(toggleSlide(d, d.slides[0].id).slides[0].enabled).toBe(true);
  });

  it('patches slide and data without touching id', () => {
    let d = defaultDeck();
    const id = d.slides[0].id;
    d = updateSlide(d, id, { title: 'Abertura', id: 'hacked' } as any);
    expect(d.slides[0].title).toBe('Abertura');
    expect(d.slides[0].id).toBe(id);
    d = patchSlideData(d, id, { quote: 'Vamos!' });
    expect(d.slides[0].data.quote).toBe('Vamos!');
  });

  it('normalizes garbage and unknown kinds', () => {
    expect(normalizeDeck(null)).toBeNull();
    expect(normalizeDeck({ slides: [] })).toBeNull();
    const d = normalizeDeck({ slides: [{ id: 'x', kind: 'nope', enabled: false }] });
    expect(d?.slides[0].kind).toBe('blank');
    expect(d?.slides[0].enabled).toBe(true);
  });
});
